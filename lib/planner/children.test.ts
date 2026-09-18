import assert from "node:assert/strict";
import { test } from "node:test";

import { childShort, makeChild, mergeImport, parseDelimited, rowsToChildren, splitFullName, syncGroupChildren } from "./children.ts";
import type { Child, Group } from "./types.ts";

const groups: Group[] = [
  { id: "g3", name: "3. Klasse", short: "3. Kl.", color: "#a", children: "A01, A02", sortOrder: 0 },
  { id: "g4", name: "4. Klasse", short: "4. Kl.", color: "#b", children: "", sortOrder: 1 },
];

test("childShort: Anfangsbuchstaben, eindeutig in der Liste", () => {
  const anna = makeChild({ firstName: "Anna", lastName: "Muster" });
  assert.equal(anna.short, "AM");
  assert.equal(childShort({ firstName: "Aron", lastName: "Meier" }, [anna]), "AMe");
});

test("rowsToChildren: erkennt Kopfzeile, geteilte Namensspalte und Gruppe", () => {
  assert.deepEqual(rowsToChildren([["Vorname", "Nachname", "Klasse"], ["Anna", "Muster", "3. Klasse"], ["", "", ""], ["Ben", "Keller", ""]]),
    [{ firstName: "Anna", lastName: "Muster", group: "3. Klasse" }, { firstName: "Ben", lastName: "Keller" }]);
  assert.deepEqual(rowsToChildren([["Name"], ["Anna Lena Muster"], ["Ben"]]),
    [{ firstName: "Anna Lena", lastName: "Muster" }, { firstName: "Ben", lastName: "" }]);
  assert.deepEqual(rowsToChildren([["Anna", "Muster"], ["Ben", "Keller"]]),
    [{ firstName: "Anna", lastName: "Muster" }, { firstName: "Ben", lastName: "Keller" }], "ohne Kopfzeile: erste zwei Spalten");
});

test("parseDelimited: Trennzeichen automatisch", () => {
  assert.deepEqual(parseDelimited("Vorname;Nachname\nAnna;Muster\r\nBen;\"Keller\"\n"), [["Vorname", "Nachname"], ["Anna", "Muster"], ["Ben", "Keller"]]);
  assert.deepEqual(parseDelimited("a,b\n1,2"), [["a", "b"], ["1", "2"]]);
});

test("mergeImport: überspringt vorhandene Namen, ordnet Gruppe per Name zu", () => {
  const existing = [makeChild({ firstName: "Anna", lastName: "Muster" })];
  const added = mergeImport(existing, [{ firstName: "anna", lastName: "MUSTER" }, { firstName: "Ben", lastName: "Keller", group: "4. Klasse" }, { firstName: "Cem", lastName: "Aydin", group: "unbekannt" }], groups);
  assert.deepEqual(added.map((c) => [c.firstName, c.groupId]), [["Ben", "g4"], ["Cem", null]]);
  assert.equal(added[0].short, "BK");
});

test("syncGroupChildren: spiegelt Kürzel nur in Gruppen mit Kindern aus der Stammliste", () => {
  const kids: Child[] = [
    makeChild({ id: "1", firstName: "Anna", lastName: "Muster", groupId: "g4" }),
    makeChild({ id: "2", firstName: "Ben", lastName: "Keller", groupId: "g4", sortOrder: 1 }),
  ];
  const changed = syncGroupChildren(groups, kids);
  assert.deepEqual(changed.map((g) => [g.id, g.children]), [["g4", "AM, BK"]], "3. Klasse mit fremden Kürzeln bleibt unangetastet");
  // Kind aus der Gruppe entfernt → Spiegel wird geleert
  const g4 = { ...groups[1], children: "AM, BK" };
  const after = syncGroupChildren([groups[0], g4], kids.map((c) => ({ ...c, groupId: null })));
  assert.deepEqual(after.map((g) => [g.id, g.children]), [["g4", ""]]);
});

test("rowsToChildren: ganzer Name in einer Spalte wird auch ohne Kopfzeile geteilt", () => {
  assert.deepEqual(rowsToChildren(parseDelimited(["Anna Muster", "Beat Meier"].join(String.fromCharCode(10)))),
    [{ firstName: "Anna", lastName: "Muster" }, { firstName: "Beat", lastName: "Meier" }]);
  assert.deepEqual(rowsToChildren([["Name", "Klasse"], ["Muster, Anna", "3a"]]),
    [{ firstName: "Anna", lastName: "Muster", group: "3a" }]);
  assert.deepEqual(rowsToChildren([["Anna-Lena Meier Huber"]]),
    [{ firstName: "Anna-Lena Meier", lastName: "Huber" }]);
  // ein einzelnes Wort bleibt Vorname
  assert.deepEqual(rowsToChildren([["Ben"]]), [{ firstName: "Ben", lastName: "" }]);
});

test("splitFullName: Komma-Form und Leerzeichen-Form", () => {
  assert.deepEqual(splitFullName("Muster, Anna"), { firstName: "Anna", lastName: "Muster" });
  assert.deepEqual(splitFullName("  Anna   Muster "), { firstName: "Anna", lastName: "Muster" });
  assert.deepEqual(splitFullName(""), { firstName: "", lastName: "" });
});
