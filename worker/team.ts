import { z } from "zod";
import { buildPushPayload } from "@block65/webcrypto-web-push";
import { plannerSchema, canChangeSettings, analyzeChildConflicts, type TeamUser } from "../shared/planner";
import { token, digest, hashPassword, verifyPassword, SESSION_DAYS } from "../shared/security";

interface Env { DB: D1Database; ASSETS: Fetcher; VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string; VAPID_SUBJECT?: string }
type DbUser = { id: string; username: string; name: string; role: "admin" | "teacher"; teacher_id: string; password_hash: string };
type Plan = { revision: number; data: string; updated_at: string; updated_by: string; operation_id: string };
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers } });
const publicUser = (u: DbUser): TeamUser => ({ id: u.id, username: u.username, name: u.name, role: u.role, teacherId: u.teacher_id });
function cookie(value: string, request: Request, maxAge = SESSION_DAYS * 86400) { return `wa_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`; }
async function currentUser(request: Request, env: Env) {
  const value = request.headers.get("cookie")?.match(/(?:^|;\s*)wa_session=([^;]+)/)?.[1];
  if (!value) return null;
  return env.DB.prepare("SELECT u.* FROM users u JOIN auth_sessions s ON s.user_id = u.id WHERE s.hash = ? AND s.expires > ? AND u.active = 1").bind(await digest(value), Date.now()).first<DbUser>();
}
async function body(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("JSON_REQUIRED");
  const value = await request.text();
  if (value.length > 1000000) throw new Error("TOO_LARGE");
  return JSON.parse(value);
}
async function notify(env: Env, author: string) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) return;
  const rows = await env.DB.prepare("SELECT p.* FROM push_subscriptions p JOIN users u ON u.id=p.user_id WHERE p.user_id != ? AND u.active=1 LIMIT 100").bind(author).all<{ endpoint: string; data: string }>();
  await Promise.allSettled(rows.results.map(async row => {
    const subscription = JSON.parse(row.data);
    const payload = await buildPushPayload({ data: "Plan aktualisiert", options: { ttl: 3600, urgency: "high" } }, subscription, { publicKey: env.VAPID_PUBLIC_KEY!, privateKey: env.VAPID_PRIVATE_KEY!, subject: env.VAPID_SUBJECT! });
    const response = await fetch(row.endpoint, { ...payload, signal: AbortSignal.timeout(10000) });
    if (response.status === 404 || response.status === 410) await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint=?").bind(row.endpoint).run();
    else if (!response.ok) console.error("Push delivery failed", response.status);
  }));
}
const credentials = z.object({ username: z.string().min(1).max(100).transform(v => v.trim().toLowerCase()), password: z.string().min(1).max(256) });
const subscriptionSchema = z.object({ endpoint: z.string().url().max(3000).refine(value => { const url = new URL(value); return url.protocol === "https:" && (url.hostname === "fcm.googleapis.com" || url.hostname.endsWith(".push.services.mozilla.com") || url.hostname === "updates.push.services.mozilla.com" || url.hostname.endsWith(".notify.windows.com") || url.hostname === "web.push.apple.com"); }), expirationTime: z.number().nullable().optional(), keys: z.object({ p256dh: z.string().regex(/^[\w-]+$/).max(200), auth: z.string().regex(/^[\w-]+$/).max(100) }) });

async function api(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== "GET" && request.headers.get("origin") !== url.origin) return json({ error: "Ungültiger Ursprung." }, 403);
  if (url.pathname === "/api/login" && request.method === "POST") {
    const input = credentials.parse(await body(request));
    // Account + source limits, shared across isolates, also apply to unknown accounts.
    const now = Date.now();
    const keys = [await digest(`account:${input.username}`), await digest(`ip:${request.headers.get("cf-connecting-ip") || "local"}`)];
    for (const [i, key] of keys.entries()) {
      await env.DB.prepare("INSERT INTO login_attempts(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires < ? THEN 1 ELSE count+1 END, expires=CASE WHEN expires < ? THEN excluded.expires ELSE expires END").bind(key, now + 60000, now, now).run();
      const row = await env.DB.prepare("SELECT count FROM login_attempts WHERE key=?").bind(key).first<{ count: number }>();
      if (row && row.count > (i === 0 ? 8 : 30)) return json({ error: "Zu viele Versuche. Bitte in einer Minute erneut anmelden." }, 429);
    }
    const user = await env.DB.prepare("SELECT * FROM users WHERE username=? AND active=1").bind(input.username).first<DbUser>();
    const valid = await verifyPassword(input.password, user?.password_hash || "invalid:invalid");
    if (!user || !valid) return json({ error: "Benutzername oder Passwort stimmt nicht." }, 401);
    const value = token();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO auth_sessions(hash,user_id,expires) VALUES(?,?,?)").bind(await digest(value), user.id, now + SESSION_DAYS * 86400000),
      env.DB.prepare("DELETE FROM auth_sessions WHERE expires < ?").bind(now),
      env.DB.prepare("DELETE FROM login_attempts WHERE expires < ?").bind(now),
    ]);
    return json({ user: publicUser(user) }, 200, { "Set-Cookie": cookie(value, request) });
  }
  const user = await currentUser(request, env);
  if (!user) return json({ error: "Bitte anmelden." }, 401);
  if (url.pathname === "/api/me" && request.method === "GET") return json({ user: publicUser(user), pushPublicKey: env.VAPID_PUBLIC_KEY || null });
  if (url.pathname === "/api/logout" && request.method === "POST") {
    const value = request.headers.get("cookie")?.match(/(?:^|;\s*)wa_session=([^;]+)/)?.[1];
    if (value) await env.DB.prepare("DELETE FROM auth_sessions WHERE hash=?").bind(await digest(value)).run();
    return json({ ok: true }, 200, { "Set-Cookie": cookie("", request, 0) });
  }
  if (url.pathname === "/api/password" && request.method === "POST") {
    const input = z.object({ current: z.string().max(256), password: z.string().min(12).max(256) }).parse(await body(request));
    if (!await verifyPassword(input.current, user.password_hash)) return json({ error: "Bisheriges Passwort stimmt nicht." }, 400);
    await env.DB.batch([env.DB.prepare("UPDATE users SET password_hash=? WHERE id=?").bind(await hashPassword(input.password), user.id), env.DB.prepare("DELETE FROM auth_sessions WHERE user_id=?").bind(user.id)]);
    return json({ ok: true }, 200, { "Set-Cookie": cookie("", request, 0) });
  }
  if (url.pathname === "/api/users") {
    if (user.role !== "admin") return json({ error: "Nur für die Koordination." }, 403);
    if (request.method === "GET") { const rows = await env.DB.prepare("SELECT id,username,name,role,teacher_id,active FROM users ORDER BY name").all(); return json(rows.results); }
    if (request.method === "POST") {
      const input = z.object({ username: z.string().regex(/^[a-z0-9._-]{3,60}$/), name: z.string().min(1).max(100), password: z.string().min(12).max(256), role: z.enum(["admin", "teacher"]), teacherId: z.string().min(1).max(100) }).parse(await body(request));
      if (await env.DB.prepare("SELECT id FROM users WHERE username=?").bind(input.username).first()) return json({ error: "Benutzername bereits vergeben." }, 409);
      await env.DB.prepare("INSERT INTO users(id,username,name,password_hash,role,teacher_id) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(), input.username, input.name, await hashPassword(input.password), input.role, input.teacherId).run();
      return json({ ok: true });
    }
    if (request.method === "PATCH") {
      const input = z.object({ id: z.string(), active: z.boolean() }).parse(await body(request));
      if (input.id === user.id) return json({ error: "Das eigene Konto kann hier nicht deaktiviert werden." }, 400);
      await env.DB.batch([env.DB.prepare("UPDATE users SET active=? WHERE id=?").bind(Number(input.active), input.id), env.DB.prepare("DELETE FROM auth_sessions WHERE user_id=?").bind(input.id), env.DB.prepare("DELETE FROM push_subscriptions WHERE user_id=?").bind(input.id)]);
      return json({ ok: true });
    }
  }
  if (url.pathname === "/api/plan" && request.method === "GET") {
    const plan = await env.DB.prepare("SELECT * FROM plans WHERE id=1").first<Plan>();
    if (!plan) return json({ revision: 0, data: null });
    const since = Number(url.searchParams.get("since") || 0);
    const important = await env.DB.prepare("SELECT revision FROM changes WHERE revision > ? AND urgent=1 AND user_id != ? LIMIT 1").bind(since, user.id).first();
    const planData = JSON.parse(plan.data);
    return json({ revision: plan.revision, data: plan.revision === since ? undefined : planData, updatedAt: plan.updated_at, updatedBy: plan.updated_by, important: !!important, conflicts: analyzeChildConflicts(planData) });
  }
  if (url.pathname === "/api/plan" && request.method === "PUT") {
    const input = z.object({ revision: z.number().int().nonnegative(), operationId: z.string().uuid(), urgent: z.boolean(), data: plannerSchema }).parse(await body(request));
    const previousOperation = await env.DB.prepare("SELECT revision FROM changes WHERE operation_id=? AND user_id=?").bind(input.operationId, user.id).first<{ revision: number }>();
    if (previousOperation) return json({ revision: previousOperation.revision });
    const previous = await env.DB.prepare("SELECT * FROM plans WHERE id=1").first<Plan>();
    if (previous && previous.revision !== input.revision) return json({ error: "Der Teamplan wurde inzwischen geändert.", revision: previous.revision, data: JSON.parse(previous.data) }, 409);
    if (!previous && input.revision !== 0) return json({ error: "Plan bitte neu laden." }, 409);
    if (previous && !canChangeSettings(JSON.parse(previous.data), input.data, user.role)) return json({ error: "Gruppen, Lehrpersonen und Vorlagen verwaltet die Koordination." }, 403);
    if (!previous && user.role !== "admin") return json({ error: "Die Koordination muss zuerst einen Plan anlegen." }, 403);
    const now = new Date().toISOString();
    const write = previous
      ? env.DB.prepare("UPDATE plans SET data=?,revision=revision+1,updated_at=?,updated_by=?,operation_id=? WHERE id=1 AND revision=?").bind(JSON.stringify(input.data), now, user.name, input.operationId, input.revision)
      : env.DB.prepare("INSERT OR IGNORE INTO plans(id,revision,data,updated_at,updated_by,operation_id) VALUES(1,1,?,?,?,?)").bind(JSON.stringify(input.data), now, user.name, input.operationId);
    const result = await env.DB.batch([write, env.DB.prepare("INSERT OR IGNORE INTO changes(operation_id,revision,user_id,urgent,created_at) SELECT operation_id,revision,?,?,? FROM plans WHERE id=1 AND operation_id=?").bind(user.id, Number(input.urgent), now, input.operationId)]);
    if (!result[0].meta.changes) return json({ error: "Gleichzeitige Änderung erkannt. Bitte Teamstand laden." }, 409);
    if (input.urgent) ctx.waitUntil(notify(env, user.id).catch(() => console.error("Push temporarily unavailable")));
    return json({ revision: input.revision + 1, conflicts: analyzeChildConflicts(input.data) });
  }
  if (url.pathname === "/api/push" && request.method === "POST") {
    if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return json({ error: "Push ist noch nicht eingerichtet." }, 503);
    const sub = subscriptionSchema.parse(await body(request));
    await env.DB.prepare("INSERT INTO push_subscriptions(endpoint,user_id,data) VALUES(?,?,?) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,data=excluded.data").bind(sub.endpoint, user.id, JSON.stringify(sub)).run();
    return json({ ok: true });
  }
  if (url.pathname === "/api/push" && request.method === "DELETE") {
    const input = z.object({ endpoint: z.string().max(3000) }).parse(await body(request));
    await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint=? AND user_id=?").bind(input.endpoint, user.id).run(); return json({ ok: true });
  }
  return json({ error: "Nicht gefunden." }, 404);
}
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    if (!new URL(request.url).pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try { return await api(request, env, ctx); }
    catch (error) {
      if (error instanceof z.ZodError || error instanceof SyntaxError || (error instanceof Error && ["JSON_REQUIRED", "TOO_LARGE"].includes(error.message))) return json({ error: "Eingabe ungültig oder zu gross." }, 400);
      console.error("Team API request failed", error instanceof Error ? error.name : "Unknown");
      return json({ error: "Der Server ist vorübergehend nicht erreichbar. Änderungen bleiben auf diesem Gerät vorgemerkt." }, 503);
    }
  },
};
