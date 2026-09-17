import { CalendarClock, GripVertical, MapPin, Users } from "lucide-react";

import { isMeetingSlot } from "@/lib/planner/constants";
import { countChildren, isVisibleFor, meetingParticipants, sessionTeacherIds } from "@/lib/planner/logic";
import type { Group, Session, Teacher } from "@/lib/planner/types";

const STATUS_LABEL: Record<Session["status"], string> = {
  planned: "Geplant", open: "Offen", done: "Erledigt", carried: "Übertragen",
};

export function SessionCard({ session, groups, teachers, viewerId = "all", expanded = false, showDragHandle = false }: {
  session: Session;
  groups: Group[];
  teachers: Teacher[];
  viewerId?: string;
  expanded?: boolean;
  showDragHandle?: boolean;
}) {
  const isMeeting = isMeetingSlot(session.slot);

  if (viewerId !== "all" && !isVisibleFor(session, viewerId)) {
    return (
      <div className={`session-card is-foreign ${isMeeting ? "meeting-card" : ""}`}>
        <div className="session-title-row"><strong>{session.title}</strong></div>
        <p className="foreign-hint">{isMeeting ? "nicht dein Termin" : "nicht deine Lektion"}</p>
      </div>
    );
  }

  if (isMeeting) {
    const participants = meetingParticipants(session).map((id) => teachers.find((t) => t.id === id)).filter((t): t is Teacher => Boolean(t));
    return (
      <div className={`session-card meeting-card ${expanded ? "expanded" : ""} status-${session.status}`} title={session.title}>
        <div className="session-title-row">
          {showDragHandle && <span className="card-drag-handle" aria-hidden="true"><GripVertical /></span>}
          <span className="meeting-icon" aria-hidden="true"><CalendarClock /></span>
          <strong>{session.title}</strong>
          {session.status !== "planned" && <span className="status-pill">{STATUS_LABEL[session.status]}</span>}
        </div>
        {session.focus && <p>{session.focus}</p>}
        <div className="meeting-people" title={participants.length ? participants.map((t) => t.name).join(", ") : "ganzes Team"}>
          <Users size={12} />
          {participants.length
            ? participants.map((t) => <span className="teacher-avatar tiny" key={t.id} style={{ background: t.color }}>{t.initials}</span>)
            : <span className="meeting-all">ganzes Team</span>}
        </div>
        {session.room && <div className="room-line"><MapPin size={14} />{session.room}</div>}
      </div>
    );
  }

  const knownGroupIds = new Set(groups.map((g) => g.id));
  const activeAssignments = session.assignments.filter((a) => !a.off);
  const subjectsDiffer = new Set(activeAssignments.filter((a) => a.subject).map((a) => a.subject)).size > 1;

  return (
    <div className={`session-card ${expanded ? "expanded" : ""} status-${session.status}`} title={session.title}>
      <div className="session-title-row">
        {showDragHandle && <span className="card-drag-handle" aria-hidden="true"><GripVertical /></span>}
        <strong>{session.title}</strong>
        {session.status !== "planned" && <span className="status-pill">{STATUS_LABEL[session.status]}</span>}
      </div>
      {session.focus && <p>{session.focus}</p>}
      <div className="assignment-list">
        {session.wholeClass ? (
          <div className="assignment all-assignment">
            <span className="group-dot all-dot" />
            <b>Alle {countChildren(groups)}</b>
            <span className="teacher-mini-list">
              {sessionTeacherIds(session).map((id) => teachers.find((t) => t.id === id)?.initials).filter(Boolean).join(" · ")}
            </span>
          </div>
        ) : (
          session.assignments
            .filter((a) => knownGroupIds.has(a.groupId))
            .slice(0, expanded ? 6 : 3)
            .map((assignment) => {
              const group = groups.find((g) => g.id === assignment.groupId);
              if (!group) return null;

              if (assignment.off) {
                return (
                  <div className="assignment is-off" key={assignment.groupId} title={`${group.name} · frei`}>
                    <span className="group-dot" style={{ background: group.color }} />
                    <b>{group.short}</b>
                    <span className="teacher-free">frei</span>
                  </div>
                );
              }

              const teacher = teachers.find((t) => t.id === assignment.teacherId);
              const coTeacher = assignment.coTeacherId ? teachers.find((t) => t.id === assignment.coTeacherId) : null;
              const showSubject = Boolean(assignment.subject) && (subjectsDiffer || assignment.subject !== session.title);
              const detail = [showSubject ? assignment.subject : null, assignment.room].filter(Boolean).join(" · ");
              const tooltip = [group.name, assignment.subject, assignment.room].filter(Boolean).join(" · ");

              return (
                <div className="assignment" key={assignment.groupId} title={tooltip}>
                  <span className="group-dot" style={{ background: group.color }} />
                  <b>{group.short}</b>
                  {teacher
                    ? <span>{teacher.initials}{coTeacher ? `/${coTeacher.initials}` : ""}</span>
                    : <span className="teacher-open">offen</span>}
                  {detail && <small className="assignment-detail">{detail}</small>}
                </div>
              );
            })
        )}
      </div>
      {expanded && session.room && <div className="room-line"><MapPin size={14} />{session.room}</div>}
    </div>
  );
}
