import type { DayKey } from "./types.ts";

export const DAYS: { id: DayKey; label: string; short: string }[] = [
  { id: "mo", label: "Montag", short: "Mo" },
  { id: "di", label: "Dienstag", short: "Di" },
  { id: "mi", label: "Mittwoch", short: "Mi" },
  { id: "do", label: "Donnerstag", short: "Do" },
  { id: "fr", label: "Freitag", short: "Fr" },
];

/** Lektionenraster gemäss Stundenplan Kastanie SJ 26/27 */
export const SLOTS = [
  { label: "1. Lektion", time: "07:30", end: "08:15", period: "Morgen" },
  { label: "2. Lektion", time: "08:20", end: "09:05", period: "Morgen" },
  { label: "3. Lektion", time: "09:10", end: "09:55", period: "Morgen" },
  { label: "4. Lektion", time: "10:25", end: "11:10", period: "Morgen" },
  { label: "5. Lektion", time: "11:15", end: "12:00", period: "Morgen" },
  { label: "6. Lektion", time: "13:40", end: "14:25", period: "Nachmittag" },
  { label: "7. Lektion", time: "14:30", end: "15:15", period: "Nachmittag" },
];

/** Index der ersten Nachmittagslektion (für die Mittagstrennung im Raster) */
export const AFTERNOON_START = SLOTS.findIndex((s) => s.period === "Nachmittag");
/** Nach diesen Lektionen folgt eine Pause */
export const BREAK_AFTER: Record<number, string> = { 2: "Pause", 4: "Mittag" };

export const GROUP_PALETTE = ["#E98F82", "#6FAFD4", "#78B99A", "#D8A653", "#A98BC4", "#5EB9B2"];
export const TEACHER_PALETTE = ["#795A9D", "#C57953", "#347A78", "#4D699F", "#B5577A", "#5E8A3A"];
export const WHOLE_CLASS_COLOR = "#A98BC4";

export const tint = (hex: string, alpha = "24") => `${hex}${alpha}`;
