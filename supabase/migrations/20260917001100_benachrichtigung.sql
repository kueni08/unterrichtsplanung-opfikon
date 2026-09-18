-- E-Mail-Benachrichtigungen: Einstellung pro Mitglied (nie / wichtige sofort / täglich)
-- und Vermerk, welche Änderungen bereits verschickt wurden.

alter table public.team_members
  add column if not exists notify text not null default 'none' check (notify in ('none', 'instant', 'daily'));

alter table public.changes
  add column if not exists notified_at timestamptz;

-- Eigene Einstellung ändern (nur die Spalte notify, deshalb über eine Funktion statt RLS-Update)
create or replace function public.set_notify(p_team uuid, p_value text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_value not in ('none', 'instant', 'daily') then
    raise exception 'Ungültiger Wert' using errcode = '22023';
  end if;
  update public.team_members set notify = p_value where team_id = p_team and user_id = auth.uid();
  if not found then
    raise exception 'Kein Mitglied dieses Teams' using errcode = '42501';
  end if;
end;
$$;
revoke execute on function public.set_notify(uuid, text) from public, anon;
grant execute on function public.set_notify(uuid, text) to authenticated;
