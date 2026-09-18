import { subjectStyles } from "@/lib/planner/subjects";

/** Gezeichnete Flaggen, weil Windows keine Flaggen-Emojis anzeigt. */
function Flag({ code }: { code: "gb" | "fr" }) {
  if (code === "fr") {
    return (
      <svg viewBox="0 0 30 20" aria-hidden="true">
        <rect width="10" height="20" fill="#0055a4" /><rect x="10" width="10" height="20" fill="#fff" /><rect x="20" width="10" height="20" fill="#ef4135" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 60 30" aria-hidden="true">
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#c8102e" strokeWidth="2" />
      <path d="M30,0 V30 M0,15 H60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 V30 M0,15 H60" stroke="#c8102e" strokeWidth="6" />
    </svg>
  );
}

/** Symbol(e) der Fächer einer Lektion, z. B. 🇬🇧 für Englisch, 🔢 für Mathe. */
export function SubjectIcon({ subjects, size = "sm" }: { subjects: string[]; size?: "sm" | "md" }) {
  const styles = subjectStyles(subjects);
  if (styles.length === 0) return null;
  return (
    <span className={`subject-icons size-${size}`} aria-hidden="true">
      {styles.map((s) => (
        <span className={`subject-icon ${s.flag ? "is-flag" : ""} ${s.icon.length <= 2 && !s.flag && !/\p{Extended_Pictographic}/u.test(s.icon) ? "is-letters" : ""}`} key={s.name} style={{ background: `${s.color}22`, color: s.color }} title={s.name}>
          {s.flag ? <Flag code={s.flag} /> : s.icon}
        </span>
      ))}
    </span>
  );
}
