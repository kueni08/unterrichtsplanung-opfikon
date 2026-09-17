"use client";

import { useEffect, useId, useRef, useState, type ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export { filterSuggestions, type Suggestion } from "@/lib/planner/suggest";
import { filterSuggestions, type Suggestion } from "@/lib/planner/suggest";

/**
 * Textfeld mit Vorschlagsliste: Vorgaben sind wählbar, freie Eingaben bleiben möglich.
 * Tippen filtert („pa“ → Patrick, Pascal), Pfeiltasten und Enter wählen, Esc schliesst.
 */
export function SuggestInput({ value, onChange, suggestions, onPick, className, disabled, ...props }: Omit<ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  suggestions: Suggestion[];
  /** wird zusätzlich aufgerufen, wenn ein Vorschlag gewählt wurde */
  onPick?: (s: Suggestion) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const listId = useId();
  // der aktuelle Text selbst ist kein sinnvoller Vorschlag
  const matches = open ? filterSuggestions(suggestions, value).filter((s) => s.value !== value.trim()) : [];

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  function pick(s: Suggestion) {
    onChange(s.value);
    onPick?.(s);
    setOpen(false);
  }

  return (
    <div className={cn("suggest-wrap", className)} ref={wrap}>
      <Input
        {...props}
        disabled={disabled}
        value={value}
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || matches.length === 0) { if (e.key === "ArrowDown") setOpen(true); return; }
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % matches.length); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i - 1 + matches.length) % matches.length); }
          else if (e.key === "Enter") { e.preventDefault(); pick(matches[active]); }
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && matches.length > 0 && !disabled && (
        <ul className="suggest-list" id={listId} role="listbox">
          {matches.map((s, i) => (
            <li key={s.value} role="option" aria-selected={i === active} className={i === active ? "is-active" : ""} onPointerDown={(e) => { e.preventDefault(); pick(s); }} onMouseEnter={() => setActive(i)}>
              <span>{s.label ?? s.value}</span>
              {s.hint && <small>{s.hint}</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
