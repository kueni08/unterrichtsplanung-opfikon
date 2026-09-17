import { GripVertical, MapPin } from "lucide-react";

import { countChildren, isVisibleFor } from "@/lib/planner/logic";
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
  if (viewerId !== "all" && !isVisibleFor(session, viewerId)) {
    return (
      <div className="session-card is-foreign">
        <div className="session-title-row"><strong>{session.title}</strong></div>
        <p className="foreign-hint">nicht deine Lektion</p>
      </div>
    );
  }

  const knownGroupIds = new Set(groups.map((g) => g.id));

  return (
    <div className={`session-card ${expanded ? "expanded" : ""} status-${session.status}`}>
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
              {session.assignments.map((a) => teachers.find((t) => t.id === a.teacherId)?.initials).filter(Boolean).join(" · ")}
            </span>
          </div>
        ) : (
          session.assignments
            .filter((a) => knownGroupIds.has(a.groupId))
            .slice(0, expanded ? 6 : 3)
            .map((assignment) => {
              const group = groups.find((g) => g.id === assignment.groupId);
              const teacher = teachers.find((t) => t.id === assignment.teacherId);
              if (!group) return null;
              return (
                <div className="assignment" key={`${assignment.groupId}-${assignment.teacherId}`}>
                  <span className="group-dot" style={{ background: group.color }} />
                  <b>{group.short}</b>
                  {teacher ? <span>{teacher.initials}</span> : <span className="teacher-open">offen</span>}
                </div>
              );
            })
        )}
      </div>
      {expanded && session.room && <div className="room-line"><MapPin size={14} />{session.room}</div>}
    </div>
  );
}
