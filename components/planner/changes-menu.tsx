"use client";

import { useState } from "react";
import { Bell, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { KIND_LABEL, relativeTime, unseenChanges } from "@/lib/planner/changes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ChangeEntry, NotifyMode } from "@/lib/planner/types";

/**
 * „Was ist neu“: Glocke mit Zähler der Änderungen anderer seit dem letzten „Alles gesehen“,
 * Liste mit wer/wann/was, optional die ganze Historie der letzten Tage.
 */
export function ChangesMenu({ changes, since, viewerId, onSeen, onOpenSession, notify, onNotifyChange, onTestMail }: {
  changes: ChangeEntry[];
  since: string;
  viewerId: string;
  onSeen: () => void;
  onOpenSession?: (sessionId: string) => void;
  /** eigene E-Mail-Einstellung (nur im Team-Modus) */
  notify?: NotifyMode;
  onNotifyChange?: (value: NotifyMode) => void;
  /** Test-Mail an die eigene Adresse; liefert eine Meldung zurück */
  onTestMail?: () => Promise<string>;
}) {
  const [testState, setTestState] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const unseen = unseenChanges(changes, since, viewerId);
  const list = showAll
    ? [...changes].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 60)
    : unseen.slice(0, 60);
  const majorCount = unseen.filter((c) => c.importance === "major").length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={`changes-bell ${unseen.length ? "has-unseen" : ""} ${majorCount ? "has-major" : ""}`} aria-label={unseen.length ? `${unseen.length} neue Änderungen im Team` : "Änderungen im Team"}>
          <Bell size={18} />
          {unseen.length > 0 && <span className="changes-count">{unseen.length > 99 ? "99+" : unseen.length}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="changes-popover">
        <div className="changes-head">
          <div>
            <strong>Was ist neu</strong>
            <small>{showAll ? "Alle Änderungen der letzten 14 Tage" : unseen.length ? `${unseen.length} Änderungen anderer seit deinem letzten Besuch` : "Keine neuen Änderungen anderer"}</small>
          </div>
          {unseen.length > 0 && !showAll && <Button type="button" size="sm" onClick={onSeen}><Check size={14} /> Alles gesehen</Button>}
        </div>
        <ol className="changes-list">
          {list.map((c) => (
            <li key={c.id} className={`changes-item is-${c.importance} ${c.authorId === viewerId ? "is-own" : ""}`}>
              <span className={`changes-kind kind-${c.kind}`}>{KIND_LABEL[c.kind]}</span>
              <div className="changes-body">
                {c.sessionId && onOpenSession
                  ? <button type="button" className="changes-link" onClick={() => onOpenSession(c.sessionId!)}>{c.summary}</button>
                  : <span>{c.summary}</span>}
                <small>{c.authorId === viewerId ? "du" : c.authorName || "jemand"} · {relativeTime(c.createdAt)}</small>
              </div>
            </li>
          ))}
          {list.length === 0 && <li className="changes-empty">Nichts Neues – alles auf dem aktuellen Stand.</li>}
        </ol>
        <button type="button" className="changes-toggle" onClick={() => setShowAll((v) => !v)}>{showAll ? "Nur Neues zeigen" : "Alle Änderungen der letzten 14 Tage"}</button>
        {onNotifyChange && (
          <div className="notify-setting">
            <span>E-Mail bei wichtigen Änderungen</span>
            <Select value={notify ?? "none"} onValueChange={(v) => onNotifyChange(v as NotifyMode)}>
              <SelectTrigger aria-label="E-Mail-Benachrichtigung"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">nie</SelectItem>
                <SelectItem value="instant">sofort</SelectItem>
                <SelectItem value="daily">täglich (Mo–Fr, ca. 17 Uhr)</SelectItem>
              </SelectContent>
            </Select>
            {onTestMail && (
              <button type="button" className="changes-toggle" disabled={testState === "…"} onClick={async () => { setTestState("…"); setTestState(await onTestMail()); }}>Test-Mail an mich senden</button>
            )}
            {testState && testState !== "…" && <small className="notify-result">{testState}</small>}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
