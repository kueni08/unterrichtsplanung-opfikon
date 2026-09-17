-- Härtung nach Supabase-Advisor
-- 1) RLS-Hilfsfunktionen in ein nicht öffentliches Schema verschieben
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.is_team_member(uuid) set schema private;
alter function public.is_team_coordinator(uuid) set schema private;
revoke execute on function private.is_team_member(uuid), private.is_team_coordinator(uuid) from public, anon;
grant execute on function private.is_team_member(uuid), private.is_team_coordinator(uuid) to authenticated;

-- regenerate_join_code nutzt die verschobene Funktion
create or replace function public.regenerate_join_code(p_team uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := public.new_join_code();
begin
  if not private.is_team_coordinator(p_team) then
    raise exception 'Nur die Koordination kann den Code erneuern' using errcode = '42501';
  end if;
  update public.teams set join_code = v_code where id = p_team;
  return v_code;
end;
$$;

-- 2) Trigger- und interne Funktionen nicht per API aufrufbar
revoke execute on function public.guard_last_coordinator() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.new_join_code() from public, anon, authenticated;
revoke execute on function public.make_initials(text) from public, anon, authenticated;

-- 3) Schreibrechte ohne überlappende SELECT-Policies
drop policy "teachers_write_coordinator" on public.teachers;
drop policy "groups_write_coordinator" on public.groups;
drop policy "templates_write_coordinator" on public.templates;

create policy "teachers_insert_coordinator" on public.teachers for insert to authenticated with check (private.is_team_coordinator(team_id));
create policy "teachers_update_coordinator" on public.teachers for update to authenticated using (private.is_team_coordinator(team_id)) with check (private.is_team_coordinator(team_id));
create policy "teachers_delete_coordinator" on public.teachers for delete to authenticated using (private.is_team_coordinator(team_id));

create policy "groups_insert_coordinator" on public.groups for insert to authenticated with check (private.is_team_coordinator(team_id));
create policy "groups_update_coordinator" on public.groups for update to authenticated using (private.is_team_coordinator(team_id)) with check (private.is_team_coordinator(team_id));
create policy "groups_delete_coordinator" on public.groups for delete to authenticated using (private.is_team_coordinator(team_id));

create policy "templates_insert_coordinator" on public.templates for insert to authenticated with check (private.is_team_coordinator(team_id));
create policy "templates_update_coordinator" on public.templates for update to authenticated using (private.is_team_coordinator(team_id)) with check (private.is_team_coordinator(team_id));
create policy "templates_delete_coordinator" on public.templates for delete to authenticated using (private.is_team_coordinator(team_id));

-- 4) Indizes für Fremdschlüssel
create index if not exists sessions_template_team_idx on public.sessions (template_id, team_id);
create index if not exists team_members_teacher_idx on public.team_members (teacher_id);
