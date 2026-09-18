// Edge Function „notify-changes“: verschickt E-Mails zu wichtigen Änderungen über Resend.
//
// Aufrufe:
//   POST { changeId }                 – von der App direkt nach einer wichtigen Änderung (JWT der angemeldeten Person);
//                                       informiert Mitglieder mit Einstellung „sofort“ (ohne die verursachende Person).
//   POST { mode: "daily", secret }    – vom Zeitplan (GitHub Actions); tägliche Zusammenfassung für Mitglieder mit „täglich“.
//
// Secrets (Supabase-Dashboard → Edge Functions → Secrets):
//   RESEND_API_KEY   Pflicht – API-Key von resend.com
//   RESEND_FROM      optional, Standard "Wochenatelier <onboarding@resend.dev>" (eigene Domain nach DNS-Verifizierung)
//   APP_URL          optional, Standard https://kueni08.github.io/unterrichtsplanung-opfikon/
//   DIGEST_SECRET    Pflicht für die tägliche Zusammenfassung (derselbe Wert wie das GitHub-Secret)
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("RESEND_FROM") ?? "Wochenatelier <onboarding@resend.dev>";
const APP_URL = Deno.env.get("APP_URL") ?? "https://kueni08.github.io/unterrichtsplanung-opfikon/";
const DIGEST_SECRET = Deno.env.get("DIGEST_SECRET") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

type Change = { id: string; team_id: string; week_start: string | null; session_id: string | null; kind: string; importance: string; summary: string; author_id: string | null; author_name: string; created_at: string; notified_at: string | null };
type Member = { user_id: string; display_name: string; notify: string };

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const KIND: Record<string, string> = { added: "Neu", removed: "Entfernt", moved: "Verschoben", edited: "Bearbeitet", assigned: "Zuständigkeit", reassigned: "Umgeteilt", day: "Tag", group: "Gruppe", meeting: "Termin" };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const fmt = new Intl.DateTimeFormat("de-CH", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" });

async function emailOf(userId: string): Promise<string | null> {
  const { data } = await admin.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) { console.warn("RESEND_API_KEY fehlt – keine Mail verschickt"); return false; }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!res.ok) console.error("Resend:", res.status, await res.text());
  return res.ok;
}

function layout(teamName: string, title: string, body: string): string {
  return `<!doctype html><html lang="de"><body style="margin:0;padding:24px;background:#f4f7fb;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#17324d">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:22px 26px;border:1px solid #dbe5ed">
    <p style="margin:0 0 4px;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#6d8092;font-weight:700">Wochenatelier · ${esc(teamName)}</p>
    <h1 style="margin:0 0 14px;font-size:20px">${esc(title)}</h1>
    ${body}
    <p style="margin:18px 0 0"><a href="${APP_URL}" style="display:inline-block;padding:10px 16px;border-radius:9px;background:#0b4a7e;color:#fff;text-decoration:none;font-weight:700">Wochenplan öffnen</a></p>
    <p style="margin:18px 0 0;font-size:12px;color:#7a8b9d">Du erhältst diese Mail, weil du in Wochenatelier unter der Glocke „Was ist neu“ Benachrichtigungen eingeschaltet hast. Dort lassen sie sich jederzeit auf „nie“ stellen.</p>
  </div></body></html>`;
}

function line(c: Change): string {
  return `<li style="margin:0 0 8px"><span style="display:inline-block;padding:2px 7px;border-radius:99px;background:#e08a1e;color:#fff;font-size:11px;font-weight:700">${esc(KIND[c.kind] ?? c.kind)}</span> ${esc(c.summary)}<br><span style="font-size:12px;color:#7a8b9d">${esc(c.author_name || "jemand")} · ${fmt.format(new Date(c.created_at))}</span></li>`;
}

/** Sofort-Benachrichtigung für eine einzelne Änderung (Aufruf aus der App). */
async function notifyInstant(req: Request, changeId: string): Promise<Response> {
  const auth = req.headers.get("Authorization") ?? "";
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: userData } = await asUser.auth.getUser();
  const caller = userData.user;
  if (!caller) return json({ error: "nicht angemeldet" }, 401);

  // Die Änderung über die Rechte der aufrufenden Person laden (RLS: nur Teammitglieder sehen sie).
  const { data: change, error } = await asUser.from("changes").select("*").eq("id", changeId).maybeSingle<Change>();
  if (error || !change) return json({ error: "Änderung nicht gefunden" }, 404);
  if (change.author_id !== caller.id) return json({ error: "nur eigene Änderungen" }, 403);
  if (change.importance !== "major") return json({ skipped: "nicht wichtig" });
  if (change.notified_at) return json({ skipped: "bereits verschickt" });

  const { data: members } = await admin.from("team_members").select("user_id, display_name, notify").eq("team_id", change.team_id).eq("notify", "instant").neq("user_id", caller.id);
  const { data: team } = await admin.from("teams").select("name").eq("id", change.team_id).maybeSingle();
  const teamName = (team?.name as string) ?? "Team";
  let sent = 0;
  for (const m of (members ?? []) as Member[]) {
    const to = await emailOf(m.user_id);
    if (!to) continue;
    const ok = await sendMail(to, `[Wochenatelier] ${change.summary.slice(0, 90)}`, layout(teamName, "Wichtige Änderung im Wochenplan", `<ul style="padding-left:18px;margin:0">${line(change)}</ul>`));
    if (ok) sent += 1;
  }
  await admin.from("changes").update({ notified_at: new Date().toISOString() }).eq("id", change.id);
  return json({ sent });
}

/** Tägliche Zusammenfassung: wichtige Änderungen der letzten 24 Stunden je Team (Aufruf per Zeitplan). */
async function notifyDaily(secret: string): Promise<Response> {
  if (!DIGEST_SECRET || secret !== DIGEST_SECRET) return json({ error: "falsches Secret" }, 403);
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: members } = await admin.from("team_members").select("team_id, user_id, display_name, notify").eq("notify", "daily");
  const byTeam = new Map<string, Member[]>();
  for (const m of (members ?? []) as (Member & { team_id: string })[]) byTeam.set(m.team_id, [...(byTeam.get(m.team_id) ?? []), m]);
  let sent = 0;
  for (const [teamId, list] of byTeam) {
    const { data: changes } = await admin.from("changes").select("*").eq("team_id", teamId).eq("importance", "major").gte("created_at", since).order("created_at", { ascending: false }).limit(50);
    const { data: team } = await admin.from("teams").select("name").eq("id", teamId).maybeSingle();
    for (const m of list) {
      const mine = ((changes ?? []) as Change[]).filter((c) => c.author_id !== m.user_id);
      if (mine.length === 0) continue;
      const to = await emailOf(m.user_id);
      if (!to) continue;
      const ok = await sendMail(to, `[Wochenatelier] ${mine.length} wichtige Änderung${mine.length === 1 ? "" : "en"} heute`, layout((team?.name as string) ?? "Team", "Tägliche Zusammenfassung", `<ul style="padding-left:18px;margin:0">${mine.map(line).join("")}</ul>`));
      if (ok) sent += 1;
    }
  }
  return json({ sent });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST erwartet" }, 405);
  let body: { changeId?: string; mode?: string; secret?: string } = {};
  try { body = await req.json(); } catch { /* leer */ }
  try {
    if (body.mode === "daily") return await notifyDaily(body.secret ?? "");
    if (body.changeId) return await notifyInstant(req, body.changeId);
    return json({ error: "changeId oder mode fehlt" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
