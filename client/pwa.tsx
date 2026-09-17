import type { TeamUser } from "../shared/planner";
import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
export function PwaPanel() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [update, setUpdate] = useState(false);
  const [push, setPush] = useState(false);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  useEffect(() => {
    setInstalled(matchMedia("(display-mode: standalone)").matches || !!(navigator as Navigator & { standalone?: boolean }).standalone);
    const install = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    const done = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", install); window.addEventListener("appinstalled", done);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then(async reg => {
      setRegistration(reg); setUpdate(!!reg.waiting); setPush(!!await reg.pushManager?.getSubscription());
      reg.addEventListener("updatefound", () => reg.installing?.addEventListener("statechange", () => { if (reg.waiting && navigator.serviceWorker.controller) setUpdate(true); }));
    }).catch(() => setMessage("Offlinebetrieb konnte noch nicht eingerichtet werden."));
    return () => { window.removeEventListener("beforeinstallprompt", install); window.removeEventListener("appinstalled", done); };
  }, []);
  async function togglePush() {
    if (!registration || !("PushManager" in window) || !("Notification" in window)) { setMessage("Push ist in diesem Browser nicht verfügbar. Auf iPhone/iPad zuerst zum Home-Bildschirm hinzufügen und dort öffnen."); return; }
    setWorking(true);
    try {
      const existing = await registration.pushManager.getSubscription();
      if (existing && push) {
        const response = await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: existing.endpoint }) });
        if (!response.ok) throw new Error("Deaktivieren fehlgeschlagen. Bitte online erneut versuchen.");
        await existing.unsubscribe(); setPush(false); setMessage("Benachrichtigungen auf diesem Gerät ausgeschaltet."); return;
      }
      // Permission is requested only in direct response to the user's click.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setMessage(permission === "denied" ? "Benachrichtigungen sind im Browser blockiert. Freigabe bei Bedarf in den Website-Einstellungen ändern." : "Benachrichtigungen bleiben ausgeschaltet."); return; }
      const response = await fetch("/api/me", { cache: "no-store" }); const me = await response.json() as { user: TeamUser; error?: string; pushPublicKey?: string };
      if (!response.ok || !me.pushPublicKey) throw new Error("Push ist auf dem Server noch nicht eingerichtet.");
      const base64 = me.pushPublicKey.replaceAll("-", "+").replaceAll("_", "/");
      const key = Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")), c => c.charCodeAt(0));
      const subscription = existing || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const save = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscription.toJSON()) });
      if (!save.ok) throw new Error("Push-Anmeldung konnte nicht gespeichert werden. Bitte erneut versuchen.");
      setPush(true); setMessage("Wichtige Änderungen werden auf diesem Gerät gemeldet. Keine Unterrichtsdetails auf dem Sperrbildschirm.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Push ist momentan nicht verfügbar."); }
    finally { setWorking(false); }
  }
  return <aside className="pwa-panel" aria-label="App installieren und Benachrichtigungen">
    {!installed && !dismissed && <div className="install-banner"><div><strong>Wochenatelier als App nutzen</strong><p>Direkt öffnen und bei Verbindungsunterbrüchen weiterplanen.</p></div><Button onClick={async () => { if (prompt) { try { await prompt.prompt(); await prompt.userChoice; setPrompt(null); } catch { setMessage("Bitte die Installationsfunktion im Browsermenü verwenden."); } } else setMessage("iPhone/iPad: In Safari auf Teilen → Zum Home-Bildschirm. Android/Computer: Im Browsermenü «App installieren» auswählen, sofern angeboten."); }}>{prompt ? "App installieren" : "So installierst du die App"}</Button><button className="logout-button" onClick={() => setDismissed(true)}>Später</button></div>}
    <details><summary>App &amp; Benachrichtigungen</summary><p>Nur als wichtig markierte Änderungen anderer Teammitglieder lösen Push aus. Die Zustellung hängt von Browser, Internet und Geräteeinstellungen ab.</p><Button variant="outline" onClick={togglePush} disabled={working || !registration}>{push ? "Benachrichtigungen ausschalten" : "Benachrichtigungen aktivieren"}</Button>{update && <p>Eine neue App-Version ist verfügbar. Zuerst den Teamplan speichern, danach die App schliessen und erneut öffnen.</p>}<p role="status">{message}</p></details>
  </aside>;
}
