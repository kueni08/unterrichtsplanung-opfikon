-- Vorlagen mit Tagesvorgaben (Anwesenheit, Notizen) und
-- Beitritt verknüpft bestehende Lehrpersonen-Profile per Name.

alter table public.templates add column if not exists days jsonb not null default '{}'::jsonb;

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
    values (v_team, v_name, public.make_initials(v_name), v_colors[1 + (v_count % 6)], v_count)
    returning id into v_teacher;
  else
    update public.teachers set active = true where id = v_teacher;
  end if;

  insert into public.team_members (team_id, user_id, role, teacher_id, display_name)
  values (v_team, v_user, 'lehrperson', v_teacher, v_name);

  return v_team;
end;
$$;

revoke execute on function public.join_team(text, text) from public, anon;
grant execute on function public.join_team(text, text) to authenticated;
