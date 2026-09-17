"use client";

import { ArrowLeftRight, BetweenHorizontalStart, Layers, Replace } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DAYS, SLOTS, isMeetingSlot } from "@/lib/planner/constants";
import type { DayKey, Session } from "@/lib/planner/types";

export type MoveConflict = { session: Session; target: Session; day: DayKey; slot: number };
export type MoveAction = "insert" | "swap" | "append" | "replace";

/**
 * Nachfrage beim Verschieben auf einen belegten Platz. Bei leerem Ziel wird
 * direkt verschoben – dieser Dialog erscheint nur, wenn dort schon ein Block liegt.
 */
export function MoveDialog({ conflict, onChoose, onClose }: {
  conflict: MoveConflict | null;
  onChoose: (action: MoveAction) => void;
  onClose: () => void;
}) {
  if (!conflict) return null;
  const { session, target, day, slot } = conflict;
  const where = `${DAYS.find((d) => d.id === day)?.label}, ${SLOTS[slot]?.time} Uhr`;
  const noun = isMeetingSlot(slot) ? "Termin" : "Lektion";

  const options: { action: MoveAction; icon: React.ReactNode; title: string; text: string; variant?: "destructive" }[] = [
    { action: "insert", icon: <BetweenHorizontalStart />, title: "Dazwischenschieben", text: `„${target.title}“ und die folgenden Blöcke rücken einen Platz nach hinten.` },
    { action: "swap", icon: <ArrowLeftRight />, title: "Tauschen", text: `„${target.title}“ übernimmt den bisherigen Platz von „${session.title}“.` },
    { action: "append", icon: <Layers />, title: "Als Bestandteil anhängen", text: `„${session.title}“ geht in „${target.title}“ auf – z. B. weil noch nicht fertig. Stichworte und Notizen werden übernommen.` },
    { action: "replace", icon: <Replace />, title: "Ersetzen", text: `„${target.title}“ wird gelöscht und durch „${session.title}“ ersetzt.`, variant: "destructive" },
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="move-dialog">
        <DialogHeader>
          <DialogTitle>Platz ist belegt</DialogTitle>
          <DialogDescription>Am {where} liegt bereits die {noun} „{target.title}“. Wie soll „{session.title}“ dorthin?</DialogDescription>
        </DialogHeader>
        <div className="move-options">
          {options.map((o) => (
            <button type="button" key={o.action} className={`move-option ${o.variant ?? ""}`} onClick={() => onChoose(o.action)}>
              <span className="move-option-icon">{o.icon}</span>
              <span><strong>{o.title}</strong><small>{o.text}</small></span>
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
