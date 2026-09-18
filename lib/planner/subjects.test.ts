import assert from "node:assert/strict";
import { test } from "node:test";

import { subjectStyle, subjectStyles } from "./subjects.ts";

test("subjectStyle: erkennt Fächer über Stichwörter", () => {
  assert.equal(subjectStyle("Englisch").flag, "gb");
  assert.equal(subjectStyle("Französisch F.bank").flag, "fr");
  assert.equal(subjectStyle("Mathe Kreis+").name, "Mathe");
  assert.equal(subjectStyle("NMG").icon, "🌍");
  assert.equal(subjectStyle("Schwimmen").name, "Schwimmen", "Schwimmen vor Sport");
});

test("subjectStyle: unbekannte Fächer bekommen stabile Farbe und Buchstaben", () => {
  const a = subjectStyle("Zaubertränke");
  assert.equal(a.icon, "Z");
  assert.equal(a.color, subjectStyle("Zaubertränke").color);
  assert.equal(subjectStyle("Verteidigung gegen").icon, "VG");
});

test("subjectStyles: mehrere Fächer ohne Doppelungen, begrenzt", () => {
  const s = subjectStyles(["Englisch", "Englisch", "Französisch", "Mathe"]);
  assert.deepEqual(s.map((x) => x.name), ["Englisch", "Französisch"]);
});
