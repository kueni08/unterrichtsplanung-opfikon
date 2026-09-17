import { OwlLogo } from "@/components/planner/owl-logo";

/** Ladebildschirm – erscheint bis die Seite hydriert oder Daten geladen sind. */
export function Splash({ hint }: { hint?: string }) {
  return (
    <main className="splash-screen">
      <div className="splash-mark">
        <OwlLogo size={72} />
      </div>
      <p className="splash-title">Wochenatelier</p>
      <div className="splash-spinner" aria-hidden="true" />
      {hint && <p className="splash-hint">{hint}</p>}
    </main>
  );
}
