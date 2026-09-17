-- Review-Korrekturen
-- 1) Tagesangaben einer Woche feldweise speichern (keine verlorenen Änderungen,
--    wenn mehrere Personen gleichzeitig verschiedene Tage/Felder bearbeiten)
-- 2) Spaltenrechte: Koordination ändert nur Teamname bzw. Rolle/Verknüpfung
-- 3) Mitglieder dürfen nur mit Lehrpersonen des eigenen Teams verknüpft werden
-- 4) Lektionen nur in den 7 Zeitfenstern des Rasters

create or replace function public.patch_week_day(p_team uuid, p_week date, p_day text, p_patch jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_day not in ('mo', 'di', 'mi', 'do', 'fr') then
    raise exception 'Ungültiger Tag' using errcode = '22023';
  end if;
  if jsonb_typeof(p_patch) is distinct from 'object'
     or exists (select 1 from jsonb_object_keys(p_patch) k where k not in ('attendance', 'note', 'meetings'))
     or pg_column_size(p_patch) > 32000 then
    raise exception 'Ungültige Tagesangaben' using errcode = '22023';
  end if;
  -- RLS (weeks_all_member) gilt, da SECURITY INVOKER
  update public.weeks
     set days = jsonb_set(
       case when jsonb_typeof(days) = 'object' then days else '{}'::jsonb end,
       array[p_day],
       (case when jsonb_typeof(days -> p_day) = 'object' then days -> p_day else '{}'::jsonb end) || p_patch
     )
   where team_id = p_team and week_start = p_week;
  if not found then
    raise exception 'Woche nicht gefunden' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.patch_week_day(uuid, date, text, jsonb) from public, anon;
grant execute on function public.patch_week_day(uuid, date, text, jsonb) to authenticated;

revoke update on public.teams from authenticated;
grant update (name) on public.teams to authenticated;
revoke update on public.team_members from authenticated;
grant update (role, teacher_id) on public.team_members to authenticated;

create or replace function public.guard_member_teacher()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.teacher_id is not null
     and not exists (select 1 from public.teachers t where t.id = new.teacher_id and t.team_id = new.team_id) then
    raise exception 'Lehrperson gehört nicht zu diesem Team' using errcode = '23503';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_member_teacher() from public, anon, authenticated;

create trigger team_members_teacher_guard
before insert or update of teacher_id, team_id on public.team_members
for each row execute function public.guard_member_teacher();

alter table public.sessions drop constraint if exists sessions_slot_check;
alter table public.sessions add constraint sessions_slot_check check (slot between 0 and 6);
