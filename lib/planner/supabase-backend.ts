import type { SupabaseClient } from "@supabase/supabase-js";

import type { PlannerBackend } from "./backend.ts";
import { makeSession, normalizeDays } from "./logic.ts";
import type { Assignment, ChangeEntry, ChangeKind, Child, ChildNote, DayKey, Group, Member, NoteKind, NotifyMode, PersistOp, PlannerSnapshot, Reassignment, Role, Session, SessionStatus, Teacher, Template, WeekDays } from "./types.ts";

type Row = Record<string, unknown>;

const TABLES = ["teams", "team_members", "teachers", "groups", "children", "child_notes", "changes", "templates", "weeks", "sessions"] as const;

const toTeacher = (r: Row): Teacher => ({
  id: String(r.id), name: String(r.name), initials: String(r.initials), color: String(r.color),
  active: Boolean(r.active), sortOrder: Number(r.sort_order ?? 0),
});
const toChild = (r: Row): Child => ({
  id: String(r.id), firstName: String(r.first_name ?? ""), lastName: String(r.last_name ?? ""), short: String(r.short ?? ""),
  groupId: (r.group_id as string | null) ?? null, active: r.active !== false, sortOrder: Number(r.sort_order ?? 0),
});
const toChildNote = (r: Row): ChildNote => ({
  id: String(r.id), childId: String(r.child_id), kind: (r.kind as NoteKind) ?? "info", note: String(r.note ?? ""),
  notedOn: String(r.noted_on), authorId: (r.author_id as string | null) ?? null,
});
const toChange = (r: Row): ChangeEntry => ({
  id: String(r.id), weekStart: (r.week_start as string | null) ?? null, sessionId: (r.session_id as string | null) ?? null,
  kind: r.kind as ChangeKind, importance: r.importance === "major" ? "major" : "minor", summary: String(r.summary ?? ""),
  authorId: (r.author_id as string | null) ?? null, authorName: String(r.author_name ?? ""), createdAt: String(r.created_at),
});
const toGroup = (r: Row): Group => ({
  id: String(r.id), name: String(r.name), short: String(r.short ?? ""), color: String(r.color),
  children: String(r.children ?? ""), sortOrder: Number(r.sort_order ?? 0),
});
const toTemplate = (r: Row): Template => ({
  id: String(r.id), name: String(r.name), sortOrder: Number(r.sort_order ?? 0),
  days: r.days && typeof r.days === "object" && Object.keys(r.days as object).length ? (r.days as Template["days"]) : null,
});
const toMember = (r: Row): Member => ({
  userId: String(r.user_id), displayName: String(r.display_name ?? ""), role: r.role as Role,
  teacherId: (r.teacher_id as string | null) ?? null,
  notify: (["none", "instant", "daily"].includes(String(r.notify)) ? String(r.notify) : "none") as NotifyMode,
});
const toSession = (r: Row): Session => ({
  id: String(r.id), weekStart: (r.week_start as string | null) ?? null, templateId: (r.template_id as string | null) ?? null,
  day: r.day as DayKey, slot: Number(r.slot), title: String(r.title ?? ""), focus: String(r.focus ?? ""),
  room: String(r.room ?? ""), notes: String(r.notes ?? ""), homework: String(r.homework ?? ""), nextTime: String(r.next_time ?? ""), children: String(r.children ?? ""),
  wholeClass: Boolean(r.whole_class), status: r.status as SessionStatus,
  assignments: Array.isArray(r.assignments) ? (r.assignments as Assignment[]) : [],
  reassignments: Array.isArray(r.reassignments) ? (r.reassignments as Reassignment[]) : [],
});

export function sessionToRow(s: Session, teamId: string): Row {
  return {
    id: s.id, team_id: teamId, week_start: s.weekStart, template_id: s.templateId, day: s.day, slot: s.slot,
    title: s.title.slice(0, 120), focus: s.focus.slice(0, 200), room: s.room.slice(0, 80), notes: s.notes.slice(0, 4000),
    homework: s.homework.slice(0, 2000), next_time: s.nextTime.slice(0, 2000),
    children: s.children.slice(0, 1000), whole_class: s.wholeClass, status: s.status, assignments: s.assignments, reassignments: s.reassignments ?? [],
  };
}

const PATCHABLE: Partial<Record<keyof Session, string>> = {
  title: "title", focus: "focus", room: "room", notes: "notes", homework: "homework", nextTime: "next_time", children: "children",
  wholeClass: "whole_class", status: "status", assignments: "assignments", reassignments: "reassignments", day: "day", slot: "slot",
};

/** Nur die geänderten Felder als Spalten (mit denselben Längenbegrenzungen wie beim Einfügen). */
export function sessionPatchToRow(patch: Partial<Session>): Row {
  const full = sessionToRow({ ...makeSession({ day: "mo", slot: 0 }), ...patch }, "");
  const row: Row = {};
  for (const [key, column] of Object.entries(PATCHABLE)) if (key in patch) row[column as string] = full[column as string];
  return row;
}

/** Nur die Position einer Lektion (für Upserts beim Verschieben). */
export function sessionPositionRow(s: Session, teamId: string): Row {
  return { id: s.id, team_id: teamId, week_start: s.weekStart, template_id: s.templateId, day: s.day, slot: s.slot };
}

function check<T extends { error: { message: string } | null }>(result: T): T {
  if (result.error) throw new Error(translateError(result.error.message));
  return result;
}

export function translateError(message: string): string {
  if (/row-level security|permission denied/i.test(message)) return "Dafür fehlen die Berechtigungen (nur Koordination).";
  if (/exclusion constraint|session_week_slot_unique|session_template_slot_unique/i.test(message)) return "Dieser Platz wurde gerade von jemand anderem belegt. Der Plan wurde aktualisiert.";
  if (/mindestens eine Koordination/i.test(message)) return "Das Team braucht mindestens eine Koordination.";
  if (/paused|project is not active|inactive/i.test(message)) return "Der Team-Server ist pausiert (Gratis-Plan nach längerer Nichtnutzung). Die Koordination kann ihn im Supabase-Dashboard mit einem Klick wieder starten – danach hier „Erneut versuchen“.";
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) return "Keine Verbindung. Bitte Internet prüfen. Falls das Internet geht: Der Team-Server könnte pausiert sein (Gratis-Plan) – die Koordination startet ihn im Supabase-Dashboard mit einem Klick.";
  if (/Woche nicht gefunden/i.test(message)) return "Diese Woche wurde inzwischen entfernt. Der Plan wurde aktualisiert.";
  if (/JSON object requested|0 rows/i.test(message)) return "Kein Zugriff auf dieses Team (mehr). Bitte neu anmelden oder die Koordination fragen.";
  if (/Could not find the function/i.test(message)) return "Die Datenbank ist nicht auf dem aktuellen Stand (Migration fehlt).";
  return message;
}

export async function listMemberships(client: SupabaseClient, userId: string): Promise<{ teamId: string; teamName: string; role: Role }[]> {
  const { data } = check(await client.from("team_members").select("team_id, role, teams(name)").eq("user_id", userId));
  return (data ?? []).map((r: Row) => {
    const team = r.teams as { name?: string } | { name?: string }[] | null;
    const name = Array.isArray(team) ? team[0]?.name : team?.name;
    return { teamId: String(r.team_id), teamName: name ?? "Team", role: r.role as Role };
  });
}

export async function createTeam(client: SupabaseClient, name: string, displayName: string): Promise<string> {
  const { data } = check(await client.rpc("create_team", { p_name: name, p_display_name: displayName }));
  return String(data);
}

/**
 * Legt den Startinhalt (Stundenplan Kastanie) für ein frisch gegründetes Team an.
 * Die Gründerin/der Gründer wird per Vorname einer Stundenplan-Lehrperson zugeordnet.
 * Wiederholbar: Ist der Inhalt schon vollständig da, passiert nichts; Reste eines
 * abgebrochenen Versuchs (Gruppen/Vorlagen ohne Lektionen) werden ersetzt.
 */
export async function seedStarterContent(
  client: SupabaseClient,
  teamId: string,
  build: (existing: Teacher[]) => { teachers: Teacher[]; groups: Group[]; templates: Template[]; sessions: Session[] },
): Promise<void> {
  const { count } = check(await client.from("sessions").select("id", { count: "exact", head: true }).eq("team_id", teamId).not("template_id", "is", null));
  if ((count ?? 0) > 0) return;
  check(await client.from("templates").delete().eq("team_id", teamId));
  check(await client.from("groups").delete().eq("team_id", teamId));
  const { data: existingRows } = check(await client.from("teachers").select("*").eq("team_id", teamId));
  const existing = (existingRows ?? []).map(toTeacher);
  const content = build(existing);
  if (content.teachers.length) {
    check(await client.from("teachers").insert(content.teachers.map((t) => ({
      id: t.id, team_id: teamId, name: t.name, initials: t.initials, color: t.color, active: t.active, sort_order: t.sortOrder,
    }))));
  }
  check(await client.from("groups").insert(content.groups.map((g) => ({
    id: g.id, team_id: teamId, name: g.name, short: g.short, color: g.color, children: g.children, sort_order: g.sortOrder,
  }))));
  check(await client.from("templates").insert(content.templates.map((t) => ({
    id: t.id, team_id: teamId, name: t.name, sort_order: t.sortOrder, days: t.days ?? {},
  }))));
  check(await client.from("sessions").insert(content.sessions.map((s) => sessionToRow(s, teamId))));
}

export async function joinTeam(client: SupabaseClient, code: string, displayName: string): Promise<string> {
  const { data } = check(await client.rpc("join_team", { p_code: code.trim(), p_display_name: displayName }));
  return String(data);
}

export function createSupabaseBackend(client: SupabaseClient, teamId: string): PlannerBackend {
  const backend: PlannerBackend = {
    kind: "supabase",
    async load() {
      const since = new Date(Date.now() - 14 * 86400000).toISOString();
      const [team, members, teachers, groups, children, childNotes, changes, templates, weeks, sessions] = await Promise.all([
        client.from("teams").select("id, name, join_code").eq("id", teamId).single(),
        client.from("team_members").select("user_id, display_name, role, teacher_id, notify").eq("team_id", teamId),
        client.from("teachers").select("*").eq("team_id", teamId).order("sort_order").order("created_at"),
        client.from("groups").select("*").eq("team_id", teamId).order("sort_order").order("created_at"),
        client.from("children").select("*").eq("team_id", teamId).order("sort_order").order("last_name").order("first_name"),
        client.from("child_notes").select("*").eq("team_id", teamId).order("noted_on", { ascending: false }).order("created_at", { ascending: false }),
        client.from("changes").select("*").eq("team_id", teamId).gte("created_at", since).order("created_at", { ascending: false }).limit(400),
        client.from("templates").select("*").eq("team_id", teamId).order("sort_order").order("created_at"),
        client.from("weeks").select("week_start, days").eq("team_id", teamId),
        client.from("sessions").select("*").eq("team_id", teamId),
      ]);
      [team, members, teachers, groups, children, childNotes, changes, templates, weeks, sessions].forEach(check);
      const teacherList = (teachers.data ?? []).map(toTeacher);
      const weekMap: Record<string, WeekDays> = {};
      for (const w of weeks.data ?? []) weekMap[String(w.week_start)] = normalizeDays(w.days, teacherList);
      const t = team.data as Row;
      const snapshot: PlannerSnapshot = {
        team: { id: String(t.id), name: String(t.name), joinCode: String(t.join_code) },
        members: (members.data ?? []).map(toMember),
        teachers: teacherList,
        groups: (groups.data ?? []).map(toGroup),
        children: (children.data ?? []).map(toChild),
        childNotes: (childNotes.data ?? []).map(toChildNote),
        changes: (changes.data ?? []).map(toChange),
        templates: (templates.data ?? []).map(toTemplate),
        sessions: (sessions.data ?? []).map(toSession),
        weeks: weekMap,
      };
      return snapshot;
    },

    async persist(op: PersistOp) {
      switch (op.type) {
        case "upsertSessions":
          if (op.rows.length) check(await client.from("sessions").upsert(op.rows.map((s) => sessionToRow(s, teamId))));
          return;
        case "patchSession": {
          const row = sessionPatchToRow(op.patch);
          if (Object.keys(row).length) check(await client.from("sessions").update(row).eq("id", op.id));
          return;
        }
        case "moveSessions":
          // Teil-Upsert: PostgREST aktualisiert nur die mitgeschickten Spalten, in einer Transaktion
          if (op.rows.length) check(await client.from("sessions").upsert(op.rows.map((s) => sessionPositionRow(s, teamId))));
          return;
        case "deleteSessions":
          if (op.ids.length) check(await client.from("sessions").delete().in("id", op.ids));
          return;
        case "createWeek":
          check(await client.from("weeks").upsert(
            { team_id: teamId, week_start: op.weekStart, days: op.days },
            { onConflict: "team_id,week_start", ignoreDuplicates: true },
          ));
          return;
        case "patchWeekDay":
          check(await client.rpc("patch_week_day", { p_team: teamId, p_week: op.weekStart, p_day: op.day, p_patch: op.patch }));
          return;
        case "upsertGroups":
          check(await client.from("groups").upsert(op.rows.map((g) => ({
            id: g.id, team_id: teamId, name: g.name.slice(0, 80) || "Gruppe", short: g.short, color: g.color, children: g.children, sort_order: g.sortOrder,
          }))));
          return;
        case "deleteGroup":
          check(await client.from("groups").delete().eq("id", op.id));
          return;
        case "upsertChildren":
          check(await client.from("children").upsert(op.rows.map((c) => ({
            id: c.id, team_id: teamId, first_name: c.firstName.slice(0, 80), last_name: c.lastName.slice(0, 80), short: c.short.slice(0, 6) || "?",
            group_id: c.groupId, active: c.active, sort_order: c.sortOrder,
          }))));
          return;
        case "deleteChildren":
          if (op.ids.length) check(await client.from("children").delete().in("id", op.ids));
          return;
        case "upsertChildNotes":
          check(await client.from("child_notes").upsert(op.rows.map((n) => ({
            id: n.id, team_id: teamId, child_id: n.childId, kind: n.kind, note: n.note.slice(0, 1000), noted_on: n.notedOn, author_id: n.authorId,
          }))));
          return;
        case "deleteChildNotes":
          if (op.ids.length) check(await client.from("child_notes").delete().in("id", op.ids));
          return;
        case "upsertChanges":
          check(await client.from("changes").upsert(op.rows.map((c) => ({
            id: c.id, team_id: teamId, week_start: c.weekStart, session_id: c.sessionId, kind: c.kind, importance: c.importance,
            summary: c.summary.slice(0, 300), author_id: c.authorId, author_name: c.authorName.slice(0, 120), created_at: c.createdAt,
          }))));
          if (op.notify) {
            // E-Mail-Benachrichtigung anstossen; Fehler (z. B. Funktion nicht eingerichtet) bremsen die App nicht
            for (const c of op.rows.filter((x) => x.importance === "major")) {
              client.functions.invoke("notify-changes", { body: { changeId: c.id } }).catch(() => undefined);
            }
          }
          return;
        case "setNotify":
          check(await client.rpc("set_notify", { p_team: teamId, p_value: op.value }));
          return;
        case "upsertTeachers":
          check(await client.from("teachers").upsert(op.rows.map((t) => ({
            id: t.id, team_id: teamId, name: t.name.slice(0, 120) || "Lehrperson", initials: (t.initials || "?").slice(0, 4),
            color: t.color, active: t.active, sort_order: t.sortOrder,
          }))));
          return;
        case "upsertTemplates":
          check(await client.from("templates").upsert(op.rows.map((t) => ({ id: t.id, team_id: teamId, name: t.name.slice(0, 80) || "Vorlage", sort_order: t.sortOrder, days: t.days ?? {} }))));
          return;
        case "updateTeam":
          check(await client.from("teams").update({ name: op.name.slice(0, 120) || "Team" }).eq("id", teamId));
          return;
        case "updateMember": {
          const patch: Row = {};
          if (op.patch.role) patch.role = op.patch.role;
          if ("teacherId" in op.patch) patch.teacher_id = op.patch.teacherId;
          check(await client.from("team_members").update(patch).eq("team_id", teamId).eq("user_id", op.userId));
          return;
        }
        case "removeMember":
          check(await client.from("team_members").delete().eq("team_id", teamId).eq("user_id", op.userId));
          return;
      }
    },

    async testMail() {
      const { data, error } = await client.functions.invoke("notify-changes", { body: { mode: "test" } });
      if (error) {
        // Fehlermeldung der Funktion lesen (FunctionsHttpError trägt die Antwort)
        const ctx = (error as { context?: Response }).context;
        try { const body = ctx ? await ctx.json() : null; if (body?.error) return `Fehler: ${body.error}`; } catch { /* keine JSON-Antwort */ }
        return "Fehler: Die Mail-Funktion ist nicht erreichbar.";
      }
      return data?.sent ? `Test-Mail an ${data.to} verschickt – bitte Posteingang (und Spam) prüfen.` : `Fehler: ${data?.error ?? "unbekannt"}`;
    },

    subscribe({ onRemoteChange, onPresence, knowsId }, viewer) {
      const channel = client.channel(`wochenatelier:${teamId}`, { config: { presence: { key: viewer.userId } } });
      for (const table of TABLES) {
        const filter = table === "teams" ? `id=eq.${teamId}` : `team_id=eq.${teamId}`;
        channel.on("postgres_changes", { event: "INSERT", schema: "public", table, filter }, () => onRemoteChange());
        channel.on("postgres_changes", { event: "UPDATE", schema: "public", table, filter }, () => onRemoteChange());
        if (table === "teams") continue;
        // Löschereignisse lassen sich in Supabase Realtime nicht filtern und enthalten nur den
        // Primärschlüssel – daher ungefiltert abonnieren und die Relevanz hier prüfen.
        channel.on("postgres_changes", { event: "DELETE", schema: "public", table }, (payload) => {
          const old = (payload.old ?? {}) as Row;
          if (old.team_id === teamId || (typeof old.id === "string" && knowsId?.(old.id))) onRemoteChange();
        });
      }
      channel.on("presence", { event: "sync" }, () => onPresence(Object.keys(channel.presenceState())));
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({ name: viewer.displayName, online_at: new Date().toISOString() });
          onRemoteChange(); // nach (Wieder-)Verbindung Stand abgleichen
        }
      });
      return () => { void client.removeChannel(channel); };
    },

    async regenerateJoinCode() {
      const { data } = check(await client.rpc("regenerate_join_code", { p_team: teamId }));
      return String(data);
    },
  };
  return backend;
}
