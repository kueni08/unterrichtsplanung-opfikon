-- Wochenatelier · Teamversion
-- Supabase Auth + PostgreSQL + Realtime
--
-- Rollen pro Team:
--   koordination  – verwaltet Team, Gruppen, Lehrpersonen und Vorlagen
--   lehrperson    – plant Wochen und Lektionen gemeinsam mit dem Team
--
-- Datenschutz: Kinder werden ausschliesslich mit Kürzeln erfasst (z. B. A01).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------

create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  join_code   text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.teachers (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  initials    text not null check (char_length(initials) between 1 and 4),
  color       text not null default '#4D699F' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index teachers_team_idx on public.teachers (team_id);

create table public.team_members (
  team_id       uuid not null references public.teams (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  role          text not null default 'lehrperson' check (role in ('koordination', 'lehrperson')),
  teacher_id    uuid references public.teachers (id) on delete set null,
  display_name  text not null default '',
  created_at    timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index team_members_user_idx on public.team_members (user_id);

create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  short       text not null default '',
  color       text not null default '#6FAFD4' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  children    text not null default '' check (char_length(children) <= 2000),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index groups_team_idx on public.groups (team_id);

create table public.templates (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, team_id)
);
create index templates_team_idx on public.templates (team_id);

create table public.weeks (
  team_id     uuid not null references public.teams (id) on delete cascade,
  week_start  date not null check (extract(isodow from week_start) = 1),
  days        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (team_id, week_start)
);

create table public.sessions (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams (id) on delete cascade,
  template_id  uuid,
  week_start   date,
  day          text not null check (day in ('mo', 'di', 'mi', 'do', 'fr')),
  slot         integer not null check (slot between 0 and 7),
  title        text not null default '' check (char_length(title) <= 120),
  focus        text not null default '' check (char_length(focus) <= 200),
  room         text not null default '' check (char_length(room) <= 80),
  notes        text not null default '' check (char_length(notes) <= 4000),
  children     text not null default '' check (char_length(children) <= 1000),
  whole_class  boolean not null default false,
  status       text not null default 'planned' check (status in ('planned', 'open', 'done', 'carried')),
  assignments  jsonb not null default '[]'::jsonb check (jsonb_typeof(assignments) = 'array'),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- genau eines: Vorlagenbaustein ODER Lektion einer Woche
  constraint session_owner check ((template_id is null) <> (week_start is null)),
  constraint session_template_fk foreign key (template_id, team_id)
    references public.templates (id, team_id) on delete cascade,
  constraint session_week_fk foreign key (team_id, week_start)
    references public.weeks (team_id, week_start) on delete cascade,
  -- ein Platz pro Tag/Lektion; erst am Ende der Transaktion geprüft,
  -- damit mehrere Blöcke in einem Schritt verschoben werden können
  constraint session_week_slot_unique exclude using btree
    (team_id with =, week_start with =, day with =, slot with =)
    where (week_start is not null) deferrable initially deferred,
  constraint session_template_slot_unique exclude using btree
    (template_id with =, day with =, slot with =)
    where (template_id is not null) deferrable initially deferred
);
create index sessions_team_week_idx on public.sessions (team_id, week_start);
create index sessions_template_idx on public.sessions (template_id);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger teams_touch     before update on public.teams     for each row execute function public.touch_updated_at();
create trigger teachers_touch  before update on public.teachers  for each row execute function public.touch_updated_at();
create trigger groups_touch    before update on public.groups    for each row execute function public.touch_updated_at();
create trigger templates_touch before update on public.templates for each row execute function public.touch_updated_at();
create trigger weeks_touch     before update on public.weeks     for each row execute function public.touch_updated_at();
create trigger sessions_touch  before update on public.sessions  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen für RLS
-- ---------------------------------------------------------------------------

create or replace function public.is_team_member(p_team uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members m
    where m.team_id = p_team and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_team_coordinator(p_team uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members m
    where m.team_id = p_team and m.user_id = (select auth.uid()) and m.role = 'koordination'
  );
$$;

create or replace function public.make_initials(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(
    coalesce(left(split_part(btrim(p_name), ' ', 1), 1), '') ||
    coalesce(left(nullif(split_part(btrim(p_name), ' ', 2), ''), 1),
             substr(split_part(btrim(p_name), ' ', 1), 2, 1), '')
  );
$$;

create or replace function public.new_join_code()
returns text
language sql
volatile
set search_path = ''
as $$
  -- ohne verwechselbare Zeichen (0/O, 1/I)
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 8);
$$;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_team(p_name text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user    uuid := auth.uid();
  v_team    uuid;
  v_teacher uuid;
  v_name    text := coalesce(nullif(btrim(p_display_name), ''), 'Koordination');
begin
  if v_user is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'Teamname fehlt' using errcode = '22023';
  end if;

  insert into public.teams (name, join_code)
  values (btrim(p_name), public.new_join_code())
  returning id into v_team;

  insert into public.teachers (team_id, name, initials, color, sort_order)
  values (v_team, v_name, public.make_initials(v_name), '#795A9D', 0)
  returning id into v_teacher;

  insert into public.team_members (team_id, user_id, role, teacher_id, display_name)
  values (v_team, v_user, 'koordination', v_teacher, v_name);

  return v_team;
end;
$$;

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

  select count(*) into v_count from public.teachers where team_id = v_team;

  insert into public.teachers (team_id, name, initials, color, sort_order)
  values (v_team, v_name, public.make_initials(v_name), v_colors[1 + (v_count % 6)], v_count)
  returning id into v_teacher;

  insert into public.team_members (team_id, user_id, role, teacher_id, display_name)
  values (v_team, v_user, 'lehrperson', v_teacher, v_name);

  return v_team;
end;
$$;

create or replace function public.regenerate_join_code(p_team uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := public.new_join_code();
begin
  if not public.is_team_coordinator(p_team) then
    raise exception 'Nur die Koordination kann den Code erneuern' using errcode = '42501';
  end if;
  update public.teams set join_code = v_code where id = p_team;
  return v_code;
end;
$$;

-- Das Team darf nie ohne Koordination bleiben.
create or replace function public.guard_last_coordinator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'koordination'
     and (tg_op = 'DELETE' or new.role <> 'koordination')
     and not exists (
       select 1 from public.team_members
       where team_id = old.team_id and role = 'koordination' and user_id <> old.user_id
     )
     and exists (select 1 from public.teams where id = old.team_id)
  then
    raise exception 'Das Team braucht mindestens eine Koordination' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger team_members_guard
before update or delete on public.team_members
for each row execute function public.guard_last_coordinator();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.teams        enable row level security;
alter table public.team_members enable row level security;
alter table public.teachers     enable row level security;
alter table public.groups       enable row level security;
alter table public.templates    enable row level security;
alter table public.weeks        enable row level security;
alter table public.sessions     enable row level security;

-- teams
create policy "teams_select_member" on public.teams
  for select to authenticated using (public.is_team_member(id));
create policy "teams_update_coordinator" on public.teams
  for update to authenticated using (public.is_team_coordinator(id)) with check (public.is_team_coordinator(id));

-- team_members
create policy "members_select_member" on public.team_members
  for select to authenticated using (public.is_team_member(team_id));
create policy "members_update_coordinator" on public.team_members
  for update to authenticated using (public.is_team_coordinator(team_id)) with check (public.is_team_coordinator(team_id));
create policy "members_delete_coordinator_or_self" on public.team_members
  for delete to authenticated using (public.is_team_coordinator(team_id) or user_id = (select auth.uid()));

-- Stammdaten: lesen alle Mitglieder, ändern nur die Koordination
create policy "teachers_select_member" on public.teachers
  for select to authenticated using (public.is_team_member(team_id));
create policy "teachers_write_coordinator" on public.teachers
  for all to authenticated using (public.is_team_coordinator(team_id)) with check (public.is_team_coordinator(team_id));

create policy "groups_select_member" on public.groups
  for select to authenticated using (public.is_team_member(team_id));
create policy "groups_write_coordinator" on public.groups
  for all to authenticated using (public.is_team_coordinator(team_id)) with check (public.is_team_coordinator(team_id));

create policy "templates_select_member" on public.templates
  for select to authenticated using (public.is_team_member(team_id));
create policy "templates_write_coordinator" on public.templates
  for all to authenticated using (public.is_team_coordinator(team_id)) with check (public.is_team_coordinator(team_id));

-- Wochen: das ganze Team plant gemeinsam
create policy "weeks_all_member" on public.weeks
  for all to authenticated using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));

-- Lektionen: Wochenlektionen alle Mitglieder, Vorlagenbausteine nur Koordination
create policy "sessions_select_member" on public.sessions
  for select to authenticated using (public.is_team_member(team_id));
create policy "sessions_insert" on public.sessions
  for insert to authenticated with check (
    case when template_id is null then public.is_team_member(team_id)
         else public.is_team_coordinator(team_id) end
  );
create policy "sessions_update" on public.sessions
  for update to authenticated
  using (
    case when template_id is null then public.is_team_member(team_id)
         else public.is_team_coordinator(team_id) end
  )
  with check (
    case when template_id is null then public.is_team_member(team_id)
         else public.is_team_coordinator(team_id) end
  );
create policy "sessions_delete" on public.sessions
  for delete to authenticated using (
    case when template_id is null then public.is_team_member(team_id)
         else public.is_team_coordinator(team_id) end
  );

-- ---------------------------------------------------------------------------
-- Rechte
-- ---------------------------------------------------------------------------

revoke all on public.teams, public.team_members, public.teachers, public.groups,
              public.templates, public.weeks, public.sessions from anon;
grant select, update                 on public.teams        to authenticated;
grant select, update, delete         on public.team_members to authenticated;
grant select, insert, update, delete on public.teachers, public.groups, public.templates,
                                        public.weeks, public.sessions to authenticated;

revoke execute on function public.create_team(text, text),
                           public.join_team(text, text),
                           public.regenerate_join_code(uuid),
                           public.is_team_member(uuid),
                           public.is_team_coordinator(uuid)
  from public, anon;
grant execute on function public.create_team(text, text),
                          public.join_team(text, text),
                          public.regenerate_join_code(uuid),
                          public.is_team_member(uuid),
                          public.is_team_coordinator(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter table public.teams        replica identity full;
alter table public.team_members replica identity full;
alter table public.teachers     replica identity full;
alter table public.groups       replica identity full;
alter table public.templates    replica identity full;
alter table public.weeks        replica identity full;
alter table public.sessions     replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.teams, public.team_members, public.teachers, public.groups,
      public.templates, public.weeks, public.sessions;
  end if;
end;
$$;
