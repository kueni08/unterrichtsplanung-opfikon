import { cloneTemplateToWeek, emptyDays, newId } from "./logic.ts";
import type { Assignment, DayKey, Group, PlannerSnapshot, Session, Teacher, Template } from "./types.ts";

type Row = [DayKey, number, string, string, string, number[] | "all"];

const RULE_WEEK: Row[] = [
  ["mo", 0, "Wochenstart", "Ankommen · Ausblick", "Lernatelier", "all"],
  ["mo", 1, "Mathe-Werkstatt", "Zahlenräume", "Räume 1–3", [0, 1, 2]],
  ["mo", 2, "Deutsch", "Lesespuren", "Räume 1–3", [1, 0, 2]],
  ["mo", 5, "NMG", "Lebensräume", "Atelier", [2, 1, 0]],
  ["di", 0, "Lernzeit", "Individuelle Ziele", "Lernatelier", [1, 2, 0]],
  ["di", 1, "Mathematik", "Strategien", "Räume 1–3", [0, 1, 2]],
  ["di", 3, "Sport", "Kooperation", "Turnhalle", "all"],
  ["di", 6, "Gestalten", "Farbe & Form", "Werkraum", [3, 1, 0]],
  ["mi", 0, "Deutsch", "Schreibkonferenz", "Räume 1–3", [0, 1, 2]],
  ["mi", 1, "Förderband", "Lesen · DaZ · Mathe", "Förderräume", [3, 1, 2]],
  ["mi", 3, "Klassenrat", "Gemeinschaft", "Lernatelier", "all"],
  ["do", 0, "Mathematik", "Üben & vertiefen", "Räume 1–3", [0, 1, 2]],
  ["do", 2, "NMG-Projekt", "Forscherauftrag", "Atelier", [2, 0, 1]],
  ["do", 5, "Musik", "Rhythmus", "Musikraum", "all"],
  ["fr", 0, "Lernzeit", "Wochenziele", "Lernatelier", [1, 0, 3]],
  ["fr", 1, "Deutsch", "Präsentieren", "Räume 1–3", [0, 1, 2]],
  ["fr", 3, "Wochenabschluss", "Rückblick", "Lernatelier", "all"],
];

const PROJECT_WEEK: Row[] = [
  ["mo", 0, "Projekt-Kickoff", "Frage & Teams", "Lernatelier", "all"],
  ["mo", 1, "Projektatelier", "Forschen", "Ateliers", [0, 2, 1]],
  ["di", 0, "Projektatelier", "Planen & bauen", "Ateliers", [1, 0, 2]],
  ["mi", 0, "Zwischenhalt", "Feedback", "Lernatelier", "all"],
  ["do", 0, "Projektatelier", "Fertigstellen", "Ateliers", [2, 1, 0]],
  ["fr", 1, "Präsentationen", "Zeigen & würdigen", "Aula", "all"],
];

function starterGroups(): Group[] {
  const codes = (prefix: string) => Array.from({ length: 13 }, (_, i) => `${prefix}${String(i + 1).padStart(2, "0")}`).join(", ");
  return [
    { id: newId(), name: "1. Klasse", short: "1. Kl.", color: "#E98F82", children: codes("A"), sortOrder: 0 },
    { id: newId(), name: "2. Klasse", short: "2. Kl.", color: "#6FAFD4", children: codes("B"), sortOrder: 1 },
    { id: newId(), name: "3. Klasse", short: "3. Kl.", color: "#78B99A", children: codes("C"), sortOrder: 2 },
  ];
}

function buildRows(rows: Row[], templateId: string, groups: Group[], teacherIds: string[]): Session[] {
  const pick = (i: number) => (teacherIds.length ? teacherIds[i % teacherIds.length] : "");
  return rows.map(([day, slot, title, focus, room, plan]) => {
    const assignments: Assignment[] = plan === "all"
      ? teacherIds.slice(0, 3).map((teacherId, i) => ({ groupId: groups[i]?.id ?? "", teacherId })).filter((a) => a.groupId)
      : groups.map((g, i) => ({ groupId: g.id, teacherId: pick(plan[i] ?? i) }));
    return {
      id: newId(), weekStart: null, templateId, day, slot, title, focus, room, notes: "", children: "",
      wholeClass: plan === "all", status: "planned", assignments,
    };
  });
}

/** Startinhalt für ein neues Team: drei Gruppen und zwei Wochenvorlagen. */
export function buildStarterContent(teacherIds: string[]): { groups: Group[]; templates: Template[]; sessions: Session[] } {
  const groups = starterGroups();
  const templates: Template[] = [
    { id: newId(), name: "Regelwoche ADL", sortOrder: 0 },
    { id: newId(), name: "Projektwoche", sortOrder: 1 },
  ];
  const sessions = [
    ...buildRows(RULE_WEEK, templates[0].id, groups, teacherIds),
    ...buildRows(PROJECT_WEEK, templates[1].id, groups, teacherIds),
  ];
  return { groups, templates, sessions };
}

export const DEMO_USERS = {
  koordination: { userId: "demo-koordination", displayName: "Lara Meier", role: "koordination" as const, teacherIndex: 0 },
  lehrperson: { userId: "demo-lehrperson", displayName: "Kim Berger", role: "lehrperson" as const, teacherIndex: 1 },
};

export function buildDemoSnapshot(weekStart: string): PlannerSnapshot {
  const teachers: Teacher[] = [
    { id: newId(), name: "Lara Meier", initials: "LM", color: "#795A9D", active: true, sortOrder: 0 },
    { id: newId(), name: "Kim Berger", initials: "KB", color: "#C57953", active: true, sortOrder: 1 },
    { id: newId(), name: "Sami Frei", initials: "SF", color: "#347A78", active: true, sortOrder: 2 },
    { id: newId(), name: "Nora Graf", initials: "NG", color: "#4D699F", active: true, sortOrder: 3 },
  ];
  const content = buildStarterContent(teachers.map((t) => t.id));
  const rule = content.sessions.filter((s) => s.templateId === content.templates[0].id);
  const week = cloneTemplateToWeek(rule, weekStart).map((s, i) =>
    i === 2 ? { ...s, status: "open" as const, notes: "Lesespur 2 noch nicht ganz abgeschlossen. Gruppe 1 braucht zusätzliche Begleitung." }
      : i === 0 ? { ...s, status: "done" as const } : s);
  const [lara, kim, sami, nora] = teachers.map((t) => t.id);
  const days = emptyDays(teachers);
  days.mo = { attendance: [lara, kim, sami], note: "10:00 Uhr: Besuch der Schulsozialarbeit.", meetings: [{ time: "16:15", title: "Stufensitzung" }] };
  days.di = { attendance: [lara, kim, sami, nora], note: "Turnhalle ab 10:00 Uhr reserviert.", meetings: [] };
  days.mi = { attendance: [lara, kim, nora], note: "Sami: Weiterbildung ganzer Tag.", meetings: [{ time: "12:15", title: "Kurzabsprache IF" }] };
  days.do = { attendance: [lara, kim, sami], note: "", meetings: [{ time: "16:10", title: "Elterngespräch" }, { time: "17:00", title: "Teamplanung" }] };
  days.fr = { attendance: [lara, kim, sami], note: "Bibliotheksbücher mitgeben.", meetings: [] };
  return {
    team: { id: "demo", name: "ADL Opfikon", joinCode: "DEMO2026" },
    members: [
      { userId: DEMO_USERS.koordination.userId, displayName: "Lara Meier", role: "koordination", teacherId: lara },
      { userId: DEMO_USERS.lehrperson.userId, displayName: "Kim Berger", role: "lehrperson", teacherId: kim },
    ],
    teachers,
    groups: content.groups,
    templates: content.templates,
    sessions: [...content.sessions, ...week],
    weeks: { [weekStart]: days },
  };
}
