"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { PlannerBackend } from "@/lib/planner/backend";
import { DAYS, SLOTS, TEACHER_PALETTE, GROUP_PALETTE, isMeetingSlot } from "@/lib/planner/constants";
import {
  applyChanged, carryForwardTarget, continuationTitle, defaultAssignments, emptyDays,
  findFreeSlot, makeSession, newId, pickFields, reorderSessions, sameContainer, sessionsIn, uniqueInitials, weekFromTemplate,
} from "@/lib/planner/logic";
import type { DayKey, DayMeta, Group, Member, PersistOp, PlannerSnapshot, Role, Session, Teacher, Template, Viewer } from "@/lib/planner/types";

export type SaveState = "saved" | "saving" | "error";
export type Container = { weekStart: string } | { templateId: string };

const containerOf = (c: Container) => ("weekStart" in c ? { weekStart: c.weekStart, templateId: null } : { weekStart: null, templateId: c.templateId });
const dayLabel = (day: DayKey) => DAYS.find((d) => d.id === day)?.label ?? day;

/**
 * Zentraler Zustand der Planung. Änderungen erscheinen sofort (optimistisch),
 * werden der Reihe nach gespeichert und bei Fehlern mit dem Serverstand abgeglichen.
 */
export function usePlanner(backend: PlannerBackend, viewer: { userId: string; displayName: string }) {
  const [snapshot, setSnapshotState] = useState<PlannerSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);

  const snapRef = useRef<PlannerSnapshot | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  const failed = useRef(false);
  const timers = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; run: () => void }>());
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleReloadRef = useRef<(delay?: number) => void>(() => {});
  /** zählt jede Zustandsänderung – ein Neuladen, das eine lokale Änderung überholt hat, wird verworfen */
  const version = useRef(0);
  /** noch nicht gespeicherte Felder pro Lektion bzw. Wochentag */
  const dirty = useRef(new Map<string, Set<string>>());

  const setSnapshot = useCallback((next: PlannerSnapshot) => {
    version.current += 1;
    snapRef.current = next;
    setSnapshotState(next);
  }, []);

  const markDirty = (key: string, fields: string[]) => {
    const set = dirty.current.get(key) ?? new Set<string>();
    fields.forEach((f) => set.add(f));
    dirty.current.set(key, set);
  };
  const takeDirty = (key: string): string[] => {
    const set = dirty.current.get(key);
    dirty.current.delete(key);
    return set ? [...set] : [];
  };

  const reload = useCallback(async () => {
    const started = version.current;
    try {
      const fresh = await backend.load();
      // Während des Ladens lokal geändert oder noch ungespeichert? Dann später erneut laden,
      // statt die lokale (optimistische) Änderung mit dem älteren Serverstand zu überschreiben.
      if (snapRef.current && (version.current !== started || pending.current > 0 || timers.current.size > 0)) {
        scheduleReloadRef.current(600);
        return;
      }
      setSnapshot(fresh);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    }
  }, [backend, setSnapshot]);

  // `scheduleReloadRef` gibt der verzögerten Selbstwiederholung immer die aktuelle
  // Fassung von `scheduleReload`, statt eine veraltete Closure einzufangen.
  const scheduleReload = useCallback((delay = 350) => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => {
      reloadTimer.current = null;
      if (pending.current > 0 || timers.current.size > 0) { scheduleReloadRef.current(600); return; }
      void reload();
    }, delay);
  }, [reload]);
  useEffect(() => { scheduleReloadRef.current = scheduleReload; });

  const enqueue = useCallback((op: PersistOp) => {
    pending.current += 1;
    setSaveState("saving");
    queue.current = queue.current
      .then(() => backend.persist(op, snapRef.current as PlannerSnapshot))
      .catch((error: unknown) => {
        failed.current = true;
        toast.error(error instanceof Error ? error.message : "Speichern fehlgeschlagen");
        scheduleReload(0);
      })
      .finally(() => {
        pending.current -= 1;
        if (pending.current === 0) {
          setSaveState(failed.current ? "error" : "saved");
          failed.current = false;
        }
      });
  }, [backend, scheduleReload]);

  const debounce = useCallback((key: string, makeOp: () => PersistOp | null, delay = 450) => {
    const existing = timers.current.get(key);
    if (existing) clearTimeout(existing.timer);
    const run = () => {
      timers.current.delete(key);
      const op = makeOp();
      if (op) enqueue(op);
    };
    setSaveState("saving");
    timers.current.set(key, { timer: setTimeout(run, delay), run });
  }, [enqueue]);

  const flush = useCallback(() => {
    for (const [, entry] of [...timers.current]) { clearTimeout(entry.timer); entry.run(); }
  }, []);

  const commit = useCallback((next: PlannerSnapshot, ops: PersistOp[] = []) => {
    setSnapshot(next);
    ops.forEach(enqueue);
  }, [enqueue, setSnapshot]);

  // Laden, Realtime, Presence
  useEffect(() => {
    let cancelled = false;
    backend.load()
      .then((data) => { if (!cancelled) { setSnapshot(data); setLoadError(null); } })
      .catch((error: unknown) => { if (!cancelled) setLoadError(error instanceof Error ? error.message : String(error)); });
    const knowsId = (id: string) => {
      const snap = snapRef.current;
      return Boolean(snap && [snap.sessions, snap.groups, snap.teachers, snap.templates].some((list) => list.some((x) => x.id === id)));
    };
    const unsubscribe = backend.subscribe(
      { onRemoteChange: () => scheduleReload(), onPresence: (ids) => { if (!cancelled) setOnlineUserIds(ids); }, knowsId },
      { ...viewer, role: "lehrperson", teacherId: null } satisfies Viewer,
    );
    const onUnload = () => flush();
    window.addEventListener("beforeunload", onUnload);
    const retimers = timers.current;
    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener("beforeunload", onUnload);
      for (const [, entry] of [...retimers]) { clearTimeout(entry.timer); entry.run(); }
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
    };
    // viewer ist pro Instanz stabil (Komponente wird bei Wechsel neu gemountet)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend]);

  const me: Member | null = useMemo(
    () => snapshot?.members.find((m) => m.userId === viewer.userId) ?? null,
    [snapshot, viewer.userId],
  );
  const role: Role = me?.role ?? "lehrperson";

  const get = () => snapRef.current as PlannerSnapshot;

  // ---------- Lektionen ----------

  const ensureWeek = (snap: PlannerSnapshot, weekStart: string, ops: PersistOp[]): PlannerSnapshot => {
    if (snap.weeks[weekStart]) return snap;
    const days = emptyDays(snap.teachers);
    ops.push({ type: "createWeek", weekStart, days });
    return { ...snap, weeks: { ...snap.weeks, [weekStart]: days } };
  };

  const updateSession = useCallback((id: string, patch: Partial<Session>) => {
    const snap = get();
    const next = { ...snap, sessions: snap.sessions.map((s) => (s.id === id ? { ...s, ...patch } : s)) };
    setSnapshot(next);
    const key = `session:${id}`;
    markDirty(key, Object.keys(patch));
    debounce(key, () => {
      const fields = takeDirty(key) as (keyof Session)[];
      const row = snapRef.current?.sessions.find((s) => s.id === id);
      return row && fields.length ? { type: "patchSession", id, patch: pickFields(row, fields) } : null;
    });
  }, [debounce, setSnapshot]);

  const addSession = useCallback((container: Container, day: DayKey, preferredSlot = 0): string | null => {
    let snap = get();
    const where = containerOf(container);
    const list = sessionsIn(snap.sessions, where);
    const taken = list.some((s) => s.day === day && s.slot === preferredSlot);
    const slot = taken ? findFreeSlot(list, day, 0) : preferredSlot;
    if (slot < 0) { toast.error(`${dayLabel(day)} ist bereits voll belegt`); return null; }
    const ops: PersistOp[] = [];
    if (where.weekStart) snap = ensureWeek(snap, where.weekStart, ops);
    const fresh = isMeetingSlot(slot)
      ? makeSession({ ...where, day, slot, title: "Termin", assignments: [] })
      : makeSession({ ...where, day, slot, assignments: defaultAssignments(snap.groups, snap.teachers) });
    ops.push({ type: "upsertSessions", rows: [fresh] });
    commit({ ...snap, sessions: [...snap.sessions, fresh] }, ops);
    return fresh.id;
  }, [commit]);

  const removeSession = useCallback((id: string) => {
    const snap = get();
    const t = timers.current.get(`session:${id}`);
    if (t) { clearTimeout(t.timer); timers.current.delete(`session:${id}`); }
    dirty.current.delete(`session:${id}`);
    commit({ ...snap, sessions: snap.sessions.filter((s) => s.id !== id) }, [{ type: "deleteSessions", ids: [id] }]);
    toast.success("Block entfernt");
  }, [commit]);

  const moveSession = useCallback((id: string, day: DayKey, slot: number): boolean => {
    flush();
    const snap = get();
    const session = snap.sessions.find((s) => s.id === id);
    if (!session) return false;
    const list = snap.sessions.filter((s) => s.weekStart === session.weekStart && s.templateId === session.templateId);
    const { changed, moved } = reorderSessions(list, id, day, slot);
    if (!moved) {
      if (!(session.day === day && session.slot === slot)) toast.error("An diesem Tag ist kein freier Platz mehr vorhanden");
      return false;
    }
    commit({ ...snap, sessions: applyChanged(snap.sessions, changed) }, [{ type: "moveSessions", rows: changed }]);
    toast.success(`Block auf ${dayLabel(day)}, ${SLOTS[Math.min(slot, SLOTS.length - 1)].time} Uhr verschoben`);
    return true;
  }, [commit, flush]);

  /** Zwei Blöcke derselben Woche/Vorlage tauschen die Plätze. */
  const swapSessions = useCallback((idA: string, idB: string): boolean => {
    flush();
    const snap = get();
    const a = snap.sessions.find((s) => s.id === idA);
    const b = snap.sessions.find((s) => s.id === idB);
    if (!a || !b || !sameContainer(a, b)) return false;
    const changed = [{ ...a, day: b.day, slot: b.slot }, { ...b, day: a.day, slot: a.slot }];
    commit({ ...snap, sessions: applyChanged(snap.sessions, changed) }, [{ type: "moveSessions", rows: changed }]);
    toast.success("Blöcke getauscht");
    return true;
  }, [commit, flush]);

  /** Der Zielblock wird gelöscht, der verschobene Block nimmt seinen Platz ein. */
  const replaceSession = useCallback((id: string, targetId: string): boolean => {
    flush();
    const snap = get();
    const a = snap.sessions.find((s) => s.id === id);
    const target = snap.sessions.find((s) => s.id === targetId);
    if (!a || !target || !sameContainer(a, target)) return false;
    const moved = { ...a, day: target.day, slot: target.slot };
    const sessions = applyChanged(snap.sessions.filter((s) => s.id !== targetId), [moved]);
    commit({ ...snap, sessions }, [{ type: "deleteSessions", ids: [targetId] }, { type: "moveSessions", rows: [moved] }]);
    toast.success(`„${target.title}“ ersetzt`);
    return true;
  }, [commit, flush]);

  /**
   * Der verschobene Block geht als Bestandteil im Zielblock auf (z. B. weil er noch nicht fertig war):
   * Titel und Stichworte werden ergänzt, Notizen angehängt, der verschobene Block entfällt.
   */
  const appendSession = useCallback((id: string, targetId: string): boolean => {
    flush();
    const snap = get();
    const a = snap.sessions.find((s) => s.id === id);
    const target = snap.sessions.find((s) => s.id === targetId);
    if (!a || !target || !sameContainer(a, target)) return false;
    const focus = [target.focus.trim(), `+ ${a.title}${a.focus.trim() ? ` (${a.focus.trim()})` : ""}`].filter(Boolean).join(" · ");
    const notes = [target.notes.trim(), a.notes.trim() ? `— Aus „${a.title}“ übernommen —\n${a.notes.trim()}` : ""].filter(Boolean).join("\n\n");
    const patch: Partial<Session> = { focus, notes };
    const sessions = snap.sessions.filter((s) => s.id !== id).map((s) => (s.id === targetId ? { ...s, ...patch } : s));
    commit({ ...snap, sessions }, [{ type: "patchSession", id: targetId, patch }, { type: "deleteSessions", ids: [id] }]);
    toast.success(`„${a.title}“ in „${target.title}“ aufgenommen`);
    return true;
  }, [commit, flush]);

  /**
   * Überträgt einen Block als Fortsetzung. Existiert die Folgewoche noch nicht, wird sie zuerst
   * aus der Vorlage `templateId` angelegt – sonst wäre sie danach leer und liesse sich nicht
   * mehr aus der Vorlage erstellen.
   */
  const carryForward = useCallback((id: string, nextWeekStart: string, templateId?: string | null): boolean => {
    flush();
    let snap = get();
    const session = snap.sessions.find((s) => s.id === id);
    if (!session?.weekStart) return false;
    const ops: PersistOp[] = [];
    let target = carryForwardTarget(snap.sessions, session, nextWeekStart);
    if (target && !snap.weeks[target.weekStart]) {
      const created = weekFromTemplate(snap.sessions, snap.templates, snap.teachers, templateId, target.weekStart);
      snap = { ...snap, weeks: { ...snap.weeks, [target.weekStart]: created.days }, sessions: [...snap.sessions, ...created.sessions] };
      ops.push({ type: "createWeek", weekStart: target.weekStart, days: created.days });
      if (created.sessions.length) ops.push({ type: "upsertSessions", rows: created.sessions });
      target = carryForwardTarget(snap.sessions, session, nextWeekStart);
    }
    if (!target) { toast.error("Weder diese noch nächste Woche hat einen freien Platz"); return false; }
    const marked: Session = { ...session, status: "carried" };
    const copy: Session = {
      ...session, id: newId(), weekStart: target.weekStart, day: target.day, slot: target.slot,
      title: continuationTitle(session.title), status: "planned", assignments: session.assignments.map((a) => ({ ...a })),
    };
    ops.push({ type: "upsertSessions", rows: [copy] }, { type: "patchSession", id, patch: { status: "carried" } });
    commit({ ...snap, sessions: applyChanged(snap.sessions, [marked, copy]) }, ops);
    const when = target.weekStart === session.weekStart ? "" : " (nächste Woche)";
    toast.success(`Fortsetzung auf ${dayLabel(target.day)}, ${SLOTS[target.slot].time} Uhr${when} übertragen`);
    return true;
  }, [commit, flush]);

  const createWeekFromTemplate = useCallback((weekStart: string, templateId: string) => {
    const snap = get();
    if (snap.weeks[weekStart]) return;
    const { days, sessions: clones } = weekFromTemplate(snap.sessions, snap.templates, snap.teachers, templateId, weekStart);
    commit(
      { ...snap, weeks: { ...snap.weeks, [weekStart]: days }, sessions: [...snap.sessions, ...clones] },
      [{ type: "createWeek", weekStart, days }, { type: "upsertSessions", rows: clones }],
    );
    toast.success("Woche aus Vorlage angelegt");
  }, [commit]);

  const updateDay = useCallback((weekStart: string, day: DayKey, patch: Partial<DayMeta>) => {
    const snap = get();
    const week = snap.weeks[weekStart];
    if (!week) return;
    const nextWeek = { ...week, [day]: { ...week[day], ...patch } };
    setSnapshot({ ...snap, weeks: { ...snap.weeks, [weekStart]: nextWeek } });
    const key = `week:${weekStart}:${day}`;
    markDirty(key, Object.keys(patch));
    debounce(key, () => {
      const fields = takeDirty(key) as (keyof DayMeta)[];
      const latest = snapRef.current?.weeks[weekStart]?.[day];
      return latest && fields.length ? { type: "patchWeekDay", weekStart, day, patch: pickFields(latest, fields) } : null;
    });
  }, [debounce, setSnapshot]);

  // ---------- Stammdaten (Koordination) ----------

  const updateGroup = useCallback((id: string, patch: Partial<Group>) => {
    const snap = get();
    setSnapshot({ ...snap, groups: snap.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) });
    debounce(`group:${id}`, () => {
      const g = snapRef.current?.groups.find((x) => x.id === id);
      return g ? { type: "upsertGroups", rows: [g] } : null;
    });
  }, [debounce, setSnapshot]);

  const addGroup = useCallback(() => {
    const snap = get();
    const group: Group = { id: newId(), name: "Neue Gruppe", short: "Neu", color: GROUP_PALETTE[snap.groups.length % GROUP_PALETTE.length], children: "", sortOrder: snap.groups.length };
    commit({ ...snap, groups: [...snap.groups, group] }, [{ type: "upsertGroups", rows: [group] }]);
  }, [commit]);

  const removeGroup = useCallback((id: string) => {
    const snap = get();
    commit({ ...snap, groups: snap.groups.filter((g) => g.id !== id) }, [{ type: "deleteGroup", id }]);
  }, [commit]);

  const updateTeacher = useCallback((id: string, patch: Partial<Teacher>) => {
    const snap = get();
    setSnapshot({
      ...snap,
      teachers: snap.teachers.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, ...patch };
        const others = snap.teachers.filter((x) => x.id !== id).map((x) => x.initials);
        // Kürzel folgt dem Namen, solange es nicht von Hand gesetzt wurde
        if (patch.name !== undefined && patch.initials === undefined && t.initials === uniqueInitials(t.name, others)) next.initials = uniqueInitials(patch.name, others);
        if (patch.initials !== undefined) next.initials = patch.initials.trim().slice(0, 4);
        return next;
      }),
    });
    debounce(`teacher:${id}`, () => {
      const t = snapRef.current?.teachers.find((x) => x.id === id);
      return t ? { type: "upsertTeachers", rows: [t] } : null;
    });
  }, [debounce, setSnapshot]);

  const addTeacher = useCallback((name = "Neue Lehrperson") => {
    const snap = get();
    const teacher: Teacher = { id: newId(), name, initials: uniqueInitials(name, snap.teachers.map((t) => t.initials)), color: TEACHER_PALETTE[snap.teachers.length % TEACHER_PALETTE.length], active: true, sortOrder: snap.teachers.length };
    commit({ ...snap, teachers: [...snap.teachers, teacher] }, [{ type: "upsertTeachers", rows: [teacher] }]);
    return teacher.id;
  }, [commit]);

  const updateTemplate = useCallback((id: string, patch: Partial<Template>) => {
    const snap = get();
    setSnapshot({ ...snap, templates: snap.templates.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
    debounce(`template:${id}`, () => {
      const t = snapRef.current?.templates.find((x) => x.id === id);
      return t ? { type: "upsertTemplates", rows: [t] } : null;
    });
  }, [debounce, setSnapshot]);

  const renameTeam = useCallback((name: string) => {
    const snap = get();
    setSnapshot({ ...snap, team: { ...snap.team, name } });
    debounce("team", () => ({ type: "updateTeam", name: snapRef.current?.team.name ?? name }));
  }, [debounce, setSnapshot]);

  const updateMember = useCallback((userId: string, patch: Partial<Pick<Member, "role" | "teacherId">>) => {
    const snap = get();
    if (patch.role === "lehrperson" && snap.members.filter((m) => m.role === "koordination" && m.userId !== userId).length === 0) {
      toast.error("Das Team braucht mindestens eine Koordination.");
      return;
    }
    commit({ ...snap, members: snap.members.map((m) => (m.userId === userId ? { ...m, ...patch } : m)) }, [{ type: "updateMember", userId, patch }]);
  }, [commit]);

  const removeMember = useCallback((userId: string) => {
    const snap = get();
    commit({ ...snap, members: snap.members.filter((m) => m.userId !== userId) }, [{ type: "removeMember", userId }]);
  }, [commit]);

  const regenerateJoinCode = useCallback(async () => {
    try {
      const code = await backend.regenerateJoinCode();
      const snap = get();
      setSnapshot({ ...snap, team: { ...snap.team, joinCode: code } });
      toast.success("Neuer Beitrittscode erstellt");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Code konnte nicht erneuert werden");
    }
  }, [backend, setSnapshot]);

  const resetDemo = useCallback(async () => {
    if (!backend.reset) return;
    setSnapshot(await backend.reset());
    toast.success("Beispieldaten wiederhergestellt");
  }, [backend, setSnapshot]);

  return {
    snapshot, loadError, saveState, onlineUserIds, me, role, isCoordinator: role === "koordination",
    reload, flush,
    updateSession, addSession, removeSession, moveSession, swapSessions, replaceSession, appendSession, carryForward, createWeekFromTemplate, updateDay,
    updateGroup, addGroup, removeGroup, updateTeacher, addTeacher, updateTemplate, renameTeam, updateMember, removeMember,
    regenerateJoinCode, resetDemo: backend.reset ? resetDemo : undefined,
  };
}

export type PlannerApi = ReturnType<typeof usePlanner>;
