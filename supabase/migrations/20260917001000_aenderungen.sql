-- Änderungsprotokoll: wer hat wann was geändert. Die App schreibt bei jeder Aktion einen Eintrag
-- und hebt im Wochenplan hervor, was andere seit dem letzten Besuch geändert haben.

create table public.changes (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  week_start  date,
  session_id  uuid,
  kind        text not null check (kind in ('added', 'removed', 'moved', 'edited', 'assigned', 'reassigned', 'day', 'group', 'meeting')),
  importance  text not null default 'minor' check (importance in ('minor', 'major')),
  summary     text not null default '' check (char_length(summary) <= 300),
  author_id   uuid,
  author_name text not null default '' check (char_length(author_name) <= 120),
  created_at  timestamptz not null default now()
);
create index changes_team_time_idx on public.changes (team_id, created_at desc);

alter table public.changes enable row level security;
create policy "changes_select_member" on public.changes
  for select to authenticated using (private.is_team_member(team_id));
create policy "changes_insert_member" on public.changes
  for insert to authenticated with check (private.is_team_member(team_id) and author_id = auth.uid());
create policy "changes_update_own" on public.changes
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "changes_delete_coordinator" on public.changes
  for delete to authenticated using (private.is_team_coordinator(team_id));

revoke all on public.changes from anon;
grant select, insert, update, delete on public.changes to authenticated;

alter table public.changes replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.changes;
  end if;
end;
$$;
