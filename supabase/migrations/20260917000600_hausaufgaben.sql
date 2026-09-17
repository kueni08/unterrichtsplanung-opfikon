-- Hausaufgaben und Hinweis fürs nächste Mal pro Lektion (Rückblick je Fach in der App).
alter table public.sessions
  add column if not exists homework  text not null default '' check (char_length(homework) <= 2000),
  add column if not exists next_time text not null default '' check (char_length(next_time) <= 2000);
