/**
 * Farben und Symbole je Fach, damit Lektionen im Wochenplan auf einen Blick erkennbar sind.
 * Erkennung über Stichwörter im Fachnamen (auch „Englisch · Französisch“ oder „Mathe Kreis+“).
 * Unbekannte Fächer erhalten eine stabile Farbe aus dem Namen und den Anfangsbuchstaben als Symbol.
 */

export type SubjectStyle = {
  /** Emoji oder Kürzel; Flaggen werden in der Oberfläche als SVG gezeichnet (Windows zeigt keine Flaggen-Emojis) */
  icon: string;
  /** "flag-gb" | "flag-fr" für gezeichnete Flaggen, sonst undefined */
  flag?: "gb" | "fr";
  color: string;
  /** erkanntes Fach (kanonischer Name) oder der Originaltext */
  name: string;
};

const RULES: { match: RegExp; name: string; icon: string; color: string; flag?: "gb" | "fr" }[] = [
  { match: /\bengl|english/i, name: "Englisch", icon: "🇬🇧", flag: "gb", color: "#1d3f8a" },
  { match: /\bfranz|fran[cç]ais|french/i, name: "Französisch", icon: "🇫🇷", flag: "fr", color: "#0b57a4" },
  { match: /\bdeutsch|\bsprache|\blesen|\bschreiben/i, name: "Deutsch", icon: "📖", color: "#c0392b" },
  { match: /\bmathe|\bmathematik|\brechnen/i, name: "Mathe", icon: "🔢", color: "#1e6fb0" },
  { match: /\bnmg|natur|mensch|gesellschaft/i, name: "NMG", icon: "🌍", color: "#2e8b57" },
  { match: /\bmusik|\bsingen|\bchor/i, name: "Musik", icon: "🎵", color: "#8e44ad" },
  { match: /\bbg\b|bildnerisch|\bzeichnen|\bkunst/i, name: "BG", icon: "🎨", color: "#e67e22" },
  { match: /\bttg\b|textil|technisch|\bwerken/i, name: "TTG", icon: "✂️", color: "#b8860b" },
  { match: /schwimm/i, name: "Schwimmen", icon: "🏊", color: "#2c9fd6" },
  { match: /\bsport|\bturnen|bewegung/i, name: "Sport", icon: "⚽", color: "#16a085" },
  { match: /\brke\b|religion|\bethik|\bkultur/i, name: "RKE", icon: "🕊️", color: "#7f8c8d" },
  { match: /\bm&i\b|\bmi\b|medien|informatik|\bict\b/i, name: "M&I", icon: "💻", color: "#34495e" },
  { match: /projekt/i, name: "Projekt", icon: "🧩", color: "#d35400" },
  { match: /atelier|werkstatt/i, name: "Atelier", icon: "🛠️", color: "#795548" },
  { match: /klassenrat|\brat\b/i, name: "Klassenrat", icon: "🗣️", color: "#6c5ce7" },
  { match: /wochenplan|\bplanarbeit|freiarbeit/i, name: "Wochenplan", icon: "📝", color: "#607d8b" },
  { match: /förder|\bdaz\b|\bif\b|logo/i, name: "Förderung", icon: "🌱", color: "#3d9970" },
  { match: /pause|znüni|mittag/i, name: "Pause", icon: "🍎", color: "#95a5a6" },
];

const FALLBACK_COLORS = ["#5d6d7e", "#7b8d6a", "#8a6d9b", "#9b7b5d", "#5b8a8f", "#a06b6b", "#6b7fa0", "#8f8a5b"];

function hashColor(text: string): string {
  let h = 0;
  for (const ch of text.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK_COLORS[h % FALLBACK_COLORS.length];
}

export function subjectStyle(subject: string): SubjectStyle {
  const text = subject.trim();
  for (const rule of RULES) {
    if (rule.match.test(text)) return { icon: rule.icon, flag: rule.flag, color: rule.color, name: rule.name };
  }
  const letters = text.split(/[\s·/+-]+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "•";
  return { icon: letters, color: hashColor(text || "?"), name: text };
}

/** Stile für eine Lektion mit mehreren Fächern – ohne Doppelungen, höchstens `limit`. */
export function subjectStyles(subjects: string[], limit = 2): SubjectStyle[] {
  const seen = new Set<string>();
  const result: SubjectStyle[] = [];
  for (const s of subjects) {
    const style = subjectStyle(s);
    if (seen.has(style.name)) continue;
    seen.add(style.name);
    result.push(style);
    if (result.length >= limit) break;
  }
  return result;
}
