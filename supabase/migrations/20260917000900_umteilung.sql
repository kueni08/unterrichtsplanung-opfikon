-- Umteilung einzelner Kinder pro Lektion (sessions.reassignments) und pro Tag (weeks.days.<tag>.reassignments).
alter table public.sessions
  add column if not exists reassignments jsonb not null default '[]'::jsonb check (jsonb_typeof(reassignments) = 'array');

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
     or exists (select 1 from jsonb_object_keys(p_patch) k where k not in ('attendance', 'note', 'meetings', 'reassignments'))
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
