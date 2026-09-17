import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Öffentliche Projektangaben. Der Publishable Key ist für den Browser gedacht;
 * der Schutz der Daten erfolgt über Row Level Security in der Datenbank.
 * Mit leeren Umgebungsvariablen läuft die App nur im Demo-Modus.
 */
const DEFAULT_URL = "https://gppbxybdteihpoawyxpy.supabase.co";
const DEFAULT_KEY = "sb_publishable_w6jOmcVIq-oaXK7eAraAJA_7uKW8dEr";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? DEFAULT_URL;
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? DEFAULT_KEY;
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

let client: SupabaseClient | null | undefined;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

/** Liefert den Browser-Client (oder null, wenn nicht konfiguriert / auf dem Server). */
export function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (client !== undefined) return client;
  client = isSupabaseConfigured()
    ? createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        realtime: { params: { eventsPerSecond: 10 } },
      })
    : null;
  return client;
}

/** Absolute URL der App (für Bestätigungs- und Passwort-Links). */
export function appUrl(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${BASE_PATH}/`;
}
