import type { DayKey } from "./types.ts";

export const DAYS: { id: DayKey; label: string; short: string }[] = [
  { id: "mo", label: "Montag", short: "Mo" },
  { id: "di", label: "Dienstag", short: "Di" },
  { id: "mi", label: "Mittwoch", short: "Mi" },
  { id: "do", label: "Donnerstag", short: "Do" },
  { id: "fr", label: "Freitag", short: "Fr" },
];

export type SlotKind = "lesson" | "meeting";
export type SlotPeriod = "Morgen" | "Mittag" | "Nachmittag" | "Abend";
export type Slot = { label: string; short: string; time: string; end: string; period: SlotPeriod; kind: SlotKind };

/**
 * Tagesstruktur: Lektionenraster gemäss Stundenplan Kastanie SJ 26/27,
 * ergänzt um Zeitfenster über Mittag und am Abend für Sitzungen, Elterngespräche usw.
 * Die Reihenfolge ist chronologisch; der Index ist der gespeicherte `slot`.
 */
export const SLOTS: Slot[] = [
  { label: "1. Lektion", short: "1", time: "07:30", end: "08:15", period: "Morgen", kind: "lesson" },
  { label: "2. Lektion", short: "2", time: "08:20", end: "09:05", period: "Morgen", kind: "lesson" },
  { label: "3. Lektion", short: "3", time: "09:10", end: "09:55", period: "Morgen", kind: "lesson" },
  { label: "4. Lektion", short: "4", time: "10:25", end: "11:10", period: "Morgen", kind: "lesson" },
  { label: "5. Lektion", short: "5", time: "11:15", end: "12:00", period: "Morgen", kind: "lesson" },
  { label: "Mittag", short: "M", time: "12:05", end: "13:35", period: "Mittag", kind: "meeting" },
  { label: "6. Lektion", short: "6", time: "13:40", end: "14:25", period: "Nachmittag", kind: "lesson" },
  { label: "7. Lektion", short: "7", time: "14:30", end: "15:15", period: "Nachmittag", kind: "lesson" },
  { label: "Abend 1", short: "A1", time: "16:00", end: "17:00", period: "Abend", kind: "meeting" },
  { label: "Abend 2", short: "A2", time: "17:00", end: "18:00", period: "Abend", kind: "meeting" },
  { label: "Abend 3", short: "A3", time: "18:00", end: "19:30", period: "Abend", kind: "meeting" },
];

/** Beschriftung der Abschnitte im Raster */
export const PERIOD_LABEL: Record<SlotPeriod, string> = {
  Morgen: "Morgen · Unterricht",
  Mittag: "Mittag · Sitzungen",
  Nachmittag: "Nachmittag · Unterricht",
  Abend: "Abend · Sitzungen & Elterngespräche",
};

/** Indizes, an denen ein neuer Abschnitt beginnt (ausser dem ersten) */
export const PERIOD_STARTS = new Set(SLOTS.map((s, i) => (i > 0 && SLOTS[i - 1].period !== s.period ? i : -1)).filter((i) => i >= 0));
/** Index der ersten Nachmittagslektion (für die Mittagstrennung im Raster) */
export const AFTERNOON_START = SLOTS.findIndex((s) => s.period === "Nachmittag");
/** Nach diesen Lektionen folgt eine Pause */
export const BREAK_AFTER: Record<number, string> = { 2: "Pause" };

export const isMeetingSlot = (slot: number): boolean => SLOTS[slot]?.kind === "meeting";
export const slotKind = (slot: number): SlotKind => SLOTS[slot]?.kind ?? "lesson";
/** Alle Slot-Indizes einer Art in chronologischer Reihenfolge */
export const slotsOfKind = (kind: SlotKind): number[] => SLOTS.map((s, i) => (s.kind === kind ? i : -1)).filter((i) => i >= 0);

export const GROUP_PALETTE = ["#E98F82", "#6FAFD4", "#78B99A", "#D8A653", "#A98BC4", "#5EB9B2"];
export const TEACHER_PALETTE = ["#795A9D", "#C57953", "#347A78", "#4D699F", "#B5577A", "#5E8A3A"];
export const WHOLE_CLASS_COLOR = "#A98BC4";

export const tint = (hex: string, alpha = "24") => `${hex}${alpha}`;
