import { uniqueInitials } from "./logic.ts";
import { newId } from "./logic.ts";
import type { Child, Group } from "./types.ts";

/**
 * Kinder-Stammliste: Namen, Kürzel und Gruppenzuordnung.
 * groups.children (Kürzel-Liste) wird aus der Zuordnung gespiegelt, damit Wochenplan,
 * Zählung („Alle 28“) und die Kinderzuordnung pro Lektion unverändert funktionieren.
 */

export const fullName = (c: Pick<Child, "firstName" | "lastName">): string => `${c.firstName.trim()} ${c.lastName.trim()}`.trim();

/** Kürzel aus Vor- und Nachname, eindeutig innerhalb der Kinderliste. */
export function childShort(child: Pick<Child, "firstName" | "lastName">, others: Iterable<Pick<Child, "short">>): string {
  return uniqueInitials(fullName(child) || "?", [...others].map((c) => c.short));
}

export function makeChild(partial: Partial<Child> & Pick<Child, "firstName" | "lastName">, others: Child[] = []): Child {
  return {
    id: newId(), groupId: null, active: true, sortOrder: others.length,
    short: childShort(partial, others),
    ...partial,
  };
}

/** Kinder einer Gruppe in Listenreihenfolge. */
export function childrenOfGroup(children: Child[], groupId: string): Child[] {
  return children.filter((c) => c.active && c.groupId === groupId).sort((a, b) => a.sortOrder - b.sortOrder || fullName(a).localeCompare(fullName(b), "de"));
}

/** Kürzel-Liste einer Gruppe, wie sie in groups.children gespiegelt wird. */
export function groupChildrenText(children: Child[], groupId: string): string {
  return childrenOfGroup(children, groupId).map((c) => c.short).join(", ");
}

/** Gruppen, deren Kürzel-Spiegel nach einer Änderung an den Kindern angepasst werden muss. */
export function syncGroupChildren(groups: Group[], children: Child[]): Group[] {
  const known = new Set(children.map((c) => c.short.toLowerCase()));
  const mirrored = (text: string) => text.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean).every((x) => known.has(x));
  return groups
    // nur Gruppen anfassen, die Kinder aus der Stammliste haben oder deren Kürzel bereits daraus stammen
    .filter((g) => children.some((c) => c.active && c.groupId === g.id) || mirrored(g.children))
    .map((g) => ({ ...g, children: groupChildrenText(children, g.id) }))
    .filter((g) => g.children !== groups.find((x) => x.id === g.id)?.children);
}

export type ImportedRow = { firstName: string; lastName: string; group?: string };

const HEADER_FIRST = ["vorname", "first name", "firstname", "first"];
const HEADER_LAST = ["nachname", "name", "familienname", "last name", "lastname", "last", "surname"];
const HEADER_GROUP = ["gruppe", "klasse", "group", "class"];

const cell = (v: unknown) => (v == null ? "" : String(v)).trim();

/**
 * Tabellenzeilen (Excel/CSV) in Kinder umwandeln. Erkennt Spalten über die Kopfzeile
 * (Vorname/Nachname/Name/Gruppe); ohne Kopfzeile gelten die ersten beiden Spalten als
 * Vor- und Nachname. Eine einzelne Spalte „Name“ wird am letzten Leerzeichen geteilt.
 */
export function rowsToChildren(rows: unknown[][]): ImportedRow[] {
  if (rows.length === 0) return [];
  const header = rows[0].map((v) => cell(v).toLowerCase());
  const idx = (names: string[]) => header.findIndex((h) => names.includes(h));
  let first = idx(HEADER_FIRST);
  let last = idx(HEADER_LAST);
  const group = idx(HEADER_GROUP);
  const hasHeader = first >= 0 || last >= 0;
  const body = hasHeader ? rows.slice(1) : rows;
  if (!hasHeader) { first = 0; last = 1; }

  const result: ImportedRow[] = [];
  for (const row of body) {
    let firstName = first >= 0 ? cell(row[first]) : "";
    let lastName = last >= 0 ? cell(row[last]) : "";
    if (first < 0 && lastName) {
      // nur eine Namensspalte: „Anna Muster“ → Vorname „Anna“, Nachname „Muster“
      const parts = lastName.split(/\s+/);
      firstName = parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0];
      lastName = parts.length > 1 ? parts[parts.length - 1] : "";
    }
    if (!firstName && !lastName) continue;
    const entry: ImportedRow = { firstName, lastName };
    if (group >= 0 && cell(row[group])) entry.group = cell(row[group]);
    result.push(entry);
  }
  return result;
}

/** CSV/TSV-Text in Zeilen zerlegen (Trennzeichen automatisch: ; , oder Tab). */
export function parseDelimited(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length === 0) return [];
  const sample = lines[0];
  const delimiter = [";", "\t", ","].reduce((best, d) => (sample.split(d).length > sample.split(best).length ? d : best), ";");
  return lines.map((line) => line.split(delimiter).map((v) => v.trim().replace(/^"(.*)"$/, "$1")));
}

/** Importierte Zeilen in neue Kinder umwandeln; vorhandene (gleicher Name) werden übersprungen. */
export function mergeImport(existing: Child[], rows: ImportedRow[], groups: Group[]): Child[] {
  const known = new Set(existing.map((c) => fullName(c).toLowerCase()));
  const all = [...existing];
  const added: Child[] = [];
  for (const row of rows) {
    const key = fullName(row).toLowerCase();
    if (!key || known.has(key)) continue;
    known.add(key);
    const group = row.group ? groups.find((g) => g.name.toLowerCase() === row.group!.toLowerCase() || g.short.toLowerCase() === row.group!.toLowerCase()) : undefined;
    const child = makeChild({ firstName: row.firstName, lastName: row.lastName, groupId: group?.id ?? null }, all);
    all.push(child);
    added.push(child);
  }
  return added;
}
