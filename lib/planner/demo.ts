import { TEACHER_PALETTE } from "./constants.ts";
import { cloneTemplateToWeek, daysFromTemplate, deriveTitle, makeSession, newId, setParticipants, uniqueInitials } from "./logic.ts";
import { addDays, isoDate, parseIsoDate } from "./dates.ts";
import type { Assignment, ChangeEntry, ChildNote, DayKey, Group, PlannerSnapshot, Session, Teacher, Template, WeekDays } from "./types.ts";

/**
 * Standardinhalt gemäss „Vorlage Stundenplan Kastanie SJ26/27“.
 * Kürzel der Kinder sind Platzhalter und werden im Admin-Bereich angepasst.
 */

export const KASTANIE_TEACHERS = ["Dani", "Andrea", "Klara", "Nici", "Coni"] as const;
type T = (typeof KASTANIE_TEACHERS)[number];

/** Zelle: Fach, Raum, Lehrperson(en) – oder "frei" */
type Cell = { subject: string; room?: string; teachers: T[]; focus?: string; notes?: string } | "frei";
/** Eintrag: entweder gemeinsam für alle Klassen oder pro Klasse [3., 4., 5.] */
type Entry = { day: DayKey; slot: number } & ({ all: Exclude<Cell, "frei"> } | { perGroup: [Cell, Cell, Cell] });

const c = (subject: string, teachers: T[], room?: string, extra: { focus?: string; notes?: string } = {}): Exclude<Cell, "frei"> => ({ subject, room, teachers, ...extra });
const F = "frei" as const;

const KASTANIE: Entry[] = [
  // Montag
  { day: "mo", slot: 0, perGroup: [F, F, c("M&I", ["Klara"])] },
  { day: "mo", slot: 1, all: c("NMG", ["Dani"], undefined, { focus: "Ankommen · Singen mit allen", notes: "Dani hat Lead (mit Gitarre)." }) },
  { day: "mo", slot: 2, all: c("Mathe", ["Dani"]) },
  ...[3, 4].map((slot) => ({ day: "mo" as const, slot, perGroup: [c("Englisch", ["Klara"], "Atelier"), c("Englisch", ["Andrea"], "Kreis"), c("Französisch", ["Dani"], "F.bank")] as [Cell, Cell, Cell] })),
  { day: "mo", slot: 6, perGroup: [F, c("Mathe", ["Dani"], "Atelier"), c("Englisch", ["Klara"], "F.bank")] },
  { day: "mo", slot: 7, perGroup: [F, c("Deutsch", ["Dani"], "Atelier"), c("Englisch", ["Klara"], "F.bank")] },
  // Dienstag
  { day: "di", slot: 0, perGroup: [c("Englisch", ["Klara"], "Atelier"), F, F] },
  { day: "di", slot: 1, all: c("Musik", ["Andrea", "Dani"], undefined, { focus: "Chor" }) },
  { day: "di", slot: 2, all: c("Mathe", ["Dani"]) },
  { day: "di", slot: 3, all: c("BG", ["Andrea", "Klara"]) },
  { day: "di", slot: 4, all: c("BG", ["Andrea", "Klara"]) },
  { day: "di", slot: 6, perGroup: [c("Schwimmen", ["Klara"]), c("Sport", ["Dani", "Andrea"]), c("Sport", ["Dani", "Andrea"])] },
  { day: "di", slot: 7, all: c("Deutsch", ["Dani", "Andrea"], undefined, { focus: "Alle · Training 20'" }) },
  // Mittwoch
  { day: "mi", slot: 1, all: c("RKE", ["Nici"]) },
  { day: "mi", slot: 2, all: c("Mathe", ["Dani"]) },
  ...[3, 4].map((slot) => ({ day: "mi" as const, slot, perGroup: [c("TTG", ["Coni"], "Atelier"), c("Sport", ["Andrea", "Dani"]), c("Sport", ["Andrea", "Dani"])] as [Cell, Cell, Cell] })),
  // Donnerstag
  { day: "do", slot: 0, perGroup: [F, c("Englisch", ["Andrea"]), c("Deutsch", ["Coni"], "Atelier")] },
  { day: "do", slot: 1, all: c("Deutsch", ["Coni"]) },
  { day: "do", slot: 2, all: c("NMG", ["Andrea", "Dani"]) },
  { day: "do", slot: 3, perGroup: [c("Mathe", ["Dani"], "Kreis+"), c("TTG", ["Coni"], "Atelier"), c("Mathe", ["Andrea"], "F.bank")] },
  { day: "do", slot: 4, perGroup: [c("Deutsch", ["Andrea"], "Kreis+"), c("TTG", ["Coni"], "Atelier"), c("Französisch", ["Dani"], "F.bank")] },
  { day: "do", slot: 6, all: c("NMG", ["Andrea", "Dani"]) },
  { day: "do", slot: 7, all: c("NMG", ["Andrea", "Dani"]) },
  // Freitag
  { day: "fr", slot: 1, all: c("Deutsch", ["Coni"]) },
  { day: "fr", slot: 2, perGroup: [c("Deutsch", ["Coni"], "Atelier"), c("Musik", ["Andrea"], "Aula"), c("Mathe", ["Dani"], "Kreis+")] },
  { day: "fr", slot: 3, perGroup: [c("Musik", ["Andrea"], "Aula"), c("Mathe", ["Dani"], "Kreis+"), c("Deutsch", ["Coni"], "Atelier")] },
  { day: "fr", slot: 4, perGroup: [c("Mathe", ["Dani"], "Kreis+"), c("Deutsch", ["Coni"], "Atelier"), c("Musik", ["Andrea"], "Aula")] },
  ...[6, 7].map((slot) => ({ day: "fr" as const, slot, perGroup: [c("Sport", ["Dani"]), F, c("TTG", ["Coni"], "Atelier")] as [Cell, Cell, Cell] })),
];

/** Anwesenheit laut Kopfzeile des Stundenplans */
const KASTANIE_DAYS: Record<DayKey, { present: T[]; note?: string }> = {
  mo: { present: ["Dani", "Andrea", "Klara"] },
  di: { present: ["Dani", "Andrea", "Klara", "Nici"] },
  mi: { present: ["Dani", "Andrea", "Coni", "Nici", "Klara"], note: "Klara: PICTS" },
  do: { present: ["Dani", "Andrea", "Coni", "Nici"] },
  fr: { present: ["Dani", "Andrea", "Coni"] },
};

/** Index der ersten Zelle mit identischem Inhalt (Leitgruppe beim Zusammenlegen) */
function leadGroupIndex(cells: Cell[], index: number): number {
  const key = JSON.stringify(cells[index]);
  return cells.findIndex((c) => c !== "frei" && JSON.stringify(c) === key);
}

type Row = [DayKey, number, string, string, string, T[] | "all"];
const PROJECT_WEEK: Row[] = [
  ["mo", 1, "Projekt-Kickoff", "Frage & Teams", "Aula", "all"],
  ["mo", 2, "Projektatelier", "Forschen", "Ateliers", ["Dani", "Andrea", "Klara"]],
  ["di", 1, "Projektatelier", "Planen & bauen", "Ateliers", ["Andrea", "Klara", "Dani"]],
  ["mi", 1, "Zwischenhalt", "Feedback", "Aula", "all"],
  ["do", 1, "Projektatelier", "Fertigstellen", "Ateliers", ["Coni", "Andrea", "Dani"]],
  ["fr", 2, "Präsentationen", "Zeigen & würdigen", "Aula", "all"],
];

const codes = (prefix: string) => Array.from({ length: 13 }, (_, i) => `${prefix}${String(i + 1).padStart(2, "0")}`).join(", ");

type GroupSpec = { name: string; short: string; color: string; children: string };
const REAL_GROUPS: GroupSpec[] = [
  { name: "3. Klasse", short: "3. Kl.", color: "#E98F82", children: codes("C") },
  { name: "4. Klasse", short: "4. Kl.", color: "#6FAFD4", children: codes("D") },
  { name: "5. Klasse", short: "5. Kl.", color: "#78B99A", children: codes("E") },
];

function starterGroups(specs: GroupSpec[]): Group[] {
  return specs.map((g, i) => ({ id: newId(), name: g.name, short: g.short, color: g.color, children: g.children, sortOrder: i }));
}

/**
 * Augenzwinkernde Demo-Besetzung (Figuren aus Harry Potter) für die öffentliche Demo und das Werbevideo.
 * Die echten Vornamen aus dem Stundenplan bleiben der Vorlage für echte Teams vorbehalten.
 * Kinder erscheinen – wie in der echten App – nur als Kürzel.
 */
const DEMO_NAMES: Record<T, string> = {
  Dani: "Albus Dumbledore",
  Andrea: "Minerva McGonagall",
  Klara: "Severus Snape",
  Nici: "Hermine Granger",
  Coni: "Rubeus Hagrid",
};
const DEMO_GROUPS: GroupSpec[] = [
  { name: "Gryffindor · 3. Kl.", short: "Gryffindor", color: "#E98F82", children: "HP, RW, NL, GW, SF, DT, LB, PP, CC, FW" },
  { name: "Hufflepuff · 4. Kl.", short: "Hufflepuff", color: "#D8A653", children: "CD, HA, EM, SB, JF, ZS, NT, WW, LS" },
  { name: "Ravenclaw · 5. Kl.", short: "Ravenclaw", color: "#6FAFD4", children: "LL, CH, PA, TB, AG, MC, ME, RC, LT" },
];
const DEMO_TEXT: Record<string, string> = {
  "Dani hat Lead (mit Gitarre).": "Dumbledore hat Lead (mit Phönix-Begleitung).",
  "Klara: PICTS": "Snape: Weiterbildung Zaubertränke",
};

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
  || a.trim().split(/\s+/)[0].toLowerCase() === b.trim().toLowerCase();

/**
 * Startinhalt für ein neues Team: Lehrpersonen, Klassen 3–5, Vorlage „Stundenplan Kastanie SJ 26/27“
 * und eine Projektwoche. Bereits vorhandene Lehrpersonen (z. B. die Gründerin) werden per Vorname zugeordnet.
 */
export function buildStarterContent(
  existing: Teacher[] = [],
  options: { demo?: boolean } = {},
): { teachers: Teacher[]; groups: Group[]; templates: Template[]; sessions: Session[] } {
  const label = (name: T) => (options.demo ? DEMO_NAMES[name] : name);
  const text = (value: string) => (options.demo ? DEMO_TEXT[value] ?? value : value);
  const newTeachers: Teacher[] = [];
  const idOf = {} as Record<T, string>;
  KASTANIE_TEACHERS.forEach((name, i) => {
    const match = existing.find((t) => sameName(t.name, label(name)));
    if (match) { idOf[name] = match.id; return; }
    const teacher: Teacher = {
      id: newId(), name: label(name), initials: uniqueInitials(label(name), [...existing, ...newTeachers].map((t) => t.initials)),
      color: TEACHER_PALETTE[(existing.length + newTeachers.length) % TEACHER_PALETTE.length],
      active: true, sortOrder: existing.length + i,
    };
    newTeachers.push(teacher);
    idOf[name] = teacher.id;
  });

  const groups = starterGroups(options.demo ? DEMO_GROUPS : REAL_GROUPS);
  const days = Object.fromEntries(Object.entries(KASTANIE_DAYS).map(([day, v]) => [day, {
    attendance: v.present.map((n) => idOf[n]), note: text(v.note ?? ""), meetings: [],
  }])) as unknown as WeekDays;
  const templates: Template[] = [
    { id: newId(), name: options.demo ? "Stundenplan Hogwarts" : "Stundenplan Kastanie SJ 26/27", sortOrder: 0, days },
    { id: newId(), name: "Projektwoche", sortOrder: 1, days },
  ];

  const toAssignment = (cell: Cell, group: Group): Assignment => cell === "frei"
    ? { groupId: group.id, teacherId: "", off: true }
    : { groupId: group.id, teacherId: idOf[cell.teachers[0]], ...(cell.teachers[1] ? { coTeacherId: idOf[cell.teachers[1]] } : {}), subject: cell.subject, ...(cell.room ? { room: cell.room } : {}) };

  const timetable: Session[] = KASTANIE.map((entry) => {
    const base = { id: newId(), weekStart: null, templateId: templates[0].id, day: entry.day, slot: entry.slot, children: "", homework: "", nextTime: "", status: "planned" as const };
    if ("all" in entry) {
      const cell = entry.all;
      const assignments = groups.map((g) => {
        const a = toAssignment(cell, g);
        delete a.subject; delete a.room;
        return a;
      });
      return { ...base, title: cell.subject, focus: cell.focus ?? "", room: cell.room ?? "", notes: text(cell.notes ?? ""), wholeClass: true, assignments };
    }
    const assignments = groups.map((g, i) => toAssignment(entry.perGroup[i], g));
    // Gruppen mit identischem Unterricht (Fach, Lehrpersonen, Raum) werden zusammengelegt
    entry.perGroup.forEach((cell, i) => {
      if (cell === "frei") return;
      const lead = entry.perGroup.findIndex((other, j) => j < i && other !== "frei" && JSON.stringify(other) === JSON.stringify(cell));
      if (lead >= 0) assignments[i] = { groupId: groups[i].id, teacherId: "", withGroupId: groups[leadGroupIndex(entry.perGroup, lead)].id };
    });
    const active = entry.perGroup.filter((x): x is Exclude<Cell, "frei"> => x !== "frei");
    const sharedRoom = active.every((x) => x.room === active[0]?.room) ? active[0]?.room ?? "" : "";
    return { ...base, title: deriveTitle(assignments, "Lektion"), focus: "", room: sharedRoom, notes: "", wholeClass: false, assignments };
  });

  const project: Session[] = PROJECT_WEEK.map(([day, slot, title, focus, room, plan]) => ({
    id: newId(), weekStart: null, templateId: templates[1].id, day, slot, title, focus, room, notes: "", homework: "", nextTime: "", children: "", status: "planned",
    wholeClass: plan === "all",
    assignments: groups.map((g, i) => ({ groupId: g.id, teacherId: idOf[plan === "all" ? (["Dani", "Andrea", "Coni"] as T[])[i] : plan[i]] })),
  }));

  return { teachers: newTeachers, groups, templates, sessions: [...timetable, ...project] };
}

export const DEMO_USERS = {
  koordination: { userId: "demo-koordination", displayName: DEMO_NAMES.Andrea, role: "koordination" as const },
  lehrperson: { userId: "demo-lehrperson", displayName: DEMO_NAMES.Nici, role: "lehrperson" as const },
};

/** Demo-Kinder: Namen aus der Zauberwelt, Kürzel passend zu den Gruppenlisten (je Gruppe). */
const DEMO_CHILDREN: Record<string, string>[] = [
  { HP: "Harry Potter", RW: "Ron Weasley", NL: "Neville Longbottom", GW: "Ginny Weasley", SF: "Seamus Finnigan", DT: "Dean Thomas", LB: "Lavender Brown", PP: "Parvati Patil", CC: "Colin Creevey", FW: "Fred Weasley" },
  { CD: "Cedric Diggory", HA: "Hannah Abbott", EM: "Ernie Macmillan", SB: "Susan Bones", JF: "Justin Finch-Fletchley", ZS: "Zacharias Smith", NT: "Nymphadora Tonks", WW: "Wayne Wexler", LS: "Leanne Summers" },
  { LL: "Luna Lovegood", CH: "Cho Chang", PA: "Padma Patil", TB: "Terry Boot", AG: "Anthony Goldstein", MC: "Michael Corner", ME: "Marietta Edgecombe", RC: "Roger Cornfoot", LT: "Lisa Turpin" },
];

/** Beispiel-Änderungen anderer, damit Rahmen, Stift und „Was ist neu“ in der Demo sichtbar sind. */
function demoChanges(week: Session[]): ChangeEntry[] {
  const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60000).toISOString();
  const find = (day: DayKey, slot: number) => week.find((s) => s.day === day && s.slot === slot);
  const moved = find("di", 3); const edited = find("do", 2); const meeting = find("do", 8);
  const hermine = { authorId: DEMO_USERS.lehrperson.userId, authorName: DEMO_NAMES.Nici };
  const list: ChangeEntry[] = [];
  if (moved) list.push({ id: newId(), weekStart: moved.weekStart, sessionId: moved.id, kind: "moved", importance: "major", summary: `„${moved.title}“ von Di 4. Lektion nach Di 3. Lektion verschoben`, createdAt: at(35), ...hermine });
  if (edited) list.push({ id: newId(), weekStart: edited.weekStart, sessionId: edited.id, kind: "edited", importance: "minor", summary: `„${edited.title}“ (Do 2. Lektion): Notizen, Hausaufgaben geändert`, createdAt: at(120), ...hermine });
  if (meeting) list.push({ id: newId(), weekStart: meeting.weekStart, sessionId: meeting.id, kind: "assigned", importance: "major", summary: `Teilnehmende in „${meeting.title}“ (Do Abend 1) geändert`, createdAt: at(26 * 60), ...hermine });
  list.push({ id: newId(), weekStart: week[0]?.weekStart ?? null, sessionId: null, kind: "day", importance: "major", summary: "Anwesenheit am Mittwoch geändert", createdAt: at(3 * 60), ...hermine });
  return list;
}

export function buildDemoSnapshot(weekStart: string): PlannerSnapshot {
  const content = buildStarterContent([], { demo: true });
  const teachers = content.teachers;
  const id = (name: T) => teachers.find((t) => t.name === DEMO_NAMES[name])?.id ?? "";
  const main = content.templates[0];
  const week = cloneTemplateToWeek(content.sessions.filter((s) => s.templateId === main.id), weekStart);
  // etwas Leben in die Demo-Woche bringen
  const monday = week.filter((s) => s.day === "mo").sort((a, b) => a.slot - b.slot);
  if (monday[1]) monday[1].status = "done";
  if (monday[2]) { monday[2].status = "open"; monday[2].notes = "Einmaleins-Training noch nicht abgeschlossen. Hufflepuff braucht zusätzliche Begleitung."; }
  const days = daysFromTemplate(main.days, teachers);
  days.mo = { ...days.mo, note: "10:00 Uhr: Die Schuleule bringt die Post.", meetings: [] };
  days.di = { ...days.di, note: "Turnhalle ab 13:40 Uhr für das Besenflug-Training reserviert.", meetings: [] };
  days.fr = { ...days.fr, note: "Bibliotheksbücher zurückbringen – bitte keine fliegenden." };
  const meeting = (day: DayKey, slot: number, title: string, focus: string, room: string, who: T[]): Session => ({
    ...makeSession({ day, slot, weekStart, title, focus, room, assignments: setParticipants(who.map(id)) }),
  });
  week.push(
    meeting("mo", 8, "Stufensitzung", "Projektwoche · Elternabend vorbereiten", "Lehrerzimmer", ["Andrea", "Dani", "Klara", "Nici", "Coni"]),
    meeting("mi", 5, "Kurzabsprache Zaubertrank-Kerker", "Materialliste", "Kerker", ["Dani", "Nici"]),
    meeting("do", 8, "Elterngespräch H03", "Standortgespräch", "Zimmer 12", ["Andrea"]),
    meeting("do", 9, "Teamplanung", "Wochenrückblick", "Lehrerzimmer", []),
  );
  const children = DEMO_CHILDREN.flatMap((names, g) => Object.entries(names).map(([short, name], i) => {
    const parts = name.split(" ");
    return { id: newId(), firstName: parts[0], lastName: parts.slice(1).join(" "), short, groupId: content.groups[g].id, active: true, sortOrder: g * 20 + i };
  }));
  const kid = (short: string) => children.find((c) => c.short === short)?.id ?? "";
  const day = (offset: number) => isoDate(addDays(parseIsoDate(weekStart), offset));
  const childNotes: ChildNote[] = [
    { id: newId(), childId: kid("NL"), kind: "plus", note: "Hat Seamus beim Zaubertrank geholfen, ohne dass jemand fragen musste.", notedOn: day(1), authorId: DEMO_USERS.koordination.userId },
    { id: newId(), childId: kid("RW"), kind: "minus", note: "Hausaufgaben zum dritten Mal vergessen – Eltern informiert.", notedOn: day(1), authorId: DEMO_USERS.lehrperson.userId },
    { id: newId(), childId: kid("RW"), kind: "info", note: "Wirkt müde; laut eigener Aussage bis spät Quidditch-Training.", notedOn: day(2), authorId: DEMO_USERS.lehrperson.userId },
    { id: newId(), childId: kid("HP"), kind: "minus", note: "Streit in der Pause mit Draco, beide ermahnt.", notedOn: day(-4), authorId: DEMO_USERS.koordination.userId },
    { id: newId(), childId: kid("LL"), kind: "plus", note: "Präsentation über Schrumpfhörnige Schnarchkackler – kreativ und gut vorbereitet.", notedOn: day(3), authorId: DEMO_USERS.koordination.userId },
  ];
  return {
    team: { id: "demo", name: "Hogwarts · Demo-Schule", joinCode: "EULE2026" },
    members: [
      { userId: DEMO_USERS.koordination.userId, displayName: DEMO_NAMES.Andrea, role: "koordination", teacherId: id("Andrea") },
      { userId: DEMO_USERS.lehrperson.userId, displayName: DEMO_NAMES.Nici, role: "lehrperson", teacherId: id("Nici") },
    ],
    teachers,
    groups: content.groups,
    children,
    childNotes,
    changes: demoChanges(week),
    templates: content.templates,
    sessions: [...content.sessions, ...week],
    weeks: { [weekStart]: days },
  };
}
