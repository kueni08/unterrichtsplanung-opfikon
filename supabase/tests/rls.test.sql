-- RLS- und RPC-Tests. Lokal ausführen mit: bash supabase/tests/run-local.sh
\set ON_ERROR_STOP on

insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a', 'koordination@example.ch'),
  ('00000000-0000-0000-0000-00000000000b', 'lehrperson@example.ch'),
  ('00000000-0000-0000-0000-00000000000c', 'fremd@example.ch');

create or replace function pg_temp.act_as(p_user text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user, false);
  execute 'set role authenticated';
end $$;

create or replace function pg_temp.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'OK  % (abgewiesen: %)', p_label, sqlerrm;
    return;
  end;
  raise exception 'FEHLER % wurde nicht abgewiesen', p_label;
end $$;

create or replace function pg_temp.expect(p_ok boolean, p_label text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'FEHLER %', p_label; end if;
  raise notice 'OK  %', p_label;
end $$;

-- 1) Koordination legt Team an
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select public.create_team('ADL Opfikon', 'Lara Meier') as team_id \gset
select pg_temp.expect((select role from public.team_members where team_id = :'team_id') = 'koordination', 'Ersteller ist Koordination');
select pg_temp.expect((select initials from public.teachers where team_id = :'team_id') = 'LM', 'Initialen werden gebildet');
select join_code from public.teams where id = :'team_id' \gset

insert into public.groups (team_id, name, short, color, children) values (:'team_id', '1. Klasse', '1. Kl.', '#E98F82', 'A01, A02');
insert into public.templates (id, team_id, name) values ('10000000-0000-0000-0000-000000000001', :'team_id', 'Regelwoche');
insert into public.sessions (team_id, template_id, day, slot, title) values (:'team_id', '10000000-0000-0000-0000-000000000001', 'mo', 0, 'Wochenstart');
insert into public.weeks (team_id, week_start) values (:'team_id', '2026-09-14');
insert into public.sessions (id, team_id, week_start, day, slot, title) values
  ('20000000-0000-0000-0000-000000000001', :'team_id', '2026-09-14', 'mo', 0, 'Deutsch'),
  ('20000000-0000-0000-0000-000000000002', :'team_id', '2026-09-14', 'mo', 1, 'Mathe');
select pg_temp.expect(true, 'Koordination schreibt Stammdaten, Vorlagen und Wochen');

-- Blöcke tauschen in einem Statement (verzögerte Eindeutigkeit)
update public.sessions set slot = case slot when 0 then 1 else 0 end where week_start = '2026-09-14';
select pg_temp.expect((select slot from public.sessions where id = '20000000-0000-0000-0000-000000000001') = 1, 'Tausch zweier Blöcke funktioniert');

-- Doppelbelegung wird am Transaktionsende abgewiesen
select pg_temp.expect_error($q$insert into public.sessions (team_id, week_start, day, slot, title)
  select team_id, week_start, 'mo', 0, 'Doppelt' from public.weeks limit 1; set constraints all immediate$q$, 'Doppelbelegung');

select pg_temp.expect_error($q$insert into public.weeks (team_id, week_start) select id, '2026-09-16' from public.teams limit 1$q$, 'Wochenstart muss Montag sein');
select pg_temp.expect_error($q$insert into public.teams (name, join_code) values ('x', 'y')$q$, 'Team direkt anlegen');

-- 2) Fremde Person sieht nichts
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select pg_temp.expect((select count(*) from public.teams) = 0, 'Fremde sehen keine Teams');
select pg_temp.expect((select count(*) from public.sessions) = 0, 'Fremde sehen keine Lektionen');
select pg_temp.expect((select count(*) from public.groups) = 0, 'Fremde sehen keine Kinderkürzel');
select pg_temp.expect_error(format($q$insert into public.sessions (team_id, week_start, day, slot) values (%L, '2026-09-14', 'di', 0)$q$, :'team_id'), 'Fremde schreiben Lektion');
select pg_temp.expect_error($q$select public.join_team('FALSCH00', 'X')$q$, 'Falscher Beitrittscode');
select pg_temp.expect_error(format($q$select public.regenerate_join_code(%L)$q$, :'team_id'), 'Fremde erneuern Code');
update public.sessions set title = 'gehackt';
reset role;
select pg_temp.expect((select count(*) from public.sessions where title = 'gehackt') = 0, 'Fremde Updates wirkungslos');

-- vorbereitetes Profil ohne Konto (wie aus dem Stundenplan)
insert into public.teachers (team_id, name, initials) values (:'team_id', 'Kim', 'KI');

-- 3) Lehrperson tritt bei
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select public.join_team(lower(:'join_code'), 'Kim Berger') = :'team_id'::uuid as joined \gset
select pg_temp.expect(:'joined'::boolean, 'Beitritt mit Code (Kleinschreibung) klappt');
select public.join_team(:'join_code', 'Kim Berger');
select pg_temp.expect((select count(*) from public.team_members where team_id = :'team_id') = 2, 'Doppelter Beitritt erzeugt keinen zweiten Eintrag');
select pg_temp.expect((select role from public.team_members where user_id = '00000000-0000-0000-0000-00000000000b') = 'lehrperson', 'Beigetreten als Lehrperson');
select pg_temp.expect((select count(*) from public.teachers where team_id = :'team_id') = 2, 'Vorhandenes Profil „Kim“ wird verknüpft statt dupliziert');
select pg_temp.expect((select t.name from public.team_members m join public.teachers t on t.id = m.teacher_id where m.user_id = '00000000-0000-0000-0000-00000000000b') = 'Kim', 'Verknüpfung per Vorname');

-- darf Wochen planen
update public.sessions set title = 'Deutsch · Lesespuren' where id = '20000000-0000-0000-0000-000000000001';
insert into public.sessions (team_id, week_start, day, slot, title) values (:'team_id', '2026-09-14', 'di', 0, 'Sport');
update public.weeks set days = '{"mo": {"note": "Besuch"}}' where team_id = :'team_id';
select pg_temp.expect((select count(*) from public.sessions where week_start is not null) = 3, 'Lehrperson plant Wochen');

-- darf keine Stammdaten/Vorlagen/Rollen ändern
update public.groups set name = 'x';
update public.templates set name = 'x';
update public.sessions set title = 'x' where template_id is not null;
update public.team_members set role = 'koordination';
update public.teams set name = 'x';
reset role;
select pg_temp.expect((select count(*) from public.groups where name = 'x') = 0, 'Lehrperson ändert keine Gruppen');
select pg_temp.expect((select count(*) from public.templates where name = 'x') = 0, 'Lehrperson ändert keine Vorlagen');
select pg_temp.expect((select count(*) from public.sessions where title = 'x') = 0, 'Lehrperson ändert keine Vorlagenbausteine');
select pg_temp.expect((select count(*) from public.team_members where role = 'koordination') = 1, 'Lehrperson macht sich nicht zur Koordination');
select pg_temp.expect((select count(*) from public.teams where name = 'x') = 0, 'Lehrperson ändert Teamnamen nicht');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error(format($q$insert into public.sessions (team_id, template_id, day, slot) values (%L, '10000000-0000-0000-0000-000000000001', 'di', 3)$q$, :'team_id'), 'Lehrperson legt Vorlagenbaustein an');
select pg_temp.expect_error(format($q$insert into public.groups (team_id, name) values (%L, 'Neu')$q$, :'team_id'), 'Lehrperson legt Gruppe an');

-- 4) Koordination: letzte Koordination bleibt erhalten
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect_error($q$update public.team_members set role = 'lehrperson' where user_id = '00000000-0000-0000-0000-00000000000a'$q$, 'Letzte Koordination herabstufen');
update public.team_members set role = 'koordination' where user_id = '00000000-0000-0000-0000-00000000000b';
update public.team_members set role = 'lehrperson' where user_id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.expect((select count(*) from public.team_members where role = 'koordination') = 1, 'Rollenwechsel mit Nachfolge klappt');

-- 5) Team löschen (als DB-Owner) räumt alles ab
reset role;
delete from public.teams;
select pg_temp.expect((select count(*) from public.sessions) + (select count(*) from public.team_members) = 0, 'Kaskadierendes Löschen');

-- 6) Realtime-Publication enthält alle Tabellen
select pg_temp.expect((select count(*) from pg_publication_tables where pubname = 'supabase_realtime') = 7, 'Realtime für 7 Tabellen aktiv');

\echo 'Alle Datenbanktests bestanden.'
