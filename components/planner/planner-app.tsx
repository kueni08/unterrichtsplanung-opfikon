"use client";

import { useState } from "react";
import {
  CalendarDays, Check, CheckCheck, ChevronLeft, ChevronRight, CircleAlert, CopyPlus,
  GripVertical, HelpCircle, LayoutGrid, LogOut, Printer, Settings2, TriangleAlert, Users,
} from "lucide-react";

import { AdminView } from "@/components/planner/admin-view";
import { DayView } from "@/components/planner/day-view";
import { LessonSheet } from "@/components/planner/lesson-sheet";
import { OwlLogo } from "@/components/planner/owl-logo";
import { Splash } from "@/components/planner/splash";
import { WeekGrid } from "@/components/planner/week-grid";
import { WelcomeTour } from "@/components/planner/welcome-tour";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { usePlanner } from "@/hooks/use-planner";
import type { PlannerBackend } from "@/lib/planner/backend";
import { weekStartFor, isoWeekNumber, parseIsoDate, addDays } from "@/lib/planner/dates";
import { countChildren, emptyDays, initialsFrom, planningWarnings, sessionsIn } from "@/lib/planner/logic";
import type { DayKey, Role } from "@/lib/planner/types";

const weekLabelFmt = new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "short" });

function defaultDayForToday(): DayKey {
  const weekday = new Date().getDay(); // 0 = So … 6 = Sa
  const map: Record<number, DayKey> = { 1: "mo", 2: "di", 3: "mi", 4: "do", 5: "fr" };
  return map[weekday] ?? "mo";
}

function tourSeenKey(userId: string) {
  return `wochenatelier-tour-${userId}`;
}

function initialTourOpen(userId: string): boolean {
  try {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get("tour") === "0") return false;
    return !window.localStorage.getItem(tourSeenKey(userId));
  } catch {
    return false;
  }
}

export type TeamOption = { teamId: string; teamName: string; role: Role };

export function PlannerApp({ backend, userId, displayName, mode, teams, onSwitchTeam, onSignOut, onExitDemo }: {
  backend: PlannerBackend;
  userId: string;
  displayName: string;
  mode: "demo" | "team";
  teams?: TeamOption[];
  onSwitchTeam?: (teamId: string) => void;
  onSignOut?: () => void;
  onExitDemo?: () => void;
}) {
  const api = usePlanner(backend, { userId, displayName });
  const [tab, setTab] = useState<"week" | "day" | "admin">("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<DayKey>(defaultDayForToday);
  const [viewOverride, setViewOverride] = useState<string | null>(null);
  const [templateOverride, setTemplateOverride] = useState<string | null>(null);
  const [sheetSessionId, setSheetSessionId] = useState<string | null>(null);
  const [tourOpen, setTourOpen] = useState(() => initialTourOpen(userId));

  if (api.loadError) {
    return (
      <main className="planner-error-shell">
        <div className="planner-error-card">
          <TriangleAlert size={28} />
          <h2>Plan konnte nicht geladen werden</h2>
          <p>{api.loadError}</p>
          <Button onClick={() => api.reload()}>Erneut versuchen</Button>
        </div>
      </main>
    );
  }

  const snapshot = api.snapshot;
  if (!snapshot) return <Splash />;

  const weekStart = weekStartFor(new Date(), weekOffset);
  const weekDays = snapshot.weeks[weekStart];
  const weekExists = Boolean(weekDays);
  const sessionsInWeek = sessionsIn(snapshot.sessions, { weekStart });
  const selectedView = viewOverride ?? api.me?.teacherId ?? "all";
  const selectedTemplateId = templateOverride ?? snapshot.templates[0]?.id ?? "";
  const activeTeachers = snapshot.teachers.filter((t) => t.active);
  const warnings = planningWarnings(sessionsInWeek, snapshot.groups, snapshot.teachers);
  const sheetSession = sheetSessionId ? snapshot.sessions.find((s) => s.id === sheetSessionId) ?? null : null;
  const monday = parseIsoDate(weekStart);
  const weekEnd = addDays(monday, 4);

  function openWeekCell(day: DayKey, slot: number) {
    const existing = sessionsInWeek.find((s) => s.day === day && s.slot === slot);
    if (existing) { setSheetSessionId(existing.id); return; }
    const id = api.addSession({ weekStart }, day, slot);
    if (id) setSheetSessionId(id);
  }

  function handleAddLesson() {
    const id = api.addSession({ weekStart }, selectedDay);
    if (id) setSheetSessionId(id);
  }

  function handleDayHeaderClick(day: DayKey) {
    setSelectedDay(day);
    setTab("day");
  }

  function closeTour(open: boolean) {
    if (!open) {
      try { window.localStorage.setItem(tourSeenKey(userId), "1"); } catch { /* Speicher gesperrt */ }
    }
    setTourOpen(open);
  }

  const onlineTeachers = api.onlineUserIds
    .map((id) => snapshot.members.find((m) => m.userId === id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m))
    .map((member) => {
      const teacher = snapshot.teachers.find((t) => t.id === member.teacherId);
      return { key: member.userId, initials: teacher?.initials ?? initialsFrom(member.displayName), color: teacher?.color ?? "#5f9ec8", name: member.displayName };
    });

  const saveIcon = api.saveState === "saved" ? <Check size={14} /> : api.saveState === "saving" ? <CheckCheck size={14} className="save-spin" /> : <CircleAlert size={14} />;
  const saveLabel = api.saveState === "saved" ? "Gespeichert" : api.saveState === "saving" ? "Speichert…" : "Fehler beim Speichern";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <OwlLogo size={52} />
          <div className="brand-divider" />
          <div>
            <p className="eyebrow">Teamplanung</p>
            <h1>Wochenatelier{snapshot.team.name && <span className="team-name-chip">{snapshot.team.name}</span>}</h1>
          </div>
        </div>
        <div className="header-meta">
          <button type="button" className="help-button" onClick={() => setTourOpen(true)} aria-label="Kurze Einführung anzeigen"><HelpCircle size={18} /></button>
          <p className={`save-state save-${api.saveState}`}>{saveIcon} {saveLabel}</p>
          {mode === "team" && onlineTeachers.length > 0 && (
            <div className="avatar-stack" aria-label="Gerade online">
              {onlineTeachers.slice(0, 5).map((t) => <span key={t.key} style={{ background: t.color }} title={`${t.name} · online`}>{t.initials}</span>)}
            </div>
          )}
          {mode === "demo" && <span className="demo-badge">Demo</span>}
          <span className="user-chip"><strong>{displayName}</strong><small>{api.role === "koordination" ? "Koordination" : "Lehrperson"}</small></span>
          {mode === "team" && teams && teams.length > 1 && (
            <Select value={snapshot.team.id} onValueChange={(value) => onSwitchTeam?.(value)}>
              <SelectTrigger aria-label="Team wechseln" className="team-switch"><SelectValue /></SelectTrigger>
              <SelectContent>{teams.map((t) => <SelectItem key={t.teamId} value={t.teamId}>{t.teamName}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <button
            type="button"
            className="logout-button"
            title={mode === "demo" ? "Demo beenden" : "Abmelden"}
            aria-label={mode === "demo" ? "Demo beenden" : "Abmelden"}
            onClick={() => (mode === "demo" ? onExitDemo?.() : onSignOut?.())}
          >
            <LogOut size={14} /> <span className="logout-label">{mode === "demo" ? "Demo beenden" : "Abmelden"}</span>
          </button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="workspace">
        <div className="workspace-nav">
          <TabsList variant="line" className="main-tabs">
            <TabsTrigger value="week"><LayoutGrid /> Wochenplan</TabsTrigger>
            <TabsTrigger value="day"><CalendarDays /> Tagesfokus</TabsTrigger>
            {api.isCoordinator && <TabsTrigger value="admin"><Settings2 /> Admin</TabsTrigger>}
          </TabsList>
          <div className="view-selector">
            <span>Ansicht:</span>
            <Select value={selectedView} onValueChange={setViewOverride}>
              <SelectTrigger aria-label="Persönliche Ansicht"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Gesamtansicht</SelectItem>
                {activeTeachers.map((teacher) => <SelectItem key={teacher.id} value={teacher.id}>{teacher.initials} · {teacher.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="week" className="view-space">
          <section className="planner-toolbar">
            <div className="week-switcher">
              <Button variant="outline" size="icon" onClick={() => setWeekOffset((v) => v - 1)} aria-label="Vorherige Woche"><ChevronLeft /></Button>
              <div className="week-title">
                <span>KW {isoWeekNumber(monday)}</span>
                <strong>{weekLabelFmt.format(monday)} – {weekLabelFmt.format(weekEnd)} {weekEnd.getFullYear()}</strong>
              </div>
              <Button variant="outline" size="icon" onClick={() => setWeekOffset((v) => v + 1)} aria-label="Nächste Woche"><ChevronRight /></Button>
              {weekOffset !== 0 && <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>Heute</Button>}
            </div>
            <div className="toolbar-actions">
              <Select value={selectedTemplateId} onValueChange={setTemplateOverride}>
                <SelectTrigger aria-label="Wochenvorlage" className="template-select"><SelectValue /></SelectTrigger>
                <SelectContent>{snapshot.templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
              {!weekExists && <Button onClick={() => api.createWeekFromTemplate(weekStart, selectedTemplateId)}><CopyPlus /> Woche aus Vorlage</Button>}
              {weekExists && <Button variant="outline" onClick={handleAddLesson}><CopyPlus /> Lektion</Button>}
              {weekExists && <Button variant="outline" onClick={() => window.print()}><Printer /> Drucken</Button>}
            </div>
          </section>

          <div className="legend-row">
            <span className="legend-label">Gruppen</span>
            {snapshot.groups.map((group) => <span className="legend-chip" key={group.id}><i style={{ background: group.color }} />{group.name}</span>)}
            <span className="legend-chip all"><Users size={14} />Alle {countChildren(snapshot.groups)}</span>
            <span className="drag-hint"><GripVertical size={14} /> Blöcke ziehen oder im Block „Verschieben“ wählen</span>
          </div>

          <div className="privacy-strip">
            <CircleAlert size={16} />
            <span><strong>Datenschutz:</strong> Kinder nur mit Kürzel (z. B. A01) erfassen – keine Namen, Diagnosen oder privaten Details.</span>
            <span className="privacy-count">{countChildren(snapshot.groups)} Kürzel erfasst</span>
          </div>

          {warnings.length > 0 && (
            <div className="planning-warning">
              <CircleAlert size={16} />
              <div>
                <strong>Planungscheck</strong>
                {warnings.slice(0, 2).map((warning) => <span key={warning}>{warning}</span>)}
                {warnings.length > 2 && <span>+{warnings.length - 2} weitere</span>}
              </div>
            </div>
          )}

          {!weekExists ? (
            <section className="empty-week">
              <div className="empty-icon"><CalendarDays /></div>
              <h2>Diese Woche ist noch leer</h2>
              <p>Wähle eine Grundstruktur und übernimm sie als Ausgangslage. Danach kannst du jeden Block individuell anpassen.</p>
              <Button onClick={() => api.createWeekFromTemplate(weekStart, selectedTemplateId)}>
                <CopyPlus /> {snapshot.templates.find((t) => t.id === selectedTemplateId)?.name ?? "Vorlage"} übernehmen
              </Button>
            </section>
          ) : (
            <>
              <div className="active-view-note">{selectedView === "all" ? "Gesamtansicht: alle Gruppen und Zuständigkeiten" : `Persönliche Ansicht für ${activeTeachers.find((t) => t.id === selectedView)?.initials ?? ""}: eigene Zuständigkeiten und Teamtermine`}</div>
              <WeekGrid
                sessions={sessionsInWeek}
                weekDays={weekDays!}
                weekStart={weekStart}
                groups={snapshot.groups}
                teachers={snapshot.teachers}
                viewerId={selectedView}
                onOpen={openWeekCell}
                onDayHeaderClick={handleDayHeaderClick}
                onMove={(sessionId, day, slot) => api.moveSession(sessionId, day, slot)}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="day" className="view-space">
          <DayView
            weekStart={weekStart}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            sessions={sessionsInWeek}
            groups={snapshot.groups}
            teachers={snapshot.teachers}
            dayMeta={weekDays?.[selectedDay] ?? emptyDays(snapshot.teachers)[selectedDay]}
            disabled={!weekExists}
            viewerId={selectedView}
            onOpenSession={openWeekCell}
            onChangeDay={(patch) => api.updateDay(weekStart, selectedDay, patch)}
          />
        </TabsContent>

        {api.isCoordinator && (
          <TabsContent value="admin" className="view-space">
            <AdminView
              api={api}
              snapshot={snapshot}
              mode={mode}
              selectedTemplateId={selectedTemplateId}
              onSelectTemplate={setTemplateOverride}
              onOpenSheet={setSheetSessionId}
              currentUserId={userId}
            />
          </TabsContent>
        )}
      </Tabs>

      <LessonSheet
        key={sheetSessionId ?? "none"}
        session={sheetSession}
        api={api}
        snapshot={snapshot}
        isCoordinator={api.isCoordinator}
        onOpenChange={(open) => !open && setSheetSessionId(null)}
      />
      <WelcomeTour open={tourOpen} onOpenChange={closeTour} role={api.role} joinCode={snapshot.team.joinCode} />
      <Toaster richColors position="bottom-center" />
    </main>
  );
}
