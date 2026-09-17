"use client";

import { BookOpenCheck, History, StickyNote } from "lucide-react";

import { DAYS } from "@/lib/planner/constants";
import { sessionDate } from "@/lib/planner/invite";
import { previousLessons } from "@/lib/planner/logic";
import type { Session } from "@/lib/planner/types";

const dateFmt = new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit" });

export function lessonDateLabel(session: Session): string {
  const date = sessionDate(session);
  const day = DAYS.find((d) => d.id === session.day)?.short ?? "";
  return date ? `${day} ${dateFmt.format(new Date(`${date}T00:00:00`))}` : day;
}

/**
 * Rückblick im Lektions-Editor: Was wurde in diesem Fach zuletzt gemacht, welche
 * Hausaufgaben wurden verteilt, und was hat sich die Lehrperson fürs nächste Mal notiert?
 * Wird automatisch aus den früheren Lektionen abgeleitet – nichts muss kopiert werden.
 */
export function LessonHistory({ all, current, onOpen }: { all: Session[]; current: Session; onOpen?: (id: string) => void }) {
  const previous = previousLessons(all, current, 3);
  if (previous.length === 0) return null;
  // jüngste Notiz „fürs nächste Mal“ aus den früheren Lektionen
  const last = previous.find((s) => s.nextTime.trim());

  return (
    <section className="history-panel" aria-label="Rückblick">
      <h4><History size={15} /> Zuletzt in diesem Fach</h4>
      {last && (
        <div className="history-next">
          <StickyNote size={14} />
          <div><strong>Fürs heutige Mal notiert</strong> ({lessonDateLabel(last)}): {last.nextTime}</div>
        </div>
      )}
      <ol className="history-list">
        {previous.map((s) => (
          <li key={s.id}>
            <button type="button" className="history-head" onClick={() => onOpen?.(s.id)} title="Lektion öffnen">
              <span className="history-date">{lessonDateLabel(s)}</span>
              <strong>{s.title}</strong>
              {s.focus.trim() && <span className="history-focus">{s.focus}</span>}
            </button>
            {s.homework.trim() && <p className="history-line"><BookOpenCheck size={13} /> <span><b>HA:</b> {s.homework}</span></p>}
            {s.notes.trim() && <p className="history-line history-notes">{s.notes.length > 220 ? `${s.notes.slice(0, 220)}…` : s.notes}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
