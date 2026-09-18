# Einrichtung und Betrieb

Diese Anleitung richtet sich an die technische Betreuung (Admin/IT) der Anwendung Wochenatelier: Supabase-Konfiguration, Datenbankschema, Deployment und Datenschutz.

## Supabase-Projekt

- Projekt-Referenz: `gppbxybdteihpoawyxpy`
- Region: `eu-central-2` (Zürich)
- URL: `https://gppbxybdteihpoawyxpy.supabase.co`

Die Anwendung verwendet Supabase für Authentifizierung (E-Mail/Passwort), die PostgreSQL-Datenbank inklusive Row Level Security (RLS) und Realtime-Synchronisation.

## Manuelle Schritte im Supabase-Dashboard (erforderlich)

Diese Einstellungen werden nicht über Migrationen gesetzt und müssen einmalig im Dashboard vorgenommen werden:

1. **Authentication → URL Configuration**
   - **Site URL**: `https://kueni08.github.io/unterrichtsplanung-opfikon/`
   - **Redirect URLs** (zusätzlich eintragen):
     - `https://kueni08.github.io/unterrichtsplanung-opfikon/**`
     - `http://localhost:3000/**`
2. **Authentication → Email**
   - „Confirm email“ aktivieren, damit sich nur Nutzende mit bestätigter E-Mail-Adresse anmelden können.
3. **Optional, empfohlen für den produktiven Betrieb**:
   - **Eigener SMTP-Server** hinterlegen (Authentication → Email). Der in Supabase eingebaute Mailversand ist mengenmässig stark limitiert und eignet sich nur zum Testen bzw. für sehr kleine Nutzungszahlen – für den produktiven Betrieb mit einem ganzen Kollegium sollte ein eigener SMTP-Anbieter eingerichtet werden.
   - **Leaked Password Protection** aktivieren (Authentication → Policies bzw. Password Settings), damit bekannte, kompromittierte Passwörter abgelehnt werden.
   - **Minimale Passwortlänge** auf mindestens 8 Zeichen setzen.

## Datenbank-Migrationen

Die Migrationen liegen unter `supabase/migrations/` und werden in Dateinamen-Reihenfolge angewendet:

| Datei | Inhalt |
| --- | --- |
| `20260917000000_teamversion.sql` | Tabellen (`teams`, `teachers`, `team_members`, `groups`, `templates`, `weeks`, `sessions`), RPCs (`create_team`, `join_team`, `regenerate_join_code`), RLS-Policies, Realtime-Publikation |
| `20260917000100_hardening.sql` | Härtung gemäss Supabase-Security-Advisor: RLS-Hilfsfunktionen in ein privates Schema verschoben, interne Funktionen vor direktem API-Zugriff geschützt, zusätzliche Indizes |
| `20260917000200_kastanie_defaults.sql` | Tagesvorgaben (`templates.days`) und Beitritt, der vorhandene Lehrpersonen-Profile per (Vor-)Namen verknüpft |
| `20260917000300_review_fixes.sql` | RPC `patch_week_day` (Tagesangaben feldweise speichern), Spaltenrechte für `teams`/`team_members`, Verknüpfung nur mit Lehrpersonen des eigenen Teams, Zeitfenster 0–6 |

**Reihenfolge beim Ausrollen:** Neue Migrationen immer *vor* dem Frontend-Deployment anwenden – die App ruft z. B. `patch_week_day` auf und meldet sonst „Die Datenbank ist nicht auf dem aktuellen Stand“.

### Anwenden

Mit der Supabase-CLI:

```bash
supabase db push
```

Alternativ lassen sich die Dateien unter `supabase/migrations/` der Reihe nach im **SQL-Editor** des Supabase-Dashboards ausführen.

## RLS-Modell (wer darf was)

Alle Tabellen haben Row Level Security aktiviert. Zugriff hat nur, wer über `team_members` Mitglied des jeweiligen Teams ist.

| Tabelle | Lesen | Schreiben |
| --- | --- | --- |
| `teams` | alle Teammitglieder (inkl. Beitrittscode) | nur Koordination, nur Spalte `name`; neuer Code nur über `regenerate_join_code` |
| `team_members` | alle Teammitglieder | Koordination ändert nur `role`/`teacher_id` (Lehrperson desselben Teams); Mitglieder können sich selbst entfernen, die Koordination auch andere; Beitritt nur über `join_team` |
| `teachers` | alle Teammitglieder | nur Koordination |
| `groups` | alle Teammitglieder | nur Koordination |
| `templates` | alle Teammitglieder | nur Koordination |
| `weeks` | alle Teammitglieder | alle Teammitglieder (Tagesangaben über `patch_week_day`, RLS gilt) |
| `sessions` (Wochenlektionen, `week_start` gesetzt) | alle Teammitglieder | alle Teammitglieder |
| `sessions` (Vorlagenbausteine, `template_id` gesetzt) | alle Teammitglieder | nur Koordination |

Zusätzliche Regeln, die in der Datenbank erzwungen werden:

- Ein Team kann nie ohne Koordinationsperson bleiben (Trigger `team_members_guard`).
- Pro Team/Woche/Tag/Zeitfenster ist nur eine Lektion erlaubt, ebenso pro Vorlage/Tag/Zeitfenster (`exclude`-Constraints, am Ende der Transaktion geprüft, damit mehrere Blöcke in einem Schritt verschoben werden können).
- Eine Lektion gehört immer entweder zu einer Woche **oder** zu einer Vorlage, nie zu beidem.

## Zeitfenster (Slots)

`lib/planner/constants.ts` definiert die Tagesstruktur als Liste `SLOTS` (Index = gespeicherter `slot` in `sessions`). Lektionen (`kind: "lesson"`) und Termine (`kind: "meeting"`, Mittag/Abend) bilden getrennte Spuren: Verschieben, Übertragen und „nächster freier Platz“ bleiben innerhalb einer Spur. Die Datenbank erlaubt `slot` 0–10 (`sessions_slot_check`); die Migration `20260917000400_tagesstruktur.sql` hat die bisherigen Nachmittagslektionen (5/6) auf 6/7 verschoben. Teilnehmende eines Termins werden als `assignments` mit leerer `groupId` gespeichert.

## Kinder-Stammliste

Tabelle `children` (Vor-/Nachname, Kürzel, `group_id`), RLS wie bei `groups` (Mitglieder lesen, Koordination schreibt). `groups.children` bleibt als Kürzel-Spiegel der Zuordnung bestehen (`syncGroupChildren` in `lib/planner/children.ts`), damit Zählung und Kinderzuordnung pro Lektion unverändert funktionieren. Der Excel-Import nutzt SheetJS (`xlsx`), das erst beim Import nachgeladen wird.

## Umteilungen

`sessions.reassignments` (JSON `[{childId, groupId}]`) für Lektionen, `weeks.days.<tag>.reassignments` für Tage (`patch_week_day` erlaubt den Schlüssel). Auflösung: Lektion → Tag → `children.group_id` (`lib/planner/reassign.ts`).

## Verhaltensnotizen

Tabelle `child_notes` (Kind, Art `plus|minus|info`, Text, Datum, `author_id`). Alle Teammitglieder lesen und erfassen (nur mit eigener `author_id`); ändern/löschen darf die erfassende Person oder die Koordination. Beim Löschen eines Kindes werden seine Notizen kaskadierend gelöscht.

## Realtime

Alle Tabellen sind Teil der Supabase-Realtime-Publikation (`supabase_realtime`) mit `replica identity full`. Die App abonniert Einfügungen und Änderungen gefiltert nach Team; Löschungen lassen sich in Supabase Realtime nicht filtern und liefern bei RLS nur den Primärschlüssel – sie werden daher ungefiltert abonniert und in der App anhand der bekannten IDs zugeordnet. Bei jedem Ereignis lädt die App den Teamstand kurz verzögert neu (nicht, solange eigene Änderungen noch gespeichert werden). Gespeichert werden nur die jeweils geänderten Felder, damit gleichzeitige Änderungen an verschiedenen Feldern nicht verloren gehen; bei gleichzeitiger Änderung desselben Feldes gilt die zuletzt gespeicherte. Die Presence-Funktion liefert die Online-Anzeige.

## Progressive Web App (PWA)

- `app/manifest.ts` erzeugt beim Build `manifest.webmanifest`; alle Pfade berücksichtigen `NEXT_PUBLIC_BASE_PATH` (auf GitHub Pages `/unterrichtsplanung-opfikon`).
- `public/sw.js` ist der Service Worker. Er leitet seine Basis aus dem Registrierungs-Scope ab und cached nur eigene statische Dateien (`_next/static/`, Icons, Startseite). Anfragen an Supabase werden nie gecacht.
- `components/planner/pwa-setup.tsx` registriert den Service Worker, zeigt den Installations-Hinweis und den Update-Hinweis. Nach dem Deployment einer neuen Version bekommen offene Apps den Hinweis „Jetzt aktualisieren“.
- Bei Änderungen am Service Worker selbst die Konstante `VERSION` in `public/sw.js` erhöhen, damit alte Caches gelöscht werden.
- Icons liegen in `public/icons/` (192, 512 und 512 maskable, erzeugt aus `public/icons/eule-app-icon.svg`).
- Push-Benachrichtigungen sind nicht vorgesehen: Sie bräuchten einen eigenen Server, GitHub Pages liefert nur statische Dateien.

## Änderungsprotokoll

Tabelle `changes` (Team, Woche, Lektion, Art, Wichtigkeit, Zusammenfassung, Person, Zeitpunkt). Die App schreibt bei jeder Aktion einen Eintrag (`logChange` in `hooks/use-planner.ts`); Tipp-Änderungen an derselben Lektion werden innerhalb von 10 Minuten zu einem Eintrag zusammengefasst. Geladen werden die letzten 14 Tage (max. 400 Einträge). „Gesehen bis“ liegt pro Person und Gerät im localStorage.

**E-Mail-Benachrichtigungen (optional, noch nicht aktiv):** Vorgesehen ist eine Supabase Edge Function, die per Database Webhook auf neue `changes`-Zeilen mit `importance = 'major'` reagiert und Mitglieder mit Einstellung „sofort“ bzw. per Zeitplan „täglich“ informiert; Versand über einen Mail-Dienst wie Resend (API-Key als Secret der Edge Function). Voraussetzungen: Mail-Dienst-Konto, Spalte `notify` in `team_members`, Einstellung im Admin/Profil.

## Pausieren im Gratis-Plan verhindern

Supabase pausiert Gratis-Projekte nach 7 Tagen ohne Zugriffe (z. B. in den Ferien). Der Workflow `.github/workflows/keep-alive.yml` ruft deshalb alle zwei Tage eine harmlose REST-Abfrage mit dem öffentlichen Schlüssel auf – das zählt als Aktivität, und das Projekt bleibt wach. Zusätzlich kann er ein pausiertes Projekt automatisch wiederherstellen: Dafür unter Supabase → Account → Access Tokens ein Token erzeugen und im GitHub-Repo unter Settings → Secrets → Actions als `SUPABASE_ACCESS_TOKEN` hinterlegen. Ohne Token bleibt es beim Anstupsen; ein pausiertes Projekt wird dann von Hand im Dashboard gestartet (die App zeigt in diesem Fall einen entsprechenden Hinweis). Der Workflow lässt sich unter „Actions“ auch manuell auslösen.

Hinweis: GitHub deaktiviert Zeitpläne in Repositories ohne Aktivität nach 60 Tagen – dann unter „Actions“ den Workflow wieder aktivieren.

## GitHub Pages Deployment

Der Workflow `.github/workflows/deploy-pages.yml` baut die Anwendung bei jedem Push auf `main`, bei manuellem Auslösen (`workflow_dispatch`) sowie bei Pull Requests (dort nur Build/Test, kein Deployment). Deployed wird ausschliesslich bei einem Push auf `main`.

Der Build-Job führt aus: Abhängigkeiten installieren, Unit-Tests (`npm run test:unit`), Linting (`eslint`), `next build` (statischer Export) und lädt das Ergebnis als Pages-Artefakt hoch. Ein separater Job führt die Datenbanktests (`supabase/tests/run-local.sh`) aus.

### Optionale Repository-Variablen

Der Workflow verwendet für den Build standardmässig die produktiven Supabase-Werte, kann aber über **Repository Variables** (Settings → Secrets and variables → Actions → Variables) überschrieben werden – z. B. um gegen ein Test- oder Staging-Projekt zu bauen:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Sind diese Variablen nicht gesetzt, verwendet der Workflow die Werte des produktiven Projekts (`gppbxybdteihpoawyxpy`, Region Zürich).

## Datenbanktests lokal ausführen

```bash
npm run test:db
```

Das Skript `supabase/tests/run-local.sh` startet eine temporäre PostgreSQL-Instanz, spielt einen minimalen Nachbau der Supabase-Umgebung (Rollen `anon`/`authenticated`, `auth`-Schema) sowie alle Migrationen ein und führt anschliessend `supabase/tests/rls.test.sql` aus. Voraussetzung ist eine lokale PostgreSQL-Installation (Version 15 oder neuer) mit `initdb`, `pg_ctl` und `psql` im `PATH` oder unter `/usr/lib/postgresql/*/bin`. Der Befehl darf nicht als root-Benutzer ausgeführt werden (`initdb` verweigert dies) – auf GitHub-Actions-Runnern ist das automatisch der Fall, da dort nicht als root gearbeitet wird.

## Backup und Datenschutz

- Die Koordination kann im Admin-Bereich jederzeit einen **JSON-Export** aller Team-Daten erstellen. Dieser Export sollte an einem Ort mit angemessenem Zugriffsschutz abgelegt werden.
- Die Anwendung erfasst Kinder ausschliesslich mit **Kürzeln**, nie mit Namen oder weiteren personenbezogenen Angaben; Freitextfelder (Notizen, Fokus) sind entsprechend nur für unkritische, organisatorische Angaben vorgesehen.
- Daten werden bei Supabase in der Region Zürich (`eu-central-2`) gespeichert.
- **Empfehlung**: Vor dem produktiven Einsatz mit echten Team- und Kinderdaten sollte die Nutzung von Supabase als Auftragsbearbeiter mit der Informatik- bzw. Datenschutzverantwortlichen Stelle der Schule bzw. Gemeinde abgeklärt werden (Auftragsbearbeitungsvereinbarung, DSG). Diese Anleitung ersetzt keine rechtliche Beratung.

## Team zurücksetzen oder entfernen

Ein Team lässt sich vollständig entfernen, indem der Team-Datensatz gelöscht wird – alle abhängigen Daten (Mitgliedschaften, Lehrpersonen, Gruppen, Vorlagen, Wochen, Lektionen) werden durch die `on delete cascade`-Fremdschlüssel automatisch mitgelöscht. Im SQL-Editor des Supabase-Dashboards:

```sql
delete from teams where id = '<team-id>';
```

Die `<team-id>` lässt sich z. B. über die Team-Tabelle oder den Teamnamen ermitteln:

```sql
select id, name, join_code from teams where name = '<teamname>';
```

Dieser Schritt kann nicht rückgängig gemacht werden – vorher gegebenenfalls ein Backup (JSON-Export) der betroffenen Teams erstellen.
