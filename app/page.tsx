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

export default function Page() {
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);
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
      setAuthUser(session?.user ?? null);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabase]);

  // Teams der angemeldeten Person laden, sobald die Sitzung bekannt ist.
  useEffect(() => {
    if (!supabase || !authUser) return;
    let active = true;
    listMemberships(supabase, authUser.id)
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
  }, [supabase, authUser]);

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
    return <AuthScreen supabase={null} onDemoSelect={setDemoRole} />;
  }

  if (passwordRecovery) {
    return <PasswordResetForm supabase={supabase} onDone={() => setPasswordRecovery(false)} />;
  }

  if (authUser === undefined) return <Splash />;

  if (authUser === null) {
    return <AuthScreen supabase={supabase} onDemoSelect={setDemoRole} />;
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
