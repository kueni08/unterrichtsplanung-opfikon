"use client";

import { Fragment, useState, type DragEvent } from "react";
import { CalendarPlus, Clock3, MessageSquareText, Plus, Users } from "lucide-react";

import { SessionCard } from "@/components/planner/session-card";
import { BREAK_AFTER, DAYS, PERIOD_LABEL, PERIOD_STARTS, SLOTS } from "@/lib/planner/constants";
import { addDays, parseIsoDate } from "@/lib/planner/dates";
import type { DayKey, Group, Session, Teacher, WeekDays } from "@/lib/planner/types";

const dateFmt = new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit" });

export function WeekGrid({ sessions, weekDays, weekStart, groups, teachers, viewerId, onOpen, onDayHeaderClick, onMove }: {
  sessions: Session[];
  weekDays: WeekDays;
  weekStart: string;
  groups: Group[];
  teachers: Teacher[];
  viewerId: string;
  onOpen: (day: DayKey, slot: number) => void;
  onDayHeaderClick: (day: DayKey) => void;
  onMove: (sessionId: string, day: DayKey, slot: number) => void;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ day: DayKey; slot: number; edge: "before" | "after" } | null>(null);
  const monday = parseIsoDate(weekStart);

  function dragOver(event: DragEvent<HTMLButtonElement>, day: DayKey, slot: number, occupied: boolean) {
    if (!draggedId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const dragged = sessions.find((item) => item.id === draggedId);
    let edge: "before" | "after" = "before";
    if (occupied && dragged?.day === day && dragged.slot !== slot) edge = dragged.slot < slot ? "after" : "before";
    else if (occupied) {
      const bounds = event.currentTarget.getBoundingClientRect();
      edge = event.clientY > bounds.top + bounds.height / 2 ? "after" : "before";
    }
    setDropTarget({ day, slot, edge });
  }

  function drop(event: DragEvent<HTMLButtonElement>, day: DayKey, slot: number, occupied: boolean) {
    event.preventDefault();
    const sessionId = event.dataTransfer.getData("application/x-lesson-id") || draggedId;
    if (!sessionId) { setDraggedId(null); setDropTarget(null); return; }
    const dragged = sessions.find((item) => item.id === sessionId);
    const edge = dropTarget?.day === day && dropTarget.slot === slot ? dropTarget.edge : "before";
    const exactSlot = dragged?.day === day || !occupied || edge === "before" ? slot : Math.min(slot + 1, SLOTS.length - 1);
    onMove(sessionId, day, exactSlot);
    setDraggedId(null);
    setDropTarget(null);
  }

  return (
    <div className="planner-scroll">
      <div className="week-grid">
        <div className="grid-corner"><Clock3 size={16} /> Zeit</div>
        {DAYS.map((day, dayIndex) => {
          const meta = weekDays[day.id];
          return (
            <button type="button" className="day-head" key={day.id} onClick={() => onDayHeaderClick(day.id)}>
              <span>{day.label}</span>
              <strong>{dateFmt.format(addDays(monday, dayIndex))}</strong>
              <div className="day-head-meta">
                <span><Users size={13} /> {meta.attendance.length} LP</span>
                {(meta.note.trim() || meta.meetings.some((m) => m.time || m.title.trim())) && <span className="has-note"><MessageSquareText size={13} /> Info</span>}
              </div>
            </button>
          );
        })}
        {SLOTS.map((slot, slotIndex) => {
          const isMeeting = slot.kind === "meeting";
          return (
            <Fragment key={slot.time}>
              {PERIOD_STARTS.has(slotIndex) && <div className={`period-row ${isMeeting ? "is-meeting" : ""}`}>{PERIOD_LABEL[slot.period]}</div>}
              <div className={`grid-row-contents ${isMeeting ? "slot-meeting" : ""}`}>
                <div className="time-cell">
                  <strong>{slot.time}–{slot.end}</strong><span>{slot.label}</span>
                  {slotIndex === 0 && <em>{slot.period}</em>}
                </div>
                {DAYS.map((day) => {
                  const item = sessions.find((session) => session.day === day.id && session.slot === slotIndex);
                  const isTarget = dropTarget?.day === day.id && dropTarget.slot === slotIndex;
                  return (
                    <button
                      type="button"
                      className={`lesson-cell ${isMeeting ? "meeting-cell" : ""} ${item?.id === draggedId ? "is-dragging" : ""} ${isTarget ? `drop-${dropTarget.edge}` : ""}`}
                      key={`${day.id}-${slotIndex}`}
                      draggable={Boolean(item)}
                      onDragStart={(event) => {
                        if (!item) return;
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("application/x-lesson-id", item.id);
                        event.dataTransfer.setData("text/plain", item.title);
                        setDraggedId(item.id);
                      }}
                      onDragOver={(event) => dragOver(event, day.id, slotIndex, Boolean(item))}
                      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropTarget(null); }}
                      onDrop={(event) => drop(event, day.id, slotIndex, Boolean(item))}
                      onDragEnd={() => { setDraggedId(null); setDropTarget(null); }}
                      onClick={() => onOpen(day.id, slotIndex)}
                      aria-label={`${day.label}, ${slot.label}${item ? ": öffnen" : isMeeting ? ": Termin planen" : " planen"}`}
                    >
                      {item
                        ? <SessionCard session={item} groups={groups} teachers={teachers} viewerId={viewerId} showDragHandle />
                        : <span className="add-cell">{isMeeting ? <><CalendarPlus size={16} /> Termin</> : <><Plus size={16} /> Planen</>}</span>}
                    </button>
                  );
                })}
              </div>
              {BREAK_AFTER[slotIndex] && <div className="break-row">{BREAK_AFTER[slotIndex]}</div>}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
