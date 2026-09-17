import { useEffect, useState, type ReactNode } from "react";
import type { TeamUser } from "../shared/planner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
export function AccountGate({ children }: { children: (user: TeamUser) => ReactNode }) {
  const [user, setUser] = useState<TeamUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/me", { cache: "no-store", signal: AbortSignal.timeout(10000) }).then(async response => {
      if (response.ok) { const result = await response.json() as { user: TeamUser; error?: string; pushPublicKey?: string }; setUser(result.user); try { localStorage.setItem("wa-last-user", JSON.stringify({ user: result.user, expires: Date.now() + 7 * 86400000 })); } catch {} }
      else if (response.status === 401) { localStorage.removeItem("wa-last-user"); }
      else setError("Der Anmeldedienst ist vorübergehend nicht erreichbar.");
    }).catch(() => {
      try { const cached = JSON.parse(localStorage.getItem("wa-last-user") || "null"); if (cached && cached.expires > Date.now()) setUser(cached.user); else setError("Bitte für die erste Anmeldung online gehen."); } catch { setError("Bitte Verbindung prüfen."); }
    }).finally(() => setLoading(false));
  }, []);
  if (user) return children(user);
  return <main className="login-shell"><section className="login-card"><p className="eyebrow">Unterricht gemeinsam planen</p><h1>Wochenatelier</h1><p className="login-copy">Melde dich mit deinem persönlichen Teamkonto an.</p><form onSubmit={async event => {
    event.preventDefault(); const form = new FormData(event.currentTarget); setLoading(true); setError("");
    try { const response = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)), signal: AbortSignal.timeout(15000) }); const result = await response.json() as { user: TeamUser; error?: string; pushPublicKey?: string }; if (!response.ok) throw new Error(result.error); try { localStorage.setItem("wa-last-user", JSON.stringify({ user: result.user, expires: Date.now() + 7 * 86400000 })); } catch {} setUser(result.user); }
    catch (error) { setError(error instanceof Error ? error.message : "Anmeldung nicht möglich."); } finally { setLoading(false); }
  }}><label className="field-stack">Benutzername<Input name="username" autoComplete="username" required /></label><label className="field-stack">Passwort<Input name="password" type="password" autoComplete="current-password" required /></label><Button className="login-button" disabled={loading}>{loading ? "Verbindung wird geprüft …" : "Anmelden"}</Button></form>{error && <p role="alert">{error}</p>}<p className="login-copy" style={{ marginTop: 20, fontSize: 13 }}>Zugang oder Passwort vergessen? Bitte die Koordination kontaktieren. Kein ChatGPT-Konto erforderlich.</p></section></main>;
}
export async function logout() {
  const response = await fetch("/api/logout", { method: "POST" });
  if (!response.ok) throw new Error("Abmelden benötigt eine Internetverbindung.");
  try { localStorage.removeItem("wa-last-user"); for (const key of Object.keys(localStorage)) if (key.startsWith("wa-cache-")) localStorage.removeItem(key); } catch {}
  location.reload();
}
export function AccountSettings({ user }: { user: TeamUser }) {
  const [message, setMessage] = useState("");
  return <details className="account-settings"><summary>Konto &amp; Teamzugänge</summary><form onSubmit={async event => {
    event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form));
    try { const response = await fetch("/api/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) }); const result = await response.json() as { user: TeamUser; error?: string; pushPublicKey?: string }; if (!response.ok) throw new Error(result.error); localStorage.removeItem("wa-last-user"); location.reload(); } catch (e) { setMessage(String(e)); }
  }}><h3>Passwort ändern</h3><Input name="current" type="password" placeholder="Bisheriges Passwort" aria-label="Bisheriges Passwort" autoComplete="current-password" required /><Input name="password" type="password" placeholder="Neues Passwort (mind. 12 Zeichen)" aria-label="Neues Passwort" minLength={12} autoComplete="new-password" required /><Button>Passwort speichern &amp; neu anmelden</Button></form>{user.role === "admin" && <form onSubmit={async event => {
    event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form));
    try { const response = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) }); const result = await response.json() as { user: TeamUser; error?: string; pushPublicKey?: string }; if (!response.ok) throw new Error(result.error); setMessage("Teamkonto angelegt. Zugang persönlich weitergeben."); form.reset(); } catch (e) { setMessage(String(e)); }
  }}><h3>Teamkonto anlegen</h3><Input name="username" placeholder="Benutzername" aria-label="Neuer Benutzername" pattern="[a-z0-9._-]{3,60}" required /><Input name="name" placeholder="Anzeigename" aria-label="Anzeigename" required /><Input name="password" type="password" placeholder="Startpasswort (mind. 12 Zeichen)" aria-label="Startpasswort" autoComplete="new-password" minLength={12} required /><label>Lehrperson-Zuordnung<select name="teacherId"><option value="t1">Lara · t1</option><option value="t2">Kim · t2</option><option value="t3">Sami · t3</option><option value="t4">Nora · t4</option></select></label><label>Rolle<select name="role"><option value="teacher">Lehrperson</option><option value="admin">Koordination</option></select></label><Button>Konto anlegen</Button></form>}<p role="status">{message}</p></details>;
}
