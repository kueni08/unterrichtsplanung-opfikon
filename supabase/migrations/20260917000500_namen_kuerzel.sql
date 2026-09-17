-- Vollständige Namen und sinnvolle Kürzel:
-- * make_initials: Anfangsbuchstaben von Vor- und Nachname (letztes Wort), bei nur einem Wort die ersten zwei Buchstaben.
-- * unique_initials: Kürzel innerhalb eines Teams eindeutig (AM → AMu → AnM → AM2).
-- * join_team: Beitritt mit vollständigem Namen übernimmt den Namen in ein per Vorname verknüpftes Platzhalter-Profil.

create or replace function public.make_initials(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  with w as (
    select regexp_split_to_array(btrim(coalesce(p_name, '')), '\s+') as parts
  )
  select case
    when coalesce(array_length(parts, 1), 0) = 0 or parts[1] = '' then '?'
    when array_length(parts, 1) > 1 then upper(left(parts[1], 1) || left(parts[array_length(parts, 1)], 1))
    else upper(left(parts[1], 2))
  end
  from w;
$$;

create or replace function public.unique_initials(p_team uuid, p_name text, p_exclude uuid default null)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_parts text[] := regexp_split_to_array(btrim(coalesce(p_name, '')), '\s+');
  v_base  text := public.make_initials(p_name);
  v_cands text[];
  v_cand  text;
  v_n     integer;
begin
  if not exists (select 1 from public.teachers t where t.team_id = p_team and upper(t.initials) = upper(v_base) and (p_exclude is null or t.id <> p_exclude)) then
    return v_base;
  end if;
  if array_length(v_parts, 1) > 1 then
    v_cands := array[
      left(v_parts[1], 1) || left(v_parts[array_length(v_parts, 1)], 2),
      left(v_parts[1], 2) || left(v_parts[array_length(v_parts, 1)], 1),
      left(v_parts[1], 1) || left(v_parts[array_length(v_parts, 1)], 3)
    ];
  else
    v_cands := array[left(v_parts[1], 3), left(v_parts[1], 4)];
  end if;
  foreach v_cand in array v_cands loop
    v_cand := upper(left(v_cand, 1)) || substr(v_cand, 2);
    if char_length(v_cand) >= 2 and not exists (select 1 from public.teachers t where t.team_id = p_team and upper(t.initials) = upper(v_cand) and (p_exclude is null or t.id <> p_exclude)) then
      return v_cand;
    end if;
  end loop;
  for v_n in 2..99 loop
    if not exists (select 1 from public.teachers t where t.team_id = p_team and upper(t.initials) = upper(v_base || v_n) and (p_exclude is null or t.id <> p_exclude)) then
      return v_base || v_n;
    end if;
  end loop;
  return v_base;
end;
$$;

revoke execute on function public.make_initials(text) from public, anon, authenticated;
revoke execute on function public.unique_initials(uuid, text, uuid) from public, anon, authenticated;

create or replace function public.join_team(p_code text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user    uuid := auth.uid();
  v_team    uuid;
  v_teacher uuid;
  v_count   integer;
  v_name    text := coalesce(nullif(btrim(p_display_name), ''), 'Lehrperson');
  v_first   text := lower(split_part(coalesce(nullif(btrim(p_display_name), ''), 'Lehrperson'), ' ', 1));
  v_old     text;
  v_colors  text[] := array['#795A9D', '#C57953', '#347A78', '#4D699F', '#B5577A', '#5E8A3A'];
begin
  if v_user is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;

  select id into v_team from public.teams
  where join_code = upper(btrim(coalesce(p_code, '')));
  if v_team is null then
    raise exception 'Beitrittscode ungültig' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.team_members where team_id = v_team and user_id = v_user) then
    return v_team;
  end if;

  -- vorhandenes, noch nicht verknüpftes Profil mit gleichem (Vor-)Namen übernehmen – nur wenn eindeutig
  select min(t.id::text)::uuid, count(*) into v_teacher, v_count
  from public.teachers t
  where t.team_id = v_team
    and (lower(btrim(t.name)) = lower(v_name) or lower(btrim(t.name)) = v_first)
    and not exists (select 1 from public.team_members m where m.teacher_id = t.id);

  if v_count <> 1 then
    select count(*) into v_count from public.teachers where team_id = v_team;
    insert into public.teachers (team_id, name, initials, color, sort_order)
    values (v_team, v_name, public.unique_initials(v_team, v_name), v_colors[1 + (v_count % 6)], v_count)
    returning id into v_teacher;
  else
    -- Platzhalter (nur Vorname) durch den vollständigen Namen ersetzen; Kürzel nur nachführen, wenn es noch automatisch war
    select name into v_old from public.teachers where id = v_teacher;
    update public.teachers
    set active = true,
        name = case when char_length(v_name) > char_length(btrim(v_old)) then v_name else name end,
        initials = case
          when char_length(v_name) > char_length(btrim(v_old)) and upper(initials) = upper(public.make_initials(v_old))
            then public.unique_initials(v_team, v_name, v_teacher)
          else initials
        end
    where id = v_teacher;
  end if;

  insert into public.team_members (team_id, user_id, role, teacher_id, display_name)
  values (v_team, v_user, 'lehrperson', v_teacher, v_name);

  return v_team;
end;
$$;

revoke execute on function public.join_team(text, text) from public, anon;
grant execute on function public.join_team(text, text) to authenticated;

-- Bestehende Kürzel einmalig neu ableiten, sofern sie noch dem alten Automatismus entsprechen
-- (alter Algorithmus: 1. Buchstabe Vorname + 1. Buchstabe 2. Wort bzw. 2. Buchstabe des Vornamens).
update public.teachers t
set initials = public.unique_initials(t.team_id, t.name, t.id)
where upper(t.initials) = upper(
  left(split_part(btrim(t.name), ' ', 1), 1) ||
  coalesce(left(nullif(split_part(btrim(t.name), ' ', 2), ''), 1), substr(split_part(btrim(t.name), ' ', 1), 2, 1), '')
);
