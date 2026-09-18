import { resolveAssignments } from "./logic.ts";
import type { Child, DayMeta, Group, Reassignment, Session } from "./types.ts";

/**
 * Umteilung einzelner Kinder: pro Tag (Tagesfokus) oder pro Lektion kann ein Kind
 * vorübergehend einer anderen Gruppe zugeteilt werden. Ein Kind ist immer in genau
 * einer Gruppe: Lektion vor Tag vor Stammgruppe.
 */

export function effectiveGroupId(child: Child, day?: Pick<DayMeta, "reassignments"> | null, session?: Pick<Session, "reassignments"> | null): string | null {
  const inLesson = session?.reassignments?.find((r) => r.childId === child.id);
  if (inLesson) return inLesson.groupId;
  const inDay = day?.reassignments?.find((r) => r.childId === child.id);
  if (inDay) return inDay.groupId;
  return child.groupId;
}

/** Ein Kind umteilen (ersetzt eine bestehende Umteilung desselben Kindes). */
export function setReassignment(list: Reassignment[] | undefined, childId: string, groupId: string | null): Reassignment[] {
  const rest = (list ?? []).filter((r) => r.childId !== childId);
  return groupId ? [...rest, { childId, groupId }] : rest;
}

export type ReassignIssue = { childId: string; message: string; severity: "error" | "hint" };

/**
 * Prüft eine geplante Umteilung, bevor sie gespeichert wird.
 * Fehler: Zielgruppe hat in der Lektion frei, Gruppe unbekannt, Kind unbekannt.
 * Hinweis: Kind ist dort ohnehin schon (Stammgruppe oder Tagesumteilung).
 */
export function checkReassignment(
  child: Child | undefined, groupId: string, groups: Group[], session: Session | null, day: Pick<DayMeta, "reassignments"> | null,
): ReassignIssue | null {
  if (!child) return { childId: "", message: "Kind nicht gefunden.", severity: "error" };
  const group = groups.find((g) => g.id === groupId);
  if (!group) return { childId: child.id, message: "Gruppe nicht gefunden.", severity: "error" };
  if (session && !session.wholeClass) {
    const assignment = resolveAssignments(session.assignments).find((a) => a.groupId === groupId);
    if (assignment?.off) return { childId: child.id, message: `${group.name} hat in dieser Lektion frei – dorthin lässt sich niemand umteilen.`, severity: "error" };
  }
  const current = effectiveGroupId(child, day, session ? { reassignments: session.reassignments?.filter((r) => r.childId !== child.id) } : null);
  if (current === groupId) return { childId: child.id, message: `${child.firstName} ist hier bereits in ${group.name}.`, severity: "hint" };
  return null;
}

/** Warnungen für den Planungscheck: Umteilungen in freie Gruppen, doppelte Kürzel in Gruppenlisten. */
export function reassignmentWarnings(sessions: Session[], weekDays: Partial<Record<string, DayMeta>> | null, children: Child[], groups: Group[]): string[] {
  const warnings: string[] = [];
  const byId = new Map(children.map((c) => [c.id, c]));
  const groupName = (id: string) => groups.find((g) => g.id === id)?.name ?? "unbekannte Gruppe";

  for (const s of sessions) {
    for (const r of s.reassignments ?? []) {
      const child = byId.get(r.childId);
      if (!child) continue;
      if (!groups.some((g) => g.id === r.groupId)) { warnings.push(`${s.title}: ${child.short} ist in eine Gruppe umgeteilt, die es nicht mehr gibt.`); continue; }
      if (s.wholeClass) continue;
      const a = resolveAssignments(s.assignments).find((x) => x.groupId === r.groupId);
      if (a?.off) warnings.push(`${s.title}: ${child.short} ist in ${groupName(r.groupId)} umgeteilt, die dort frei hat.`);
    }
  }
  for (const [day, meta] of Object.entries(weekDays ?? {})) {
    for (const r of meta?.reassignments ?? []) {
      const child = byId.get(r.childId);
      if (child && !groups.some((g) => g.id === r.groupId)) warnings.push(`Tagesumteilung ${day.toUpperCase()}: ${child.short} zeigt auf eine Gruppe, die es nicht mehr gibt.`);
    }
  }

  // Teams ohne Stammliste: dasselbe Kürzel darf nicht in mehreren Gruppenlisten stehen
  if (children.length === 0) {
    const where = new Map<string, string[]>();
    for (const g of groups) {
      for (const short of g.children.split(",").map((x) => x.trim()).filter(Boolean)) {
        const key = short.toLowerCase();
        where.set(key, [...(where.get(key) ?? []), g.name]);
      }
    }
    for (const [short, names] of where) {
      if (names.length > 1) warnings.push(`Kürzel ${short.toUpperCase()} steht in mehreren Gruppen (${names.join(", ")}) – ein Kind kann nur in einer Gruppe sein.`);
    }
  }
  return warnings;
}

/** Umteilungen einer Lektion lesbar (für Karte und Tooltip): „RW → Hufflepuff“. */
export function describeReassignments(list: Reassignment[] | undefined, children: Child[], groups: Group[]): string[] {
  return (list ?? []).flatMap((r) => {
    const child = children.find((c) => c.id === r.childId);
    const group = groups.find((g) => g.id === r.groupId);
    return child && group ? [`${child.short} → ${group.short || group.name}`] : [];
  });
}
