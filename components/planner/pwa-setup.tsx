"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { BASE_PATH } from "@/lib/supabase/client";

const DISMISS_KEY = "wochenatelier-install-hint";

type InstallPromptEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function wasDismissed(): boolean {
  try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
}

/**
 * Registriert den Service Worker (Offline-Hülle) und zeigt einen dezenten
 * Installations-Hinweis, solange die App noch nicht auf dem Home-Bildschirm liegt.
 */
export function PwaSetup() {
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    const onPrompt = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent); };
    const onInstalled = () => { setInstalled(true); setInstallPrompt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/`, updateViaCache: "none" }).then((reg) => {
      if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        installing?.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) setWaiting(installing);
        });
      });
    }).catch(() => { /* ohne Service Worker läuft die App normal weiter */ });

    let reloading = false;
    const onControllerChange = () => { if (!reloading) { reloading = true; window.location.reload(); } };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* privater Modus */ }
  }

  async function install() {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") setInstalled(true);
    } catch { /* Browser hat den Dialog abgebrochen */ }
    setInstallPrompt(null);
  }

  if (waiting) {
    return (
      <div className="pwa-toast" role="status">
        <span>Eine neue Version des Wochenateliers ist bereit.</span>
        <Button size="sm" onClick={() => waiting.postMessage("ACTIVATE_UPDATE")}>Jetzt aktualisieren</Button>
      </div>
    );
  }

  // Erst nach der Hydration auswerten, damit Server- und Browser-HTML übereinstimmen.
  const hidden = !hydrated || dismissed || installed || isStandalone() || wasDismissed();
  if (hidden) return null;
  // Safari auf iPhone/iPad kennt kein beforeinstallprompt – dort nur eine Anleitung zeigen.
  const iosHint = !installPrompt && isIos();
  if (!installPrompt && !iosHint) return null;

  return (
    <div className="pwa-toast" role="region" aria-label="App installieren">
      <span>
        {iosHint
          ? "Als App nutzen: In Safari auf «Teilen» tippen, dann «Zum Home-Bildschirm»."
          : "Wochenatelier als App auf dem Gerät installieren?"}
      </span>
      <span className="pwa-toast-actions">
        {installPrompt && <Button size="sm" onClick={install}>Installieren</Button>}
        <Button size="sm" variant="secondary" onClick={dismiss}>Später</Button>
      </span>
    </div>
  );
}
