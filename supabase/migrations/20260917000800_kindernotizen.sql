-- Verhaltensnotizen pro Kind (positiv / negativ / Notiz), abrufbar im Kinderdossier.
-- Alle Teammitglieder dürfen Einträge erfassen; ändern/löschen darf die erfassende Person oder die Koordination.

create table public.child_notes (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  child_id    uuid not null references public.children (id) on delete cascade,
  kind        text not null default 'info' check (kind in ('plus', 'minus', 'info')),
  note        text not null default '' check (char_length(note) <= 1000),
  noted_on    date not null default current_date,
  author_id   uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index child_notes_team_idx on public.child_notes (team_id);
create index child_notes_child_idx on public.child_notes (child_id, noted_on desc);

create trigger child_notes_touch before update on public.child_notes for each row execute function public.touch_updated_at();

alter table public.child_notes enable row level security;
create policy "child_notes_select_member" on public.child_notes
  for select to authenticated using (private.is_team_member(team_id));
create policy "child_notes_insert_member" on public.child_notes
  for insert to authenticated with check (private.is_team_member(team_id) and author_id = auth.uid());
create policy "child_notes_update_own_or_coordinator" on public.child_notes
  for update to authenticated
  using (author_id = auth.uid() or private.is_team_coordinator(team_id))
  with check (private.is_team_member(team_id) and (author_id = auth.uid() or private.is_team_coordinator(team_id)));
create policy "child_notes_delete_own_or_coordinator" on public.child_notes
  for delete to authenticated using (author_id = auth.uid() or private.is_team_coordinator(team_id));

revoke all on public.child_notes from anon;
grant select, insert, update, delete on public.child_notes to authenticated;

alter table public.child_notes replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.child_notes;
  end if;
end;
$$;
