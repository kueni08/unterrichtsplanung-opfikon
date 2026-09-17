"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { AuthScreen, PasswordResetForm } from "@/components/planner/auth-screen";
import { Onboarding } from "@/components/planner/onboarding";
import { PlannerApp, type TeamOption } from "@/components/planner/planner-app";
import { Splash } from "@/components/planner/splash";
import { Button } from "@/components/ui/button";
import { createLocalBackend } from "@/lib/planner/backend";
import { weekStartFor } from "@/lib/planner/dates";
import { DEMO_USERS, buildDemoSnapshot } from "@/lib/planner/demo";
import { createSupabaseBackend, listMemberships } from "@/lib/planner/supabase-backend";
import type { Role } from "@/lib/planner/types";
import { getSupabase } from "@/lib/supabase/client";

const TEAM_STORAGE_KEY = "wochenatelier-team";

/** Fehlermeldung aus einem abgelaufenen/ungültigen Bestätigungs- oder Passwort-Link (#error_description=…). */
function readAuthErrorFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const search = new URLSearchParams(window.location.search);
  return params.get("error_description") ?? search.get("error_description");
}

export default function Page() {
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);
  // vor dem Erzeugen des Clients lesen, da dieser die URL bereinigt
  const [urlAuthError] = useState<string | null>(readAuthErrorFromUrl);
  const [supabase] = useState<SupabaseClient | null>(() => getSupabase());

  const [demoRole, setDemoRole] = useState<Role | null>(null);
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [memberships, setMemberships] = useState<TeamOption[] | null>(null);
  const [membershipsError, setMembershipsError] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const demoBackend = useMemo(() => createLocalBackend(() => buildDemoSnapshot(weekStartFor(new Date(), 0))), []);
  const teamBackend = useMemo(
    () => (supabase && selectedTeamId ? createSupabaseBackend(supabase, selectedTeamId) : null),
    [supabase, selectedTeamId],
  );

  // Sitzung laden & Änderungen (Anmeldung, Abmeldung, Passwort-Reset-Link) beobachten.
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setAuthUser(data.session?.user ?? null);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      if (!session) {
        // abgemeldet (auch bei abgelaufener Sitzung): keine Teamliste der vorherigen Person behalten
        setMemberships(null);
        setMembershipsError(null);
        setSelectedTeamId(null);
      }
      setAuthUser(session?.user ?? null);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!urlAuthError) return;
    try { window.history.replaceState(null, "", window.location.pathname); } catch { /* ignorieren */ }
  }, [urlAuthError]);

  // Teams der angemeldeten Person laden, sobald die Sitzung bekannt ist.
  // Abhängig von der ID (nicht vom User-Objekt), damit Token-Erneuerungen nicht neu laden.
  const authUserId = authUser?.id ?? null;
  useEffect(() => {
    if (!supabase || !authUserId) return;
    let active = true;
    listMemberships(supabase, authUserId)
      .then((list) => {
        if (!active) return;
        setMemberships(list);
        setMembershipsError(null);
        if (list.length > 0) {
          let stored: string | null = null;
          try { stored = window.localStorage.getItem(TEAM_STORAGE_KEY); } catch { /* Speicher gesperrt */ }
          const match = list.find((m) => m.teamId === stored) ?? list[0];
          setSelectedTeamId(match.teamId);
        }
      })
      .catch((error: unknown) => {
        if (active) setMembershipsError(error instanceof Error ? error.message : String(error));
      });
    return () => { active = false; };
  }, [supabase, authUserId]);

  async function handleOnboardingDone(teamId: string) {
    if (!supabase || !authUser) return;
    try {
      const list = await listMemberships(supabase, authUser.id);
      setMemberships(list);
      setSelectedTeamId(teamId);
      try { window.localStorage.setItem(TEAM_STORAGE_KEY, teamId); } catch { /* Speicher gesperrt */ }
    } catch (error) {
      setMembershipsError(error instanceof Error ? error.message : String(error));
    }
  }

  function handleSwitchTeam(teamId: string) {
    setSelectedTeamId(teamId);
    try { window.localStorage.setItem(TEAM_STORAGE_KEY, teamId); } catch { /* Speicher gesperrt */ }
  }

  async function handleSignOut() {
    setMemberships(null);
    setSelectedTeamId(null);
    await supabase?.auth.signOut();
  }

  if (!hydrated) return <Splash />;

  if (demoRole) {
    return (
      <PlannerApp
        key={`demo-${demoRole}`}
        backend={demoBackend}
        userId={DEMO_USERS[demoRole].userId}
        displayName={DEMO_USERS[demoRole].displayName}
        mode="demo"
        onExitDemo={() => setDemoRole(null)}
      />
    );
  }

  if (!supabase) {
    return <AuthScreen supabase={null} onDemoSelect={setDemoRole} initialError={urlAuthError} />;
  }

  if (passwordRecovery) {
    return <PasswordResetForm supabase={supabase} onDone={() => setPasswordRecovery(false)} />;
  }

  if (authUser === undefined) return <Splash />;

  if (authUser === null) {
    return <AuthScreen supabase={supabase} onDemoSelect={setDemoRole} initialError={urlAuthError} />;
  }

  const displayName = (authUser.user_metadata?.display_name as string | undefined) || authUser.email || "Ich";

  if (membershipsError) {
    return (
      <main className="planner-error-shell">
        <div className="planner-error-card">
          <h2>Teams konnten nicht geladen werden</h2>
          <p>{membershipsError}</p>
          <Button onClick={() => window.location.reload()}>Erneut versuchen</Button>
        </div>
      </main>
    );
  }

  if (memberships === null) return <Splash />;

  if (memberships.length === 0) {
    return (
      <Onboarding
        supabase={supabase}
        displayName={displayName}
        onDone={handleOnboardingDone}
        onSignOut={handleSignOut}
      />
    );
  }

  if (!selectedTeamId || !teamBackend) return <Splash />;

  return (
    <PlannerApp
      key={selectedTeamId}
      backend={teamBackend}
      userId={authUser.id}
      displayName={displayName}
      mode="team"
      teams={memberships}
      onSwitchTeam={handleSwitchTeam}
      onSignOut={handleSignOut}
    />
  );
}
