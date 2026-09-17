import test from "node:test";
import assert from "node:assert/strict";

import { carryForwardTarget, makeSession, pickFields, weekFromTemplate } from "./logic.ts";
import { buildStarterContent } from "./demo.ts";
import { sessionPatchToRow, sessionPositionRow, sessionToRow, translateError } from "./supabase-backend.ts";
import type { Session } from "./types.ts";

test("sessionPatchToRow: only the changed fields become columns", () => {
  assert.deepEqual(sessionPatchToRow({ title: "Mathe" }), { title: "Mathe" });
  assert.deepEqual(sessionPatchToRow({ wholeClass: true, status: "carried" }), { whole_class: true, status: "carried" });
  assert.deepEqual(sessionPatchToRow({ assignments: [{ groupId: "g", teacherId: "t" }] }), { assignments: [{ groupId: "g", teacherId: "t" }] });
});

test("sessionPatchToRow: applies the same length limits as full rows and ignores non-patchable keys", () => {
  const row = sessionPatchToRow({ title: "x".repeat(300), id: "other", weekStart: "2026-01-05" });
  assert.deepEqual(Object.keys(row), ["title"]);
  assert.equal((row.title as string).length, 120);
});

test("sessionPositionRow: carries only identity and position (content stays untouched on upsert)", () => {
  const s = makeSession({ day: "di", slot: 3, weekStart: "2026-09-14", title: "Deutsch", notes: "geheim" });
  assert.deepEqual(sessionPositionRow(s, "team"), { id: s.id, team_id: "team", week_start: "2026-09-14", template_id: null, day: "di", slot: 3 });
  assert.equal(sessionToRow(s, "team").notes, "geheim");
});

test("pickFields picks only the requested keys", () => {
  assert.deepEqual(pickFields({ a: 1, b: 2, c: 3 }, ["a", "c"] as const), { a: 1, c: 3 });
});

test("translateError maps database and network errors to German messages", () => {
  assert.match(translateError("conflicting key value violates exclusion constraint \"session_week_slot_unique\""), /Platz/);
  assert.match(translateError("new row violates row-level security policy"), /Berechtigungen/);
  assert.match(translateError("TypeError: Load failed"), /Verbindung/);
  assert.match(translateError("Woche nicht gefunden"), /Woche/);
  assert.equal(translateError("etwas anderes"), "etwas anderes");
});

test("weekFromTemplate: clones the chosen template with its day defaults, falls back to the first template", () => {
  const content = buildStarterContent([]);
  const [main, project] = content.templates;
  const chosen = weekFromTemplate(content.sessions, content.templates, content.teachers, project.id, "2026-09-21");
  assert.equal(chosen.sessions.length, content.sessions.filter((s) => s.templateId === project.id).length);
  assert.ok(chosen.sessions.every((s) => s.weekStart === "2026-09-21" && s.templateId === null));
  const fallback = weekFromTemplate(content.sessions, content.templates, content.teachers, "unbekannt", "2026-09-21");
  assert.equal(fallback.sessions.length, content.sessions.filter((s) => s.templateId === main.id).length);
  assert.deepEqual(fallback.days.mo.attendance.length, 3);
  const empty = weekFromTemplate([], [], content.teachers, null, "2026-09-21");
  assert.equal(empty.sessions.length, 0);
  assert.equal(empty.days.fr.attendance.length, content.teachers.length);
});

test("carry forward into a not-yet-created week lands on a free slot of the template-based week", () => {
  const content = buildStarterContent([]);
  const main = content.templates[0];
  const thisWeek = weekFromTemplate(content.sessions, content.templates, content.teachers, main.id, "2026-09-14").sessions;
  // diese Woche komplett voll machen
  const filler: Session[] = [];
  for (const day of ["mo", "di", "mi", "do", "fr"] as const) {
    for (let slot = 0; slot < 7; slot += 1) {
      if (!thisWeek.some((s) => s.day === day && s.slot === slot)) filler.push(makeSession({ day, slot, weekStart: "2026-09-14" }));
    }
  }
  const all = [...content.sessions, ...thisWeek, ...filler];
  const last = thisWeek.find((s) => s.day === "fr" && s.slot === 6)!;
  const naive = carryForwardTarget(all, last, "2026-09-21");
  assert.deepEqual(naive, { weekStart: "2026-09-21", day: "mo", slot: 0 }, "ohne Folgewoche wäre Mo 1. Lektion frei");
  const next = weekFromTemplate(all, content.templates, content.teachers, main.id, "2026-09-21").sessions;
  const target = carryForwardTarget([...all, ...next], last, "2026-09-21");
  assert.ok(target);
  assert.equal(target.weekStart, "2026-09-21");
  assert.ok(!next.some((s) => s.day === target.day && s.slot === target.slot), "Ziel kollidiert nicht mit dem Stundenplan");
});
