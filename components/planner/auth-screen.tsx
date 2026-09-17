"use client";

import { useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CircleAlert, KeyRound, Loader2, ShieldCheck, Sparkles } from "lucide-react";

import { OwlLogo } from "@/components/planner/owl-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { appUrl } from "@/lib/supabase/client";
import { DEMO_USERS } from "@/lib/planner/demo";
import type { Role } from "@/lib/planner/types";

function mapAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return "E-Mail oder Passwort ist falsch.";
  if (/email not confirmed/i.test(message)) return "Bitte bestätige zuerst deine E-Mail-Adresse.";
  if (/user already registered/i.test(message)) return "Diese E-Mail ist bereits registriert.";
  if (/password should be at least/i.test(message)) return "Das Passwort muss mindestens 8 Zeichen haben.";
  if (/failed to fetch|networkerror/i.test(message)) return "Keine Verbindung. Bitte Internet prüfen.";
  return message;
}

export function AuthScreen({ supabase, onDemoSelect }: { supabase: SupabaseClient | null; onDemoSelect: (role: Role) => void }) {
  const [tab, setTab] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showDemo, setShowDemo] = useState(!supabase);

  async function handleSignIn(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (signInError) setError(mapAuthError(signInError.message));
  }

  async function handleSignUp(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    if (password.length < 8) { setError("Das Passwort muss mindestens 8 Zeichen haben."); return; }
    setLoading(true);
    setError(null);
    setInfo(null);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: appUrl(), data: { display_name: name.trim() || email.trim() } },
    });
    setLoading(false);
    if (signUpError) { setError(mapAuthError(signUpError.message)); return; }
    if (!data.session) setInfo("Bitte bestätige deine E-Mail-Adresse – wir haben dir einen Link geschickt.");
  }

  async function handleForgotPassword() {
    if (!supabase) return;
    if (!email.trim()) { setError("Bitte zuerst die E-Mail-Adresse eingeben."); return; }
    setLoading(true);
    setError(null);
    setInfo(null);
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl() });
    setLoading(false);
    setInfo("Falls ein Konto mit dieser E-Mail besteht, haben wir einen Link zum Zurücksetzen geschickt.");
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <OwlLogo size={96} />
        <p className="eyebrow">Teamplanung</p>
        <h1>Wochenatelier</h1>
        <p className="login-copy">Unterrichtsplanung für Teamteaching</p>

        {supabase && !showDemo && (
          <>
            <Tabs value={tab} onValueChange={setTab} className="auth-tabs">
              <TabsList className="w-full">
                <TabsTrigger value="signin" className="flex-1">Anmelden</TabsTrigger>
                <TabsTrigger value="signup" className="flex-1">Registrieren</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form className="auth-form" onSubmit={handleSignIn}>
                  <div className="field-stack"><Label htmlFor="signin-email">E-Mail</Label><Input id="signin-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                  <div className="field-stack"><Label htmlFor="signin-password">Passwort</Label><Input id="signin-password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                  <button type="button" className="link-button" onClick={handleForgotPassword}>Passwort vergessen?</button>
                  <Button type="submit" className="login-button" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <KeyRound />} Anmelden</Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form className="auth-form" onSubmit={handleSignUp}>
                  <div className="field-stack"><Label htmlFor="signup-name">Name</Label><Input id="signup-name" required value={name} onChange={(e) => setName(e.target.value)} /></div>
                  <div className="field-stack"><Label htmlFor="signup-email">E-Mail</Label><Input id="signup-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                  <div className="field-stack"><Label htmlFor="signup-password">Passwort</Label><Input id="signup-password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                  <Button type="submit" className="login-button" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Konto erstellen</Button>
                </form>
              </TabsContent>
            </Tabs>
            {error && <p className="auth-error"><CircleAlert size={15} />{error}</p>}
            {info && <p className="auth-info">{info}</p>}
            <div className="auth-divider"><span>oder</span></div>
          </>
        )}

        {supabase && !showDemo && (
          <Button variant="outline" className="w-full" onClick={() => setShowDemo(true)}><Sparkles /> Demo ohne Konto ansehen</Button>
        )}

        {(showDemo || !supabase) && (
          <div className="demo-reveal">
            {!supabase && <p className="auth-hint">Teamversion ist nicht konfiguriert.</p>}
            <p className="demo-reveal-title">Ohne Konto ausprobieren</p>
            <Button className="w-full" onClick={() => onDemoSelect("koordination")}>
              Als Koordination ({DEMO_USERS.koordination.displayName})
            </Button>
            <Button variant="outline" className="w-full" onClick={() => onDemoSelect("lehrperson")}>
              Als Lehrperson ({DEMO_USERS.lehrperson.displayName})
            </Button>
            {supabase && <button type="button" className="link-button" onClick={() => setShowDemo(false)}>Zurück zur Anmeldung</button>}
          </div>
        )}

        <div className="privacy-note"><CircleAlert /><p><strong>Datenschutz:</strong> Kinder erscheinen nur als Kürzel.</p></div>
      </section>
    </main>
  );
}

export function PasswordResetForm({ supabase, onDone }: { supabase: SupabaseClient; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) { setError("Das Passwort muss mindestens 8 Zeichen haben."); return; }
    setLoading(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) { setError(mapAuthError(updateError.message)); return; }
    onDone();
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <OwlLogo size={96} />
        <p className="eyebrow">Teamplanung</p>
        <h1>Neues Passwort setzen</h1>
        <p className="login-copy">Wähle ein neues Passwort für dein Konto.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field-stack"><Label htmlFor="new-password">Neues Passwort</Label><Input id="new-password" type="password" minLength={8} required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          {error && <p className="auth-error"><CircleAlert size={15} />{error}</p>}
          <Button type="submit" className="login-button" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <KeyRound />} Passwort speichern</Button>
        </form>
      </section>
    </main>
  );
}
