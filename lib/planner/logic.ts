import { DAYS, SLOTS } from "./constants.ts";
import type { Assignment, DayKey, DayMeta, Group, Session, Teacher, Template, WeekDays } from "./types.ts";

export const newId = (): string => globalThis.crypto.randomUUID();

export function emptyDays(teachers: Teacher[]): WeekDays {
  const present = teachers.filter((t) => t.active).map((t) => t.id);
  return Object.fromEntries(DAYS.map((d) => [d.id, { attendance: [...present], note: "", meetings: [] }])) as unknown as WeekDays;
}

/** Ergänzt fehlende Tage/Felder (z. B. aus älteren Datenständen). */
export function normalizeDays(raw: unknown, teachers: Teacher[]): WeekDays {
  const base = emptyDays(teachers);
  const source = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<DayKey, Partial<DayMeta>>>;
  for (const day of DAYS) {
    const value = source[day.id];
    if (!value) continue;
    base[day.id] = {
      attendance: Array.isArray(value.attendance) ? value.attendance.filter((x): x is string => typeof x === "string") : base[day.id].attendance,
      note: typeof value.note === "string" ? value.note : "",
      meetings: Array.isArray(value.meetings)
        ? value.meetings.slice(0, 2).map((m) => ({ time: String(m?.time ?? ""), title: String(m?.title ?? "") }))
        : [],
    };
  }
  return base;
}

export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2);
  return letters.toUpperCase();
}

export function countChildren(groups: Group[]): number {
  return groups.reduce((sum, g) => sum + g.children.split(",").map((x) => x.trim()).filter(Boolean).length, 0);
}

export function sameContainer(a: Session, b: Session): boolean {
  return a.weekStart === b.weekStart && a.templateId === b.templateId;
}

export function sessionsIn(list: Session[], container: { weekStart?: string | null; templateId?: string | null }): Session[] {
  const weekStart = container.weekStart ?? null;
  const templateId = container.templateId ?? null;
  return list.filter((s) => s.weekStart === weekStart && s.templateId === templateId);
}

export function findFreeSlot(container: Session[], day: DayKey, from = 0): number {
  const occupied = new Set(container.filter((s) => s.day === day).map((s) => s.slot));
  for (let slot = from; slot < SLOTS.length; slot += 1) if (!occupied.has(slot)) return slot;
  return -1;
}

/**
 * Verschiebt einen Block innerhalb eines Containers (Woche oder Vorlage).
 * Belegte Plätze werden nach hinten bzw. vorne aufgeschoben.
 * Gibt nur die veränderten Blöcke zurück.
 */
export function reorderSessions(container: Session[], sessionId: string, targetDay: DayKey, requestedSlot: number): { changed: Session[]; moved: boolean } {
  const dragged = container.find((s) => s.id === sessionId);
  const targetSlot = Math.max(0, Math.min(SLOTS.length - 1, requestedSlot));
  if (!dragged || (dragged.day === targetDay && dragged.slot === targetSlot)) return { changed: [], moved: false };

  const rest = container.filter((s) => s.id !== sessionId);
  const shift = (predicate: (s: Session) => boolean, delta: number) =>
    rest.filter((s) => s.day === targetDay && predicate(s)).map((s) => ({ ...s, slot: s.slot + delta }));
  const placed = { ...dragged, day: targetDay, slot: targetSlot };

  if (dragged.day === targetDay) {
    const shifted = targetSlot > dragged.slot
      ? shift((s) => s.slot > dragged.slot && s.slot <= targetSlot, -1)
      : shift((s) => s.slot >= targetSlot && s.slot < dragged.slot, 1);
    return { changed: [...shifted, placed], moved: true };
  }

  const occupied = new Set(rest.filter((s) => s.day === targetDay).map((s) => s.slot));
  if (!occupied.has(targetSlot)) return { changed: [placed], moved: true };

  let freeAfter = -1;
  for (let i = targetSlot + 1; i < SLOTS.length; i += 1) if (!occupied.has(i)) { freeAfter = i; break; }
  if (freeAfter >= 0) return { changed: [...shift((s) => s.slot >= targetSlot && s.slot < freeAfter, 1), placed], moved: true };

  let freeBefore = -1;
  for (let i = targetSlot - 1; i >= 0; i -= 1) if (!occupied.has(i)) { freeBefore = i; break; }
  if (freeBefore >= 0) return { changed: [...shift((s) => s.slot > freeBefore && s.slot <= targetSlot, -1), placed], moved: true };

  return { changed: [], moved: false };
}

export function applyChanged(list: Session[], changed: Session[]): Session[] {
  const byId = new Map(changed.map((s) => [s.id, s]));
  const result = list.map((s) => byId.get(s.id) ?? s);
  for (const s of changed) if (!list.some((x) => x.id === s.id)) result.push(s);
  return result;
}

/** Nächster freier Platz nach dem Block – sonst in der Folgewoche (belegte Plätze werden übersprungen). */
export function carryForwardTarget(all: Session[], session: Session, nextWeekStart: string): { weekStart: string; day: DayKey; slot: number } | null {
  if (!session.weekStart) return null;
  const positions = DAYS.flatMap((d) => SLOTS.map((_, slot) => ({ day: d.id, slot })));
  const index = positions.findIndex((p) => p.day === session.day && p.slot === session.slot);
  const current = sessionsIn(all, { weekStart: session.weekStart });
  const isFree = (list: Session[], p: { day: DayKey; slot: number }) => !list.some((s) => s.day === p.day && s.slot === p.slot);
  const sameWeek = positions.slice(index + 1).find((p) => isFree(current, p));
  if (sameWeek) return { weekStart: session.weekStart, ...sameWeek };
  const next = sessionsIn(all, { weekStart: nextWeekStart });
  const nextWeek = positions.find((p) => isFree(next, p));
  return nextWeek ? { weekStart: nextWeekStart, ...nextWeek } : null;
}

export function continuationTitle(title: string): string {
  return title.includes("Fortsetzung") ? title : `${title} · Fortsetzung`;
}

export function isVisibleFor(session: Session, teacherId: string | "all"): boolean {
  return teacherId === "all" || session.wholeClass
    || session.assignments.some((a) => !a.off && (a.teacherId === teacherId || a.coTeacherId === teacherId));
}

/** Alle Lehrpersonen eines Blocks (ohne Duplikate, ohne freie Gruppen). */
export function sessionTeacherIds(session: Session): string[] {
  const ids = session.assignments.filter((a) => !a.off).flatMap((a) => [a.teacherId, a.coTeacherId ?? ""]);
  return [...new Set(ids.filter(Boolean))];
}

/** Titel aus den Fächern der Gruppen ableiten (z. B. „Englisch · Französisch“). */
export function deriveTitle(assignments: Assignment[], fallback: string): string {
  const subjects = [...new Set(assignments.filter((a) => !a.off && a.subject).map((a) => a.subject as string))];
  return subjects.length ? subjects.join(" · ") : fallback;
}

export function planningWarnings(sessions: Session[], groups: Group[], teachers: Teacher[]): string[] {
  const warnings: string[] = [];
  const active = new Set(teachers.filter((t) => t.active).map((t) => t.id));
  if (active.size < 3) warnings.push("Mindestens drei aktive Lehrpersonen sind vorgesehen.");
  for (const s of sessions) {
    if (s.wholeClass) continue;
    const relevant = groups
      .map((g) => s.assignments.find((a) => a.groupId === g.id) ?? { groupId: g.id, teacherId: "" })
      .filter((a) => !a.off);
    if (relevant.some((a) => !a.teacherId)) warnings.push(`${s.title}: Zuständigkeit noch offen.`);
    else if (relevant.some((a) => !active.has(a.teacherId) || (a.coTeacherId && !active.has(a.coTeacherId)))) warnings.push(`${s.title}: Eine zugeteilte Lehrperson ist nicht aktiv.`);
    // Dieselbe Lehrperson darf mehrere Gruppen nur führen, wenn diese dasselbe Fach gemeinsam haben
    const byTeacher = new Map<string, Set<string>>();
    for (const a of relevant) {
      if (!a.teacherId) continue;
      const key = `${a.subject ?? s.title}|${a.room ?? s.room}`;
      byTeacher.set(a.teacherId, (byTeacher.get(a.teacherId) ?? new Set()).add(key));
    }
    if ([...byTeacher.values()].some((set) => set.size > 1)) warnings.push(`${s.title}: Eine Lehrperson ist gleichzeitig mehreren Gruppen mit unterschiedlichem Unterricht zugeteilt.`);
  }
  return [...new Set(warnings)];
}

export function makeSession(partial: Partial<Session> & Pick<Session, "day" | "slot">): Session {
  return {
    id: newId(), weekStart: null, templateId: null, title: "Neue Lektion", focus: "", room: "", notes: "",
    children: "", wholeClass: false, status: "planned", assignments: [], ...partial,
  };
}

export function defaultAssignments(groups: Group[], teachers: Teacher[]): Assignment[] {
  const active = teachers.filter((t) => t.active);
  return groups.map((g, i) => ({ groupId: g.id, teacherId: active[i]?.id ?? "" }));
}

export function cloneTemplateToWeek(templateSessions: Session[], weekStart: string): Session[] {
  return templateSessions.map((s) => ({
    ...s, id: newId(), weekStart, templateId: null, status: "planned", notes: s.notes, assignments: s.assignments.map((a) => ({ ...a })),
  }));
}

export function setAssignment(assignments: Assignment[], groupId: string, patch: Partial<Assignment>): Assignment[] {
  const existing = assignments.find((a) => a.groupId === groupId) ?? { groupId, teacherId: "" };
  const next: Assignment = { ...existing, ...patch, groupId };
  for (const key of ["coTeacherId", "subject", "room"] as const) if (!next[key]) delete next[key];
  if (!next.off) delete next.off;
  return [...assignments.filter((a) => a.groupId !== groupId), next];
}

/** Tagesvorgaben einer Vorlage auf die aktuellen Lehrpersonen anwenden. */
export function daysFromTemplate(templateDays: Partial<WeekDays> | null | undefined, teachers: Teacher[]): WeekDays {
  const base = emptyDays(teachers);
  if (!templateDays) return base;
  const known = new Set(teachers.map((t) => t.id));
  for (const d of DAYS) {
    const src = templateDays[d.id];
    if (!src) continue;
    base[d.id] = {
      attendance: (src.attendance ?? base[d.id].attendance).filter((id) => known.has(id)),
      note: src.note ?? "",
      meetings: (src.meetings ?? []).slice(0, 2).map((m) => ({ ...m })),
    };
  }
  return base;
}

/**
 * Inhalt einer neuen Woche aus einer Vorlage (Tagesvorgaben + Lektionen mit neuen IDs).
 * Ohne passende Vorlage wird die erste verwendet; ohne Vorlagen entsteht eine leere Woche.
 */
export function weekFromTemplate(
  all: Session[], templates: Template[], teachers: Teacher[], templateId: string | null | undefined, weekStart: string,
): { days: WeekDays; sessions: Session[] } {
  const template = templates.find((t) => t.id === templateId) ?? templates[0];
  if (!template) return { days: emptyDays(teachers), sessions: [] };
  return {
    days: daysFromTemplate(template.days, teachers),
    sessions: cloneTemplateToWeek(sessionsIn(all, { templateId: template.id }), weekStart),
  };
}

/** Die Felder `keys` eines Objekts (für feldweises Speichern). */
export function pickFields<T extends object, K extends keyof T>(source: T, keys: Iterable<K>): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) result[key] = source[key];
  return result;
}
