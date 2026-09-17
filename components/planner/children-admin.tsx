"use client";

import { useRef, useState } from "react";
import { Check, FileSpreadsheet, Pencil, Plus, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { filterSuggestions } from "@/components/ui/suggest-input";
import { childrenOfGroup, fullName, parseDelimited, rowsToChildren } from "@/lib/planner/children";
import type { PlannerApi } from "@/hooks/use-planner";
import type { Child, Group } from "@/lib/planner/types";

const byName = (a: Child, b: Child) => a.lastName.localeCompare(b.lastName, "de") || a.firstName.localeCompare(b.firstName, "de");

/** Kinder-Stammliste: erfassen, importieren, bearbeiten. Gruppen wählen daraus aus. */
export function ChildrenCard({ api, kids, groups }: { api: PlannerApi; kids: Child[]; groups: Group[] }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const sortedAll = [...kids].sort(byName);
  const sorted = query.trim()
    ? filterSuggestions(sortedAll.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName}`, hint: c.short })), query, 500).map((s) => sortedAll.find((c) => c.id === s.value)!)
    : sortedAll;

  function handleAdd() {
    if (!firstName.trim() && !lastName.trim()) return;
    api.addChild(firstName, lastName);
    setFirstName(""); setLastName("");
  }

  async function handleFile(file: File) {
    try {
      let rows: unknown[][];
      if (/\.(xlsx|xlsm|xls)$/i.test(file.name)) {
        // SheetJS nur bei Bedarf laden (hält das Startpaket klein)
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: "" });
      } else {
        rows = parseDelimited(await file.text());
      }
      const parsed = rowsToChildren(rows);
      if (parsed.length === 0) { toast.error("Keine Namen gefunden. Erwartet werden Spalten „Vorname“ und „Nachname“ (optional „Klasse“)."); return; }
      const added = api.importChildren(parsed);
      toast.success(added ? `${added} Kinder importiert${parsed.length > added ? ` (${parsed.length - added} bereits vorhanden)` : ""}` : "Alle Kinder waren bereits erfasst");
    } catch {
      toast.error("Die Datei konnte nicht gelesen werden.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <article className="admin-card kids-card">
      <div className="card-heading"><span className="icon-box coral"><UserRound /></span><div><h3>Kinder</h3><p>Stammliste mit Namen – die Gruppen wählen daraus aus</p></div></div>
      <div className="kid-add-row">
        <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Vorname" aria-label="Vorname" onKeyDown={(e) => e.key === "Enter" && handleAdd()} />
        <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nachname" aria-label="Nachname" onKeyDown={(e) => e.key === "Enter" && handleAdd()} />
        <Button type="button" variant="outline" size="icon" onClick={handleAdd} aria-label="Kind hinzufügen"><Plus size={16} /></Button>
      </div>
      <div className="kid-import-row">
        <input ref={fileInput} type="file" accept=".xlsx,.xlsm,.xls,.csv,.txt" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
        <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}><FileSpreadsheet size={15} /> Aus Excel / CSV importieren</Button>
        <small>Spalten „Vorname“, „Nachname“, optional „Klasse“. Vorhandene Namen werden übersprungen.</small>
      </div>
      {sortedAll.length > 8 && <Input className="kid-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Suchen … (z. B. „pa“ für Patrick, Pascal)" aria-label="Kinder suchen" />}
      {sortedAll.length === 0
        ? <p className="kids-empty">Noch keine Kinder erfasst. Solange die Liste leer ist, gelten die Kürzel-Felder der Gruppen.</p>
        : (
          <ul className="kid-list" aria-label="Kinder">
            {sorted.map((child) => {
              const group = groups.find((g) => g.id === child.groupId);
              if (editId === child.id) {
                return (
                  <li className="kid-row is-editing" key={child.id}>
                    <Input value={child.firstName} onChange={(e) => api.updateChild(child.id, { firstName: e.target.value })} aria-label="Vorname" />
                    <Input value={child.lastName} onChange={(e) => api.updateChild(child.id, { lastName: e.target.value })} aria-label="Nachname" />
                    <Input className="initials-input" value={child.short} maxLength={6} onChange={(e) => api.updateChild(child.id, { short: e.target.value })} aria-label="Kürzel" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => setEditId(null)} aria-label="Fertig"><Check size={15} /></Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => { if (window.confirm(`${fullName(child)} wirklich entfernen?`)) { api.removeChildren([child.id]); setEditId(null); } }} aria-label="Entfernen"><Trash2 size={15} /></Button>
                  </li>
                );
              }
              return (
                <li className="kid-row" key={child.id}>
                  <span className="kid-short">{child.short}</span>
                  <span className="kid-name">{child.lastName} {child.firstName}</span>
                  {group
                    ? <span className="group-chip" style={{ background: group.color }}>{group.short || group.name}</span>
                    : <span className="group-chip none">ohne Gruppe</span>}
                  <Button type="button" variant="ghost" size="icon" onClick={() => setEditId(child.id)} aria-label={`${fullName(child)} bearbeiten`}><Pencil size={14} /></Button>
                </li>
              );
            })}
          </ul>
        )}
      <p className="kids-count">{sortedAll.length} Kinder · {sortedAll.filter((c) => !c.groupId).length} ohne Gruppe</p>
    </article>
  );
}

/** Kinder einer Gruppe: Chips zum Entfernen und Auswahl per Checkbox aus der Stammliste. */
export function GroupChildrenPicker({ api, group, kids, groups }: { api: PlannerApi; group: Group; kids: Child[]; groups: Group[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const members = childrenOfGroup(kids, group.id);
  const sortedAll = [...kids].filter((c) => c.active).sort(byName);
  const all = query.trim()
    ? filterSuggestions(sortedAll.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName}`, hint: c.short })), query, 200).map((s) => sortedAll.find((c) => c.id === s.value)!)
    : sortedAll;
  const selected = new Set(members.map((c) => c.id));

  function toggle(child: Child, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(child.id); else next.delete(child.id);
    api.assignChildren(group.id, [...next]);
  }

  return (
    <div className="group-children">
      <div className="group-children-head">
        <span>{members.length} Kinder</span>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>{open ? <><Check size={14} /> Fertig</> : <><Plus size={14} /> Kinder auswählen</>}</Button>
      </div>
      {!open && members.length > 0 && (
        <div className="kid-chips">
          {members.map((c) => (
            <span className="kid-chip" key={c.id} title={fullName(c)}>
              {c.firstName} <b>{c.short}</b>
              <button type="button" onClick={() => toggle(c, false)} aria-label={`${fullName(c)} aus ${group.name} entfernen`}><X size={11} /></button>
            </span>
          ))}
        </div>
      )}
      {open && (
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Suchen … (z. B. „pa“)" aria-label="Kinder filtern" autoFocus />
      )}
      {open && (
        <ul className="kid-picker" aria-label={`Kinder für ${group.name} auswählen`}>
          {all.map((c) => {
            const other = c.groupId && c.groupId !== group.id ? groups.find((g) => g.id === c.groupId) : null;
            return (
              <li key={c.id}>
                <label>
                  <Checkbox checked={selected.has(c.id)} onCheckedChange={(checked) => toggle(c, checked === true)} />
                  <span className="kid-name">{c.lastName} {c.firstName}</span>
                  <span className="kid-short">{c.short}</span>
                  {other && <span className="group-chip" style={{ background: other.color }} title={`zurzeit in ${other.name}`}>{other.short || other.name}</span>}
                </label>
              </li>
            );
          })}
          {all.length === 0 && <li className="kids-empty">{sortedAll.length === 0 ? "Zuerst Kinder in der Stammliste erfassen." : "Kein Kind passt zur Suche."}</li>}
        </ul>
      )}
    </div>
  );
}
