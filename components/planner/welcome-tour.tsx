"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Role } from "@/lib/planner/types";

type Step = { title: string; body: string };

function stepsFor(role: Role, joinCode: string): Step[] {
  return [
    {
      title: "Willkommen im Wochenatelier",
      body: role === "koordination"
        ? "Als Koordination behältst du hier die ganze Wochenplanung deines Teams im Blick und pflegst Vorlagen, Gruppen und das Team."
        : "Hier siehst du deine eigenen Lektionen und die gemeinsame Wochenplanung deines Teams – übersichtlich und immer aktuell.",
    },
    {
      title: "Wochenplan & Vorlagen",
      body: "Jede Woche startet aus einer Vorlage – dein Team beginnt mit dem Stundenplan Kastanie. Wähle eine Vorlage und übernimm sie – danach lässt sich jeder Block einzeln anpassen.",
    },
    {
      title: "Fächer pro Klasse & Teamteaching",
      body: "In einem Block können Klassen gleichzeitig unterschiedliche Fächer haben, z. B. Englisch in der 3./4. und Französisch in der 5. Klasse. Trägst du bei einer Gruppe eine zweite Lehrperson ein, entsteht Teamteaching – beide Kürzel erscheinen im Block.",
    },
    {
      title: "Blöcke bearbeiten, verschieben, übertragen",
      body: "Klicke auf einen Block, um ihn zu öffnen. Ziehe Blöcke direkt im Raster, oder nutze im Block den Bereich „Verschieben“ – das funktioniert auch auf dem Tablet. Nicht fertig geworden? Übertrage den Block in die nächste freie Lektion.",
    },
    {
      title: "Tagesfokus",
      body: "Im Tagesfokus siehst du den Tagesablauf als Zeitleiste und pflegst nebenbei Anwesenheiten, eine Tagesnotiz und bis zu zwei Sitzungstermine.",
    },
    role === "koordination"
      ? { title: "Team einladen", body: `Teile den Beitrittscode ${joinCode} mit deinem Team – im Admin-Bereich unter „Team“ findest du ihn jederzeit wieder und kannst bei Bedarf einen neuen erzeugen.` }
      : { title: "Gemeinsam planen", body: "Änderungen erscheinen in Echtzeit bei allen im Team. Kinder erfasst ihr immer nur mit Kürzel – nie mit vollständigen Namen oder Diagnosen." },
  ];
}

export function WelcomeTour({ open, onOpenChange, role, joinCode }: { open: boolean; onOpenChange: (open: boolean) => void; role: Role; joinCode: string }) {
  const [index, setIndex] = useState(0);
  const steps = stepsFor(role, joinCode);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  function handleOpenChange(next: boolean) {
    if (!next) setIndex(0);
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="tour-dialog">
        <DialogHeader>
          <DialogTitle>{step.title}</DialogTitle>
          <DialogDescription>{step.body}</DialogDescription>
        </DialogHeader>
        {role === "koordination" && index === steps.length - 1 && (
          <button
            type="button"
            className="tour-code"
            onClick={() => { navigator.clipboard?.writeText(joinCode).catch(() => {}); }}
          >
            <span>{joinCode}</span><Copy size={14} />
          </button>
        )}
        <div className="tour-dots" role="tablist" aria-label="Tourfortschritt">
          {steps.map((s, i) => (
            <span key={s.title} className={i === index ? "tour-dot active" : "tour-dot"} />
          ))}
        </div>
        <div className="tour-actions">
          {!isLast && <button type="button" className="link-button" onClick={() => handleOpenChange(false)}>Überspringen</button>}
          <div className="tour-actions-right">
            {index > 0 && <Button variant="outline" onClick={() => setIndex((i) => i - 1)}>Zurück</Button>}
            {isLast
              ? <Button onClick={() => handleOpenChange(false)}><Check /> Los geht&apos;s</Button>
              : <Button onClick={() => setIndex((i) => i + 1)}>Weiter</Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
