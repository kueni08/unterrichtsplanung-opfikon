export type DayKey = "mo" | "di" | "mi" | "do" | "fr";
export type SessionStatus = "planned" | "open" | "done" | "carried";
export type Role = "koordination" | "lehrperson";

export type Group = { id: string; name: string; short: string; color: string; children: string; sortOrder: number };
export type Child = {
  id: string;
  firstName: string;
  lastName: string;
  /** Kürzel im Wochenplan (aus den Anfangsbuchstaben, anpassbar) */
  short: string;
  groupId: string | null;
  active: boolean;
  sortOrder: number;
};
export type NoteKind = "plus" | "minus" | "info";
/** Verhaltensnotiz zu einem Kind (positiv, negativ oder neutrale Beobachtung) */
export type ChildNote = {
  id: string;
  childId: string;
  kind: NoteKind;
  note: string;
  /** ISO-Datum */
  notedOn: string;
  authorId: string | null;
};
export type ChangeKind = "added" | "removed" | "moved" | "edited" | "assigned" | "reassigned" | "day" | "group" | "meeting";
/** Eintrag im Änderungsprotokoll: wer hat wann was geändert */
export type ChangeEntry = {
  id: string;
  weekStart: string | null;
  sessionId: string | null;
  kind: ChangeKind;
  importance: "minor" | "major";
  summary: string;
  authorId: string | null;
  authorName: string;
  /** ISO-Zeitpunkt */
  createdAt: string;
};
export type Teacher = { id: string; name: string; initials: string; color: string; active: boolean; sortOrder: number };
export type Assignment = {
  groupId: string;
  teacherId: string;
  /** zweite Lehrperson (Teamteaching, z. B. „Andrea/Dani“) */
  coTeacherId?: string;
  /** abweichendes Fach dieser Gruppe (wenn Klassen parallel Verschiedenes haben) */
  subject?: string;
  /** abweichender Raum dieser Gruppe */
  room?: string;
  /** Gruppe hat in dieser Lektion frei */
  off?: boolean;
  /** wird zusammen mit dieser Gruppe unterrichtet und übernimmt deren Lehrpersonen, Fach und Raum */
  withGroupId?: string;
};

/** Vorübergehende Umteilung eines Kindes in eine andere Gruppe (pro Tag oder pro Lektion) */
export type Reassignment = { childId: string; groupId: string };

export type Session = {
  id: string;
  /** ISO-Datum des Montags – gesetzt für Lektionen einer Woche */
  weekStart: string | null;
  /** gesetzt für Vorlagenbausteine */
  templateId: string | null;
  day: DayKey;
  slot: number;
  title: string;
  focus: string;
  room: string;
  notes: string;
  /** Hausaufgaben, die in dieser Lektion verteilt wurden */
  homework: string;
  /** Hinweis für die nächste Lektion in diesem Fach (erscheint dort automatisch als Rückblick) */
  nextTime: string;
  children: string;
  /** Kinder, die in dieser Lektion einer anderen Gruppe zugeteilt sind */
  reassignments?: Reassignment[];
  wholeClass: boolean;
  status: SessionStatus;
  assignments: Assignment[];
};

export type Meeting = { time: string; title: string };
export type DayMeta = { attendance: string[]; note: string; meetings: Meeting[]; /** ganztägige Umteilungen */ reassignments?: Reassignment[] };
export type WeekDays = Record<DayKey, DayMeta>;

export type Template = {
  id: string;
  name: string;
  sortOrder: number;
  /** Standard für neue Wochen: Anwesenheit und Tagesnotizen */
  days: Partial<WeekDays> | null;
};

export type Member = {
  userId: string;
  displayName: string;
  role: Role;
  teacherId: string | null;
};

export type TeamInfo = { id: string; name: string; joinCode: string };

export type PlannerSnapshot = {
  team: TeamInfo;
  members: Member[];
  teachers: Teacher[];
  groups: Group[];
  /** Kinder-Stammliste (optional; leer bei Teams, die nur Kürzel pflegen) */
  children: Child[];
  /** Verhaltensnotizen zu Kindern */
  childNotes: ChildNote[];
  /** Änderungsprotokoll der letzten Tage */
  changes: ChangeEntry[];
  templates: Template[];
  /** Lektionen aller Wochen und Vorlagen */
  sessions: Session[];
  /** Wochen, die angelegt sind – Schlüssel: ISO-Datum des Montags */
  weeks: Record<string, WeekDays>;
};

export type Viewer = { userId: string; displayName: string; role: Role; teacherId: string | null };

export type PersistOp =
  /** neue Lektionen (vollständige Zeilen) */
  | { type: "upsertSessions"; rows: Session[] }
  /** nur geänderte Felder einer Lektion – überschreibt keine Änderungen anderer */
  | { type: "patchSession"; id: string; patch: Partial<Session> }
  /** nur Tag/Zeitfenster (verschieben); Inhalte bleiben unangetastet */
  | { type: "moveSessions"; rows: Session[] }
  | { type: "deleteSessions"; ids: string[] }
  /** legt eine Woche an; besteht sie schon, bleibt sie unverändert */
  | { type: "createWeek"; weekStart: string; days: WeekDays }
  /** nur geänderte Felder eines Tages */
  | { type: "patchWeekDay"; weekStart: string; day: DayKey; patch: Partial<DayMeta> }
  | { type: "upsertGroups"; rows: Group[] }
  | { type: "deleteGroup"; id: string }
  | { type: "upsertChildren"; rows: Child[] }
  | { type: "deleteChildren"; ids: string[] }
  | { type: "upsertChildNotes"; rows: ChildNote[] }
  | { type: "upsertChanges"; rows: ChangeEntry[] }
  | { type: "deleteChildNotes"; ids: string[] }
  | { type: "upsertTeachers"; rows: Teacher[] }
  | { type: "upsertTemplates"; rows: Template[] }
  | { type: "updateTeam"; name: string }
  | { type: "updateMember"; userId: string; patch: Partial<Pick<Member, "role" | "teacherId">> }
  | { type: "removeMember"; userId: string };
