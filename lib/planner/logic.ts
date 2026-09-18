import { DAYS, SLOTS, SUBJECT_PRESETS, isMeetingSlot, slotKind, slotsOfKind, type SlotKind } from "./constants.ts";
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
      ...(Array.isArray(value.reassignments) && value.reassignments.length
        ? { reassignments: value.reassignments.filter((r) => r && typeof r.childId === "string" && typeof r.groupId === "string").map((r) => ({ childId: r.childId, groupId: r.groupId })) }
        : {}),
    };
  }
  return base;
}

/** Kürzel aus den Anfangsbuchstaben: „Andrea Muster“ → AM, „Anna-Lena Meier Huber“ → AH, „Dani“ → DA. */
export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2);
  return letters.toUpperCase();
}

/**
 * Eindeutiges Kürzel im Team: erst Anfangsbuchstaben, bei Kollision zusätzlich
 * ein zweiter Buchstabe des Nachnamens (AMu), dann des Vornamens (AnM), zuletzt eine Zahl.
 */
export function uniqueInitials(name: string, taken: Iterable<string>): string {
  const used = new Set([...taken].map((x) => x.toUpperCase()));
  const base = initialsFrom(name);
  if (!used.has(base)) return base;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const candidates: string[] = [];
  if (parts.length > 1) {
    const first = parts[0];
    const last = parts[parts.length - 1];
    candidates.push(first[0] + last.slice(0, 2), first.slice(0, 2) + last[0], first[0] + last.slice(0, 3));
  } else if (parts.length === 1) {
    candidates.push(parts[0].slice(0, 3), parts[0].slice(0, 4));
  }
  for (const c of candidates) {
    const cand = c[0].toUpperCase() + c.slice(1);
    if (cand.length >= 2 && !used.has(cand.toUpperCase())) return cand;
  }
  for (let n = 2; n < 100; n += 1) if (!used.has(`${base}${n}`)) return `${base}${n}`;
  return base;
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

/** Nächster freier Platz der gewünschten Art (Lektion oder Termin) an diesem Tag. */
export function findFreeSlot(container: Session[], day: DayKey, from = 0, kind: SlotKind = slotKind(from)): number {
  const occupied = new Set(container.filter((s) => s.day === day).map((s) => s.slot));
  for (const slot of slotsOfKind(kind)) if (slot >= from && !occupied.has(slot)) return slot;
  return -1;
}

/**
 * Verschiebt einen Block innerhalb eines Containers (Woche oder Vorlage).
 * Belegte Plätze werden nach hinten bzw. vorne aufgeschoben – nur innerhalb
 * der gleichen Art von Zeitfenstern (Lektionen bzw. Termine), damit keine
 * Lektion über Mittag oder in den Abend rutscht.
 * Gibt nur die veränderten Blöcke zurück.
 */
export function reorderSessions(container: Session[], sessionId: string, targetDay: DayKey, requestedSlot: number): { changed: Session[]; moved: boolean } {
  const dragged = container.find((s) => s.id === sessionId);
  const targetSlot = Math.max(0, Math.min(SLOTS.length - 1, requestedSlot));
  if (!dragged || (dragged.day === targetDay && dragged.slot === targetSlot)) return { changed: [], moved: false };

  // Positionen innerhalb der Spur (z. B. Lektionen 0,1,2,3,4,6,7 → 0..6)
  const lane = slotsOfKind(slotKind(targetSlot));
  const targetPos = lane.indexOf(targetSlot);
  const rest = container.filter((s) => s.id !== sessionId && s.day === targetDay && lane.includes(s.slot));
  const posOf = (s: Session) => lane.indexOf(s.slot);
  const shift = (predicate: (pos: number) => boolean, delta: number) =>
    rest.filter((s) => predicate(posOf(s))).map((s) => ({ ...s, slot: lane[posOf(s) + delta] }));
  const placed = { ...dragged, day: targetDay, slot: targetSlot };

  const draggedPos = dragged.day === targetDay ? lane.indexOf(dragged.slot) : -1;
  if (draggedPos >= 0) {
    const shifted = targetPos > draggedPos
      ? shift((pos) => pos > draggedPos && pos <= targetPos, -1)
      : shift((pos) => pos >= targetPos && pos < draggedPos, 1);
    return { changed: [...shifted, placed], moved: true };
  }

  const occupied = new Set(rest.map(posOf));
  if (!occupied.has(targetPos)) return { changed: [placed], moved: true };

  let freeAfter = -1;
  for (let i = targetPos + 1; i < lane.length; i += 1) if (!occupied.has(i)) { freeAfter = i; break; }
  if (freeAfter >= 0) return { changed: [...shift((pos) => pos >= targetPos && pos < freeAfter, 1), placed], moved: true };

  let freeBefore = -1;
  for (let i = targetPos - 1; i >= 0; i -= 1) if (!occupied.has(i)) { freeBefore = i; break; }
  if (freeBefore >= 0) return { changed: [...shift((pos) => pos > freeBefore && pos <= targetPos, -1), placed], moved: true };

  return { changed: [], moved: false };
}

export function applyChanged(list: Session[], changed: Session[]): Session[] {
  const byId = new Map(changed.map((s) => [s.id, s]));
  const result = list.map((s) => byId.get(s.id) ?? s);
  for (const s of changed) if (!list.some((x) => x.id === s.id)) result.push(s);
  return result;
}

/** Nächster freier Platz gleicher Art nach dem Block – sonst in der Folgewoche (belegte Plätze werden übersprungen). */
export function carryForwardTarget(all: Session[], session: Session, nextWeekStart: string): { weekStart: string; day: DayKey; slot: number } | null {
  if (!session.weekStart) return null;
  const lane = slotsOfKind(slotKind(session.slot));
  const positions = DAYS.flatMap((d) => lane.map((slot) => ({ day: d.id, slot })));
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
  if (teacherId === "all" || session.wholeClass) return true;
  // Termine ohne Teilnehmende gelten für das ganze Team
  if (isMeetingSlot(session.slot) && meetingParticipants(session).length === 0) return true;
  return resolveAssignments(session.assignments).some((a) => !a.off && (a.teacherId === teacherId || a.coTeacherId === teacherId));
}

/**
 * Zusammengelegte Gruppen auflösen: Eine Gruppe mit `withGroupId` übernimmt Lehrpersonen,
 * Fach und Raum der Leitgruppe (Ketten werden verfolgt, Zyklen abgefangen).
 */
export function resolveAssignments(assignments: Assignment[]): Assignment[] {
  const byGroup = new Map(assignments.map((a) => [a.groupId, a]));
  return assignments.map((a) => {
    if (!a.withGroupId) return a;
    let lead: Assignment | undefined = a;
    const seen = new Set<string>();
    while (lead?.withGroupId && !seen.has(lead.groupId)) { seen.add(lead.groupId); lead = byGroup.get(lead.withGroupId); }
    if (!lead || lead === a || lead.withGroupId) return { ...a, withGroupId: undefined };
    const merged: Assignment = { ...a, teacherId: lead.teacherId, off: lead.off };
    for (const key of ["coTeacherId", "subject", "room"] as const) { if (lead[key]) merged[key] = lead[key]; else delete merged[key]; }
    if (!merged.off) delete merged.off;
    return merged;
  });
}

/** Leitgruppe einer zusammengelegten Gruppe (oder die Gruppe selbst). */
export function leadGroupId(assignments: Assignment[], groupId: string): string {
  const byGroup = new Map(assignments.map((a) => [a.groupId, a]));
  let current = byGroup.get(groupId);
  const seen = new Set<string>();
  while (current?.withGroupId && !seen.has(current.groupId)) { seen.add(current.groupId); current = byGroup.get(current.withGroupId); }
  return current?.groupId ?? groupId;
}

export type GroupCluster = { assignment: Assignment; groups: Group[] };

/** Gruppen einer Lektion für die Anzeige bündeln: zusammengelegte Gruppen erscheinen als eine Zeile. */
export function groupClusters(assignments: Assignment[], groups: Group[]): GroupCluster[] {
  const resolved = resolveAssignments(assignments);
  const clusters = new Map<string, GroupCluster>();
  for (const group of groups) {
    const a = resolved.find((x) => x.groupId === group.id);
    if (!a) continue;
    const lead = a.withGroupId ? leadGroupId(assignments, group.id) : group.id;
    const existing = clusters.get(lead);
    if (existing) { existing.groups.push(group); continue; }
    const leadAssignment = resolved.find((x) => x.groupId === lead) ?? a;
    clusters.set(lead, { assignment: leadAssignment, groups: [group] });
  }
  return [...clusters.values()];
}

/** Teilnehmende eines Termins (als Zuweisungen ohne Gruppe gespeichert). */
export function meetingParticipants(session: Session): string[] {
  return [...new Set(session.assignments.filter((a) => !a.groupId && !a.off && a.teacherId).map((a) => a.teacherId))];
}

export function setParticipants(teacherIds: string[]): Assignment[] {
  return [...new Set(teacherIds)].map((teacherId) => ({ groupId: "", teacherId }));
}

/** Alle Lehrpersonen eines Blocks (ohne Duplikate, ohne freie Gruppen). */
export function sessionTeacherIds(session: Session): string[] {
  const ids = resolveAssignments(session.assignments).filter((a) => !a.off).flatMap((a) => [a.teacherId, a.coTeacherId ?? ""]);
  return [...new Set(ids.filter(Boolean))];
}

/** Titel aus den Fächern der Gruppen ableiten (z. B. „Englisch · Französisch“). */
export function deriveTitle(assignments: Assignment[], fallback: string): string {
  const subjects = [...new Set(resolveAssignments(assignments).filter((a) => !a.off && a.subject).map((a) => a.subject as string))];
  return subjects.length ? subjects.join(" · ") : fallback;
}

export function planningWarnings(sessions: Session[], groups: Group[], teachers: Teacher[]): string[] {
  const warnings: string[] = [];
  const active = new Set(teachers.filter((t) => t.active).map((t) => t.id));
  if (active.size < 3) warnings.push("Mindestens drei aktive Lehrpersonen sind vorgesehen.");
  for (const s of sessions) {
    if (s.wholeClass) continue;
    if (isMeetingSlot(s.slot)) {
      // Termine: nur prüfen, ob Teilnehmende noch aktiv sind
      if (meetingParticipants(s).some((id) => !active.has(id))) warnings.push(`${s.title}: Eine teilnehmende Lehrperson ist nicht aktiv.`);
      continue;
    }
    const resolved = resolveAssignments(s.assignments);
    const relevant = groups
      .map((g) => resolved.find((a) => a.groupId === g.id) ?? { groupId: g.id, teacherId: "" })
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
    id: newId(), weekStart: null, templateId: null, title: "Neue Lektion", focus: "", room: "", notes: "", homework: "", nextTime: "",
    children: "", wholeClass: false, status: "planned", assignments: [], ...partial,
  };
}

export function defaultAssignments(groups: Group[], teachers: Teacher[]): Assignment[] {
  const active = teachers.filter((t) => t.active);
  return groups.map((g, i) => ({ groupId: g.id, teacherId: active[i]?.id ?? "" }));
}

export function cloneTemplateToWeek(templateSessions: Session[], weekStart: string): Session[] {
  return templateSessions.map((s) => ({
    ...s, id: newId(), weekStart, templateId: null, status: "planned", notes: s.notes, homework: "", nextTime: "", reassignments: [], assignments: s.assignments.map((a) => ({ ...a })),
  }));
}

/** Fächer zur Auswahl: Vorgaben plus alles, was im Team schon verwendet wird (nach Häufigkeit). */
export function subjectSuggestions(sessions: Session[]): string[] {
  const count = new Map<string, number>();
  for (const s of sessions) {
    if (isMeetingSlot(s.slot)) continue;
    for (const subject of subjectsOf(s)) count.set(subject, (count.get(subject) ?? 0) + 1);
  }
  const used = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([subject]) => subject);
  return [...new Set([...used, ...SUBJECT_PRESETS])];
}

/** Räume zur Auswahl: alles, was im Team schon verwendet wird. */
export function roomSuggestions(sessions: Session[]): string[] {
  const count = new Map<string, number>();
  for (const s of sessions) {
    for (const room of [s.room, ...s.assignments.map((a) => a.room ?? "")]) {
      const r = room.trim();
      if (r) count.set(r, (count.get(r) ?? 0) + 1);
    }
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([room]) => room);
}

// ---------------------------------------------------------------------------
// Verlauf pro Fach: Rückblick auf frühere Lektionen und Hausaufgaben
// ---------------------------------------------------------------------------

/** Fächer einer Lektion: die Fächer der Gruppen, sonst der Titel. */
export function subjectsOf(session: Session): string[] {
  const fromGroups = [...new Set(resolveAssignments(session.assignments).filter((a) => !a.off && a.subject).map((a) => (a.subject as string).trim()))];
  const list = fromGroups.length ? fromGroups : [session.title.trim()];
  return list.filter(Boolean);
}

/** Gruppen, die in dieser Lektion tatsächlich Unterricht haben (leer = nicht bestimmbar → passt zu allem). */
function groupsOf(session: Session): Set<string> {
  if (session.wholeClass) return new Set();
  return new Set(resolveAssignments(session.assignments).filter((a) => !a.off && a.groupId).map((a) => a.groupId));
}

const norm = (s: string) => s.trim().toLowerCase();

/** Chronologische Position einer Lektion innerhalb aller Wochen (nur für Wochenlektionen). */
export function sessionOrderKey(s: Session): string {
  const dayIndex = DAYS.findIndex((d) => d.id === s.day);
  return `${s.weekStart ?? ""}-${dayIndex}-${String(s.slot).padStart(2, "0")}`;
}

/**
 * Frühere Lektionen desselben Fachs (und – sofern bestimmbar – mit mindestens einer gemeinsamen Gruppe),
 * neueste zuerst. Vorlagenbausteine und die Lektion selbst zählen nicht.
 */
export function previousLessons(all: Session[], current: Session, limit = 3): Session[] {
  if (!current.weekStart) return [];
  const subjects = new Set(subjectsOf(current).map(norm));
  if (subjects.size === 0) return [];
  const groups = groupsOf(current);
  const key = sessionOrderKey(current);
  return all
    .filter((s) => s.weekStart && s.id !== current.id && !isMeetingSlot(s.slot) && sessionOrderKey(s) < key)
    .filter((s) => subjectsOf(s).some((x) => subjects.has(norm(x))))
    .filter((s) => {
      const g = groupsOf(s);
      return groups.size === 0 || g.size === 0 || [...g].some((id) => groups.has(id));
    })
    .sort((a, b) => (sessionOrderKey(a) < sessionOrderKey(b) ? 1 : -1))
    .slice(0, limit);
}

export type HomeworkEntry = { subject: string; session: Session; groupIds: string[] };

/** Alle verteilten Hausaufgaben, je Fach neueste zuerst. */
export function homeworkBySubject(all: Session[]): Map<string, HomeworkEntry[]> {
  const result = new Map<string, HomeworkEntry[]>();
  const withHomework = all
    .filter((s) => s.weekStart && s.homework.trim())
    .sort((a, b) => (sessionOrderKey(a) < sessionOrderKey(b) ? 1 : -1));
  for (const session of withHomework) {
    for (const subject of subjectsOf(session)) {
      const k = norm(subject);
      const list = result.get(k) ?? [];
      list.push({ subject, session, groupIds: [...groupsOf(session)] });
      result.set(k, list);
    }
  }
  return result;
}

export function setAssignment(assignments: Assignment[], groupId: string, patch: Partial<Assignment>): Assignment[] {
  const existing = assignments.find((a) => a.groupId === groupId) ?? { groupId, teacherId: "" };
  const next: Assignment = { ...existing, ...patch, groupId };
  if (next.withGroupId === groupId) delete next.withGroupId;
  if (next.withGroupId) {
    // zusammengelegt: eigene Angaben entfallen, sie kommen von der Leitgruppe
    next.teacherId = "";
    delete next.coTeacherId; delete next.subject; delete next.room; delete next.off;
  } else {
    delete next.withGroupId;
  }
  for (const key of ["coTeacherId", "subject", "room"] as const) if (!next[key]) delete next[key];
  if (!next.off) delete next.off;
  return [...assignments.filter((a) => a.groupId !== groupId), next];
}

/** Gruppen, die sich als Leitgruppe für `groupId` eignen (keine Zyklen, nicht selbst zusammengelegt). */
export function mergeCandidates(assignments: Assignment[], groups: Group[], groupId: string): Group[] {
  return groups.filter((g) => g.id !== groupId && leadGroupId(assignments, g.id) !== groupId && !assignments.find((a) => a.groupId === g.id)?.withGroupId);
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
