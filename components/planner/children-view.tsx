"use client";

import { useState } from "react";
import { CircleAlert, Pencil, Search, ThumbsDown, ThumbsUp, Trash2, UserRound, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SuggestInput, filterSuggestions, type Suggestion } from "@/components/ui/suggest-input";
import { Textarea } from "@/components/ui/textarea";
import { fullName } from "@/lib/planner/children";
import { isoDate } from "@/lib/planner/dates";
import type { PlannerApi } from "@/hooks/use-planner";
import type { Child, ChildNote, Group, Member, NoteKind } from "@/lib/planner/types";

const KIND: Record<NoteKind, { label: string; icon: React.ReactNode }> = {
  plus: { label: "Positiv", icon: <ThumbsUp size={14} /> },
  minus: { label: "Ermahnung", icon: <ThumbsDown size={14} /> },
  info: { label: "Notiz", icon: <CircleAlert size={14} /> },
};
const dateFmt = new Intl.DateTimeFormat("de-CH", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
const byName = (a: Child, b: Child) => a.lastName.localeCompare(b.lastName, "de") || a.firstName.localeCompare(b.firstName, "de");

/**
 * Kinder: Liste mit Suche, Dossier je Kind mit Verhaltensnotizen (positiv / Ermahnung / Notiz).
 * Einträge erfassen dürfen alle im Team; ändern/löschen die erfassende Person oder die Koordination.
 */
export function ChildrenView({ api, kids, notes, groups, members, currentUserId, isCoordinator }: {
  api: PlannerApi; kids: Child[]; notes: ChildNote[]; groups: Group[]; members: Member[]; currentUserId: string; isCoordinator: boolean;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const active = kids.filter((c) => c.active).sort(byName);
  const list = query.trim()
    ? filterSuggestions(active.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName}`, hint: c.short })), query, 500).map((s) => active.find((c) => c.id === s.value)!)
    : active;
  const selected = active.find((c) => c.id === selectedId) ?? null;
  const count = (childId: string, kind: NoteKind) => notes.filter((n) => n.childId === childId && n.kind === kind).length;

  if (active.length === 0) {
    return (
      <section className="homework-empty">
        <UserRound size={28} />
        <h2>Noch keine Kinder erfasst</h2>
        <p>Die Koordination erfasst die Kinder im Admin-Bereich (einzeln oder per Excel-Import). Danach lassen sich hier Verhaltensnotizen führen und im Dossier abrufen.</p>
      </section>
    );
  }

  return (
    <section className="kids-layout">
      <aside className="kids-list-panel">
        <div className="kids-search"><Search size={15} /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Kind suchen …" aria-label="Kind suchen" /></div>
        <ul className="kids-list" aria-label="Kinder">
          {list.map((c) => {
            const group = groups.find((g) => g.id === c.groupId);
            const plus = count(c.id, "plus"); const minus = count(c.id, "minus");
            return (
              <li key={c.id}>
                <button type="button" className={`kids-list-row ${c.id === selectedId ? "is-active" : ""}`} onClick={() => setSelectedId(c.id)}>
                  <span className="kid-short">{c.short}</span>
                  <span className="kid-name">{c.lastName} {c.firstName}</span>
                  {group && <span className="group-chip" style={{ background: group.color }}>{group.short || group.name}</span>}
                  <span className="kid-counts">{plus > 0 && <b className="is-plus">+{plus}</b>}{minus > 0 && <b className="is-minus">−{minus}</b>}</span>
                </button>
              </li>
            );
          })}
          {list.length === 0 && <li className="kids-empty">Kein Kind passt zur Suche.</li>}
        </ul>
      </aside>
      <div className="kids-dossier">
        <NoteForm api={api} kids={active} groups={groups} selected={selected} onSelect={setSelectedId} />
        {selected
          ? <Dossier child={selected} group={groups.find((g) => g.id === selected.groupId)} notes={notes.filter((n) => n.childId === selected.id)} members={members} api={api} currentUserId={currentUserId} isCoordinator={isCoordinator} />
          : <p className="kids-empty dossier-hint">Ein Kind in der Liste wählen, um das Dossier zu sehen – oder oben direkt einen Eintrag erfassen.</p>}
      </div>
    </section>
  );
}

function NoteForm({ api, kids, groups, selected, onSelect }: { api: PlannerApi; kids: Child[]; groups: Group[]; selected: Child | null; onSelect: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<NoteKind>("info");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => isoDate(new Date()));
  const options: Suggestion[] = kids.map((c) => ({ value: c.id, label: `${c.lastName} ${c.firstName}`, hint: `${c.short}${groups.find((g) => g.id === c.groupId)?.short ? ` · ${groups.find((g) => g.id === c.groupId)?.short}` : ""}` }));

  function save() {
    if (!selected || !note.trim()) return;
    api.addChildNote(selected.id, kind, note, date);
    setNote("");
  }

  return (
    <section className="note-form" aria-label="Eintrag erfassen">
      <div className="note-form-row">
        <div className="field-stack">
          <Label htmlFor="note-child">Kind</Label>
          {selected
            ? <div className="note-selected"><span className="kid-short">{selected.short}</span><strong>{fullName(selected)}</strong><button type="button" onClick={() => { onSelect(""); setSearch(""); }} aria-label="Anderes Kind wählen"><X size={13} /></button></div>
            : <SuggestInput id="note-child" value={search} onChange={setSearch} suggestions={options} placeholder="Name eingeben (z. B. „pa“) …" onPick={(s) => { onSelect(s.value); setSearch(""); }} />}
        </div>
        <div className="field-stack">
          <Label>Art</Label>
          <div className="kind-toggle" role="radiogroup" aria-label="Art des Eintrags">
            {(Object.keys(KIND) as NoteKind[]).map((k) => (
              <button type="button" key={k} role="radio" aria-checked={kind === k} className={`kind-${k} ${kind === k ? "is-active" : ""}`} onClick={() => setKind(k)}>{KIND[k].icon} {KIND[k].label}</button>
            ))}
          </div>
        </div>
        <div className="field-stack"><Label htmlFor="note-date">Datum</Label><Input id="note-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      <div className="field-stack">
        <Label htmlFor="note-text">Beobachtung</Label>
        <Textarea id="note-text" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={kind === "plus" ? "Was ist positiv aufgefallen?" : kind === "minus" ? "Was ist vorgefallen, was wurde vereinbart?" : "Beobachtung, Absprache, Hinweis …"} />
      </div>
      <div className="note-form-actions">
        <small>Sachlich und konkret formulieren – keine Diagnosen oder Wertungen der Person.</small>
        <Button type="button" onClick={save} disabled={!selected || !note.trim()}>Eintrag speichern</Button>
      </div>
    </section>
  );
}

function Dossier({ child, group, notes, members, api, currentUserId, isCoordinator }: {
  child: Child; group?: Group; notes: ChildNote[]; members: Member[]; api: PlannerApi; currentUserId: string; isCoordinator: boolean;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const sorted = [...notes].sort((a, b) => (a.notedOn < b.notedOn ? 1 : a.notedOn > b.notedOn ? -1 : 0));
  const plus = notes.filter((n) => n.kind === "plus").length;
  const minus = notes.filter((n) => n.kind === "minus").length;
  const author = (id: string | null) => members.find((m) => m.userId === id)?.displayName ?? "–";

  return (
    <section className="dossier" aria-label={`Dossier ${fullName(child)}`}>
      <header className="dossier-head">
        <span className="kid-short big">{child.short}</span>
        <div>
          <h2>{fullName(child)}</h2>
          <p>{group ? <span className="group-chip" style={{ background: group.color }}>{group.name}</span> : "ohne Gruppe"} <span className="dossier-counts"><b className="is-plus">{plus} positiv</b> · <b className="is-minus">{minus} Ermahnungen</b> · {notes.length - plus - minus} Notizen</span></p>
        </div>
      </header>
      {sorted.length === 0 && <p className="kids-empty">Noch keine Einträge.</p>}
      <ol className="note-list">
        {sorted.map((n) => {
          const mine = n.authorId === currentUserId;
          const editable = mine || isCoordinator;
          return (
            <li key={n.id} className={`note-item kind-${n.kind}`}>
              <div className="note-meta">
                <span className={`note-kind kind-${n.kind}`}>{KIND[n.kind].icon} {KIND[n.kind].label}</span>
                <span className="note-date">{dateFmt.format(new Date(`${n.notedOn}T00:00:00`))}</span>
                <span className="note-author">{author(n.authorId)}</span>
                {editable && editId !== n.id && (
                  <span className="note-actions">
                    <button type="button" onClick={() => setEditId(n.id)} aria-label="Eintrag bearbeiten"><Pencil size={13} /></button>
                    <button type="button" onClick={() => { if (window.confirm("Eintrag wirklich löschen?")) api.removeChildNote(n.id); }} aria-label="Eintrag löschen"><Trash2 size={13} /></button>
                  </span>
                )}
              </div>
              {editId === n.id
                ? (
                  <div className="note-edit">
                    <div className="kind-toggle" role="radiogroup">
                      {(Object.keys(KIND) as NoteKind[]).map((k) => (
                        <button type="button" key={k} role="radio" aria-checked={n.kind === k} className={`kind-${k} ${n.kind === k ? "is-active" : ""}`} onClick={() => api.updateChildNote(n.id, { kind: k })}>{KIND[k].icon} {KIND[k].label}</button>
                      ))}
                    </div>
                    <Textarea value={n.note} onChange={(e) => api.updateChildNote(n.id, { note: e.target.value })} rows={3} />
                    <div className="note-edit-actions"><Input type="date" value={n.notedOn} onChange={(e) => e.target.value && api.updateChildNote(n.id, { notedOn: e.target.value })} /><Button type="button" size="sm" onClick={() => setEditId(null)}>Fertig</Button></div>
                  </div>
                )
                : <p className="note-text">{n.note}</p>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
