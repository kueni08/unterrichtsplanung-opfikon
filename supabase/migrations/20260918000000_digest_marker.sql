-- Tägliche Zusammenfassung: Vermerk je Änderung, ob sie schon in einer Zusammenfassung war.
-- Damit hängt der Versand nicht mehr an einem festen 24-Stunden-Fenster (Wochenende, verspätete Zeitpläne),
-- und `notified_at` bleibt dem Sofortversand vorbehalten (leer = Nachlieferung durch die nächste Zusammenfassung).
alter table public.changes add column if not exists digested_at timestamptz;

-- Bestehende Einträge gelten als erledigt, sonst käme beim ersten Lauf ein Rückstau.
update public.changes set digested_at = coalesce(digested_at, now());

create index if not exists changes_pending_idx on public.changes (team_id, created_at desc)
  where importance = 'major' and (digested_at is null or notified_at is null);
