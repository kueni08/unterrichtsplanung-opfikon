# Unterrichtsplanung Opfikon – Anleitung

## Online-Adresse

Nach erfolgreichem Cloudflare-Deployment ist die Anwendung unter der von Wrangler ausgegebenen `workers.dev`-Adresse erreichbar. Die Adresse steht auch im Cloudflare-Dashboard unter **Workers & Pages → wochenatelier-opfikon**.

## Anmeldung und Team

Lehrpersonen melden sich mit ihren unabhängigen Konten an. Einladungen und Rollen werden im Team-Bereich verwaltet. Änderungen werden mit der gemeinsamen Cloudflare-D1-Datenbank synchronisiert.

## Gruppen und Konflikte

Ein Kind darf mehreren Gruppen zugeordnet sein. Die Konfliktanalyse prüft vor dem Speichern, ob es in derselben Lektion mehreren gleichzeitig laufenden Unterrichtseinheiten zugeordnet ist.

Eine Ausnahme kann für eine einzelne Lektion oder einen einzelnen Tag gesetzt werden. Diese Ausnahme hebt die Dauerzuordnung nicht dauerhaft auf und wird in der Konfliktliste sichtbar protokolliert.

## Offline und Synchronisation

Die PWA speichert Änderungen zunächst lokal. Sobald wieder eine Verbindung besteht, werden sie automatisch synchronisiert. Bei gleichzeitigen Änderungen durch mehrere Personen erscheint ein Versionskonflikt; danach muss die aktuellere Version geprüft und erneut gespeichert werden.

## PWA installieren

Die Website im Browser öffnen und **Installieren** bzw. **Zum Startbildschirm hinzufügen** wählen. Auf iPhone/iPad: **Teilen → Zum Home-Bildschirm**. Benachrichtigungen müssen im Browser und anschliessend in der Anwendung erlaubt werden.

## Entwicklung und Deployment

```powershell
npm install
npm run build:pwa
npx wrangler deploy --dry-run
npx wrangler deploy
```

Für Datenbankänderungen:

```powershell
npx wrangler d1 migrations apply wochenatelier-opfikon --remote
```

Secrets und Passwörter niemals in Git einchecken. Die Cloudflare-Ressourcen bleiben im kostenlosen Kontingent, solange dessen aktuelle Limits nicht überschritten werden.

