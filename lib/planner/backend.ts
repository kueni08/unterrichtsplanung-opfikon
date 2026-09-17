import type { PersistOp, PlannerSnapshot, Viewer } from "./types.ts";

export type RealtimeHandlers = {
  onRemoteChange: () => void;
  onPresence: (userIds: string[]) => void;
  /** Kennt der aktuelle Stand diese ID? (Löschereignisse kommen ungefiltert an.) */
  knowsId?: (id: string) => boolean;
};

export interface PlannerBackend {
  readonly kind: "local" | "supabase";
  load(): Promise<PlannerSnapshot>;
  /** Schreibt eine Änderung. `latest` ist der aktuelle Gesamtstand (für lokale Speicherung). */
  persist(op: PersistOp, latest: PlannerSnapshot): Promise<void>;
  /** Meldet Änderungen anderer Personen und wer gerade online ist. */
  subscribe(handlers: RealtimeHandlers, viewer: Viewer): () => void;
  regenerateJoinCode(): Promise<string>;
  /** Nur Demo: Beispieldaten zurücksetzen. */
  reset?(): Promise<PlannerSnapshot>;
}

const DEMO_KEY = "wochenatelier-demo-v6";

export function createLocalBackend(factory: () => PlannerSnapshot): PlannerBackend {
  const read = (): PlannerSnapshot | null => {
    try {
      const raw = window.localStorage.getItem(DEMO_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PlannerSnapshot;
      return parsed?.team && Array.isArray(parsed.sessions) ? parsed : null;
    } catch {
      return null;
    }
  };
  const write = (snapshot: PlannerSnapshot) => {
    try { window.localStorage.setItem(DEMO_KEY, JSON.stringify(snapshot)); } catch { /* Speicher voll oder gesperrt */ }
  };
  return {
    kind: "local",
    async load() {
      const stored = read();
      if (stored) return stored;
      const fresh = factory();
      write(fresh);
      return fresh;
    },
    async persist(_op, latest) { write(latest); },
    subscribe() { return () => {}; },
    async regenerateJoinCode() {
      return Array.from({ length: 8 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
    },
    async reset() {
      try { window.localStorage.removeItem(DEMO_KEY); } catch { /* ignorieren */ }
      const fresh = factory();
      write(fresh);
      return fresh;
    },
  };
}
