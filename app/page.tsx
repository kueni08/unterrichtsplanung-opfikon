"use client";

import { useCallback, useMemo, useState, type DragEvent } from "react";
import { useTeamSync } from "../client/sync";
import { AccountSettings, logout } from "../client/account";
import { analyzeChildConflicts, type TeamUser, type PlannerData } from "../shared/planner";
import {
  CalendarDays, Check, ChevronLeft, ChevronRight, CircleAlert, Clock3,
  CopyPlus, GripVertical, LayoutGrid, MapPin, MessageSquareText, Plus, RotateCcw,
  Settings2, Sparkles, Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";

type DayKey = "mo" | "di" | "mi" | "do" | "fr";
type SessionStatus = "planned" | "open" | "done" | "carried";
type Group = { id: string; name: string; short: string; color: string; children: string };
type Teacher = { id: string; name: string; initials: string; color: string; active: boolean };
type Assignment = { groupId: string; teacherId: string };
type Session = {
  id: string; day: DayKey; slot: number; title: string; focus: string; room: string;
  notes: string; children: string; childOverrides?: string[]; wholeClass?: boolean; assignments: Assignment[]; status: SessionStatus;
};
type Meeting = { time: string; title: string };
type DayMeta = { attendance: string[]; note: string; meetings: Meeting[] };
type Week = { sessions: Session[]; days: Record<DayKey, DayMeta> };
type EditTarget = { kind: "week" | "template"; id: string } | null;

const days: { id: DayKey; label: string; short: string }[] = [
  { id: "mo", label: "Montag", short: "Mo" }, { id: "di", label: "Dienstag", short: "Di" },
  { id: "mi", label: "Mittwoch", short: "Mi" }, { id: "do", label: "Donnerstag", short: "Do" },
  { id: "fr", label: "Freitag", short: "Fr" },
];
const slots = [
  { label: "1. Lektion", time: "08:10", period: "Morgen" },
  { label: "2. Lektion", time: "09:00", period: "Morgen" },
  { label: "3. Lektion", time: "10:10", period: "Morgen" },
  { label: "4. Lektion", time: "11:00", period: "Morgen" },
  { label: "5. Lektion", time: "11:50", period: "Morgen" },
  { label: "6. Lektion", time: "13:30", period: "Nachmittag" },
  { label: "7. Lektion", time: "14:20", period: "Nachmittag" },
  { label: "8. Lektion", time: "15:20", period: "Nachmittag" },
];
const initialGroups: Group[] = [
  { id: "g1", name: "1. Klasse", short: "1. Kl.", color: "#E98F82", children: "A01, A02, A03, A04, A05, A06, A07, A08, A09, A10, A11, A12, A13" },
  { id: "g2", name: "2. Klasse", short: "2. Kl.", color: "#6FAFD4", children: "B01, B02, B03, B04, B05, B06, B07, B08, B09, B10, B11, B12, B13" },
  { id: "g3", name: "3. Klasse", short: "3. Kl.", color: "#78B99A", children: "C01, C02, C03, C04, C05, C06, C07, C08, C09, C10, C11, C12, C13" },
];
const initialTeachers: Teacher[] = [
  { id: "t1", name: "Lara Meier", initials: "LM", color: "#795A9D", active: true },
  { id: "t2", name: "Kim Berger", initials: "KB", color: "#C57953", active: true },
  { id: "t3", name: "Sami Frei", initials: "SF", color: "#347A78", active: true },
  { id: "t4", name: "Nora Graf", initials: "NG", color: "#4D699F", active: true },
];
const groupAssignments = (a = "t1", b = "t2", c = "t3"): Assignment[] => [
  { groupId: "g1", teacherId: a }, { groupId: "g2", teacherId: b }, { groupId: "g3", teacherId: c },
];
const s = (id: string, day: DayKey, slot: number, title: string, focus: string, room: string,
  assignments = groupAssignments(), wholeClass = false): Session =>
  ({ id, day, slot, title, focus, room, assignments, wholeClass, notes: "", children: "", status: "planned" });

const ruleTemplate: Session[] = [
  s("tm01", "mo", 0, "Wochenstart", "Ankommen · Ausblick", "Lernatelier", groupAssignments(), true),
  s("tm02", "mo", 1, "Mathe-Werkstatt", "Zahlenräume", "Räume 1–3"),
  s("tm03", "mo", 2, "Deutsch", "Lesespuren", "Räume 1–3", groupAssignments("t2", "t1", "t3")),
  s("tm04", "mo", 5, "NMG", "Lebensräume", "Atelier", groupAssignments("t3", "t2", "t1")),
  s("tm05", "di", 0, "Lernzeit", "Individuelle Ziele", "Lernatelier", groupAssignments("t2", "t3", "t1")),
  s("tm06", "di", 1, "Mathematik", "Strategien", "Räume 1–3"),
  s("tm07", "di", 3, "Sport", "Kooperation", "Turnhalle", groupAssignments("t3", "t1", "t2"), true),
  s("tm08", "di", 6, "Gestalten", "Farbe & Form", "Werkraum", groupAssignments("t4", "t2", "t1")),
  s("tm09", "mi", 0, "Deutsch", "Schreibkonferenz", "Räume 1–3"),
  s("tm10", "mi", 1, "Förderband", "Lesen · DaZ · Mathe", "Förderräume", groupAssignments("t4", "t2", "t3")),
  s("tm11", "mi", 3, "Klassenrat", "Gemeinschaft", "Lernatelier", groupAssignments(), true),
  s("tm12", "do", 0, "Mathematik", "Üben & vertiefen", "Räume 1–3"),
  s("tm13", "do", 2, "NMG-Projekt", "Forscherauftrag", "Atelier", groupAssignments("t3", "t1", "t2")),
  s("tm14", "do", 5, "Musik", "Rhythmus", "Musikraum", groupAssignments(), true),
  s("tm15", "fr", 0, "Lernzeit", "Wochenziele", "Lernatelier", groupAssignments("t2", "t1", "t4")),
  s("tm16", "fr", 1, "Deutsch", "Präsentieren", "Räume 1–3"),
  s("tm17", "fr", 3, "Wochenabschluss", "Rückblick", "Lernatelier", groupAssignments(), true),
];
const projectTemplate: Session[] = [
  s("tp01", "mo", 0, "Projekt-Kickoff", "Frage & Teams", "Lernatelier", groupAssignments(), true),
  s("tp02", "mo", 1, "Projektatelier", "Forschen", "Ateliers", groupAssignments("t1", "t3", "t2")),
  s("tp03", "di", 0, "Projektatelier", "Planen & bauen", "Ateliers", groupAssignments("t2", "t1", "t3")),
  s("tp04", "mi", 0, "Zwischenhalt", "Feedback", "Lernatelier", groupAssignments(), true),
  s("tp05", "do", 0, "Projektatelier", "Fertigstellen", "Ateliers", groupAssignments("t3", "t2", "t1")),
  s("tp06", "fr", 1, "Präsentationen", "Zeigen & würdigen", "Aula", groupAssignments(), true),
];
const baseMonday = new Date(2026, 7, 31);
function isoDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function dateAt(offset: number, day = 0) { const date = new Date(baseMonday); date.setDate(date.getDate() + offset * 7 + day); return date; }
function emptyDays(teachers = initialTeachers): Record<DayKey, DayMeta> {
  const present = teachers.filter((t) => t.active).slice(0, 3).map((t) => t.id);
  const createDay = (): DayMeta => ({ attendance: [...present], note: "", meetings: [] });
  return { mo: createDay(), di: createDay(), mi: createDay(), do: createDay(), fr: createDay() };
}
function cloneSessions(source: Session[], prefix: string) {
  return source.map((item, index) => ({ ...item, id: `${prefix}-${index}-${Date.now()}`, assignments: item.assignments.map((a) => ({ ...a })) }));
}
const sampleWeek: Week = {
  sessions: cloneSessions(ruleTemplate, "w36").map((item, index) => index === 2
    ? { ...item, status: "open", notes: "Lesespur 2 noch nicht ganz abgeschlossen. Gruppe 1 braucht zusätzliche Begleitung." }
    : index === 0 ? { ...item, status: "done" } : item),
  days: {
    ...emptyDays(),
    mo: { attendance: ["t1", "t2", "t3"], note: "10:00 Uhr: Besuch der Schulsozialarbeit.", meetings: [{ time: "16:15", title: "Stufensitzung" }] },
    di: { attendance: ["t1", "t2", "t3", "t4"], note: "Turnhalle ab 10:00 Uhr reserviert.", meetings: [] },
    mi: { attendance: ["t1", "t2", "t4"], note: "Sami: Weiterbildung ganzer Tag.", meetings: [{ time: "12:15", title: "Kurzabsprache IF" }] },
    do: { attendance: ["t1", "t2", "t3"], note: "", meetings: [{ time: "16:10", title: "Elterngespräch" }, { time: "17:00", title: "Teamplanung" }] },
    fr: { attendance: ["t1", "t2", "t3"], note: "Bibliotheksbücher mitgeben.", meetings: [] },
  },
};
const palette = ["#E98F82", "#6FAFD4", "#78B99A", "#D8A653", "#A98BC4", "#5EB9B2"];
const tint = (hex: string, alpha = "24") => `${hex}${alpha}`;

function reorderSessions(source: Session[], sessionId: string, targetDay: DayKey, requestedSlot: number) {
  const dragged = source.find((item) => item.id === sessionId);
  const targetSlot = Math.max(0, Math.min(slots.length - 1, requestedSlot));
  if (!dragged || (dragged.day === targetDay && dragged.slot === targetSlot)) return { sessions: source, moved: false };

  let rest = source.filter((item) => item.id !== sessionId);
  if (dragged.day === targetDay) {
    if (targetSlot > dragged.slot) {
      rest = rest.map((item) => item.day === targetDay && item.slot > dragged.slot && item.slot <= targetSlot ? { ...item, slot: item.slot - 1 } : item);
    } else {
      rest = rest.map((item) => item.day === targetDay && item.slot >= targetSlot && item.slot < dragged.slot ? { ...item, slot: item.slot + 1 } : item);
    }
    return { sessions: [...rest, { ...dragged, day: targetDay, slot: targetSlot }], moved: true };
  }

  const occupied = new Set(rest.filter((item) => item.day === targetDay).map((item) => item.slot));
  if (!occupied.has(targetSlot)) return { sessions: [...rest, { ...dragged, day: targetDay, slot: targetSlot }], moved: true };

  let freeAfter = -1;
  for (let index = targetSlot + 1; index < slots.length; index += 1) {
    if (!occupied.has(index)) { freeAfter = index; break; }
  }
  if (freeAfter >= 0) {
    rest = rest.map((item) => item.day === targetDay && item.slot >= targetSlot && item.slot < freeAfter ? { ...item, slot: item.slot + 1 } : item);
    return { sessions: [...rest, { ...dragged, day: targetDay, slot: targetSlot }], moved: true };
  }

  let freeBefore = -1;
  for (let index = targetSlot - 1; index >= 0; index -= 1) {
    if (!occupied.has(index)) { freeBefore = index; break; }
  }
  if (freeBefore >= 0) {
    rest = rest.map((item) => item.day === targetDay && item.slot > freeBefore && item.slot <= targetSlot ? { ...item, slot: item.slot - 1 } : item);
    return { sessions: [...rest, { ...dragged, day: targetDay, slot: targetSlot }], moved: true };
  }
  return { sessions: source, moved: false };
}

function WeekLabel({ offset }: { offset: number }) {
  const start = dateAt(offset); const end = dateAt(offset, 4);
  const fmt = new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "short" });
  return <>{fmt.format(start)} – {fmt.format(end)} {end.getFullYear()}</>;
}

export default function Home({ user }: { user: TeamUser }) {
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [teachers, setTeachers] = useState<Teacher[]>(initialTeachers);
  const [templates, setTemplates] = useState<Record<string, Session[]>>({ regel: ruleTemplate, projekt: projectTemplate });
  const [selectedTemplate, setSelectedTemplate] = useState("regel");
  const [weeks, setWeeks] = useState<Record<string, Week>>({ [isoDate(baseMonday)]: sampleWeek });
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<DayKey>("mi");
  const [viewer, setViewer] = useState(user.role === "admin" ? "all" : user.teacherId);
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const data = useMemo(() => ({ groups, teachers, templates, weeks }), [groups, teachers, templates, weeks]);
  const applyData = useCallback((value: PlannerData) => { setGroups(value.groups); setTeachers(value.teachers); setTemplates(value.templates); setWeeks(value.weeks); }, []);
  const sync = useTeamSync(user, data, applyData);
  const childConflicts = useMemo(() => analyzeChildConflicts(data), [data]);
  const weekKey = isoDate(dateAt(weekOffset));
  const currentWeek = weeks[weekKey];
  const currentSessions = currentWeek?.sessions ?? [];
  const visibleSessions = useMemo(() => viewer === "all" ? currentSessions : currentSessions.filter((item) => item.wholeClass || item.assignments.some((a) => a.teacherId === viewer)), [currentSessions, viewer]);
  const viewerTeacher = teachers.find((teacher) => teacher.id === viewer);
  const planningWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (teachers.filter((t) => t.active).length < 3) warnings.push("Mindestens drei aktive Lehrpersonen sind vorgesehen.");
    currentSessions.forEach((item) => {
      if (!item.wholeClass && item.assignments.length !== groups.length) warnings.push(`${item.title}: Gruppenzuordnung unvollständig.`);
      const assigned = item.assignments.map((a) => a.teacherId).filter(Boolean);
      if (new Set(assigned).size < assigned.length && !item.wholeClass) warnings.push(`${item.title}: Eine Lehrperson ist mehreren Gruppen zugeteilt.`);
    });
    return [...new Set(warnings)];
  }, [currentSessions, groups.length, teachers]);


  const activeSession = useMemo(() => {
    if (!editTarget) return null;
    const source = editTarget.kind === "week" ? currentSessions : templates[selectedTemplate] ?? [];
    return source.find((item) => item.id === editTarget.id) ?? null;
  }, [editTarget, currentSessions, templates, selectedTemplate]);

  function updateCurrentWeek(updater: (week: Week) => Week) {
    setWeeks((old) => { const base = old[weekKey] ?? { sessions: [], days: emptyDays(teachers) }; return { ...old, [weekKey]: updater(base) }; });
  }
  function updateActiveSession(patch: Partial<Session>) {
    if (!editTarget) return;
    if (editTarget.kind === "week") updateCurrentWeek((week) => ({ ...week, sessions: week.sessions.map((item) => item.id === editTarget.id ? { ...item, ...patch } : item) }));
    else setTemplates((old) => ({ ...old, [selectedTemplate]: (old[selectedTemplate] ?? []).map((item) => item.id === editTarget.id ? { ...item, ...patch } : item) }));
  }
  function openCell(kind: "week" | "template", day: DayKey, slot: number) {
    const list = kind === "week" ? currentSessions : templates[selectedTemplate] ?? [];
    const existing = list.find((item) => item.day === day && item.slot === slot);
    if (existing) { setEditTarget({ kind, id: existing.id }); return; }
    const fresh = s(`${kind}-${day}-${slot}-${Date.now()}`, day, slot, "Neue Lektion", "", "", groups.slice(0, 3).map((group, i) => ({ groupId: group.id, teacherId: teachers[i]?.id ?? teachers[0]?.id ?? "" })));
    if (kind === "week") updateCurrentWeek((week) => ({ ...week, sessions: [...week.sessions, fresh] }));
    else setTemplates((old) => ({ ...old, [selectedTemplate]: [...(old[selectedTemplate] ?? []), fresh] }));
    setEditTarget({ kind, id: fresh.id });
  }
  function createFromTemplate() {
    setWeeks((old) => ({ ...old, [weekKey]: { sessions: cloneSessions(templates[selectedTemplate] ?? [], weekKey), days: emptyDays(teachers) } }));
    toast.success("Woche aus Vorlage angelegt");
  }
  function updateDay(day: DayKey, patch: Partial<DayMeta>) {
    updateCurrentWeek((week) => ({ ...week, days: { ...week.days, [day]: { ...week.days[day], ...patch } } }));
  }
  function carryForward(session: Session) {
    const positions = days.flatMap((day) => slots.map((_, slot) => ({ day: day.id, slot })));
    const currentIndex = positions.findIndex((p) => p.day === session.day && p.slot === session.slot);
    let target = positions.slice(currentIndex + 1).find((p) => !currentSessions.some((item) => item.day === p.day && item.slot === p.slot));
    let targetWeekKey = weekKey;
    if (!target) { target = positions[0]; targetWeekKey = isoDate(dateAt(weekOffset + 1)); }
    const copy: Session = { ...session, id: `carry-${Date.now()}`, day: target.day, slot: target.slot,
      title: session.title.includes("Fortsetzung") ? session.title : `${session.title} · Fortsetzung`, status: "planned", assignments: session.assignments.map((a) => ({ ...a })) };
    setWeeks((old) => {
      const original = old[weekKey] ?? { sessions: [], days: emptyDays(teachers) };
      const next = old[targetWeekKey] ?? { sessions: [], days: emptyDays(teachers) };
      const marked = { ...original, sessions: original.sessions.map((item) => item.id === session.id ? { ...item, status: "carried" as SessionStatus } : item) };
      if (targetWeekKey === weekKey) return { ...old, [weekKey]: { ...marked, sessions: [...marked.sessions, copy] } };
      return { ...old, [weekKey]: marked, [targetWeekKey]: { ...next, sessions: [...next.sessions, copy] } };
    });
    setEditTarget(null);
    toast.success(`Fortsetzung auf ${days.find((d) => d.id === target!.day)?.label}, ${slots[target.slot].time} Uhr übertragen`);
  }
  function moveSession(sessionId: string, targetDay: DayKey, targetSlot: number) {
    const dragged = currentSessions.find((item) => item.id === sessionId);
    if (!dragged || (dragged.day === targetDay && dragged.slot === targetSlot)) return;
    const result = reorderSessions(currentSessions, sessionId, targetDay, targetSlot);
    if (!result.moved) {
      toast.error("In diesem Tag ist kein freier Platz mehr vorhanden");
      return;
    }
    updateCurrentWeek((week) => ({ ...week, sessions: result.sessions }));
    toast.success(`Block auf ${days.find((day) => day.id === targetDay)?.label}, ${slots[targetSlot].time} Uhr verschoben`);
  }
  function resetDemo() {
    if (!window.confirm("Den gemeinsamen Plan durch Beispieldaten ersetzen? Vorher bei Bedarf einen Entwurf exportieren.")) return;
    setGroups(initialGroups); setTeachers(initialTeachers);
    setTemplates({ regel: ruleTemplate, projekt: projectTemplate }); setWeeks({ [isoDate(baseMonday)]: sampleWeek }); setWeekOffset(0);
    toast.success("Beispieldaten wiederhergestellt");
  }

  if (!sync.ready) return <main className="login-shell"><section className="login-card"><h1>Wochenatelier</h1><p role="status">{sync.status}</p><Button onClick={() => location.reload()}>Erneut laden</Button></section></main>;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <img src="https://www.schule-opfikon.ch/inc/customers/opfikon/images/logo-schule-opfikon-new.svg" alt="Schule Opfikon" className="school-logo" />
          <div className="brand-divider" />
          <div><p className="eyebrow">Teamplanung</p><h1>Wochenatelier</h1></div>
        </div>
          <div className="header-meta">
          <span>{user.name}</span><button className="logout-button" onClick={async () => { if (sync.pending) { toast.error("Bitte zuerst speichern oder den Entwurf exportieren."); return; } try { await logout(); } catch (e) { toast.error(String(e)); } }}>Abmelden</button>
          <span className="draft-badge"><Sparkles size={14} /> Entwurf</span>
          <div className="avatar-stack" aria-label="Lehrpersonen im Team">
            {teachers.filter((t) => t.active).slice(0, 4).map((teacher) => <span key={teacher.id} style={{ background: teacher.color }} title={teacher.name}>{teacher.initials}</span>)}
          </div>
        </div>
      </header>

      <Tabs defaultValue="week" className="workspace">
        <div className="workspace-nav">
          <TabsList variant="line" className="main-tabs">
            <TabsTrigger value="week"><LayoutGrid /> Wochenplan</TabsTrigger>
            <TabsTrigger value="day"><CalendarDays /> Tagesfokus</TabsTrigger>
            {user.role === "admin" && <TabsTrigger value="admin"><Settings2 /> Admin</TabsTrigger>}
          </TabsList>
          {user.role === "admin" && <div className="view-selector"><span>Ansicht:</span><Select value={viewer} onValueChange={setViewer}><SelectTrigger aria-label="Persönliche Ansicht"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Koordination · alles</SelectItem>{teachers.filter((t) => t.active).map((teacher) => <SelectItem key={teacher.id} value={teacher.id}>{teacher.initials} · {teacher.name}</SelectItem>)}</SelectContent></Select></div>}
          <p className="save-state" role="status"><Check size={14} /> {sync.status}</p>
        </div>
        <section className="sync-toolbar"><span role="status">{sync.status}</span><label><input type="checkbox" checked={sync.urgent} onChange={e => sync.setUrgent(e.target.checked)} /> Nächste Änderung ist wichtig · Team benachrichtigen</label><Button variant="outline" size="sm" onClick={sync.exportDraft}>Entwurf exportieren</Button><Button variant="outline" size="sm" onClick={sync.retry}>Jetzt abgleichen</Button>{childConflicts.length > 0 && <div className="conflict-alert" role="alert"><strong>Konfliktanalyse: {childConflicts.length} Überschneidung(en)</strong><span>{childConflicts.slice(0, 3).map(conflict => `${conflict.childId} · ${conflict.day} · ${conflict.slot + 1}. Lektion`).join(" · ")}</span><small>Mehrfachzugehörigkeiten sind erlaubt. Hinterlege bei einer einzelnen Lektion unter «Ausnahme-Kürzel» eine zeitlich begrenzte Ausnahme.</small></div>}{sync.notice && <p role="status">{sync.notice}</p>}{sync.conflict && <div role="alert"><p>Jemand hat den Plan gleichzeitig geändert. Dein Entwurf wird nicht überschrieben. Sichere ihn als Datei und lade den aktuellen Teamstand; übertrage anschliessend die gewünschten Anpassungen.</p><Button onClick={sync.resolveConflict}>Entwurf sichern &amp; Teamstand laden</Button></div>}</section>

        <TabsContent value="week" className="view-space">
          <section className="planner-toolbar">
            <div className="week-switcher">
              <Button variant="outline" size="icon" onClick={() => setWeekOffset((v) => v - 1)} aria-label="Vorherige Woche"><ChevronLeft /></Button>
              <div className="week-title"><span>KW {36 + weekOffset}</span><strong><WeekLabel offset={weekOffset} /></strong></div>
              <Button variant="outline" size="icon" onClick={() => setWeekOffset((v) => v + 1)} aria-label="Nächste Woche"><ChevronRight /></Button>
            </div>
            <div className="toolbar-actions">
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger aria-label="Wochenvorlage" className="template-select"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="regel">Regelwoche ADL</SelectItem><SelectItem value="projekt">Projektwoche</SelectItem></SelectContent>
              </Select>
              {!currentWeek && <Button onClick={createFromTemplate}><CopyPlus /> Woche aus Vorlage</Button>}
              {currentWeek && <Button variant="outline" onClick={() => openCell("week", selectedDay, 0)}><Plus /> Lektion</Button>}
            </div>
          </section>
          <div className="legend-row">
            <span className="legend-label">Gruppen</span>
            {groups.map((group) => <span className="legend-chip" key={group.id}><i style={{ background: group.color }} />{group.name}</span>)}
            <span className="legend-chip all"><Users size={14} />Alle 39</span>
            <span className="drag-hint"><GripVertical size={14} /> Blöcke ziehen zum Verschieben</span>
          </div>
          <div className="privacy-strip"><CircleAlert size={16} /><span><strong>Datenschutz:</strong> Kinder nur mit Kürzel (z. B. A01) erfassen – keine Namen, Diagnosen oder privaten Details.</span><span className="privacy-count">{groups.reduce((n, g) => n + g.children.split(",").map((x) => x.trim()).filter(Boolean).length, 0)} Kürzel erfasst</span></div>
          {planningWarnings.length > 0 && <div className="planning-warning"><CircleAlert size={16} /><div><strong>Planungscheck</strong>{planningWarnings.slice(0, 2).map((warning) => <span key={warning}>{warning}</span>)}</div></div>}
          {!currentWeek ? (
            <section className="empty-week">
              <div className="empty-icon"><CalendarDays /></div><h2>Diese Woche ist noch leer</h2>
              <p>Wähle eine Grundstruktur und übernimm sie als Ausgangslage. Danach kannst du jeden Block individuell anpassen.</p>
              <Button onClick={createFromTemplate}><CopyPlus /> {selectedTemplate === "regel" ? "Regelwoche ADL" : "Projektwoche"} übernehmen</Button>
            </section>
          ) : <><div className="active-view-note">{viewer === "all" ? "Gesamtansicht: alle Gruppen und Zuständigkeiten" : `Persönliche Ansicht für ${viewerTeacher?.initials}: eigene Zuständigkeiten und Teamtermine`}</div><WeekGrid sessions={visibleSessions} week={currentWeek} weekOffset={weekOffset} groups={groups} teachers={teachers} onOpen={(day, slot) => openCell("week", day, slot)} onDay={setSelectedDay} onMove={moveSession} /></>}
        </TabsContent>

        <TabsContent value="day" className="view-space">
          <section className="day-layout">
            <div className="day-main">
              <div className="section-head day-picker-head">
                <div><p className="eyebrow">Tagesfokus</p><h2>{days.find((d) => d.id === selectedDay)?.label}, {new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "long" }).format(dateAt(weekOffset, days.findIndex((d) => d.id === selectedDay)))}</h2></div>
                <div className="day-pills">{days.map((day) => <button key={day.id} className={selectedDay === day.id ? "active" : ""} onClick={() => setSelectedDay(day.id)}>{day.short}</button>)}</div>
              </div>
              <div className="timeline">
                {slots.map((slot, index) => {
                  const item = visibleSessions.find((session) => session.day === selectedDay && session.slot === index);
                  return <button className="timeline-row" key={slot.time} onClick={() => openCell("week", selectedDay, index)}>
                    <div className="timeline-time"><strong>{slot.time}</strong><span>{slot.label}</span></div>
                    {item ? <SessionCard session={item} groups={groups} teachers={teachers} expanded /> : <div className="timeline-empty"><Plus size={17} /> Freier Block</div>}
                  </button>;
                })}
              </div>
            </div>
            <DaySidebar day={selectedDay} meta={currentWeek?.days[selectedDay] ?? emptyDays(teachers)[selectedDay]} teachers={teachers} onChange={(patch) => updateDay(selectedDay, patch)} disabled={!currentWeek} />
          </section>
        </TabsContent>

        {user.role === "admin" && <TabsContent value="admin" className="view-space">
          <div className="admin-heading">
            <div><p className="eyebrow">Grundstruktur</p><h2>Planung verwalten</h2><p>Hier werden Vorlagen, Gruppen und das Team für alle künftigen Wochen gepflegt.</p></div>
            <Button variant="outline" onClick={resetDemo}><RotateCcw /> Beispieldaten zurücksetzen</Button>
          </div>
          <section className="admin-grid">
            <article className="admin-card template-card">
              <div className="card-heading"><span className="icon-box blue"><CalendarDays /></span><div><h3>Wochenvorlage</h3><p>Ausgangslage für neue Wochen</p></div></div>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="regel">Regelwoche ADL</SelectItem><SelectItem value="projekt">Projektwoche</SelectItem></SelectContent></Select>
              <MiniTemplate sessions={templates[selectedTemplate] ?? []} groups={groups} teachers={teachers} onOpen={(day, slot) => openCell("template", day, slot)} />
              <p className="admin-hint">Auf einen Block klicken, um Inhalt, Raum und Zuständigkeiten zu ändern.</p>
            </article>
            <article className="admin-card groups-card">
              <div className="card-heading"><span className="icon-box coral"><Users /></span><div><h3>Kindergruppen</h3><p>Bezeichnung, Farbe und Zuordnung</p></div></div>
              <div className="settings-list">
                {groups.map((group, index) => <div className="group-setting" key={group.id}>
                  <div className="group-setting-top"><span className="group-number" style={{ background: tint(group.color, "32"), color: group.color }}>{index + 1}</span><Input value={group.name} onChange={(e) => setGroups((old) => old.map((g) => g.id === group.id ? { ...g, name: e.target.value, short: e.target.value.replace("Klasse", "Kl.") } : g))} aria-label={`Name Gruppe ${index + 1}`} /></div>
                  <div className="color-row">{palette.map((color) => <button key={color} className={group.color === color ? "color-dot selected" : "color-dot"} style={{ background: color }} onClick={() => setGroups((old) => old.map((g) => g.id === group.id ? { ...g, color } : g))} aria-label={`Farbe ${color}`} />)}</div>
                  <Textarea value={group.children} onChange={(e) => setGroups((old) => old.map((g) => g.id === group.id ? { ...g, children: e.target.value } : g))} rows={2} aria-label={`Kürzel in ${group.name}`} placeholder="A01, A02, A03 …" />
                  <small className="privacy-helper">Nur Kürzel verwenden, z. B. A01, A02. Keine vollständigen Namen.</small>
                </div>)}
                <Button variant="outline" className="w-full" onClick={() => setGroups((old) => [...old, { id: `g${Date.now()}`, name: "Neue Gruppe", short: "Neu", color: palette[old.length % palette.length], children: "" }])}><Plus /> Gruppe hinzufügen</Button>
              </div>
            </article>
            <article className="admin-card team-card">
              <div className="card-heading"><span className="icon-box mint"><Users /></span><div><h3>Lehrpersonen</h3><p>Team und Kürzel</p></div></div>
              <div className="settings-list">
                {teachers.map((teacher) => <label className="teacher-setting" key={teacher.id}>
                  <Checkbox checked={teacher.active} onCheckedChange={(checked) => setTeachers((old) => old.map((t) => t.id === teacher.id ? { ...t, active: checked === true } : t))} />
                  <span className="teacher-avatar" style={{ background: teacher.color }}>{teacher.initials}</span>
                  <span><strong>{teacher.name}</strong><small>{teacher.active ? "Aktiv im Wochenplan" : "Ausgeblendet"}</small></span>
                </label>)}
                <Button variant="outline" className="w-full" onClick={() => setTeachers((old) => [...old, { id: `t${Date.now()}`, name: "Neue Lehrperson", initials: "NL", color: palette[old.length % palette.length], active: true }])}><Plus /> Lehrperson hinzufügen</Button>
              </div>
              <div className="privacy-note"><CircleAlert /><p>Persönliche Konten und gemeinsamer Teamplan sind aktiv. Kinder weiterhin ausschliesslich mit Kürzeln erfassen.</p></div>
            </article>
          </section>
        </TabsContent>}
      </Tabs>
      <AccountSettings user={user} />

      <LessonSheet session={activeSession} kind={editTarget?.kind ?? "week"} groups={groups} teachers={teachers.filter((t) => t.active)} open={Boolean(editTarget && activeSession)} onOpenChange={(open) => !open && setEditTarget(null)} onChange={updateActiveSession} onCarry={() => activeSession && carryForward(activeSession)} />
      <Toaster richColors position="bottom-center" />
    </main>
  );
}

function WeekGrid({ sessions, week, weekOffset, groups, teachers, onOpen, onDay, onMove }: {
  sessions: Session[]; week: Week; weekOffset: number; groups: Group[]; teachers: Teacher[];
  onOpen: (day: DayKey, slot: number) => void; onDay: (day: DayKey) => void;
  onMove: (sessionId: string, day: DayKey, slot: number) => void;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ day: DayKey; slot: number; edge: "before" | "after" } | null>(null);

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
    if (!sessionId) return;
    const dragged = sessions.find((item) => item.id === sessionId);
    const edge = dropTarget?.day === day && dropTarget.slot === slot ? dropTarget.edge : "before";
    const exactSlot = dragged?.day === day || !occupied || edge === "before" ? slot : Math.min(slot + 1, slots.length - 1);
    onMove(sessionId, day, exactSlot);
    setDraggedId(null);
    setDropTarget(null);
  }

  return <div className="planner-scroll"><div className="week-grid">
    <div className="grid-corner"><Clock3 size={16} /> Zeit</div>
    {days.map((day, dayIndex) => { const meta = week.days[day.id]; return <button className="day-head" key={day.id} onClick={() => onDay(day.id)}>
      <span>{day.label}</span><strong>{new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit" }).format(dateAt(weekOffset, dayIndex))}</strong>
      <div className="day-head-meta"><span><Users size={13} /> {meta.attendance.length} LP</span>{(meta.note || meta.meetings.length > 0) && <span className="has-note"><MessageSquareText size={13} /> Info</span>}</div>
    </button>; })}
    {slots.map((slot, slotIndex) => <div className={`grid-row-contents ${slotIndex === 5 ? "afternoon-start" : ""}`} key={slot.time}>
      <div className="time-cell"><strong>{slot.time}</strong><span>{slot.label}</span>{slotIndex === 0 || slotIndex === 5 ? <em>{slot.period}</em> : null}</div>
      {days.map((day) => { const item = sessions.find((session) => session.day === day.id && session.slot === slotIndex); const isTarget = dropTarget?.day === day.id && dropTarget.slot === slotIndex; return <button
        className={`lesson-cell ${item?.id === draggedId ? "is-dragging" : ""} ${isTarget ? `drop-${dropTarget.edge}` : ""}`}
        key={`${day.id}-${slotIndex}`}
        draggable={Boolean(item)}
        onDragStart={(event) => { if (!item) return; event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/x-lesson-id", item.id); event.dataTransfer.setData("text/plain", item.title); setDraggedId(item.id); }}
        onDragOver={(event) => dragOver(event, day.id, slotIndex, Boolean(item))}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropTarget(null); }}
        onDrop={(event) => drop(event, day.id, slotIndex, Boolean(item))}
        onDragEnd={() => { setDraggedId(null); setDropTarget(null); }}
        onClick={() => onOpen(day.id, slotIndex)}
        aria-label={`${day.label}, ${slot.label}${item ? ": verschieben oder bearbeiten" : " planen"}`}
      >
        {item ? <SessionCard session={item} groups={groups} teachers={teachers} showDragHandle /> : <span className="add-cell"><Plus size={16} /> Planen</span>}
      </button>; })}
    </div>)}
  </div></div>;
}

function SessionCard({ session, groups, teachers, expanded = false, showDragHandle = false }: { session: Session; groups: Group[]; teachers: Teacher[]; expanded?: boolean; showDragHandle?: boolean }) {
  const statusLabel = session.status === "done" ? "Erledigt" : session.status === "open" ? "Offen" : session.status === "carried" ? "Übertragen" : "Geplant";
  return <div className={`session-card ${expanded ? "expanded" : ""} status-${session.status}`}>
    <div className="session-title-row">{showDragHandle && <span className="card-drag-handle" aria-hidden="true"><GripVertical /></span>}<strong>{session.title}</strong>{session.status !== "planned" && <span className="status-pill">{statusLabel}</span>}</div>
    {session.focus && <p>{session.focus}</p>}
    <div className="assignment-list">{session.wholeClass ?
      <div className="assignment all-assignment"><span className="group-dot all-dot" /><b>Alle 39</b><span className="teacher-mini-list">{session.assignments.map((a) => teachers.find((t) => t.id === a.teacherId)?.initials).filter(Boolean).join(" · ")}</span></div>
      : session.assignments.slice(0, expanded ? 6 : 3).map((assignment) => { const group = groups.find((g) => g.id === assignment.groupId); const teacher = teachers.find((t) => t.id === assignment.teacherId); if (!group) return null;
        return <div className="assignment" key={`${assignment.groupId}-${assignment.teacherId}`}><span className="group-dot" style={{ background: group.color }} /><b>{group.short}</b><span>{teacher?.initials ?? "–"}</span></div>; })}</div>
    {expanded && session.room && <div className="room-line"><MapPin size={14} />{session.room}</div>}
  </div>;
}

function DaySidebar({ day, meta, teachers, onChange, disabled }: { day: DayKey; meta: DayMeta; teachers: Teacher[]; onChange: (patch: Partial<DayMeta>) => void; disabled: boolean }) {
  function updateMeeting(index: number, patch: Partial<Meeting>) { const next = [0, 1].map((i) => meta.meetings[i] ?? { time: "", title: "" }); next[index] = { ...next[index], ...patch }; onChange({ meetings: next.filter((m) => m.time || m.title) }); }
  return <aside className="day-sidebar">
    {disabled && <div className="sidebar-disabled">Lege zuerst eine Woche aus einer Vorlage an.</div>}
    <section className="side-panel"><div className="side-title"><Users /><div><h3>Anwesende Lehrpersonen</h3><p>Wer ist heute vor Ort?</p></div></div>
      <div className="attendance-list">{teachers.filter((t) => t.active).map((teacher) => <label key={teacher.id}><Checkbox disabled={disabled} checked={meta.attendance.includes(teacher.id)} onCheckedChange={(checked) => onChange({ attendance: checked ? [...meta.attendance, teacher.id] : meta.attendance.filter((id) => id !== teacher.id) })} /><span className="teacher-avatar small" style={{ background: teacher.color }}>{teacher.initials}</span><span>{teacher.name}</span></label>)}</div>
    </section>
    <section className="side-panel note-panel"><div className="side-title"><MessageSquareText /><div><h3>Tagesnotiz</h3><p>Besonderheiten für das ganze Team</p></div></div><Textarea disabled={disabled} value={meta.note} onChange={(e) => onChange({ note: e.target.value })} placeholder="z. B. Besuch, Raumwechsel, Absenzen …" rows={5} /></section>
    <section className="side-panel meetings-panel"><div className="side-title"><Clock3 /><div><h3>Sitzungen</h3><p>Bis zu zwei Termine pro Tag</p></div></div>
      {[0, 1].map((index) => { const meeting = meta.meetings[index] ?? { time: "", title: "" }; return <div className="meeting-row" key={`${day}-${index}`}><Input disabled={disabled} type="time" value={meeting.time} onChange={(e) => updateMeeting(index, { time: e.target.value })} /><Input disabled={disabled} value={meeting.title} onChange={(e) => updateMeeting(index, { title: e.target.value })} placeholder={index === 0 ? "Stufensitzung" : "Zweiter Termin"} /></div>; })}
    </section>
  </aside>;
}

function MiniTemplate({ sessions, groups, teachers, onOpen }: { sessions: Session[]; groups: Group[]; teachers: Teacher[]; onOpen: (day: DayKey, slot: number) => void }) {
  return <div className="mini-scroll"><div className="mini-grid"><div />{days.map((d) => <strong key={d.id}>{d.short}</strong>)}
    {slots.map((slot, index) => <div className="mini-row" key={slot.time}><span>{index + 1}</span>{days.map((day) => { const item = sessions.find((session) => session.day === day.id && session.slot === index); const accent = item?.wholeClass ? "#A98BC4" : groups.find((g) => g.id === item?.assignments[0]?.groupId)?.color ?? "#D9E0E8";
      return <button key={day.id} onClick={() => onOpen(day.id, index)} style={item ? { borderLeftColor: accent, background: tint(accent, "16") } : undefined} title={item ? `${item.title} · ${teachers.find((t) => t.id === item.assignments[0]?.teacherId)?.initials ?? ""}` : "Block anlegen"}>{item ? item.title : <Plus size={13} />}</button>; })}</div>)}
  </div></div>;
}

function LessonSheet({ session, kind, groups, teachers, open, onOpenChange, onChange, onCarry }: {
  session: Session | null; kind: "week" | "template"; groups: Group[]; teachers: Teacher[]; open: boolean;
  onOpenChange: (open: boolean) => void; onChange: (patch: Partial<Session>) => void; onCarry: () => void;
}) {
  if (!session) return null;
  const day = days.find((d) => d.id === session.day); const slot = slots[session.slot];
  function setAssignment(groupId: string, teacherId: string) { const rest = session!.assignments.filter((a) => a.groupId !== groupId); onChange({ assignments: [...rest, { groupId, teacherId }] }); }
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent className="lesson-sheet sm:max-w-xl">
    <SheetHeader className="sheet-head"><p className="eyebrow">{kind === "template" ? "Vorlagenbaustein" : `${day?.label} · ${slot.time} Uhr`}</p><SheetTitle>Unterrichtsblock bearbeiten</SheetTitle><SheetDescription>Die Wochenübersicht zeigt nur die wichtigsten Stichworte. Details bleiben hier gebündelt.</SheetDescription></SheetHeader>
    <div className="sheet-body">
      <div className="field-stack"><Label htmlFor="title">Titel / Fach</Label><Input id="title" value={session.title} onChange={(e) => onChange({ title: e.target.value })} /></div>
      <div className="field-stack"><Label htmlFor="focus">Stichworte für die Übersicht</Label><Input id="focus" value={session.focus} onChange={(e) => onChange({ focus: e.target.value })} placeholder="z. B. Einführung · Üben · Reflexion" /></div>
      <div className="two-fields"><div className="field-stack"><Label htmlFor="room">Raum</Label><Input id="room" value={session.room} onChange={(e) => onChange({ room: e.target.value })} /></div><label className="whole-class"><Checkbox checked={session.wholeClass} onCheckedChange={(checked) => onChange({ wholeClass: checked === true })} /><span><strong>Alle 39 Kinder</strong><small>Teamteaching ohne Gruppentrennung</small></span></label></div>
      <div className="field-stack"><Label>Gruppen & Zuständigkeit</Label><div className="responsibility-grid">{groups.map((group) => { const teacherId = session.assignments.find((a) => a.groupId === group.id)?.teacherId ?? teachers[0]?.id ?? ""; return <div className="responsibility" key={group.id}><span className="group-tag" style={{ background: tint(group.color, "28"), color: group.color }}><i style={{ background: group.color }} />{group.name}</span><Select value={teacherId} onValueChange={(value) => setAssignment(group.id, value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{teachers.map((teacher) => <SelectItem key={teacher.id} value={teacher.id}>{teacher.initials} · {teacher.name}</SelectItem>)}</SelectContent></Select></div>; })}</div></div>
      <div className="field-stack"><Label htmlFor="children">Abweichende Kinderzuordnung</Label><Textarea id="children" value={session.children} onChange={(e) => onChange({ children: e.target.value })} placeholder="Kürzel für diese Lektion, z. B. A03" rows={3} /><small>Mehrfachzugehörigkeit zu Gruppen ist erlaubt. Hier werden nur die Kinder erfasst, die in dieser Lektion tatsächlich anwesend sind.</small></div>
      <div className="field-stack"><Label htmlFor="child-overrides">Ausnahme-Kürzel für diese Lektion</Label><Input id="child-overrides" value={(session.childOverrides ?? []).join(", ")} onChange={(e) => onChange({ childOverrides: e.target.value.split(/[\s,;]+/).map(value => value.trim().toUpperCase()).filter(Boolean) })} placeholder="z. B. A03" /><small>Nur für diese einzelne Lektion. Die Konfliktprüfung bleibt an allen anderen Tagen aktiv.</small></div>
      <div className="field-stack"><Label htmlFor="notes">Notizen & Material</Label><Textarea id="notes" value={session.notes} onChange={(e) => onChange({ notes: e.target.value })} placeholder="Aufträge, Material, Beobachtungen, Links …" rows={5} /></div>
      {kind === "week" && <div className="status-control"><span>Status</span><div>{(["planned", "open", "done"] as SessionStatus[]).map((status) => <button key={status} className={session.status === status ? "active" : ""} onClick={() => onChange({ status })}>{status === "planned" ? "Geplant" : status === "open" ? "Noch offen" : "Erledigt"}</button>)}</div></div>}
    </div>
    <SheetFooter className="sheet-actions">{kind === "week" && <Button variant="outline" onClick={onCarry}><CopyPlus /> In nächste freie Lektion übertragen</Button>}<Button onClick={() => onOpenChange(false)}><Check /> Speichern & schliessen</Button></SheetFooter>
  </SheetContent></Sheet>;
}
