export type DayKey = "mo" | "di" | "mi" | "do" | "fr";
export type SessionStatus = "planned" | "open" | "done" | "carried";
export type Role = "koordination" | "lehrperson";

export type Group = { id: string; name: string; short: string; color: string; children: string; sortOrder: number };
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
};

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
  children: string;
  wholeClass: boolean;
  status: SessionStatus;
  assignments: Assignment[];
};

export type Meeting = { time: string; title: string };
export type DayMeta = { attendance: string[]; note: string; meetings: Meeting[] };
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
  templates: Template[];
  /** Lektionen aller Wochen und Vorlagen */
  sessions: Session[];
  /** Wochen, die angelegt sind – Schlüssel: ISO-Datum des Montags */
  weeks: Record<string, WeekDays>;
};

export type Viewer = { userId: string; displayName: string; role: Role; teacherId: string | null };

export type PersistOp =
  | { type: "upsertSessions"; rows: Session[] }
  | { type: "deleteSessions"; ids: string[] }
  | { type: "upsertWeek"; weekStart: string; days: WeekDays }
  | { type: "upsertGroups"; rows: Group[] }
  | { type: "deleteGroup"; id: string }
  | { type: "upsertTeachers"; rows: Teacher[] }
  | { type: "upsertTemplates"; rows: Template[] }
  | { type: "updateTeam"; name: string }
  | { type: "updateMember"; userId: string; patch: Partial<Pick<Member, "role" | "teacherId">> }
  | { type: "removeMember"; userId: string };
