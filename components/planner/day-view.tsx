"use client";

import { Fragment } from "react";
import { Clock3, MessageSquareText, Plus, Users } from "lucide-react";

import { SessionCard } from "@/components/planner/session-card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BREAK_AFTER, DAYS, SLOTS } from "@/lib/planner/constants";
import { addDays, parseIsoDate } from "@/lib/planner/dates";
import type { DayKey, DayMeta, Group, Meeting, Session, Teacher } from "@/lib/planner/types";

const dayDateFmt = new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "long" });

export function DayView({ weekStart, selectedDay, onSelectDay, sessions, groups, teachers, dayMeta, disabled, viewerId, onOpenSession, onChangeDay }: {
  weekStart: string;
  selectedDay: DayKey;
  onSelectDay: (day: DayKey) => void;
  sessions: Session[];
  groups: Group[];
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
            return (
              <Fragment key={slot.time}>
                <button type="button" className="timeline-row" onClick={() => onOpenSession(selectedDay, index)} disabled={disabled}>
                  <div className="timeline-time"><strong>{slot.time}–{slot.end}</strong><span>{slot.label}</span></div>
                  {item ? <SessionCard session={item} groups={groups} teachers={teachers} viewerId={viewerId} expanded /> : <div className="timeline-empty"><Plus size={17} /> Freier Block</div>}
                </button>
                {BREAK_AFTER[index] && <div className="timeline-break">{BREAK_AFTER[index]}</div>}
              </Fragment>
            );
          })}
        </div>
      </div>
      <DaySidebar day={selectedDay} meta={dayMeta} teachers={teachers} onChange={onChangeDay} disabled={disabled} />
    </section>
  );
}

function DaySidebar({ day, meta, teachers, onChange, disabled }: {
  day: DayKey; meta: DayMeta; teachers: Teacher[]; onChange: (patch: Partial<DayMeta>) => void; disabled: boolean;
}) {
  function updateMeeting(index: 0 | 1, patch: Partial<Meeting>) {
    const rows: Meeting[] = [meta.meetings[0] ?? { time: "", title: "" }, meta.meetings[1] ?? { time: "", title: "" }];
    rows[index] = { ...rows[index], ...patch };
    const second = rows[1];
    onChange({ meetings: second.time || second.title ? rows : [rows[0]] });
  }

  return (
    <aside className="day-sidebar">
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
