import type { SupabaseClient } from "@supabase/supabase-js";

import type { PlannerBackend } from "./backend.ts";
import { makeSession, normalizeDays } from "./logic.ts";
import type { Assignment, DayKey, Group, Member, PersistOp, PlannerSnapshot, Role, Session, SessionStatus, Teacher, Template, WeekDays } from "./types.ts";

type Row = Record<string, unknown>;

const TABLES = ["teams", "team_members", "teachers", "groups", "templates", "weeks", "sessions"] as const;

const toTeacher = (r: Row): Teacher => ({
  id: String(r.id), name: String(r.name), initials: String(r.initials), color: String(r.color),
  active: Boolean(r.active), sortOrder: Number(r.sort_order ?? 0),
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
});
const toSession = (r: Row): Session => ({
  id: String(r.id), weekStart: (r.week_start as string | null) ?? null, templateId: (r.template_id as string | null) ?? null,
  day: r.day as DayKey, slot: Number(r.slot), title: String(r.title ?? ""), focus: String(r.focus ?? ""),
  room: String(r.room ?? ""), notes: String(r.notes ?? ""), homework: String(r.homework ?? ""), nextTime: String(r.next_time ?? ""), children: String(r.children ?? ""),
  wholeClass: Boolean(r.whole_class), status: r.status as SessionStatus,
  assignments: Array.isArray(r.assignments) ? (r.assignments as Assignment[]) : [],
});

export function sessionToRow(s: Session, teamId: string): Row {
  return {
    id: s.id, team_id: teamId, week_start: s.weekStart, template_id: s.templateId, day: s.day, slot: s.slot,
    title: s.title.slice(0, 120), focus: s.focus.slice(0, 200), room: s.room.slice(0, 80), notes: s.notes.slice(0, 4000),
    homework: s.homework.slice(0, 2000), next_time: s.nextTime.slice(0, 2000),
    children: s.children.slice(0, 1000), whole_class: s.wholeClass, status: s.status, assignments: s.assignments,
  };
}

const PATCHABLE: Partial<Record<keyof Session, string>> = {
  title: "title", focus: "focus", room: "room", notes: "notes", homework: "homework", nextTime: "next_time", children: "children",
  wholeClass: "whole_class", status: "status", assignments: "assignments", day: "day", slot: "slot",
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
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) return "Keine Verbindung. Bitte Internet prüfen.";
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
      const [team, members, teachers, groups, templates, weeks, sessions] = await Promise.all([
        client.from("teams").select("id, name, join_code").eq("id", teamId).single(),
        client.from("team_members").select("user_id, display_name, role, teacher_id").eq("team_id", teamId),
        client.from("teachers").select("*").eq("team_id", teamId).order("sort_order").order("created_at"),
        client.from("groups").select("*").eq("team_id", teamId).order("sort_order").order("created_at"),
        client.from("templates").select("*").eq("team_id", teamId).order("sort_order").order("created_at"),
        client.from("weeks").select("week_start, days").eq("team_id", teamId),
        client.from("sessions").select("*").eq("team_id", teamId),
      ]);
      [team, members, teachers, groups, templates, weeks, sessions].forEach(check);
      const teacherList = (teachers.data ?? []).map(toTeacher);
      const weekMap: Record<string, WeekDays> = {};
      for (const w of weeks.data ?? []) weekMap[String(w.week_start)] = normalizeDays(w.days, teacherList);
      const t = team.data as Row;
      const snapshot: PlannerSnapshot = {
        team: { id: String(t.id), name: String(t.name), joinCode: String(t.join_code) },
        members: (members.data ?? []).map(toMember),
        teachers: teacherList,
        groups: (groups.data ?? []).map(toGroup),
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
