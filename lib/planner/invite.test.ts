import assert from "node:assert/strict";
import { test } from "node:test";

import { buildIcs, icsFileName, inviteBody, inviteDetails, mailtoLink, sessionDate } from "./invite.ts";
import { makeSession, setParticipants } from "./logic.ts";
import type { Teacher } from "./types.ts";

const teachers: Teacher[] = [
  { id: "t1", name: "Andrea", initials: "AN", color: "#000", active: true, sortOrder: 0 },
  { id: "t2", name: "Dani", initials: "DA", color: "#000", active: true, sortOrder: 1 },
];

test("sessionDate: leitet das Datum aus Wochenstart und Wochentag ab", () => {
  assert.equal(sessionDate({ weekStart: "2026-09-14", day: "mo" }), "2026-09-14");
  assert.equal(sessionDate({ weekStart: "2026-09-14", day: "do" }), "2026-09-17");
  assert.equal(sessionDate({ weekStart: null, day: "do" }), null);
});

test("inviteDetails: Vorlagenbausteine haben kein Datum", () => {
  const s = makeSession({ day: "mo", slot: 8, templateId: "tpl" });
  assert.equal(inviteDetails(s, teachers), null);
});

test("inviteDetails: übernimmt Zeitfenster, Raum und Teilnehmende", () => {
  const s = makeSession({ day: "do", slot: 8, weekStart: "2026-09-14", title: "Elterngespräch A04", room: "Zimmer 12", focus: "Standortgespräch", assignments: setParticipants(["t2"]) });
  const d = inviteDetails(s, teachers);
  assert.deepEqual(d, {
    title: "Elterngespräch A04", date: "2026-09-17", start: "16:00", end: "17:00", room: "Zimmer 12",
    description: "Standortgespräch", participants: ["Dani"],
  });
});

test("inviteBody und mailtoLink: Angaben landen im Mailtext, Adressen werden getrennt", () => {
  const s = makeSession({ day: "mo", slot: 5, weekStart: "2026-09-14", title: "Stufensitzung", room: "Lehrerzimmer" });
  const d = inviteDetails(s, teachers)!;
  const body = inviteBody(d, "Kastanie");
  assert.match(body, /Montag, 14\. September 2026/);
  assert.match(body, /12:05–13:35 Uhr/);
  assert.match(body, /Ort: Lehrerzimmer/);
  const link = mailtoLink("a@schule.ch; b@schule.ch", "Einladung: Stufensitzung", body);
  assert.ok(link.startsWith("mailto:a@schule.ch,b@schule.ch?subject=Einladung%3A%20Stufensitzung&body="));
});

test("buildIcs: gültiger Kalendereintrag mit lokaler Zeit und maskierten Sonderzeichen", () => {
  const s = makeSession({ day: "mi", slot: 9, weekStart: "2026-09-14", title: "Elternabend; Klasse 3, 4", notes: "Zeile 1\nZeile 2" });
  const ics = buildIcs(inviteDetails(s, teachers)!, "abc", new Date("2026-09-01T10:00:00Z"));
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART:20260916T170000\r\n/);
  assert.match(ics, /DTEND:20260916T180000\r\n/);
  assert.match(ics, /SUMMARY:Elternabend\\; Klasse 3\\, 4\r\n/);
  assert.match(ics, /DESCRIPTION:Zeile 1\\nZeile 2\r\n/);
  assert.match(ics, /DTSTAMP:20260901T100000Z\r\n/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
  assert.equal(icsFileName(inviteDetails(s, teachers)!), "2026-09-16-elternabend-klasse-3-4.ics");
});
