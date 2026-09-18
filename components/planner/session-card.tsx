import { CalendarClock, GripVertical, MapPin, Users } from "lucide-react";

import { isMeetingSlot } from "@/lib/planner/constants";
import { countChildren, groupClusters, isVisibleFor, meetingParticipants, sessionTeacherIds } from "@/lib/planner/logic";
import { describeReassignments } from "@/lib/planner/reassign";
import { subjectsOf } from "@/lib/planner/logic";
import { subjectStyles } from "@/lib/planner/subjects";
import { SubjectIcon } from "@/components/planner/subject-icon";
import type { Child, Group, Session, Teacher } from "@/lib/planner/types";

const STATUS_LABEL: Record<Session["status"], string> = {
  planned: "Geplant", open: "Offen", done: "Erledigt", carried: "Übertragen",
};

export function SessionCard({ session, groups, teachers, kids = [], viewerId = "all", expanded = false, showDragHandle = false }: {
  session: Session;
  groups: Group[];
  kids?: Child[];
  teachers: Teacher[];
  viewerId?: string;
  expanded?: boolean;
  showDragHandle?: boolean;
}) {
  const isMeeting = isMeetingSlot(session.slot);

  if (viewerId !== "all" && !isVisibleFor(session, viewerId)) {
    return (
      <div className={`session-card is-foreign ${isMeeting ? "meeting-card" : ""}`}>
        <div className="session-title-row">{!isMeeting && <SubjectIcon subjects={subjectsOf(session)} />}<strong>{session.title}</strong></div>
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

  const clusters = groupClusters(session.assignments, groups);
  const subjects = subjectsOf(session);
  const subjectColor = subjectStyles(subjects, 1)[0]?.color ?? "#9aabc0";
  const subjectsDiffer = new Set(clusters.filter((c) => !c.assignment.off && c.assignment.subject).map((c) => c.assignment.subject)).size > 1;

  return (
    <div className={`session-card ${expanded ? "expanded" : ""} status-${session.status}`} title={session.title} style={session.status === "planned" ? { borderLeftColor: subjectColor } : undefined}>
      <div className="session-title-row">
        {showDragHandle && <span className="card-drag-handle" aria-hidden="true"><GripVertical /></span>}
        <SubjectIcon subjects={subjects} size={expanded ? "md" : "sm"} />
        <strong>{session.title}</strong>
        {session.homework.trim() && <span className="hw-pill" title={`Hausaufgaben: ${session.homework}`}>HA</span>}
        {(session.reassignments?.length ?? 0) > 0 && <span className="hw-pill is-reassign" title={`Umgeteilt: ${describeReassignments(session.reassignments, kids, groups).join(", ")}`}>↔ {session.reassignments!.length}</span>}
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
          clusters
            .slice(0, expanded ? 6 : 3)
            .map(({ assignment, groups: members }) => {
              const label = members.map((g) => g.short).join(" + ");
              const dots = <span className="group-dots">{members.map((g) => <span className="group-dot" key={g.id} style={{ background: g.color }} />)}</span>;
              const key = members[0].id;

              if (assignment.off) {
                return (
                  <div className="assignment is-off" key={key} title={`${members.map((g) => g.name).join(" + ")} · frei`}>
                    {dots}
                    <b>{label}</b>
                    <span className="teacher-free">frei</span>
                  </div>
                );
              }

              const teacher = teachers.find((t) => t.id === assignment.teacherId);
              const coTeacher = assignment.coTeacherId ? teachers.find((t) => t.id === assignment.coTeacherId) : null;
              const showSubject = Boolean(assignment.subject) && (subjectsDiffer || assignment.subject !== session.title);
              const detail = [showSubject ? assignment.subject : null, assignment.room].filter(Boolean).join(" · ");
              const tooltip = [members.map((g) => g.name).join(" + "), assignment.subject, assignment.room].filter(Boolean).join(" · ");

              return (
                <div className={`assignment ${members.length > 1 ? "is-merged" : ""}`} key={key} title={tooltip}>
                  {dots}
                  <b>{label}</b>
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
