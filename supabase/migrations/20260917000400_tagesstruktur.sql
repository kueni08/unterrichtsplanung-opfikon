-- Tagesstruktur: Zeitfenster über Mittag (Slot 5) und am Abend (Slots 8–10) für Sitzungen,
-- Elterngespräche usw. Die bisherigen Nachmittagslektionen (Slots 5/6) rücken auf 6/7.
alter table public.sessions drop constraint if exists sessions_slot_check;

-- Zweistufig verschieben, damit die Exklusions-Constraints (Tag+Slot eindeutig) nie verletzt werden.
update public.sessions set slot = slot + 100 where slot >= 5;
update public.sessions set slot = slot - 99 where slot >= 100;

alter table public.sessions add constraint sessions_slot_check check (slot between 0 and 10);
