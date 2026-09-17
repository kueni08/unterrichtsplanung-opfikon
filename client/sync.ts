import { useEffect, useRef, useState } from "react";
import { plannerSchema, type PlannerData, type TeamUser } from "../shared/planner";
type Pending = { revision: number; operationId: string; data: PlannerData; urgent: boolean };
export function useTeamSync(user: TeamUser, data: PlannerData, onData: (data: PlannerData) => void) {
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Teamplan wird geladen …");
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState("");
  const [urgent, setUrgent] = useState(false);
  const state = useRef({ revision: 0, accepted: "", pending: null as Pending | null, busy: false, conflict: false, loaded: false });
  const apply = useRef(onData); apply.current = onData;
  const latest = useRef(data); latest.current = data;
  const urgentRef = useRef(urgent); urgentRef.current = urgent;
  const key = `wa-draft-${user.id}`;
  const persist = () => {
    try {
      if (state.current.pending) localStorage.setItem(key, JSON.stringify(state.current.pending));
      else localStorage.removeItem(key);
      localStorage.setItem(`wa-cache-${user.id}`, JSON.stringify({ revision: state.current.revision, data: latest.current }));
      return true;
    } catch { setNotice("Gerätespeicher voll oder gesperrt. Bitte den Entwurf exportieren und die App offen lassen, bis online gespeichert wurde."); return false; }
  };
  const accept = (value: PlannerData, revision: number) => { state.current.revision = revision; state.current.accepted = JSON.stringify(value); latest.current = value; apply.current(value); persist(); };
  const refresh = async () => {
    const s = state.current;
    if (s.busy || s.conflict || !s.loaded) return;
    s.busy = true;
    try {
      if (s.pending) {
        const sent = s.pending;
        const response = await fetch("/api/plan", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sent), signal: AbortSignal.timeout(15000) });
        if (response.status === 409) { s.conflict = true; setConflict(true); setStatus("Gleichzeitige Änderung – dein Entwurf bleibt erhalten"); return; }
        const result = await response.json() as { revision: number; data?: PlannerData; error?: string; updatedBy?: string; important?: boolean };
        if (!response.ok) { setStatus(result.error || "Speichern nicht möglich"); return; }
        s.revision = result.revision;
        s.accepted = JSON.stringify(sent.data);
        if (s.pending?.operationId === sent.operationId) { s.pending = null; setUrgent(false); }
        else if (s.pending) { s.pending.revision = result.revision; persist(); }
        persist();
        setStatus(s.pending ? "Weitere Änderungen vorgemerkt" : "Im Team gespeichert");
      } else {
        const response = await fetch(`/api/plan?since=${s.revision}`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
        if (!response.ok) { setStatus(response.status === 401 ? "Anmeldung abgelaufen – bitte neu anmelden" : "Verbindung unterbrochen – letzter Stand sichtbar"); return; }
        const result = await response.json() as { revision: number; data?: PlannerData; error?: string; updatedBy?: string; important?: boolean };
        // Never apply a response over typing that happened while the request was in flight.
        if (!s.pending && result.data && result.revision !== s.revision) {
          accept(plannerSchema.parse(result.data), result.revision);
          setNotice(result.important ? "Wichtige Änderung im Teamplan – der aktuelle Stand wurde geladen." : `Teamplan aktualisiert${result.updatedBy ? ` von ${result.updatedBy}` : ""}.`);
        }
        if (!s.pending) setStatus("Im Team gespeichert");
      }
    } catch { setStatus(s.pending ? "Offline – Änderungen auf diesem Gerät vorgemerkt" : "Offline – letzter gespeicherter Stand"); }
    finally { s.busy = false; }
  };
  const refreshRef = useRef(refresh); refreshRef.current = refresh;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = state.current;
      let cached: { revision: number; data: PlannerData } | null = null;
      try {
        const saved = localStorage.getItem(key);
        if (saved) { const pending = JSON.parse(saved); plannerSchema.parse(pending.data); s.pending = pending; }
        const savedCache = localStorage.getItem(`wa-cache-${user.id}`);
        if (savedCache) { cached = JSON.parse(savedCache); plannerSchema.parse(cached!.data); }
      } catch { setNotice("Ein gespeicherter Entwurf konnte nicht gelesen werden. Er wurde nicht überschrieben."); }
      try {
        const response = await fetch("/api/plan", { cache: "no-store", signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error("LOAD");
        const remote = await response.json() as { revision: number; data?: PlannerData; error?: string; updatedBy?: string; important?: boolean };
        if (cancelled) return;
        if (s.pending) { s.revision = s.pending.revision; s.accepted = JSON.stringify(s.pending.data); latest.current = s.pending.data; apply.current(s.pending.data); setStatus("Gespeicherter Entwurf wird übertragen …"); }
        else if (remote.data) { accept(plannerSchema.parse(remote.data), remote.revision); setStatus("Im Team gespeichert"); }
        else if (user.role === "admin") { s.revision = 0; s.accepted = JSON.stringify(latest.current); s.pending = { data: latest.current, revision: 0, operationId: crypto.randomUUID(), urgent: false }; persist(); }
        else { setStatus("Die Koordination muss zuerst den gemeinsamen Plan anlegen."); return; }
      } catch {
        if (cancelled) return;
        const offline = s.pending || cached;
        if (!offline) { setStatus("Teamplan nicht erreichbar. Bitte Verbindung prüfen und neu laden."); return; }
        accept(offline.data, offline.revision); setStatus("Offline – letzter Stand auf diesem Gerät");
      }
      s.loaded = true; setReady(true); void refreshRef.current();
    })();
    const timer = setInterval(() => { if (document.visibilityState === "visible") void refreshRef.current(); }, 15000);
    const online = () => void refreshRef.current();
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", online);
    const beforeUnload = (event: BeforeUnloadEvent) => { if (state.current.pending) { event.preventDefault(); } };
    window.addEventListener("beforeunload", beforeUnload);
    return () => { cancelled = true; clearInterval(timer); window.removeEventListener("online", online); document.removeEventListener("visibilitychange", online); window.removeEventListener("beforeunload", beforeUnload); };
  }, [user.id]);
  useEffect(() => {
    const s = state.current;
    if (!ready || (!s.pending && JSON.stringify(data) === s.accepted)) return;
    if (s.pending && JSON.stringify(data) === JSON.stringify(s.pending.data)) return;
    s.pending = { revision: s.revision, operationId: crypto.randomUUID(), data, urgent: urgentRef.current || !!s.pending?.urgent };
    const durable = persist();
    setStatus(s.conflict ? "Konflikt – Entwurf lokal gesichert" : durable ? "Änderungen vorgemerkt …" : "Noch nicht gesichert – Gerätespeicher nicht verfügbar");
    const timer = setTimeout(() => void refreshRef.current(), 800);
    return () => clearTimeout(timer);
  }, [data, ready]);
  function exportDraft() {
    const blob = new Blob([JSON.stringify(latest.current, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `wochenatelier-entwurf-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function resolveConflict() {
    exportDraft();
    try {
      const response = await fetch("/api/plan", { cache: "no-store" }); if (!response.ok) throw new Error();
      const result = await response.json() as { revision: number; data?: PlannerData; error?: string; updatedBy?: string; important?: boolean }; const value = plannerSchema.parse(result.data);
      state.current.pending = null; state.current.conflict = false; accept(value, result.revision); setConflict(false); setStatus("Teamstand geladen – eigener Entwurf als Datei gesichert");
    } catch { setStatus("Teamstand nicht erreichbar. Dein Entwurf bleibt erhalten."); }
  }
  return { ready, status, conflict, notice, urgent, setUrgent, exportDraft, resolveConflict, retry: () => refreshRef.current(), pending: !!state.current.pending };
}
