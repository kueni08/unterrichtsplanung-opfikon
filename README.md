# Wochenatelier – Unterrichtsplanung Opfikon

Digitale Wochenplanung für altersdurchmischte Klassen und Teamteaching an der Schule Opfikon. Ein Team von Lehrpersonen plant gemeinsam und in Echtzeit, wer wann mit welcher Gruppe was macht – von der Wochenübersicht bis zum Tagesfokus mit Anwesenheiten und Sitzungen.

## Was die App kann

- **Tagesstruktur mit Terminen** – neben den 7 Lektionen gibt es Zeitfenster über Mittag (12:05–13:35) und am Abend (16:00–19:30) für Sitzungen, Elterngespräche und Elternabende; optisch klar abgesetzt, mit Teilnehmenden und Einladung per E-Mail-Entwurf und Kalenderdatei (.ics).
- **Gruppen zusammenlegen** – zwei Gruppen in einer Lektion als eine Einheit mit einer Lehrperson planen („zusammen mit …“), ohne gleich die ganze Klasse zu wählen.
- **Hausaufgaben & Rückblick** – pro Lektion „Hausaufgaben“ und „Fürs nächste Mal“; der Editor zeigt automatisch die letzten Lektionen desselben Fachs, der Reiter „Hausaufgaben“ die zuletzt verteilten Aufgaben je Fach.
- **Wochenplan** – Lektionen pro Tag und Zeitfenster planen, per Drag & Drop (oder über den Knopf „Verschieben“ auf Tablets) verschieben, in die nächste freie Lektion übertragen und mit Status (geplant, offen, erledigt, übertragen) versehen.
- **Tagesfokus** – Anwesenheit der Lehrpersonen, eine Tagesnotiz fürs ganze Team und bis zu zwei Sitzungen pro Tag festhalten.
- **Vorlagen** – jedes neue Team startet mit „Stundenplan Kastanie SJ 26/27“ und „Projektwoche“. Die Koordination pflegt deren Bausteine, Standard-Anwesenheit und Tagesnotizen; neue Wochen entstehen mit einem Klick daraus (mit Vorschau für alle).
- **Admin-Bereich** – Teamname, Beitrittscode, Rollen, Gruppen mit Kürzeln, Lehrpersonen (auch ohne eigenes Konto) und Vorlagen verwalten sowie einen JSON-Export als Backup erstellen (ein Import ist nicht vorgesehen).
- **Realtime-Zusammenarbeit** – Änderungen erscheinen sofort bei allen Teammitgliedern, inklusive Anzeige, wer gerade online ist.
- **Rollen** – *Koordination* verwaltet Team, Stammdaten und Vorlagen; *Lehrperson* plant im Team mit (Wochen, Lektionen, Tagesfokus) und sieht Vorlagen nur lesend. Die persönliche Ansicht zeigt die eigenen Lektionen vollständig, fremde nur abgeschwächt mit Titel.
- **Als App installierbar (PWA)** – Wochenatelier lässt sich auf Handy, Tablet und Computer zum Home-Bildschirm hinzufügen und startet dann wie eine App. Die App-Hülle wird offline vorgehalten; die Plandaten brauchen weiterhin eine Internetverbindung.
- **Demo-Modus** – die Anwendung lässt sich ohne Konto und ohne Server mit Beispieldaten ausprobieren (Daten bleiben nur im Browser).
- **Kinder-Stammliste** – Kinder mit Namen erfassen oder aus Excel/CSV importieren; Gruppen wählen ihre Kinder per Checkbox daraus. Im Wochenplan erscheinen Kinder nur mit Kürzel.

Eine ausführliche Bedienungsanleitung für Lehrpersonen und Koordination steht in [`docs/ANLEITUNG.md`](docs/ANLEITUNG.md), die technische Einrichtung (Supabase, Deployment, RLS) in [`docs/EINRICHTUNG.md`](docs/EINRICHTUNG.md).

## Direkt testen

Live-Version: **https://kueni08.github.io/unterrichtsplanung-opfikon/**

Die App kann dort im Demo-Modus ohne Anmeldung ausprobiert werden. Für die produktive Nutzung registrieren sich Lehrpersonen mit E-Mail und Passwort und gründen ein Team oder treten einem bestehenden Team mit Beitrittscode bei.

## Technologie

- [Next.js 16](https://nextjs.org/) (statischer Export, React 19) für die Oberfläche
- [Supabase](https://supabase.com/) für Authentifizierung, PostgreSQL-Datenbank, Row Level Security und Realtime-Synchronisation
- [Tailwind CSS](https://tailwindcss.com/) und [Radix UI](https://www.radix-ui.com/) / shadcn-Komponenten für das Design
- Deployment als statische Seite über **GitHub Pages** (via GitHub Actions)

## Lokal starten

Voraussetzung: Node.js 22 oder neuer.

```bash
npm ci
npx next dev          # http://localhost:3000
```

Ohne weitere Angaben verbindet sich die App mit dem produktiven Supabase-Projekt; über `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` lässt sich ein anderes Projekt wählen. Der Demo-Modus funktioniert auch ohne Verbindung. (`npm run dev` stammt aus der ursprünglichen Projektvorlage und wird für diese App nicht verwendet.)

## Tests

```bash
npm run test:unit   # Unit-Tests für die reine Planungslogik (lib/planner)
npm run test:db     # RLS-/Datenbanktests gegen eine temporäre lokale PostgreSQL-Instanz
```

`npm run test:db` benötigt eine lokale PostgreSQL-Installation (Version 15 oder neuer, `initdb`/`pg_ctl`/`psql` im `PATH` oder unter `/usr/lib/postgresql/*/bin`) und darf nicht als root-Benutzer laufen.

## Projektstruktur

```
app/                     Next.js App Router (Seiten, Layout, Web-App-Manifest)
components/planner/      UI-Komponenten der Wochenplanung
components/ui/           Wiederverwendbare UI-Bausteine (shadcn)
public/sw.js             Service Worker (Offline-Hülle, Update-Hinweis)
public/icons/            App-Icons für Home-Bildschirm und Installation
hooks/use-planner.ts     Zentraler Planungszustand (optimistisches Speichern, Realtime)
lib/planner/             Reine Planungslogik, Typen, Demo-Daten, Supabase-Anbindung
supabase/migrations/     SQL-Migrationen (Tabellen, RLS-Policies, RPCs)
supabase/tests/          Lokale RLS-/Datenbanktests
.github/workflows/       CI/CD (Build, Tests, Deployment nach GitHub Pages)
```

## Supabase-Projekt

- Projekt-Referenz: `gppbxybdteihpoawyxpy`
- Region: `eu-central-2` (Zürich)

Details zur Einrichtung, den nötigen manuellen Schritten im Supabase-Dashboard, den Migrationen und dem RLS-Modell stehen in [`docs/EINRICHTUNG.md`](docs/EINRICHTUNG.md).
