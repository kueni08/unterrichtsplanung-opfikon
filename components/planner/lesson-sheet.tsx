"use client";

import { useState } from "react";
import { Check, CircleAlert, CopyPlus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { DAYS, SLOTS, tint } from "@/lib/planner/constants";
import { addDays, parseIsoDate, isoDate } from "@/lib/planner/dates";
import { countChildren, deriveTitle, setAssignment } from "@/lib/planner/logic";
import type { PlannerApi } from "@/hooks/use-planner";
import type { Assignment, DayKey, PlannerSnapshot, Session, SessionStatus } from "@/lib/planner/types";

const STATUS_OPTIONS: { value: SessionStatus; label: string }[] = [
  { value: "planned", label: "Geplant" },
  { value: "open", label: "Noch offen" },
  { value: "done", label: "Erledigt" },
];

export function LessonSheet({ session, api, snapshot, isCoordinator, onOpenChange }: {
  session: Session | null;
  api: PlannerApi;
  snapshot: PlannerSnapshot;
  isCoordinator: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [moveDay, setMoveDay] = useState<DayKey>(session?.day ?? "mo");
  const [moveSlot, setMoveSlot] = useState<number>(session?.slot ?? 0);

  if (!session) return null;

  const kind: "week" | "template" = session.templateId ? "template" : "week";
  const readOnly = kind === "template" && !isCoordinator;
  const day = DAYS.find((d) => d.id === session.day);
  const slot = SLOTS[session.slot];
  const activeTeachers = snapshot.teachers.filter((t) => t.active);

  function patch(p: Partial<Session>) {
    if (readOnly) return;
    api.updateSession(session!.id, p);
  }

  function patchAssignment(groupId: string, assignmentPatch: Partial<Assignment>) {
    if (readOnly) return;
    const next = setAssignment(session!.assignments, groupId, assignmentPatch);
    api.updateSession(session!.id, { assignments: next });
  }

  function handleSubjectChange(groupId: string, value: string) {
    if (readOnly) return;
    const previous = session!.assignments;
    const next = setAssignment(previous, groupId, { subject: value });
    const sessionPatch: Partial<Session> = { assignments: next };
    if (session!.title === deriveTitle(previous, session!.title)) {
      sessionPatch.title = deriveTitle(next, session!.title);
    }
    api.updateSession(session!.id, sessionPatch);
  }

  function handleMove() {
    if (readOnly) return;
    api.moveSession(session!.id, moveDay, moveSlot);
  }

  function handleRemove() {
    if (!confirmRemove) { setConfirmRemove(true); return; }
    api.removeSession(session!.id);
    onOpenChange(false);
  }

  function handleCarry() {
    if (!session!.weekStart) return;
    const nextWeekStart = isoDate(addDays(parseIsoDate(session!.weekStart), 7));
    const ok = api.carryForward(session!.id, nextWeekStart);
    if (ok) onOpenChange(false);
  }

  function handleDone() {
    api.flush();
    onOpenChange(false);
  }

  return (
    <Sheet open={Boolean(session)} onOpenChange={onOpenChange}>
      <SheetContent className="lesson-sheet sm:max-w-xl">
        <SheetHeader className="sheet-head">
          <p className="eyebrow">{kind === "template" ? "Vorlagenbaustein" : `${day?.label} · ${slot.time}–${slot.end} Uhr`}</p>
          <SheetTitle>Unterrichtsblock bearbeiten</SheetTitle>
          <SheetDescription>Die Wochenübersicht zeigt nur die wichtigsten Stichworte. Details bleiben hier gebündelt.</SheetDescription>
        </SheetHeader>
        <div className="sheet-body">
          {readOnly && <div className="template-readonly-note"><CircleAlert size={15} /> Vorlagen pflegt die Koordination.</div>}
          <div className="field-stack"><Label htmlFor="title">Titel / Fach</Label><Input id="title" disabled={readOnly} value={session.title} onChange={(e) => patch({ title: e.target.value })} /></div>
          <div className="field-stack"><Label htmlFor="focus">Stichworte für die Übersicht</Label><Input id="focus" disabled={readOnly} value={session.focus} onChange={(e) => patch({ focus: e.target.value })} placeholder="z. B. Einführung · Üben · Reflexion" /></div>
          <div className="two-fields">
            <div className="field-stack"><Label htmlFor="room">Raum</Label><Input id="room" disabled={readOnly} value={session.room} onChange={(e) => patch({ room: e.target.value })} /></div>
            <label className="whole-class">
              <Checkbox disabled={readOnly} checked={session.wholeClass} onCheckedChange={(checked) => patch({ wholeClass: checked === true })} />
              <span><strong>Alle {countChildren(snapshot.groups)} Kinder</strong><small>Teamteaching ohne Gruppentrennung</small></span>
            </label>
          </div>
          <div className="field-stack">
            <Label>Gruppen &amp; Zuständigkeit</Label>
            <div className="responsibility-grid">
              {snapshot.groups.map((group) => {
                const assignment = session.assignments.find((a) => a.groupId === group.id);
                const isOff = assignment?.off ?? false;
                return (
                  <div className="responsibility-block" key={group.id}>
                    <div className="responsibility-head">
                      <span className="group-tag" style={{ background: tint(group.color, "28"), color: group.color }}><i style={{ background: group.color }} />{group.name}</span>
                      <label className="off-toggle">
                        <Checkbox disabled={readOnly} checked={isOff} onCheckedChange={(checked) => patchAssignment(group.id, { off: checked === true })} />
                        frei
                      </label>
                    </div>
                    {!isOff && (
                      <div className="responsibility-fields">
                        <Select disabled={readOnly} value={assignment?.teacherId || "none"} onValueChange={(value) => patchAssignment(group.id, { teacherId: value === "none" ? "" : value })}>
                          <SelectTrigger aria-label={`Lehrperson ${group.name}`}><SelectValue placeholder="Lehrperson" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— offen —</SelectItem>
                            {activeTeachers.map((teacher) => <SelectItem key={teacher.id} value={teacher.id}>{teacher.initials} · {teacher.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select disabled={readOnly} value={assignment?.coTeacherId || "none"} onValueChange={(value) => patchAssignment(group.id, { coTeacherId: value === "none" ? "" : value })}>
                          <SelectTrigger aria-label={`Co-Lehrperson ${group.name}`}><SelectValue placeholder="Co-Lehrperson" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— keine —</SelectItem>
                            {activeTeachers.map((teacher) => <SelectItem key={teacher.id} value={teacher.id}>{teacher.initials} · {teacher.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input disabled={readOnly} value={assignment?.subject ?? ""} placeholder={session.title} aria-label={`Fach ${group.name}`} onChange={(e) => handleSubjectChange(group.id, e.target.value)} />
                        <Input disabled={readOnly} value={assignment?.room ?? ""} placeholder={session.room} aria-label={`Raum ${group.name}`} onChange={(e) => patchAssignment(group.id, { room: e.target.value })} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="field-stack"><Label htmlFor="children">Abweichende Kinderzuordnung</Label><Textarea id="children" disabled={readOnly} value={session.children} onChange={(e) => patch({ children: e.target.value })} placeholder="Nur Kürzel, z. B. A04 heute in Gruppe 2" rows={3} /></div>
          <div className="field-stack"><Label htmlFor="notes">Notizen &amp; Material</Label><Textarea id="notes" disabled={readOnly} value={session.notes} onChange={(e) => patch({ notes: e.target.value })} placeholder="Aufträge, Material, Beobachtungen, Links …" rows={5} /></div>
          {kind === "week" && (
            <div className="status-control">
              <span>Status</span>
              <div>
                {STATUS_OPTIONS.map((option) => (
                  <button type="button" key={option.value} className={session.status === option.value ? "active" : ""} onClick={() => patch({ status: option.value })}>{option.label}</button>
                ))}
              </div>
            </div>
          )}
          {!readOnly && (
            <div className="field-stack move-section">
              <Label>Verschieben</Label>
              <div className="move-row">
                <Select value={moveDay} onValueChange={(value) => setMoveDay(value as DayKey)}>
                  <SelectTrigger aria-label="Tag"><SelectValue /></SelectTrigger>
                  <SelectContent>{DAYS.map((d) => <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={String(moveSlot)} onValueChange={(value) => setMoveSlot(Number(value))}>
                  <SelectTrigger aria-label="Lektion"><SelectValue /></SelectTrigger>
                  <SelectContent>{SLOTS.map((s, i) => <SelectItem key={s.time} value={String(i)}>{s.time}–{s.end} · {s.label}</SelectItem>)}</SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={handleMove}>Verschieben</Button>
              </div>
            </div>
          )}
          {!readOnly && (
            <Button type="button" variant={confirmRemove ? "destructive" : "outline"} className="remove-block-button" onClick={handleRemove}>
              <Trash2 size={15} /> {confirmRemove ? "Wirklich entfernen?" : "Block entfernen"}
            </Button>
          )}
        </div>
        <SheetFooter className="sheet-actions">
          {kind === "week" && <Button variant="outline" onClick={handleCarry} disabled={readOnly}><CopyPlus /> In nächste freie Lektion übertragen</Button>}
          <Button onClick={handleDone}><Check /> Fertig</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
