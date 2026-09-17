import type { DayKey } from "./types.ts";

export const DAYS: { id: DayKey; label: string; short: string }[] = [
  { id: "mo", label: "Montag", short: "Mo" },
  { id: "di", label: "Dienstag", short: "Di" },
  { id: "mi", label: "Mittwoch", short: "Mi" },
  { id: "do", label: "Donnerstag", short: "Do" },
  { id: "fr", label: "Freitag", short: "Fr" },
];

export const SLOTS = [
  { label: "1. Lektion", time: "08:10", period: "Morgen" },
  { label: "2. Lektion", time: "09:00", period: "Morgen" },
  { label: "3. Lektion", time: "10:10", period: "Morgen" },
  { label: "4. Lektion", time: "11:00", period: "Morgen" },
  { label: "5. Lektion", time: "11:50", period: "Morgen" },
  { label: "6. Lektion", time: "13:30", period: "Nachmittag" },
  { label: "7. Lektion", time: "14:20", period: "Nachmittag" },
  { label: "8. Lektion", time: "15:20", period: "Nachmittag" },
];

export const GROUP_PALETTE = ["#E98F82", "#6FAFD4", "#78B99A", "#D8A653", "#A98BC4", "#5EB9B2"];
export const TEACHER_PALETTE = ["#795A9D", "#C57953", "#347A78", "#4D699F", "#B5577A", "#5E8A3A"];
export const WHOLE_CLASS_COLOR = "#A98BC4";

export const tint = (hex: string, alpha = "24") => `${hex}${alpha}`;
