-- Kinder-Stammliste: Kinder werden mit Namen erfasst (auch per Excel-Import) und den Gruppen
-- zugeordnet. groups.children (Kürzel-Liste) bleibt als Spiegel der Zuordnung bestehen,
-- damit Wochenplan, Zählung und Kinderzuordnung pro Lektion unverändert funktionieren.

create table public.children (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  first_name  text not null default '' check (char_length(first_name) <= 80),
  last_name   text not null default '' check (char_length(last_name) <= 80),
  short       text not null default '' check (char_length(short) <= 6),
  group_id    uuid references public.groups (id) on delete set null,
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index children_team_idx on public.children (team_id);
create index children_group_idx on public.children (group_id);

create trigger children_touch before update on public.children for each row execute function public.touch_updated_at();

alter table public.children enable row level security;
create policy "children_select_member" on public.children
  for select to authenticated using (private.is_team_member(team_id));
create policy "children_insert_coordinator" on public.children
  for insert to authenticated with check (private.is_team_coordinator(team_id));
create policy "children_update_coordinator" on public.children
  for update to authenticated using (private.is_team_coordinator(team_id)) with check (private.is_team_coordinator(team_id));
create policy "children_delete_coordinator" on public.children
  for delete to authenticated using (private.is_team_coordinator(team_id));

revoke all on public.children from anon;
grant select, insert, update, delete on public.children to authenticated;

alter table public.children replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.children;
  end if;
end;
$$;
