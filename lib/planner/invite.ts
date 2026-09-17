import { DAYS, SLOTS } from "./constants.ts";
import { addDays, isoDate, parseIsoDate } from "./dates.ts";
import type { DayKey, Session, Teacher } from "./types.ts";

/**
 * Einladungen zu Terminen (Sitzungen, Elterngespräche): Die App läuft ohne eigenen
 * Server, darum entsteht die Einladung als E-Mail-Entwurf im Mailprogramm (mailto)
 * und als Kalenderdatei (.ics), die sich anhängen oder direkt importieren lässt.
 */

export type InviteDetails = {
  title: string;
  /** ISO-Datum des Tages */
  date: string;
  start: string;
  end: string;
  room: string;
  description: string;
  participants: string[];
};

const dateFmt = new Intl.DateTimeFormat("de-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** Kalenderdatum eines Blocks innerhalb einer Woche (null für Vorlagen). */
export function sessionDate(session: Pick<Session, "weekStart" | "day">): string | null {
  if (!session.weekStart) return null;
  const dayIndex = DAYS.findIndex((d) => d.id === session.day);
  return isoDate(addDays(parseIsoDate(session.weekStart), Math.max(0, dayIndex)));
}

export function inviteDetails(session: Session, teachers: Teacher[]): InviteDetails | null {
  const date = sessionDate(session);
  const slot = SLOTS[session.slot];
  if (!date || !slot) return null;
  const participantIds = new Set(session.assignments.filter((a) => !a.off && a.teacherId).map((a) => a.teacherId));
  return {
    title: session.title.trim() || slot.label,
    date,
    start: slot.time,
    end: slot.end,
    room: session.room.trim(),
    description: [session.focus.trim(), session.notes.trim()].filter(Boolean).join("\n\n"),
    participants: teachers.filter((t) => participantIds.has(t.id)).map((t) => t.name),
  };
}

export function formatInviteDate(date: string): string {
  return dateFmt.format(parseIsoDate(date));
}

/** Text der Einladung, wie er im Mailprogramm erscheint. */
export function inviteBody(details: InviteDetails, teamName: string): string {
  const lines = [
    `Einladung: ${details.title}`,
    "",
    `Datum: ${formatInviteDate(details.date)}`,
    `Zeit: ${details.start}–${details.end} Uhr`,
  ];
  if (details.room) lines.push(`Ort: ${details.room}`);
  if (details.participants.length) lines.push(`Teilnehmende: ${details.participants.join(", ")}`);
  if (details.description) lines.push("", details.description);
  lines.push("", "Bitte kurz bestätigen. Danke!", "", `– ${teamName} · Wochenatelier`);
  return lines.join("\n");
}

export function mailtoLink(to: string, subject: string, body: string): string {
  const recipients = to.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean).join(",");
  return `mailto:${recipients}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const icsEscape = (value: string) => value
  .replace(/\\/g, "\\\\")
  .replace(/;/g, "\\;")
  .replace(/,/g, "\\,")
  .replace(/\r?\n/g, "\\n");
const icsStamp = (date: string, time: string) => `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;

/** Zeilen länger als 75 Byte werden gemäss RFC 5545 umgebrochen. */
function foldLine(line: string): string {
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 74) { parts.push(rest.slice(0, 74)); rest = ` ${rest.slice(74)}`; }
  parts.push(rest);
  return parts.join("\r\n");
}

/** Kalendereintrag mit lokaler Zeit (ohne Zeitzone) – passend für ein Schulteam am gleichen Ort. */
export function buildIcs(details: InviteDetails, uid: string, now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const description = [details.description, details.participants.length ? `Teilnehmende: ${details.participants.join(", ")}` : ""].filter(Boolean).join("\n\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Wochenatelier//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}@wochenatelier`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${icsStamp(details.date, details.start)}`,
    `DTEND:${icsStamp(details.date, details.end)}`,
    `SUMMARY:${icsEscape(details.title)}`,
  ];
  if (details.room) lines.push(`LOCATION:${icsEscape(details.room)}`);
  if (description) lines.push(`DESCRIPTION:${icsEscape(description)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

export function icsFileName(details: InviteDetails): string {
  const slug = details.title.toLowerCase().replace(/[^a-z0-9äöü]+/g, "-").replace(/^-|-$/g, "") || "termin";
  return `${details.date}-${slug}.ics`;
}

export const dayLabelOf = (day: DayKey): string => DAYS.find((d) => d.id === day)?.label ?? day;
