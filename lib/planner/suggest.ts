export type Suggestion = { value: string; label?: string; hint?: string };

/** Kleinschreibung ohne Akzente (é → e, ä → a), damit „ra“ auch „Rämi“ findet. */
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Vorschläge nach Eingabe filtern: Wortanfang zuerst, dann Teiltreffer (ohne Gross-/Kleinschreibung und Akzente). */
export function filterSuggestions(list: Suggestion[], query: string, limit = 8): Suggestion[] {
  const q = fold(query.trim());
  if (!q) return list.slice(0, limit);
  const text = (s: Suggestion) => fold(`${s.label ?? s.value} ${s.hint ?? ""}`);
  const starts = list.filter((s) => text(s).split(/\s+/).some((w) => w.startsWith(q)));
  const contains = list.filter((s) => !starts.includes(s) && text(s).includes(q));
  return [...starts, ...contains].slice(0, limit);
}
