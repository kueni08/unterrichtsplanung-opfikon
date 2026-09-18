import assert from "node:assert/strict";
import { test } from "node:test";

import { makeSession } from "./logic.ts";
import { checkReassignment, describeReassignments, effectiveGroupId, reassignmentWarnings, setReassignment } from "./reassign.ts";
import type { Child, Group } from "./types.ts";

const groups: Group[] = [
  { id: "g3", name: "3. Klasse", short: "3.", color: "#a", children: "AM, BK", sortOrder: 0 },
  { id: "g4", name: "4. Klasse", short: "4.", color: "#b", children: "CD", sortOrder: 1 },
];
const anna: Child = { id: "c1", firstName: "Anna", lastName: "Muster", short: "AM", groupId: "g3", active: true, sortOrder: 0 };

test("effectiveGroupId: Lektion vor Tag vor Stammgruppe", () => {
  assert.equal(effectiveGroupId(anna), "g3");
  assert.equal(effectiveGroupId(anna, { reassignments: [{ childId: "c1", groupId: "g4" }] }), "g4");
  assert.equal(effectiveGroupId(anna, { reassignments: [{ childId: "c1", groupId: "g4" }] }, { reassignments: [{ childId: "c1", groupId: "g3" }] }), "g3");
});

test("setReassignment: ein Kind hat höchstens eine Umteilung", () => {
  let list = setReassignment(undefined, "c1", "g4");
  list = setReassignment(list, "c1", "g4");
  assert.deepEqual(list, [{ childId: "c1", groupId: "g4" }]);
  assert.deepEqual(setReassignment(list, "c1", null), []);
});

test("checkReassignment: freie Gruppe blockiert, Stammgruppe ergibt Hinweis", () => {
  const s = makeSession({ day: "mo", slot: 0, assignments: [{ groupId: "g3", teacherId: "t" }, { groupId: "g4", teacherId: "", off: true }] });
  assert.equal(checkReassignment(anna, "g4", groups, s, null)?.severity, "error");
  assert.equal(checkReassignment(anna, "g3", groups, s, null)?.severity, "hint");
  const open = makeSession({ day: "mo", slot: 0, assignments: [{ groupId: "g3", teacherId: "t" }, { groupId: "g4", teacherId: "t" }] });
  assert.equal(checkReassignment(anna, "g4", groups, open, null), null);
  assert.equal(checkReassignment(undefined, "g4", groups, open, null)?.severity, "error");
  // Tagesumteilung nach g4 → Lektion nach g4 ist nur ein Hinweis
  assert.equal(checkReassignment(anna, "g4", groups, open, { reassignments: [{ childId: "c1", groupId: "g4" }] })?.severity, "hint");
});

test("reassignmentWarnings: Umteilung in freie Gruppe und doppelte Kürzel", () => {
  const s = makeSession({ day: "mo", slot: 0, title: "Mathe", assignments: [{ groupId: "g3", teacherId: "t" }, { groupId: "g4", teacherId: "", off: true }], reassignments: [{ childId: "c1", groupId: "g4" }] });
  assert.deepEqual(reassignmentWarnings([s], null, [anna], groups), ["Mathe: AM ist in 4. Klasse umgeteilt, die dort frei hat."]);
  const dup = [{ ...groups[0] }, { ...groups[1], children: "CD, am" }];
  assert.deepEqual(reassignmentWarnings([], null, [], dup), ["Kürzel AM steht in mehreren Gruppen (3. Klasse, 4. Klasse) – ein Kind kann nur in einer Gruppe sein."]);
  assert.deepEqual(describeReassignments(s.reassignments, [anna], groups), ["AM → 4."]);
});
