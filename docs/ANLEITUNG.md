# Anleitung für Lehrpersonen und Koordination

Diese Anleitung beschreibt die Bedienung von Wochenatelier – der digitalen Wochenplanung für Teamteaching an der Schule Opfikon.

## Einstieg

### Registrieren und Anmelden

Beim ersten Besuch registriert man sich mit E-Mail-Adresse und Passwort. Nach der Registrierung schickt Supabase eine Bestätigungs-E-Mail; der Link darin muss angeklickt werden, bevor die Anmeldung funktioniert. Danach meldet man sich mit E-Mail und Passwort an.

### E-Mail bestätigen

Ohne bestätigte E-Mail-Adresse ist keine Anmeldung möglich. Falls die Bestätigungs-E-Mail nicht ankommt: Spam-Ordner prüfen, ein paar Minuten abwarten (der eingebaute Mailversand von Supabase ist mengenmässig begrenzt) und bei anhaltenden Problemen die Koordination oder die technische Ansprechperson kontaktieren.

### Passwort vergessen

Über den Link „Passwort vergessen“ auf der Anmeldeseite lässt sich ein Rücksetzlink per E-Mail anfordern. Mit diesem Link kann ein neues Passwort gesetzt werden.

### Team gründen oder beitreten

Nach der ersten Anmeldung gibt es zwei Möglichkeiten:

- **Team gründen**: Wer ein neues Team erstellt, wird automatisch **Koordination** dieses Teams.
- **Team beitreten**: Mit einem Beitrittscode, den die Koordination im Admin-Bereich weitergibt, tritt man einem bestehenden Team als **Lehrperson** bei.

Den Beitrittscode findet die Koordination im Admin-Bereich und kann ihn dort bei Bedarf auch neu erzeugen (z. B. wenn er versehentlich weitergegeben wurde).

### Einführungstour

Über den Knopf mit dem Fragezeichen lässt sich jederzeit eine kurze Einführungstour durch die wichtigsten Bereiche der Anwendung starten.

## Wochenplan

Der Wochenplan zeigt die Lektionen einer Woche, aufgeteilt nach Wochentag und Zeitfenster.

- **Woche aus Vorlage übernehmen**: Eine leere Woche lässt sich mit einem Klick aus einer bestehenden Vorlage (z. B. „Regelwoche“) befüllen.
- **Lektion hinzufügen**: In einem freien Zeitfenster eine neue Lektion anlegen.
- **Block bearbeiten**: Titel, Stichworte, Raum, Notizen, Kinderkürzel und Zuständigkeiten pro Gruppe anpassen.
- **Verschieben**: Ein Block lässt sich per Drag & Drop auf ein anderes Zeitfenster ziehen. Auf Tablets und Touch-Geräten steht dafür zusätzlich ein „Verschieben“-Knopf zur Verfügung. Landet ein Block auf einem belegten Platz, rücken die anderen Blöcke des Tages automatisch nach.
- **In die nächste freie Lektion übertragen**: Eine Lektion, die nicht abgeschlossen werden konnte, lässt sich als Fortsetzung in die nächste freie Lektion derselben Woche übertragen – oder, falls die Woche voll ist, in die nächste Woche. Der ursprüngliche Block erhält dabei den Status „übertragen“.
- **Status**: Jede Lektion hat einen Status (geplant, offen, erledigt, übertragen), der auf einen Blick zeigt, wo noch etwas ansteht.
- **Entfernen**: Ein Block lässt sich jederzeit wieder löschen.

### Persönliche Ansicht und Gesamtansicht

In der persönlichen Ansicht werden die eigenen Lektionen hervorgehoben dargestellt; Lektionen anderer Lehrpersonen erscheinen abgeschwächt. Die Koordination kann zwischen der persönlichen Ansicht und der Gesamtansicht mit allen Gruppen wechseln.

## Tagesfokus

Der Tagesfokus ergänzt den Wochenplan um Informationen, die für den ganzen Tag gelten:

- **Anwesenheit**: Welche Lehrpersonen an diesem Tag im Einsatz sind.
- **Tagesnotiz**: Ein freies Textfeld für Besonderheiten des Tages (z. B. Besuche, Raumwechsel, Absenzen).
- **Sitzungen**: Bis zu zwei Sitzungen mit Uhrzeit und Titel pro Tag.

## Drucken

Der Wochenplan lässt sich für die Ablage oder Aushang ausdrucken (Ausrichtung Querformat, Format A4).

## Admin-Bereich (nur Koordination)

Im Admin-Bereich verwaltet die Koordination die Stammdaten des Teams:

- **Teamname** ändern.
- **Rollen** von Mitgliedern anpassen (Koordination / Lehrperson) – ein Team braucht immer mindestens eine Koordinationsperson.
- **Lehrperson verknüpfen**: Ein Teammitglied mit einem bestehenden Lehrpersonen-Eintrag verbinden.
- **Mitglieder entfernen**, die das Team verlassen haben.
- **Gruppen & Kürzel**: Klassen/Gruppen anlegen, benennen, farblich kennzeichnen und die Kinderkürzel pflegen.
- **Lehrpersonen ohne Konto**: Lehrpersonen erfassen, die (noch) kein eigenes Login haben, damit sie trotzdem in der Planung erscheinen und Lektionen zugewiesen bekommen können.
- **Vorlagen bearbeiten**: Wochenvorlagen als wiederverwendbare Bausteine pflegen.
- **Backup**: Einen JSON-Export aller Team-Daten erstellen, z. B. zur Sicherung.

## Zusammenarbeit in Echtzeit

Wochenatelier ist für gleichzeitiges Arbeiten im Team gebaut: Änderungen, die eine Person macht, erscheinen sofort bei allen anderen. Eine Online-Anzeige zeigt, welche Teammitglieder gerade aktiv sind.

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
Codes werden ohne verwechselbare Zeichen (0/O, 1/I) erzeugt – Gross-/Kleinschreibung spielt keine Rolle. Bei der Koordination nachfragen, ob der Code noch gültig ist oder inzwischen erneuert wurde.

**Ich sehe die Lektionen einer Kollegin/eines Kollegen nicht.**
In der persönlichen Ansicht werden fremde Lektionen abgeschwächt dargestellt, nicht ausgeblendet. Zur Gesamtansicht wechseln, um alle Lektionen gleich stark zu sehen.

**Ich kann einen Block nicht verschieben.**
Ist der Zieltag bereits vollständig belegt, ist kein Platz mehr frei; zuerst einen anderen Block verschieben oder entfernen.

**Ich habe versehentlich einen Block gelöscht.**
Gelöschte Blöcke lassen sich nicht automatisch wiederherstellen. Bei wichtigen Ständen empfiehlt sich ein regelmässiges Backup über den Admin-Bereich (JSON-Export).

**Ich bin aus Versehen nicht mehr Koordination.**
Ein Team braucht immer mindestens eine Koordinationsperson; die letzte Koordinationsperson kann ihre Rolle nicht auf Lehrperson ändern und nicht aus dem Team entfernt werden. Bei Bedarf eine weitere Koordinationsperson bestimmen, bevor die Rolle gewechselt wird.
