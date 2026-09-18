"use client";

import { useState } from "react";
import { ArrowRightLeft, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SuggestInput, type Suggestion } from "@/components/ui/suggest-input";
import { fullName } from "@/lib/planner/children";
import { resolveAssignments } from "@/lib/planner/logic";
import { checkReassignment, effectiveGroupId, setReassignment } from "@/lib/planner/reassign";
import type { Child, DayMeta, Group, Reassignment, Session } from "@/lib/planner/types";

/**
 * Kinder umteilen – pro Lektion (mit `session`) oder für den ganzen Tag (ohne).
 * Prüft vor dem Speichern: Zielgruppe frei? Kind schon dort? Ein Kind ist immer nur in einer Gruppe.
 */
export function ReassignPanel({ list, onChange, kids, groups, session, day, disabled = false, compact = false }: {
  list: Reassignment[] | undefined;
  onChange: (next: Reassignment[]) => void;
  kids: Child[];
  groups: Group[];
  /** Lektion, in der umgeteilt wird (leer = Tagesumteilung) */
  session?: Session | null;
  /** Tagesangaben (für die Prüfung gegen ganztägige Umteilungen) */
  day?: DayMeta | null;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [childId, setChildId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string>("");
  const [message, setMessage] = useState<{ text: string; severity: "error" | "hint" } | null>(null);

  const active = kids.filter((c) => c.active);
  if (active.length === 0) return null;
  const child = active.find((c) => c.id === childId) ?? null;
  const offGroups = session && !session.wholeClass ? new Set(resolveAssignments(session.assignments).filter((a) => a.off).map((a) => a.groupId)) : new Set<string>();
  const options: Suggestion[] = active
    .filter((c) => !(list ?? []).some((r) => r.childId === c.id))
    .map((c) => ({ value: c.id, label: `${c.lastName} ${c.firstName}`, hint: `${c.short} · ${groups.find((g) => g.id === effectiveGroupId(c, day ?? null, session ?? null))?.short ?? "ohne Gruppe"}` }));

  function add() {
    if (!child || !groupId) return;
    const issue = checkReassignment(child, groupId, groups, session ?? null, day ?? null);
    if (issue?.severity === "error") { setMessage({ text: issue.message, severity: "error" }); return; }
    if (issue?.severity === "hint") { setMessage({ text: issue.message, severity: "hint" }); return; }
    onChange(setReassignment(list, child.id, groupId));
    setChildId(null); setSearch(""); setGroupId(""); setMessage(null);
  }

  return (
    <div className={`reassign-panel ${compact ? "is-compact" : ""}`}>
      {(list ?? []).length > 0 && (
        <ul className="reassign-list">
          {(list ?? []).map((r) => {
            const c = kids.find((x) => x.id === r.childId);
            const from = c ? groups.find((g) => g.id === (session ? effectiveGroupId(c, day ?? null, null) : c.groupId)) : null;
            const to = groups.find((g) => g.id === r.groupId);
            if (!c) return null;
            return (
              <li key={r.childId}>
                <span className="kid-short">{c.short}</span>
                <span className="reassign-name">{fullName(c)}</span>
                <span className="reassign-arrow">{from?.short ?? "–"} <ArrowRightLeft size={12} /> <b style={{ color: to?.color }}>{to?.short ?? to?.name ?? "?"}</b></span>
                {!disabled && <button type="button" onClick={() => onChange(setReassignment(list, r.childId, null))} aria-label={`Umteilung von ${fullName(c)} aufheben`}><X size={12} /></button>}
              </li>
            );
          })}
        </ul>
      )}
      {!disabled && (
        <div className="reassign-add">
          {child
            ? <div className="note-selected"><span className="kid-short">{child.short}</span><strong>{fullName(child)}</strong><button type="button" onClick={() => { setChildId(null); setSearch(""); setMessage(null); }} aria-label="Anderes Kind wählen"><X size={13} /></button></div>
            : <SuggestInput value={search} onChange={setSearch} suggestions={options} placeholder="Kind suchen …" aria-label="Kind zum Umteilen suchen" onPick={(s) => { setChildId(s.value); setSearch(""); setMessage(null); }} />}
          <Select value={groupId || "none"} onValueChange={(v) => { setGroupId(v === "none" ? "" : v); setMessage(null); }}>
            <SelectTrigger aria-label="Zielgruppe"><SelectValue placeholder="Gruppe" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Gruppe wählen —</SelectItem>
              {groups.map((g) => <SelectItem key={g.id} value={g.id} disabled={offGroups.has(g.id)}>{g.name}{offGroups.has(g.id) ? " (frei)" : ""}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" onClick={add} disabled={!child || !groupId}><ArrowRightLeft size={14} /> Umteilen</Button>
        </div>
      )}
      {message && <p className={`reassign-message is-${message.severity}`}>{message.text}</p>}
    </div>
  );
}
