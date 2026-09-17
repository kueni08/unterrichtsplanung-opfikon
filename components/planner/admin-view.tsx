"use client";

import { Fragment, useState } from "react";
import { CalendarDays, Check, CircleAlert, Copy, Download, Plus, RefreshCw, RotateCcw, Trash2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DAYS, GROUP_PALETTE, SLOTS, tint } from "@/lib/planner/constants";
import { isoDate } from "@/lib/planner/dates";
import { daysFromTemplate, sessionsIn } from "@/lib/planner/logic";
import type { PlannerApi } from "@/hooks/use-planner";
import type { DayKey, DayMeta, Group, PlannerSnapshot, Session, Teacher, WeekDays } from "@/lib/planner/types";

export function AdminView({ api, snapshot, mode, selectedTemplateId, onSelectTemplate, onOpenSheet, currentUserId }: {
  api: PlannerApi;
  snapshot: PlannerSnapshot;
  mode: "demo" | "team";
  selectedTemplateId: string;
  onSelectTemplate: (id: string) => void;
  onOpenSheet: (id: string) => void;
  currentUserId: string;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [groupRemoveId, setGroupRemoveId] = useState<string | null>(null);
  const [newTeacherName, setNewTeacherName] = useState("");
  const selectedTemplate = snapshot.templates.find((t) => t.id === selectedTemplateId) ?? null;

  function openTemplateCell(day: DayKey, slot: number) {
    const list = sessionsIn(snapshot.sessions, { templateId: selectedTemplateId });
    const existing = list.find((s) => s.day === day && s.slot === slot);
    if (existing) { onOpenSheet(existing.id); return; }
    const id = api.addSession({ templateId: selectedTemplateId }, day, slot);
    if (id) onOpenSheet(id);
  }

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(snapshot.team.joinCode);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1500);
    } catch { /* Zwischenablage nicht verfügbar */ }
  }

  function handleBackup() {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wochenatelier-backup-${isoDate(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // erst nach dem Start des Downloads freigeben (Safari/Firefox brechen sonst ab)
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handleRemoveGroup(id: string) {
    if (groupRemoveId !== id) { setGroupRemoveId(id); return; }
    setGroupRemoveId(null);
    api.removeGroup(id);
  }

  function handleAddTeacher() {
    api.addTeacher(newTeacherName.trim() || "Neue Lehrperson");
    setNewTeacherName("");
  }

  return (
    <>
      <div className="admin-heading">
        <div>
          <p className="eyebrow">Grundstruktur</p>
          <h2>Planung verwalten</h2>
          <p>Hier werden Vorlagen, Gruppen und das Team für alle künftigen Wochen gepflegt.</p>
        </div>
        <div className="admin-heading-actions">
          <Button variant="outline" onClick={handleBackup}><Download /> Backup herunterladen (JSON)</Button>
          {mode === "demo" && api.resetDemo && <Button variant="outline" onClick={() => api.resetDemo?.()}><RotateCcw /> Beispieldaten zurücksetzen</Button>}
        </div>
      </div>
      <section className="admin-grid">
        <article className="admin-card team-card">
          <div className="card-heading"><span className="icon-box blue"><Users /></span><div><h3>Team</h3><p>Name, Beitrittscode und Mitglieder</p></div></div>
          <div className="field-stack"><label htmlFor="team-name-input">Teamname</label><Input id="team-name-input" value={snapshot.team.name} onChange={(e) => api.renameTeam(e.target.value)} disabled={mode === "demo"} /></div>
          <div className="join-code-block">
            <span className="join-code-label">Beitrittscode</span>
            <div className="join-code-row">
              <strong className="join-code-value">{snapshot.team.joinCode}</strong>
              <Button type="button" variant="outline" size="icon" onClick={handleCopyCode} aria-label="Code kopieren">{copyState === "copied" ? <Check size={16} /> : <Copy size={16} />}</Button>
              <Button type="button" variant="outline" size="icon" onClick={() => api.regenerateJoinCode()} aria-label="Neuen Code erzeugen" disabled={mode === "demo"}><RefreshCw size={16} /></Button>
            </div>
          </div>
          <div className="settings-list member-list">
            {snapshot.members.map((member) => (
              <div className="member-row" key={member.userId}>
                <span className="member-name">{member.displayName}{member.userId === currentUserId && <em> (du)</em>}</span>
                <Select value={member.role} onValueChange={(value) => api.updateMember(member.userId, { role: value as "koordination" | "lehrperson" })} disabled={mode === "demo"}>
                  <SelectTrigger className="member-role"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="koordination">Koordination</SelectItem><SelectItem value="lehrperson">Lehrperson</SelectItem></SelectContent>
                </Select>
                <Select value={member.teacherId ?? "none"} onValueChange={(value) => api.updateMember(member.userId, { teacherId: value === "none" ? null : value })} disabled={mode === "demo"}>
                  <SelectTrigger className="member-teacher"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— kein Kürzel —</SelectItem>
                    {snapshot.teachers.map((teacher) => <SelectItem key={teacher.id} value={teacher.id}>{teacher.initials} · {teacher.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {member.userId !== currentUserId && (
                  <Button type="button" variant="ghost" size="icon" disabled={mode === "demo"} onClick={() => { if (window.confirm(`${member.displayName} wirklich aus dem Team entfernen?`)) api.removeMember(member.userId); }} aria-label={`${member.displayName} entfernen`}>
                    <Trash2 size={15} />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </article>

        <article className="admin-card template-card">
          <div className="card-heading"><span className="icon-box blue"><CalendarDays /></span><div><h3>Wochenvorlage</h3><p>Ausgangslage für neue Wochen</p></div></div>
          <Select value={selectedTemplateId} onValueChange={onSelectTemplate}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{snapshot.templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
          {selectedTemplate && (
            <div className="field-stack template-name-field">
              <label htmlFor="template-name-input">Name der Vorlage</label>
              <Input id="template-name-input" value={selectedTemplate.name} onChange={(e) => api.updateTemplate(selectedTemplate.id, { name: e.target.value })} />
            </div>
          )}
          <MiniTemplate sessions={sessionsIn(snapshot.sessions, { templateId: selectedTemplateId })} groups={snapshot.groups} teachers={snapshot.teachers} onOpen={openTemplateCell} />
          <p className="admin-hint">Auf einen Block klicken, um Inhalt, Raum und Zuständigkeiten zu ändern.</p>
          {selectedTemplate && (
            <TemplateAttendance
              template={selectedTemplate}
              teachers={snapshot.teachers}
              onChange={(days) => api.updateTemplate(selectedTemplate.id, { days })}
            />
          )}
        </article>

        <article className="admin-card groups-card">
          <div className="card-heading"><span className="icon-box coral"><Users /></span><div><h3>Kindergruppen</h3><p>Bezeichnung, Farbe und Zuordnung</p></div></div>
          <div className="settings-list">
            {snapshot.groups.map((group, index) => (
              <div className="group-setting" key={group.id}>
                <div className="group-setting-top">
                  <span className="group-number" style={{ background: tint(group.color, "32"), color: group.color }}>{index + 1}</span>
                  <Input value={group.name} onChange={(e) => api.updateGroup(group.id, { name: e.target.value, short: e.target.value.replace("Klasse", "Kl.") })} aria-label={`Name Gruppe ${index + 1}`} />
                </div>
                <div className="color-row">
                  {GROUP_PALETTE.map((color) => (
                    <button type="button" key={color} className={group.color === color ? "color-dot selected" : "color-dot"} style={{ background: color }} onClick={() => api.updateGroup(group.id, { color })} aria-label={`Farbe ${color}`} />
                  ))}
                </div>
                <Textarea value={group.children} onChange={(e) => api.updateGroup(group.id, { children: e.target.value })} rows={2} aria-label={`Kürzel in ${group.name}`} placeholder="A01, A02, A03 …" />
                <small className="privacy-helper">Nur Kürzel verwenden, z. B. A01, A02. Keine vollständigen Namen.</small>
                <Button type="button" variant={groupRemoveId === group.id ? "destructive" : "ghost"} size="sm" className="group-remove-button" onClick={() => handleRemoveGroup(group.id)}>
                  <Trash2 size={13} /> {groupRemoveId === group.id ? "Wirklich entfernen?" : "Gruppe entfernen"}
                </Button>
              </div>
            ))}
            <Button variant="outline" className="w-full" onClick={() => api.addGroup()}><Plus /> Gruppe hinzufügen</Button>
          </div>
        </article>

        <article className="admin-card team-card">
          <div className="card-heading"><span className="icon-box mint"><Users /></span><div><h3>Lehrpersonen</h3><p>Team und Kürzel</p></div></div>
          <div className="settings-list">
            {snapshot.teachers.map((teacher) => (
              <TeacherRow key={teacher.id} teacher={teacher} onChange={(patch) => api.updateTeacher(teacher.id, patch)} />
            ))}
            <div className="add-teacher-row">
              <Input value={newTeacherName} onChange={(e) => setNewTeacherName(e.target.value)} placeholder="Name der Lehrperson" aria-label="Name neue Lehrperson" />
              <Button type="button" variant="outline" onClick={handleAddTeacher}><Plus /> Lehrperson ohne Konto hinzufügen</Button>
            </div>
          </div>
          <div className="privacy-note"><CircleAlert /><p><strong>Hinweis:</strong> Lehrpersonen ohne Konto erscheinen im Wochenplan, können sich aber nicht selbst anmelden.</p></div>
        </article>
      </section>
    </>
  );
}

function TeacherRow({ teacher, onChange }: { teacher: Teacher; onChange: (patch: Partial<Teacher>) => void }) {
  return (
    <label className="teacher-setting">
      <Checkbox checked={teacher.active} onCheckedChange={(checked) => onChange({ active: checked === true })} />
      <span className="teacher-avatar" style={{ background: teacher.color }}>{teacher.initials}</span>
      <Input value={teacher.name} onChange={(e) => onChange({ name: e.target.value })} aria-label="Name Lehrperson" />
    </label>
  );
}

function TemplateAttendance({ template, teachers, onChange }: {
  template: { days: Partial<WeekDays> | null };
  teachers: Teacher[];
  onChange: (days: Partial<WeekDays>) => void;
}) {
  const activeTeachers = teachers.filter((t) => t.active);
  const days = daysFromTemplate(template.days, teachers);

  function updateDay(day: DayKey, patch: Partial<DayMeta>) {
    onChange({ ...template.days, [day]: { ...days[day], ...patch } });
  }

  function toggleTeacher(day: DayKey, teacherId: string, checked: boolean) {
    const attendance = checked
      ? [...days[day].attendance, teacherId]
      : days[day].attendance.filter((id) => id !== teacherId);
    updateDay(day, { attendance });
  }

  return (
    <div className="template-attendance">
      <p className="admin-subheading">Standard-Anwesenheit</p>
      <div className="attendance-matrix">
        <div className="matrix-corner" />
        {DAYS.map((day) => <strong className="matrix-day-head" key={day.id}>{day.short}</strong>)}
        {activeTeachers.map((teacher) => (
          <Fragment key={teacher.id}>
            <span className="matrix-teacher"><span className="teacher-avatar small" style={{ background: teacher.color }}>{teacher.initials}</span>{teacher.name}</span>
            {DAYS.map((day) => (
              <label className="matrix-cell" key={`${teacher.id}-${day.id}`}>
                <Checkbox
                  checked={days[day.id].attendance.includes(teacher.id)}
                  onCheckedChange={(checked) => toggleTeacher(day.id, teacher.id, checked === true)}
                  aria-label={`${teacher.name} am ${day.label}`}
                />
              </label>
            ))}
          </Fragment>
        ))}
        <span className="matrix-teacher matrix-note-label">Notiz</span>
        {DAYS.map((day) => (
          <Input
            key={`note-${day.id}`}
            className="template-notes"
            value={days[day.id].note}
            onChange={(e) => updateDay(day.id, { note: e.target.value })}
            aria-label={`Notiz ${day.label}`}
            placeholder="…"
          />
        ))}
      </div>
    </div>
  );
}

export function MiniTemplate({ sessions, groups, teachers, onOpen, readOnly = false }: {
  sessions: Session[]; groups: Group[]; teachers: Teacher[]; onOpen: (day: DayKey, slot: number) => void;
  /** leere Felder sind nicht anklickbar (Vorschau) */
  readOnly?: boolean;
}) {
  return (
    <div className="mini-scroll">
      <div className="mini-grid">
        <div />
        {DAYS.map((d) => <strong key={d.id}>{d.short}</strong>)}
        {SLOTS.map((slot, index) => (
          <div className="mini-row" key={slot.time}>
            <span>{index + 1}</span>
            {DAYS.map((day) => {
              const item = sessions.find((session) => session.day === day.id && session.slot === index);
              const accent = item?.wholeClass ? "#A98BC4" : groups.find((g) => g.id === item?.assignments[0]?.groupId)?.color ?? "#D9E0E8";
              return (
                <button
                  type="button"
                  key={day.id}
                  onClick={() => onOpen(day.id, index)}
                  disabled={readOnly && !item}
                  aria-label={`${day.label}, ${slot.label}${item ? `: ${item.title}` : readOnly ? ": frei" : ": Block anlegen"}`}
                  style={item ? { borderLeftColor: accent, background: tint(accent, "16") } : undefined}
                  title={item ? `${item.title} · ${teachers.find((t) => t.id === item.assignments[0]?.teacherId)?.initials ?? ""}` : readOnly ? "frei" : "Block anlegen"}
                >
                  {item ? item.title : readOnly ? null : <Plus size={13} />}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
