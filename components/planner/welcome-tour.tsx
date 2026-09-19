"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Role } from "@/lib/planner/types";

export type TourTab = "week" | "day" | "homework" | "kids" | "admin";

/**
 * Ein Schritt der Einführung: Wechselt bei Bedarf auf einen Tab, hebt das beschriebene Element
 * hervor (erster passender Selektor, der sichtbar ist) und zeigt die Erklärung daneben.
 * Ohne auffindbares Element erscheint die Karte in der Mitte.
 */
type Step = { title: string; body: string; tab?: TourTab; targets?: string[] };

function stepsFor(role: Role, joinCode: string): Step[] {
  return [
    {
      title: "Willkommen im Wochenatelier",
      body: role === "koordination"
        ? "Als Koordination behältst du hier die ganze Wochenplanung deines Teams im Blick und pflegst Vorlagen, Gruppen und das Team. In einer Minute zeigen wir dir die wichtigsten Stellen."
        : "Hier siehst du deine eigenen Lektionen und die gemeinsame Wochenplanung deines Teams – übersichtlich und immer aktuell. In einer Minute zeigen wir dir die wichtigsten Stellen.",
    },
    {
      title: "Wochenplan & Vorlagen",
      body: "Jede Woche startet aus einer Vorlage – dein Team beginnt mit dem Stundenplan Kastanie. Hier wählst du die Vorlage und übernimmst sie; danach lässt sich jeder Block einzeln anpassen.",
      tab: "week",
      targets: ['[data-tour="toolbar"]'],
    },
    {
      title: "Blöcke, Fächer pro Klasse & Teamteaching",
      body: "Klicke auf einen Block, um ihn zu öffnen. Klassen können gleichzeitig unterschiedliche Fächer haben (z. B. Englisch in der 3./4., Französisch in der 5.). Trägst du bei einer Gruppe eine zweite Lehrperson ein, entsteht Teamteaching – beide Kürzel erscheinen im Block.",
      tab: "week",
      targets: [".week-grid .lesson-cell:has(.session-card:not(.is-foreign)):not(.meeting-cell)", ".week-grid .lesson-cell:has(.session-card):not(.meeting-cell)", '[data-tour="template-preview"]'],
    },
    {
      title: "Verschieben & übertragen",
      body: "Ziehe Blöcke direkt im Raster – Lektionen bleiben dabei in Lektions-Zeitfenstern, Termine in Sitzungs-Zeitfenstern. Auf dem Tablet nutzt du im Block den Bereich „Verschieben“. Nicht fertig geworden? Übertrage den Block in die nächste freie Lektion.",
      tab: "week",
      targets: ['[data-tour="drag-hint"]', ".week-grid .lesson-cell:has(.session-card:not(.is-foreign)):not(.meeting-cell)", ".week-grid .lesson-cell:has(.session-card):not(.meeting-cell)"],
    },
    {
      title: "Persönliche Ansicht",
      body: "Hier schaltest du zwischen der Gesamtansicht und deiner persönlichen Ansicht um: Dann siehst du nur deine eigenen Zuständigkeiten und die Teamtermine – alles andere ist ausgegraut.",
      targets: ['[data-tour="view"]'],
    },
    {
      title: "Tagesfokus",
      body: "Der Tagesfokus zeigt den Tagesablauf als Zeitleiste. Nebenbei pflegst du hier, wer heute da ist, eine Tagesnotiz und bis zu zwei Sitzungstermine – und teilst einzelne Kinder für den Tag um.",
      tab: "day",
      targets: ['[data-tour="day-sidebar"]'],
    },
    {
      title: "Was ist neu",
      body: "Die Glocke zeigt, was andere seit deinem letzten Besuch geändert haben; wichtige Änderungen sind im Wochenplan mit einem Rahmen markiert. Hier stellst du auch ein, ob du per E-Mail informiert werden möchtest – sofort oder als tägliche Zusammenfassung.",
      targets: ['[data-tour="bell"]'],
    },
    role === "koordination"
      ? {
        title: "Team einladen",
        body: `Teile den Beitrittscode ${joinCode} mit deinem Team – hier im Admin-Bereich unter „Team“ findest du ihn jederzeit wieder und kannst bei Bedarf einen neuen erzeugen.`,
        tab: "admin",
        targets: ['[data-tour="join-code"]'],
      }
      : {
        title: "Gemeinsam planen",
        body: "Änderungen erscheinen in Echtzeit bei allen im Team. Im Wochenplan erscheinen Kinder nur mit Kürzel; Diagnosen oder private Details gehören nicht in Notizfelder.",
        tab: "week",
        targets: ['[data-tour="privacy"]'],
      },
  ];
}

type Box = { top: number; left: number; width: number; height: number };
const PAD = 6;
const GAP = 14;

/** Erster sichtbarer Treffer der Selektoren (unsichtbare Elemente – z. B. auf dem Handy ausgeblendet – zählen nicht). */
function findTarget(selectors: string[] | undefined): HTMLElement | null {
  for (const selector of selectors ?? []) {
    let el: HTMLElement | null = null;
    try { el = document.querySelector<HTMLElement>(selector); } catch { el = null; }
    if (el && el.getBoundingClientRect().width > 0) return el;
  }
  return null;
}

function boxOf(el: HTMLElement): Box {
  const r = el.getBoundingClientRect();
  return { top: r.top - PAD, left: r.left - PAD, width: r.width + 2 * PAD, height: r.height + 2 * PAD };
}

export function WelcomeTour({ open, onOpenChange, role, joinCode, onNavigate }: {
  open: boolean;
  onOpenChange: (open: boolean, remember?: boolean) => void;
  role: Role;
  joinCode: string;
  /** Tab wechseln, damit das beschriebene Element sichtbar ist */
  onNavigate?: (tab: TourTab) => void;
}) {
  const [index, setIndex] = useState(0);
  const [remember, setRemember] = useState(true);
  const [box, setBox] = useState<Box | null>(null);
  const [cardSize, setCardSize] = useState({ width: 0, height: 0 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const steps = stepsFor(role, joinCode);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  const close = useCallback(() => {
    setIndex(0);
    setBox(null);
    onOpenChange(false, remember);
  }, [onOpenChange, remember]);

  // Ziel des aktuellen Schritts suchen (nach einem Tabwechsel braucht die Oberfläche einen Moment),
  // hinscrollen und die Position bei Scrollen/Grössenänderung nachführen.
  useEffect(() => {
    if (!open) return;
    if (step.tab) onNavigate?.(step.tab);
    let cancelled = false;
    let tries = 0;
    let raf = 0;
    const measure = () => {
      const el = targetRef.current;
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      setBox(el && el.isConnected && el.getBoundingClientRect().width > 0 ? boxOf(el) : null);
    };
    const search = () => {
      if (cancelled) return;
      const el = findTarget(step.targets);
      if (el) {
        targetRef.current = el;
        el.scrollIntoView({ block: "center", inline: "center" });
        measure();
        // Layout kann sich noch setzen (Tabwechsel, verschachtelte Scrollbereiche): kurz nachmessen
        const until = performance.now() + 800;
        const settle = () => { if (cancelled) return; measure(); if (performance.now() < until) raf = requestAnimationFrame(settle); };
        raf = requestAnimationFrame(settle);
        return;
      }
      if (tries++ < 30) raf = requestAnimationFrame(search);
      else { targetRef.current = null; measure(); }
    };
    targetRef.current = null;
    raf = requestAnimationFrame(search);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, step.tab, onNavigate]);

  useLayoutEffect(() => {
    if (!open || !cardRef.current) return;
    const r = cardRef.current.getBoundingClientRect();
    if (r.width !== cardSize.width || r.height !== cardSize.height) setCardSize({ width: r.width, height: r.height });
  }, [open, index, box, cardSize]);

  useEffect(() => {
    if (!open) return;
    cardRef.current?.focus({ preventScroll: true });
  }, [open, index]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowRight" && !isLast) setIndex((i) => i + 1);
      else if (e.key === "ArrowLeft" && index > 0) setIndex((i) => i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, isLast, index]);

  if (!open || typeof document === "undefined") return null;

  // Karte unter dem Element, sonst darüber; auf schmalen Bildschirmen am unteren Rand
  const narrow = viewport.width > 0 && viewport.width < 640;
  let placement: "below" | "above" | "center" | "bottom" = "center";
  let cardStyle: React.CSSProperties = {};
  if (box && narrow) {
    placement = "bottom";
  } else if (box && cardSize.height > 0) {
    const width = Math.min(420, viewport.width - 24);
    const left = Math.min(Math.max(12, box.left + box.width / 2 - width / 2), viewport.width - width - 12);
    const fitsBelow = box.top + box.height + GAP + cardSize.height <= viewport.height - 12;
    const fitsAbove = box.top - GAP - cardSize.height >= 12;
    if (fitsBelow || !fitsAbove) {
      placement = "below";
      cardStyle = { top: Math.min(box.top + box.height + GAP, viewport.height - cardSize.height - 12), left, width };
    } else {
      placement = "above";
      cardStyle = { top: box.top - GAP - cardSize.height, left, width };
    }
    // Pfeil auf die Mitte des Elements
    (cardStyle as Record<string, string | number>)["--tour-arrow-x"] = `${Math.round(box.left + box.width / 2 - left)}px`;
  }

  return createPortal(
    <div className="tour-layer" data-placement={placement}>
      <div className={`tour-backdrop ${box ? "" : "is-full"}`} onClick={close} aria-hidden="true" />
      {box && <div className="tour-spotlight" style={{ top: box.top, left: box.left, width: box.width, height: box.height }} aria-hidden="true" />}
      <div
        ref={cardRef}
        className={`tour-card is-${placement}`}
        style={cardStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
      >
        <p className="tour-step">Schritt {index + 1} von {steps.length}</p>
        <h2 id="tour-title">{step.title}</h2>
        <p id="tour-body">{step.body}</p>
        {role === "koordination" && isLast && (
          <button type="button" className="tour-code" onClick={() => { navigator.clipboard?.writeText(joinCode).catch(() => {}); }}>
            <span>{joinCode}</span><Copy size={14} />
          </button>
        )}
        <div className="tour-dots" role="tablist" aria-label="Tourfortschritt">
          {steps.map((s, i) => (
            <button type="button" key={s.title} className={i === index ? "tour-dot active" : "tour-dot"} onClick={() => setIndex(i)} aria-label={`Schritt ${i + 1}: ${s.title}`} />
          ))}
        </div>
        <label className="tour-remember">
          <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
          <span>Nicht mehr anzeigen</span>
        </label>
        <div className="tour-actions">
          {!isLast && <button type="button" className="link-button" onClick={close}>Überspringen</button>}
          <div className="tour-actions-right">
            {index > 0 && <Button variant="outline" size="sm" onClick={() => setIndex((i) => i - 1)}>Zurück</Button>}
            {isLast
              ? <Button size="sm" onClick={close}><Check /> Los geht&apos;s</Button>
              : <Button size="sm" onClick={() => setIndex((i) => i + 1)}>Weiter</Button>}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
