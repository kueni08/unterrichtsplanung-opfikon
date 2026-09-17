import assert from "node:assert/strict";
import { test } from "node:test";

import { filterSuggestions } from "./suggest.ts";

const kids = [
  { value: "PM", label: "Patrick Müller" }, { value: "PK", label: "Pascal Keller" }, { value: "AM", label: "Anna Muster" },
  { value: "SP", label: "Sophie Papadopoulos" }, { value: "JR", label: "José Rämi" },
];

test("filterSuggestions: „pa“ findet Patrick, Pascal und Papadopoulos, Wortanfänge zuerst", () => {
  assert.deepEqual(filterSuggestions(kids, "pa").map((s) => s.value), ["PM", "PK", "SP"]);
  assert.deepEqual(filterSuggestions(kids, "Ra").map((s) => s.value), ["JR"], "Akzente werden ignoriert");
  assert.deepEqual(filterSuggestions(kids, "ust").map((s) => s.value), ["AM"], "Teiltreffer");
  assert.deepEqual(filterSuggestions(kids, "", 2).map((s) => s.value), ["PM", "PK"], "leer: erste Einträge");
});
