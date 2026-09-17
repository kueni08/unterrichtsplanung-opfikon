"use client";

import { useState } from "react";
import { CalendarArrowDown, Check, CircleAlert, CopyPlus, Mail, Trash2, UsersRound } from "lucide-react";

import { LessonHistory } from "@/components/planner/lesson-history";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { DAYS, SLOTS, isMeetingSlot, slotKind, tint } from "@/lib/planner/constants";
import { addDays, parseIsoDate, isoDate } from "@/lib/planner/dates";
import { buildIcs, icsFileName, inviteBody, inviteDetails, mailtoLink } from "@/lib/planner/invite";
import { countChildren, deriveTitle, meetingParticipants, mergeCandidates, setAssignment, setParticipants } from "@/lib/planner/logic";
import type { PlannerApi } from "@/hooks/use-planner";
import type { Assignment, DayKey, PlannerSnapshot, Session, SessionStatus } from "@/lib/planner/types";

const STATUS_OPTIONS: { value: SessionStatus; label: string }[] = [
  { value: "planned", label: "Geplant" },
  { value: "open", label: "Noch offen" },
  { value: "done", label: "Erledigt" },
];

export function LessonSheet({ session, api, snapshot, isCoordinator, templateId, onRequestMove, onOpenSession, onOpenChange }: {
  session: Session | null;
  api: PlannerApi;
  snapshot: PlannerSnapshot;
  isCoordinator: boolean;
  /** Vorlage für eine Folgewoche, die beim Übertragen neu angelegt werden muss */
  templateId?: string;
  /** Verschieben läuft über die App, damit bei belegtem Ziel nachgefragt wird */
  onRequestMove?: (sessionId: string, day: DayKey, slot: number) => void;
  /** Eine frühere Lektion aus dem Rückblick öffnen */
  onOpenSession?: (sessionId: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [inviteTo, setInviteTo] = useState("");
  const [moveDay, setMoveDay] = useState<DayKey>(session?.day ?? "mo");
  const [moveSlot, setMoveSlot] = useState<number>(session?.slot ?? 0);

  if (!session) return null;

  const kind: "week" | "template" = session.templateId ? "template" : "week";
  const readOnly = kind === "template" && !isCoordinator;
  const day = DAYS.find((d) => d.id === session.day);
  const slot = SLOTS[Math.min(Math.max(session.slot, 0), SLOTS.length - 1)];
  const activeTeachers = snapshot.teachers.filter((t) => t.active);
  const isMeeting = isMeetingSlot(session.slot);
  const participants = meetingParticipants(session);
  const invite = isMeeting ? inviteDetails(session, snapshot.teachers) : null;

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
    if (onRequestMove) onRequestMove(session!.id, moveDay, moveSlot);
    else api.moveSession(session!.id, moveDay, moveSlot);
  }

  function handleRemove() {
    if (!confirmRemove) { setConfirmRemove(true); return; }
    api.removeSession(session!.id);
    onOpenChange(false);
  }

  function handleCarry() {
    if (!session!.weekStart) return;
    const nextWeekStart = isoDate(addDays(parseIsoDate(session!.weekStart), 7));
    const ok = api.carryForward(session!.id, nextWeekStart, templateId);
    if (ok) onOpenChange(false);
  }

  function toggleParticipant(teacherId: string, on: boolean) {
    if (readOnly) return;
    const next = on ? [...participants, teacherId] : participants.filter((id) => id !== teacherId);
    api.updateSession(session!.id, { assignments: setParticipants(next) });
  }

  function downloadIcs() {
    if (!invite) return;
    const blob = new Blob([buildIcs(invite, session!.id)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = icsFileName(invite);
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
          <SheetTitle>{isMeeting ? "Termin bearbeiten" : "Unterrichtsblock bearbeiten"}</SheetTitle>
          <SheetDescription>{isMeeting ? "Sitzung, Elterngespräch oder anderer Termin ausserhalb des Unterrichts." : "Die Wochenübersicht zeigt nur die wichtigsten Stichworte. Details bleiben hier gebündelt."}</SheetDescription>
        </SheetHeader>
        <div className="sheet-body">
          {readOnly && <div className="template-readonly-note"><CircleAlert size={15} /> Vorlagen pflegt die Koordination.</div>}
          <div className="field-stack"><Label htmlFor="title">{isMeeting ? "Titel" : "Titel / Fach"}</Label><Input id="title" disabled={readOnly} value={session.title} onChange={(e) => patch({ title: e.target.value })} placeholder={isMeeting ? "z. B. Stufensitzung, Elterngespräch A04" : undefined} /></div>
          <div className="field-stack"><Label htmlFor="focus">Stichworte für die Übersicht</Label><Input id="focus" disabled={readOnly} value={session.focus} onChange={(e) => patch({ focus: e.target.value })} placeholder="z. B. Einführung · Üben · Reflexion" /></div>
          {isMeeting ? (
            <>
            <div className="field-stack"><Label htmlFor="room">Ort / Raum</Label><Input id="room" disabled={readOnly} value={session.room} onChange={(e) => patch({ room: e.target.value })} placeholder="z. B. Lehrerzimmer, Zimmer 12" /></div>
            <div className="field-stack">
              <Label>Teilnehmende</Label>
              <div className="participant-list">
                {activeTeachers.map((teacher) => (
                  <label key={teacher.id}>
                    <Checkbox disabled={readOnly} checked={participants.includes(teacher.id)} onCheckedChange={(checked) => toggleParticipant(teacher.id, checked === true)} />
                    <span className="teacher-avatar tiny" style={{ background: teacher.color }}>{teacher.initials}</span>
                    <span>{teacher.name}</span>
                  </label>
                ))}
              </div>
              <small className="privacy-helper">Ohne Auswahl gilt der Termin für das ganze Team. Externe (z. B. Eltern) nur als Empfänger:innen der Einladung erfassen, nicht hier.</small>
            </div>
            </>
          ) : (
            <>
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
                const mergedWith = assignment?.withGroupId ? snapshot.groups.find((g) => g.id === assignment.withGroupId) : null;
                const candidates = mergeCandidates(session.assignments, snapshot.groups, group.id);
                return (
                  <div className={`responsibility-block ${mergedWith ? "is-merged" : ""}`} key={group.id}>
                    <div className="responsibility-head">
                      <span className="group-tag" style={{ background: tint(group.color, "28"), color: group.color }}><i style={{ background: group.color }} />{group.name}</span>
                      {!mergedWith && (
                        <label className="off-toggle">
                          <Checkbox disabled={readOnly} checked={isOff} onCheckedChange={(checked) => patchAssignment(group.id, { off: checked === true })} />
                          frei
                        </label>
                      )}
                    </div>
                    {candidates.length > 0 && (
                      <div className="merge-row">
                        <UsersRound size={14} aria-hidden="true" />
                        <Select disabled={readOnly} value={assignment?.withGroupId || "none"} onValueChange={(value) => patchAssignment(group.id, { withGroupId: value === "none" ? undefined : value })}>
                          <SelectTrigger aria-label={`${group.name} zusammen mit`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">eigene Gruppe</SelectItem>
                            {candidates.map((g) => <SelectItem key={g.id} value={g.id}>zusammen mit {g.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {mergedWith && <p className="merge-hint">Wird gemeinsam mit <strong>{mergedWith.name}</strong> unterrichtet und übernimmt deren Lehrperson, Fach und Raum.</p>}
                    {!isOff && !mergedWith && (
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
            </>
          )}
          {!isMeeting && <div className="field-stack"><Label htmlFor="children">Abweichende Kinderzuordnung</Label><Textarea id="children" disabled={readOnly} value={session.children} onChange={(e) => patch({ children: e.target.value })} placeholder="Nur Kürzel, z. B. A04 heute in Gruppe 2" rows={3} /></div>}
          {!isMeeting && kind === "week" && <LessonHistory all={snapshot.sessions} current={session} onOpen={onOpenSession} />}
          <div className="field-stack"><Label htmlFor="notes">{isMeeting ? "Traktanden & Notizen" : "Notizen & Material"}</Label><Textarea id="notes" disabled={readOnly} value={session.notes} onChange={(e) => patch({ notes: e.target.value })} placeholder={isMeeting ? "Traktanden, Vorbereitung, Beschlüsse …" : "Aufträge, Material, Beobachtungen, Links …"} rows={5} /></div>
          {!isMeeting && kind === "week" && (
            <div className="two-fields">
              <div className="field-stack"><Label htmlFor="homework">Hausaufgaben</Label><Textarea id="homework" disabled={readOnly} value={session.homework} onChange={(e) => patch({ homework: e.target.value })} placeholder="z. B. Arbeitsblatt S. 12, Nr. 1–4" rows={3} /></div>
              <div className="field-stack"><Label htmlFor="next-time">Fürs nächste Mal</Label><Textarea id="next-time" disabled={readOnly} value={session.nextTime} onChange={(e) => patch({ nextTime: e.target.value })} placeholder="Erscheint automatisch in der nächsten Lektion dieses Fachs" rows={3} /></div>
            </div>
          )}
          {isMeeting && kind === "week" && invite && (
            <section className="invite-panel" aria-label="Einladung">
              <h4><Mail size={15} /> Einladung versenden</h4>
              <p>Öffnet einen fertigen E-Mail-Entwurf mit Datum, Zeit, Ort und Traktanden in deinem Mailprogramm. Die Kalenderdatei können Empfänger:innen direkt in ihren Kalender übernehmen.</p>
              <div className="field-stack"><Label htmlFor="invite-to">Empfänger:innen (E-Mail, optional)</Label><Input id="invite-to" type="text" inputMode="email" value={inviteTo} onChange={(e) => setInviteTo(e.target.value)} placeholder="name@schule.ch, weitere@…" /></div>
              <div className="invite-actions">
                <Button asChild variant="default">
                  <a href={mailtoLink(inviteTo, `Einladung: ${invite.title}`, inviteBody(invite, snapshot.team.name))}><Mail size={15} /> Per E-Mail einladen</a>
                </Button>
                <Button type="button" variant="outline" onClick={downloadIcs}><CalendarArrowDown size={15} /> Kalenderdatei (.ics)</Button>
              </div>
            </section>
          )}
          {isMeeting && kind === "template" && <p className="privacy-helper">Einladungen lassen sich aus einem Termin in einer konkreten Woche versenden (Vorlagen haben kein Datum).</p>}
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
                  <SelectTrigger aria-label={isMeeting ? "Zeitfenster" : "Lektion"}><SelectValue /></SelectTrigger>
                  <SelectContent>{SLOTS.map((s, i) => slotKind(i) === slotKind(session.slot) && <SelectItem key={s.time} value={String(i)}>{s.time}–{s.end} · {s.label}</SelectItem>)}</SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={handleMove}>Verschieben</Button>
              </div>
            </div>
          )}
          {!readOnly && (
            <Button type="button" variant={confirmRemove ? "destructive" : "outline"} className="remove-block-button" onClick={handleRemove}>
              <Trash2 size={15} /> {confirmRemove ? "Wirklich entfernen?" : isMeeting ? "Termin entfernen" : "Block entfernen"}
            </Button>
          )}
        </div>
        <SheetFooter className="sheet-actions">
          {kind === "week" && <Button variant="outline" onClick={handleCarry} disabled={readOnly}><CopyPlus /> {isMeeting ? "In nächsten freien Termin übertragen" : "In nächste freie Lektion übertragen"}</Button>}
          <Button onClick={handleDone}><Check /> Fertig</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
