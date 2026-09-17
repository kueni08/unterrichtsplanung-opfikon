# Anleitung für Lehrpersonen und Koordination

Diese Anleitung beschreibt die Bedienung von Wochenatelier – der digitalen Wochenplanung für Teamteaching an der Schule Opfikon.

## Einstieg

### Registrieren und Anmelden

Beim ersten Besuch registriert man sich mit E-Mail-Adresse und Passwort. Nach der Registrierung schickt Supabase eine Bestätigungs-E-Mail; der Link darin muss angeklickt werden, bevor die Anmeldung funktioniert. Danach meldet man sich mit E-Mail und Passwort an.

### E-Mail bestätigen

Ohne bestätigte E-Mail-Adresse ist keine Anmeldung möglich. Falls die Bestätigungs-E-Mail nicht ankommt: Spam-Ordner prüfen, ein paar Minuten abwarten (der eingebaute Mailversand von Supabase ist mengenmässig begrenzt) und bei anhaltenden Problemen die Koordination oder die technische Ansprechperson kontaktieren.

### Passwort vergessen

Zuerst die E-Mail-Adresse im Anmeldeformular eintragen, dann auf „Passwort vergessen?“ klicken – Wochenatelier schickt einen Rücksetzlink. Der Link öffnet die App mit dem Formular „Neues Passwort setzen“ (mindestens 8 Zeichen); danach ist man direkt angemeldet. Ist ein Link abgelaufen oder bereits benutzt, zeigt die Anmeldeseite einen Hinweis – dann einfach einen neuen Link anfordern.

### Team gründen oder beitreten

Nach der ersten Anmeldung gibt es zwei Möglichkeiten:

- **Team gründen**: Wer ein neues Team erstellt, wird automatisch **Koordination** dieses Teams.
- **Team beitreten**: Mit dem 8-stelligen Beitrittscode, den die Koordination im Admin-Bereich weitergibt, tritt man einem bestehenden Team als **Lehrperson** bei. Wer dabei den Vornamen so eingibt, wie er im Stundenplan steht (z. B. „Klara“), wird automatisch mit dem vorhandenen, noch nicht verknüpften Lehrpersonen-Profil verbunden; sonst entsteht ein neues Profil.

Beim Gründen legt Wochenatelier die Lehrpersonen Dani, Andrea, Klara, Nici und Coni, die Klassen 3.–5. sowie die Vorlagen „Stundenplan Kastanie SJ 26/27“ und „Projektwoche“ an. Bricht die Einrichtung ab (z. B. Verbindungsunterbruch), lässt sie sich mit „Einrichtung erneut versuchen“ fortsetzen, ohne ein zweites Team anzulegen.

Den Beitrittscode findet die Koordination im Admin-Bereich und kann ihn dort bei Bedarf auch neu erzeugen (z. B. wenn er versehentlich weitergegeben wurde).

### Einführungstour

Über den Knopf mit dem Fragezeichen lässt sich jederzeit eine kurze Einführungstour durch die wichtigsten Bereiche der Anwendung starten.

## Wochenplan

Der Wochenplan zeigt die Lektionen einer Woche, aufgeteilt nach Wochentag und Zeitfenster. Die Tagesstruktur folgt dem Stundenplan Kastanie und enthält zusätzlich Zeitfenster für Termine ausserhalb des Unterrichts:

| Abschnitt | Zeitfenster |
|---|---|
| Morgen · Unterricht | 1.–5. Lektion (07:30–12:00, Pause nach der 3. Lektion) |
| **Mittag · Sitzungen** | 12:05–13:35 |
| Nachmittag · Unterricht | 6.–7. Lektion (13:40–15:15) |
| **Abend · Sitzungen & Elterngespräche** | 16:00–17:00 · 17:00–18:00 · 18:00–19:30 |

Die Termin-Zeitfenster sind gelb hinterlegt und schraffiert, damit sie sich klar vom Unterricht abheben.

- **Woche aus Vorlage übernehmen**: Eine noch leere Woche lässt sich mit einem Klick aus der oben gewählten Vorlage (z. B. „Stundenplan Kastanie SJ 26/27“) befüllen. Darunter zeigt eine Vorschau den Inhalt der Vorlage; ein Klick auf einen Baustein öffnet ihn (für Lehrpersonen nur lesend). Anwesenheiten und Tagesnotizen übernimmt die Woche aus den Vorgaben der Vorlage.
- **Lektion hinzufügen**: Auf ein freies Zeitfenster („Planen“) klicken oder den Knopf „Lektion“ verwenden (nimmt das erste freie Zeitfenster des im Tagesfokus gewählten Tages).
- **Fächer pro Klasse & Teamteaching**: Im Block kann jede Klasse ein eigenes Fach und einen eigenen Raum erhalten oder „frei“ haben; eine zweite Lehrperson pro Klasse ergibt Teamteaching. Solange der Titel nicht von Hand geändert wurde, setzt er sich aus den Fächern zusammen.
- **Block bearbeiten**: Titel, Stichworte, Raum, Notizen, Kinderkürzel und Zuständigkeiten pro Gruppe anpassen.
- **Verschieben**: Ein Block lässt sich per Drag & Drop auf ein anderes Zeitfenster ziehen. Auf Tablets und Touch-Geräten steht dafür zusätzlich ein „Verschieben“-Knopf zur Verfügung. Landet ein Block auf einem belegten Platz, rücken die anderen Blöcke des Tages automatisch nach.
- **In die nächste freie Lektion übertragen**: Eine Lektion, die nicht abgeschlossen werden konnte, lässt sich als Fortsetzung in die nächste freie Lektion derselben Woche übertragen – oder, falls die Woche voll ist, in die erste freie Lektion der nächsten Woche. Gibt es die nächste Woche noch nicht, wird sie dabei aus der oben gewählten Vorlage angelegt. Der ursprüngliche Block erhält den Status „übertragen“.
- **Status**: Jede Lektion hat einen Status (geplant, noch offen, erledigt), der auf einen Blick zeigt, wo noch etwas ansteht; „übertragen“ setzt die App beim Übertragen automatisch.
- **Entfernen**: Ein Block lässt sich jederzeit wieder löschen.

### Termine über Mittag und am Abend

In den gelben Zeitfenstern („Termin“) lassen sich Sitzungen, Elterngespräche, Elternabende, Weiterbildungen usw. planen. Ein Termin hat Titel, Stichworte, Ort, Traktanden/Notizen und **Teilnehmende** (Lehrpersonen per Häkchen). Ohne Auswahl gilt der Termin für das ganze Team; sonst sehen ihn in der persönlichen Ansicht nur die Teilnehmenden vollständig.

- **Termine bleiben unter sich**: Beim Verschieben oder Übertragen rücken Lektionen nur innerhalb der Unterrichtszeiten und Termine nur innerhalb der Termin-Zeitfenster – eine Lektion rutscht nie über Mittag oder in den Abend.
- **Einladung versenden**: Im Termin (in einer konkreten Woche, nicht in einer Vorlage) gibt es den Bereich „Einladung versenden“. „Per E-Mail einladen“ öffnet im eigenen Mailprogramm einen fertigen Entwurf mit Datum, Zeit, Ort, Teilnehmenden und Traktanden; Empfänger:innen (z. B. Eltern) können vorher eingetragen werden. „Kalenderdatei (.ics)“ speichert den Termin als Datei, die sich in der Mail anhängen oder direkt in Outlook, Google Kalender oder Apple Kalender importieren lässt. Es werden keine Mails über die App selbst verschickt – der Versand läuft über das eigene Mailprogramm.
- **Datenschutz**: Auch bei Elterngesprächen nur Kürzel verwenden (z. B. „Elterngespräch A04“). Eltern-Adressen werden nur für den Mail-Entwurf verwendet und nicht in der App gespeichert.

### Persönliche Ansicht und Gesamtansicht

Beim Start ist die persönliche Ansicht der angemeldeten Person gewählt: Eigene Lektionen (auch als Co-Lehrperson) und Lektionen mit der ganzen Klasse erscheinen vollständig, Lektionen anderer nur abgeschwächt mit Titel und dem Hinweis „nicht deine Lektion“. Über „Ansicht“ kann jede Person zur Gesamtansicht oder zur Ansicht einer anderen Lehrperson wechseln.

## Tagesfokus

Der Tagesfokus (auch per Klick auf einen Tageskopf im Wochenplan) zeigt den Tag als Zeitleiste und ergänzt ihn um Informationen, die für den ganzen Tag gelten. Er ist bearbeitbar, sobald die Woche angelegt ist:

- **Anwesenheit**: Welche Lehrpersonen an diesem Tag im Einsatz sind.
- **Tagesnotiz**: Ein freies Textfeld für Besonderheiten des Tages (z. B. Besuche, Raumwechsel, Absenzen).
- **Sitzungen**: Bis zu zwei Kurznotizen mit Uhrzeit und Titel pro Tag (für Termine ausserhalb der festen Zeitfenster). Sitzungen mit Teilnehmenden und Einladung werden im Wochenplan in den Mittag- und Abend-Zeitfenstern geplant.

## Drucken

Der Wochenplan lässt sich über „Drucken“ für Ablage oder Aushang ausdrucken (A4 quer, in der Regel zwei Seiten). Gedruckt wird die gewählte Ansicht – für den Aushang vorher auf „Gesamtansicht“ wechseln.

## Admin-Bereich (nur Koordination)

Im Admin-Bereich verwaltet die Koordination die Stammdaten des Teams:

- **Teamname** ändern.
- **Rollen** von Mitgliedern anpassen (Koordination / Lehrperson) – ein Team braucht immer mindestens eine Koordinationsperson.
- **Lehrperson verknüpfen**: Ein Teammitglied mit einem bestehenden Lehrpersonen-Eintrag verbinden.
- **Mitglieder entfernen**, die das Team verlassen haben.
- **Gruppen & Kürzel**: Klassen/Gruppen anlegen, benennen, farblich kennzeichnen und die Kinderkürzel pflegen.
- **Namen & Kürzel der Lehrpersonen**: Im Admin stehen die vollständigen Namen („Vorname Nachname“). Das Kürzel für den Wochenplan entsteht automatisch aus den Anfangsbuchstaben von Vor- und Nachname (Andrea Muster → AM), ist im Team eindeutig (bei Kollision z. B. AMu) und lässt sich im Feld neben dem Namen von Hand anpassen. Tritt eine Person mit ihrem vollständigen Namen bei, übernimmt sie ein per Vorname vorbereitetes Profil (z. B. „Andrea“) samt neuem Kürzel.
- **Lehrpersonen ohne Konto**: Lehrpersonen erfassen, die (noch) kein eigenes Login haben, damit sie trotzdem in der Planung erscheinen und Lektionen zugewiesen bekommen können. Lehrpersonen werden nicht gelöscht, sondern über das Häkchen deaktiviert.
- **Vorlagen bearbeiten**: Name, Bausteine (Klick auf ein Feld im Mini-Raster), Standard-Anwesenheit und Tagesnotiz pro Wochentag der bestehenden Vorlagen pflegen. Änderungen gelten für künftig angelegte Wochen, nicht für bereits bestehende. Neue Vorlagen lassen sich derzeit nicht anlegen.
- **Beitrittscode** kopieren oder neu erzeugen (der alte Code wird damit ungültig).
- **Backup**: Einen JSON-Export aller Team-Daten erstellen, z. B. zur Sicherung.

## Zusammenarbeit in Echtzeit

Wochenatelier ist für gleichzeitiges Arbeiten im Team gebaut: Änderungen, die eine Person macht, erscheinen sofort bei allen anderen. Eine Online-Anzeige zeigt, welche Teammitglieder gerade aktiv sind.

## Als App auf dem Gerät

Wochenatelier kann wie eine App auf dem Home-Bildschirm liegen – ohne App-Store, direkt aus dem Browser:

- **iPhone / iPad (Safari):** Seite öffnen → „Teilen“ → „Zum Home-Bildschirm“.
- **Android (Chrome):** Beim ersten Besuch erscheint unten ein Hinweis „Installieren“; sonst im Browsermenü „App installieren“ oder „Zum Startbildschirm hinzufügen“ wählen.
- **Computer (Chrome, Edge):** In der Adressleiste auf das Installations-Symbol klicken oder den Hinweis unten auf der Seite verwenden.

Die App-Hülle bleibt danach auch ohne Internet erreichbar. Zum Anmelden und für den gemeinsamen Plan braucht es aber eine Verbindung, da alle Daten beim Team-Server liegen. Erscheint der Hinweis „Eine neue Version ist bereit“, einmal auf „Jetzt aktualisieren“ tippen.

## Demo-Modus

Die Anwendung lässt sich ohne Konto und ohne Internetverbindung zum Server im Demo-Modus mit Beispieldaten ausprobieren. Die Demo-Daten werden nur lokal im Browser gespeichert und können jederzeit zurückgesetzt werden. Der Demo-Modus eignet sich zum Kennenlernen der Funktionen, nicht für die produktive Planung eines echten Teams.

## Datenschutz-Regeln

- Kinder werden in der Planung **ausschliesslich mit Kürzeln** erfasst (z. B. A01, B03) – nie mit vollständigen Namen.
- Es dürfen **keine Diagnosen, Fördermassnahmen oder anderen sensiblen persönlichen Angaben** in Notiz- oder Freitextfeldern erfasst werden.
- Die Daten werden auf einer Supabase-Infrastruktur in **Zürich** gespeichert.

## Häufige Fragen und Fehlerbehebung

**Ich habe keine Bestätigungs-E-Mail erhalten.**
Spam-Ordner prüfen, kurz warten und es später erneut versuchen. Der eingebaute Mailversand von Supabase ist auf ein begrenztes Volumen ausgelegt; bei wiederholten Problemen die technische Ansprechperson der Schule informieren.

**Mein Beitrittscode funktioniert nicht.**
Codes haben 8 Zeichen und werden ohne verwechselbare Zeichen (0/O, 1/I) erzeugt – Gross-/Kleinschreibung spielt keine Rolle. Bei der Koordination nachfragen, ob der Code noch gültig ist oder inzwischen erneuert wurde.

**Ich sehe die Lektionen einer Kollegin/eines Kollegen nicht.**
In der persönlichen Ansicht werden fremde Lektionen nur abgeschwächt mit Titel dargestellt. Zur Gesamtansicht wechseln, um alle Details zu sehen.

**Eine Woche wurde ohne die Vorlage angelegt.**
Eine bereits angelegte Woche lässt sich nicht nachträglich aus einer Vorlage befüllen. Fehlende Blöcke von Hand ergänzen (Klick auf „Planen“).

**Ich kann einen Block nicht verschieben.**
Ist der Zieltag bereits vollständig belegt, ist kein Platz mehr frei; zuerst einen anderen Block verschieben oder entfernen.

**Ich habe versehentlich einen Block gelöscht.**
Gelöschte Blöcke lassen sich nicht automatisch wiederherstellen. Bei wichtigen Ständen empfiehlt sich ein regelmässiges Backup über den Admin-Bereich (JSON-Export).

**Ich bin aus Versehen nicht mehr Koordination.**
Ein Team braucht immer mindestens eine Koordinationsperson; die letzte Koordinationsperson kann ihre Rolle nicht auf Lehrperson ändern und nicht aus dem Team entfernt werden. Bei Bedarf eine weitere Koordinationsperson bestimmen, bevor die Rolle gewechselt wird.
