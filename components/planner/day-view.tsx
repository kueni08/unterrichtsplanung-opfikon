"use client";

import { Fragment } from "react";
import { ArrowRightLeft, CalendarPlus, Clock3, MessageSquareText, Plus, Users } from "lucide-react";

import { ReassignPanel } from "@/components/planner/reassign-panel";
import { SessionCard } from "@/components/planner/session-card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BREAK_AFTER, DAYS, PERIOD_LABEL, PERIOD_STARTS, SLOTS } from "@/lib/planner/constants";
import { addDays, parseIsoDate } from "@/lib/planner/dates";
import type { ChangeEntry, Child, DayKey, DayMeta, Group, Meeting, Session, Teacher } from "@/lib/planner/types";

const dayDateFmt = new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "long" });

export function DayView({ weekStart, selectedDay, onSelectDay, sessions, groups, teachers, kids = [], highlights, dayMeta, disabled, viewerId, onOpenSession, onChangeDay }: {
  weekStart: string;
  selectedDay: DayKey;
  onSelectDay: (day: DayKey) => void;
  sessions: Session[];
  groups: Group[];
  kids?: Child[];
  highlights?: Map<string, ChangeEntry>;
  teachers: Teacher[];
  dayMeta: DayMeta;
  disabled: boolean;
  viewerId: string;
  onOpenSession: (day: DayKey, slot: number) => void;
  onChangeDay: (patch: Partial<DayMeta>) => void;
}) {
  const dayIndex = DAYS.findIndex((d) => d.id === selectedDay);
  const monday = parseIsoDate(weekStart);

  return (
    <section className="day-layout">
      <div className="day-main">
        <div className="section-head day-picker-head">
          <div>
            <p className="eyebrow">Tagesfokus</p>
            <h2>{DAYS.find((d) => d.id === selectedDay)?.label}, {dayDateFmt.format(addDays(monday, dayIndex))}</h2>
          </div>
          <div className="day-pills">
            {DAYS.map((day) => (
              <button type="button" key={day.id} className={selectedDay === day.id ? "active" : ""} onClick={() => onSelectDay(day.id)}>{day.short}</button>
            ))}
          </div>
        </div>
        <div className="timeline">
          {SLOTS.map((slot, index) => {
            const item = sessions.find((session) => session.day === selectedDay && session.slot === index);
            const isMeeting = slot.kind === "meeting";
            const change = item ? highlights?.get(item.id) : undefined;
            return (
              <Fragment key={slot.time}>
                {PERIOD_STARTS.has(index) && <div className={`timeline-period ${isMeeting ? "is-meeting" : ""}`}>{PERIOD_LABEL[slot.period]}</div>}
                <button type="button" className={`timeline-row ${isMeeting ? "slot-meeting" : ""} ${change ? `is-changed-${change.importance}` : ""}`} onClick={() => onOpenSession(selectedDay, index)} disabled={disabled}>
                  <div className="timeline-time"><strong>{slot.time}–{slot.end}</strong><span>{slot.label}</span></div>
                  {item
                    ? <SessionCard session={item} groups={groups} teachers={teachers} kids={kids} viewerId={viewerId} expanded change={change} />
                    : <div className="timeline-empty">{isMeeting ? <><CalendarPlus size={17} /> Freier Termin</> : <><Plus size={17} /> Freier Block</>}</div>}
                </button>
                {BREAK_AFTER[index] && <div className="timeline-break">{BREAK_AFTER[index]}</div>}
              </Fragment>
            );
          })}
        </div>
      </div>
      <DaySidebar day={selectedDay} meta={dayMeta} teachers={teachers} kids={kids} groups={groups} onChange={onChangeDay} disabled={disabled} />
    </section>
  );
}

function DaySidebar({ day, meta, teachers, kids, groups, onChange, disabled }: {
  day: DayKey; meta: DayMeta; teachers: Teacher[]; kids: Child[]; groups: Group[]; onChange: (patch: Partial<DayMeta>) => void; disabled: boolean;
}) {
  function updateMeeting(index: 0 | 1, patch: Partial<Meeting>) {
    const rows: Meeting[] = [meta.meetings[0] ?? { time: "", title: "" }, meta.meetings[1] ?? { time: "", title: "" }];
    rows[index] = { ...rows[index], ...patch };
    const filled = (m: Meeting) => Boolean(m.time || m.title);
    // Position bleibt erhalten (Termin 2 rutscht beim Tippen nicht nach oben); leere Termine am Ende entfallen
    onChange({ meetings: filled(rows[1]) ? rows : filled(rows[0]) ? [rows[0]] : [] });
  }

  return (
    <aside className="day-sidebar" data-tour="day-sidebar">
      {disabled && <div className="sidebar-disabled">Lege zuerst eine Woche aus einer Vorlage an.</div>}
      <section className="side-panel">
        <div className="side-title"><Users /><div><h3>Anwesende Lehrpersonen</h3><p>Wer ist heute vor Ort?</p></div></div>
        <div className="attendance-list">
          {teachers.filter((t) => t.active).map((teacher) => (
            <label key={teacher.id}>
              <Checkbox
                disabled={disabled}
                checked={meta.attendance.includes(teacher.id)}
                onCheckedChange={(checked) => onChange({ attendance: checked ? [...meta.attendance, teacher.id] : meta.attendance.filter((id) => id !== teacher.id) })}
              />
              <span className="teacher-avatar small" style={{ background: teacher.color }}>{teacher.initials}</span>
              <span>{teacher.name}</span>
            </label>
          ))}
        </div>
      </section>
      <section className="side-panel note-panel">
        <div className="side-title"><MessageSquareText /><div><h3>Tagesnotiz</h3><p>Besonderheiten für das ganze Team</p></div></div>
        <Textarea disabled={disabled} value={meta.note} onChange={(e) => onChange({ note: e.target.value })} placeholder="z. B. Besuch, Raumwechsel, Absenzen …" rows={5} />
      </section>
      {kids.some((c) => c.active) && (
        <section className="side-panel reassign-day-panel">
          <div className="side-title"><ArrowRightLeft /><div><h3>Kinder heute umteilen</h3><p>Gilt für alle Lektionen des Tages</p></div></div>
          <ReassignPanel list={meta.reassignments} onChange={(next) => onChange({ reassignments: next })} kids={kids} groups={groups} day={meta} disabled={disabled} compact />
        </section>
      )}
      <section className="side-panel meetings-panel">
        <div className="side-title"><Clock3 /><div><h3>Sitzungen</h3><p>Bis zu zwei Termine pro Tag</p></div></div>
        {([0, 1] as const).map((index) => {
          const meeting = meta.meetings[index] ?? { time: "", title: "" };
          return (
            <div className="meeting-row" key={`${day}-${index}`}>
              <Input disabled={disabled} type="time" value={meeting.time} onChange={(e) => updateMeeting(index, { time: e.target.value })} aria-label={`Uhrzeit Termin ${index + 1}`} />
              <Input disabled={disabled} value={meeting.title} onChange={(e) => updateMeeting(index, { title: e.target.value })} placeholder={index === 0 ? "Stufensitzung" : "Zweiter Termin"} aria-label={`Titel Termin ${index + 1}`} />
            </div>
          );
        })}
      </section>
    </aside>
  );
}
