-- Einführungstour pro Mitglied serverseitig als gesehen merken (gilt dann auf allen Geräten).
alter table public.team_members add column if not exists tour_seen boolean not null default false;

create or replace function public.mark_tour_seen(p_team uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.team_members set tour_seen = true where team_id = p_team and user_id = auth.uid();
end;
$$;
revoke execute on function public.mark_tour_seen(uuid) from public, anon;
grant execute on function public.mark_tour_seen(uuid) to authenticated;
