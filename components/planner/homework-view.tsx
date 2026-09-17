"use client";

import { useState } from "react";
import { BookOpenCheck, ChevronDown, ChevronUp } from "lucide-react";

import { lessonDateLabel } from "@/components/planner/lesson-history";
import { homeworkBySubject, type HomeworkEntry } from "@/lib/planner/logic";
import type { Group, Session } from "@/lib/planner/types";

/**
 * Übersicht der verteilten Hausaufgaben: je Fach die neueste Hausaufgabe zuoberst,
 * frühere auf Wunsch. Ein Klick öffnet die zugehörige Lektion.
 */
export function HomeworkView({ sessions, groups, onOpen }: { sessions: Session[]; groups: Group[]; onOpen: (id: string) => void }) {
  const bySubject = [...homeworkBySubject(sessions).values()].sort((a, b) => a[0].subject.localeCompare(b[0].subject, "de"));

  if (bySubject.length === 0) {
    return (
      <section className="homework-empty">
        <BookOpenCheck size={28} />
        <h2>Noch keine Hausaufgaben erfasst</h2>
        <p>Im Lektions-Editor gibt es das Feld „Hausaufgaben“. Alles, was dort steht, erscheint hier je Fach – die neueste Aufgabe zuoberst.</p>
      </section>
    );
  }

  return (
    <section className="homework-view">
      <div className="section-head">
        <div>
          <p className="eyebrow">Hausaufgaben</p>
          <h2>Zuletzt verteilt, je Fach</h2>
        </div>
      </div>
      <div className="homework-grid">
        {bySubject.map((entries) => <SubjectCard key={entries[0].subject} entries={entries} groups={groups} onOpen={onOpen} />)}
      </div>
    </section>
  );
}

function SubjectCard({ entries, groups, onOpen }: { entries: HomeworkEntry[]; groups: Group[]; onOpen: (id: string) => void }) {
  const [showAll, setShowAll] = useState(false);
  const [latest, ...older] = entries;
  return (
    <article className="homework-card">
      <h3>{latest.subject}</h3>
      <HomeworkRow entry={latest} groups={groups} onOpen={onOpen} latest />
      {older.length > 0 && (
        <>
          {showAll && older.map((e) => <HomeworkRow key={e.session.id} entry={e} groups={groups} onOpen={onOpen} />)}
          <button type="button" className="homework-more" onClick={() => setShowAll((v) => !v)}>
            {showAll ? <><ChevronUp size={14} /> weniger</> : <><ChevronDown size={14} /> {older.length} frühere</>}
          </button>
        </>
      )}
    </article>
  );
}

function HomeworkRow({ entry, groups, onOpen, latest = false }: { entry: HomeworkEntry; groups: Group[]; onOpen: (id: string) => void; latest?: boolean }) {
  const members = entry.groupIds.length ? groups.filter((g) => entry.groupIds.includes(g.id)) : [];
  return (
    <button type="button" className={`homework-row ${latest ? "is-latest" : ""}`} onClick={() => onOpen(entry.session.id)} title="Lektion öffnen">
      <span className="homework-meta">
        <span className="history-date">{lessonDateLabel(entry.session)}</span>
        {members.length
          ? members.map((g) => <span className="group-chip" key={g.id} style={{ background: g.color }}>{g.short}</span>)
          : <span className="group-chip all">Alle</span>}
      </span>
      <span className="homework-text">{entry.session.homework}</span>
    </button>
  );
}
