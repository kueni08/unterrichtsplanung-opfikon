"use client";

import { useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CircleAlert, LogOut, School, Users } from "lucide-react";

import { OwlLogo } from "@/components/planner/owl-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildStarterContent } from "@/lib/planner/demo";
import { createTeam, joinTeam, seedStarterContent } from "@/lib/planner/supabase-backend";

/** Für frisch angemeldete Personen ohne Team: Team gründen oder beitreten. */
export function Onboarding({ supabase, displayName, onDone, onSignOut }: {
  supabase: SupabaseClient;
  displayName: string;
  onDone: (teamId: string) => void;
  onSignOut: () => void;
}) {
  const [teamName, setTeamName] = useState("");
  const [founderName, setFounderName] = useState(displayName);
  const [joinCode, setJoinCode] = useState("");
  const [joinerName, setJoinerName] = useState(displayName);
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setBusy("create");
    setError(null);
    try {
      const teamId = await createTeam(supabase, teamName.trim() || "Unser Team", founderName.trim() || displayName);
      await seedStarterContent(supabase, teamId, buildStarterContent);
      onDone(teamId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Team konnte nicht angelegt werden.");
    } finally {
      setBusy(null);
    }
  }

  async function handleJoin(event: FormEvent) {
    event.preventDefault();
    setBusy("join");
    setError(null);
    try {
      const teamId = await joinTeam(supabase, joinCode, joinerName.trim() || displayName);
      onDone(teamId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Beitritt ist fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="onboarding-shell">
      <div className="onboarding-head">
        <OwlLogo size={64} />
        <p className="eyebrow">Teamplanung</p>
        <h1>Willkommen bei Wochenatelier</h1>
        <p className="login-copy">Gründe ein neues Team oder tritt einem bestehenden Team bei, um mit der Planung zu starten.</p>
      </div>
      {error && <p className="auth-error onboarding-error"><CircleAlert size={15} />{error}</p>}
      <div className="onboarding-grid">
        <form className="onboarding-card" onSubmit={handleCreate}>
          <div className="card-heading"><span className="icon-box blue"><School /></span><div><h3>Neues Team gründen</h3><p>Du wirst automatisch Koordination</p></div></div>
          <div className="field-stack"><Label htmlFor="team-name">Teamname</Label><Input id="team-name" required placeholder="z. B. ADL Opfikon" value={teamName} onChange={(e) => setTeamName(e.target.value)} /></div>
          <div className="field-stack"><Label htmlFor="founder-name">Dein Vorname</Label><Input id="founder-name" required value={founderName} onChange={(e) => setFounderName(e.target.value)} /></div>
          <Button type="submit" disabled={busy !== null}>{busy === "create" ? "Wird angelegt…" : "Team gründen"}</Button>
          <p className="onboarding-hint">Als Koordination pflegst du Vorlagen, Gruppen und das Team. Dein Team startet mit der Vorlage „Stundenplan Kastanie SJ 26/27“ (Klassen 3.–5., Lehrpersonen Dani, Andrea, Klara, Nici, Coni). Gib deinen Vornamen so ein, wie er im Stundenplan steht – dann wirst du automatisch mit deinem Kürzel verknüpft.</p>
        </form>
        <form className="onboarding-card" onSubmit={handleJoin}>
          <div className="card-heading"><span className="icon-box mint"><Users /></span><div><h3>Einem Team beitreten</h3><p>Mit dem 8-stelligen Code der Koordination</p></div></div>
          <div className="field-stack"><Label htmlFor="join-code">Beitrittscode</Label><Input id="join-code" required maxLength={8} className="join-code-input" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} /></div>
          <div className="field-stack"><Label htmlFor="joiner-name">Dein Vorname</Label><Input id="joiner-name" required value={joinerName} onChange={(e) => setJoinerName(e.target.value)} /></div>
          <Button type="submit" variant="outline" disabled={busy !== null}>{busy === "join" ? "Wird geprüft…" : "Team beitreten"}</Button>
          <p className="onboarding-hint">Den Code findest du bei der Koordination im Admin-Bereich unter „Team“. Trittst du mit deinem Vornamen wie im Stundenplan bei, wirst du automatisch mit deinem bestehenden Profil verknüpft.</p>
        </form>
      </div>
      <button type="button" className="link-button onboarding-signout" onClick={onSignOut}><LogOut size={14} /> Abmelden</button>
    </main>
  );
}
