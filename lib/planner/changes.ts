import type { ChangeEntry, ChangeKind } from "./types.ts";

/**
 * Hervorhebung von Änderungen anderer: Was seit dem letzten Besuch passiert ist, wird im
 * Wochenplan markiert (wichtig = Rahmen, klein = Stift) und in der Liste „Was ist neu“ gezeigt.
 */

export const KIND_LABEL: Record<ChangeKind, string> = {
  added: "neu", removed: "entfernt", moved: "verschoben", edited: "bearbeitet", assigned: "Zuständigkeit",
  reassigned: "umgeteilt", day: "Tag", group: "Gruppe", meeting: "Termin",
};

export function lastSeenKey(teamId: string, userId: string): string {
  return `wochenatelier-seen-${teamId}-${userId}`;
}

/** Zeitpunkt des letzten „Alles gesehen“ – ohne Eintrag: vor 7 Tagen (neue Nutzer sehen die letzte Woche). */
export function readLastSeen(teamId: string, userId: string): string {
  const fallback = new Date(Date.now() - 7 * 86400000).toISOString();
  try {
    const raw = localStorage.getItem(lastSeenKey(teamId, userId));
    return raw && !Number.isNaN(Date.parse(raw)) ? raw : fallback;
  } catch {
    return fallback;
  }
}

export function writeLastSeen(teamId: string, userId: string, iso: string): void {
  try { localStorage.setItem(lastSeenKey(teamId, userId), iso); } catch { /* privater Modus */ }
}

/** Änderungen anderer seit `since`, neueste zuerst. */
export function unseenChanges(changes: ChangeEntry[], since: string, viewerId: string): ChangeEntry[] {
  return changes
    .filter((c) => c.authorId !== viewerId && c.createdAt > since)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

/** Je Lektion die wichtigste ungesehene Änderung anderer (major schlägt minor, sonst die neueste). */
export function highlightsBySession(changes: ChangeEntry[], since: string, viewerId: string): Map<string, ChangeEntry> {
  const map = new Map<string, ChangeEntry>();
  for (const c of unseenChanges(changes, since, viewerId)) {
    if (!c.sessionId) continue;
    const current = map.get(c.sessionId);
    if (!current || (current.importance === "minor" && c.importance === "major")) map.set(c.sessionId, c);
  }
  return map;
}

/** Letzte Änderung an einer Lektion (egal von wem). */
export function latestChangeFor(changes: ChangeEntry[], sessionId: string): ChangeEntry | undefined {
  return changes.filter((c) => c.sessionId === sessionId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
}

const timeFmt = new Intl.DateTimeFormat("de-CH", { hour: "2-digit", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("de-CH", { weekday: "short", day: "2-digit", month: "2-digit" });

/** „vor 5 Min.“, „vor 2 Std.“, „gestern 14:03“, „Di 15.09. 10:12“ */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const diff = (now.getTime() - then.getTime()) / 1000;
  if (diff < 60) return "gerade eben";
  if (diff < 3600) return `vor ${Math.round(diff / 60)} Min.`;
  const sameDay = then.toDateString() === now.toDateString();
  if (sameDay) return diff < 6 * 3600 ? `vor ${Math.round(diff / 3600)} Std.` : `heute ${timeFmt.format(then)}`;
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (then.toDateString() === yesterday.toDateString()) return `gestern ${timeFmt.format(then)}`;
  return `${dayFmt.format(then)} ${timeFmt.format(then)}`;
}
