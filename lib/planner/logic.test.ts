import test from "node:test";
import assert from "node:assert/strict";

import { DAYS, SLOTS } from "./constants.ts";
import type { DayKey, Group, Session, Teacher } from "./types.ts";
import {
  carryForwardTarget,
  cloneTemplateToWeek,
  countChildren,
  daysFromTemplate,
  deriveTitle,
  initialsFrom,
  isVisibleFor,
  normalizeDays,
  planningWarnings,
  reorderSessions,
  sessionTeacherIds,
  setAssignment,
} from "./logic.ts";
import { buildDemoSnapshot, buildStarterContent, DEMO_USERS } from "./demo.ts";

let nextTestId = 0;
function makeSession(id: string, day: DayKey, slot: number, overrides: Partial<Session> = {}): Session {
  return {
    id,
    weekStart: null,
    templateId: null,
    day,
    slot,
    title: id,
    focus: "",
    room: "",
    notes: "",
    children: "",
    wholeClass: false,
    status: "planned",
    assignments: [],
    ...overrides,
  };
}

function makeTeacher(overrides: Partial<Teacher> = {}): Teacher {
  nextTestId += 1;
  return {
    id: `t${nextTestId}`,
    name: `Teacher ${nextTestId}`,
    initials: "TT",
    color: "#000000",
    active: true,
    sortOrder: nextTestId,
    ...overrides,
  };
}

function makeGroup(overrides: Partial<Group> = {}): Group {
  nextTestId += 1;
  return {
    id: `g${nextTestId}`,
    name: `Group ${nextTestId}`,
    short: `G${nextTestId}`,
    color: "#ffffff",
    children: "",
    sortOrder: nextTestId,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// reorderSessions
// ---------------------------------------------------------------------------

test("reorderSessions: no-op when dropped on its own spot", () => {
  const container = [makeSession("a", "mo", 0)];
  const result = reorderSessions(container, "a", "mo", 0);
  assert.equal(result.moved, false);
  assert.deepEqual(result.changed, []);
});

test("reorderSessions: move within a day downward shifts blocks in between up to fill the gap", () => {
  const container = [makeSession("a", "mo", 0), makeSession("b", "mo", 1), makeSession("c", "mo", 2)];
  const result = reorderSessions(container, "a", "mo", 2);
  assert.equal(result.moved, true);
  const byId = new Map(result.changed.map((s) => [s.id, s]));
  assert.equal(byId.get("b")?.slot, 0);
  assert.equal(byId.get("c")?.slot, 1);
  assert.equal(byId.get("a")?.slot, 2);
  assert.equal(byId.get("a")?.day, "mo");
});

test("reorderSessions: move within a day upward shifts blocks in between down", () => {
  const container = [makeSession("a", "mo", 0), makeSession("b", "mo", 1), makeSession("c", "mo", 2)];
  const result = reorderSessions(container, "c", "mo", 0);
  assert.equal(result.moved, true);
  const byId = new Map(result.changed.map((s) => [s.id, s]));
  assert.equal(byId.get("a")?.slot, 1);
  assert.equal(byId.get("b")?.slot, 2);
  assert.equal(byId.get("c")?.slot, 0);
});

test("reorderSessions: move to another day into a free slot only changes the dragged block", () => {
  const container = [makeSession("a", "mo", 0)];
  const result = reorderSessions(container, "a", "di", 3);
  assert.equal(result.moved, true);
  assert.equal(result.changed.length, 1);
  assert.equal(result.changed[0].id, "a");
  assert.equal(result.changed[0].day, "di");
  assert.equal(result.changed[0].slot, 3);
});

test("reorderSessions: move to another day into an occupied slot shifts later blocks forward", () => {
  const container = [makeSession("a", "mo", 0), makeSession("d", "di", 2), makeSession("e", "di", 3)];
  const result = reorderSessions(container, "a", "di", 2);
  assert.equal(result.moved, true);
  const byId = new Map(result.changed.map((s) => [s.id, s]));
  assert.equal(byId.get("d")?.slot, 3);
  assert.equal(byId.get("e")?.slot, 4);
  assert.equal(byId.get("a")?.slot, 2);
  assert.equal(byId.get("a")?.day, "di");
});

test("reorderSessions: dropping into a nearly full day shifts earlier blocks backward when there is no room after", () => {
  // di is occupied at slots 1..7 (7 of 8 slots), slot 0 is free.
  const container: Session[] = [makeSession("a", "mo", 0)];
  for (let slot = 1; slot < SLOTS.length; slot += 1) container.push(makeSession(`x${slot}`, "di", slot));
  const result = reorderSessions(container, "a", "di", 4);
  assert.equal(result.moved, true);
  const byId = new Map(result.changed.map((s) => [s.id, s]));
  // slots 1,2,3,4 shift back by one to make room at slot 4; slots 5,6,7 are untouched.
  assert.equal(byId.get("x1")?.slot, 0);
  assert.equal(byId.get("x2")?.slot, 1);
  assert.equal(byId.get("x3")?.slot, 2);
  assert.equal(byId.get("x4")?.slot, 3);
  assert.equal(byId.get("a")?.slot, 4);
  assert.equal(byId.has("x5"), false);
  assert.equal(byId.has("x6"), false);
  assert.equal(byId.has("x7"), false);
});

test("reorderSessions: dropping into a completely full day fails (moved: false)", () => {
  const container: Session[] = [makeSession("a", "mo", 0)];
  for (let slot = 0; slot < SLOTS.length; slot += 1) container.push(makeSession(`x${slot}`, "di", slot));
  const result = reorderSessions(container, "a", "di", 3);
  assert.equal(result.moved, false);
  assert.deepEqual(result.changed, []);
});

// ---------------------------------------------------------------------------
// carryForwardTarget
// ---------------------------------------------------------------------------

function allPositions(): { day: DayKey; slot: number }[] {
  return DAYS.flatMap((d) => SLOTS.map((_, slot) => ({ day: d.id, slot })));
}

test("carryForwardTarget: returns the next free slot later in the same week", () => {
  const week1 = "2026-09-14";
  const session = makeSession("a", "mo", 0, { weekStart: week1 });
  const result = carryForwardTarget([session], session, "2026-09-21");
  assert.deepEqual(result, { weekStart: week1, day: "mo", slot: 1 });
});

test("carryForwardTarget: skips occupied slots later in the same week", () => {
  const week1 = "2026-09-14";
  const session = makeSession("a", "mo", 0, { weekStart: week1 });
  const occupyMo1 = makeSession("b", "mo", 1, { weekStart: week1 });
  const result = carryForwardTarget([session, occupyMo1], session, "2026-09-21");
  assert.deepEqual(result, { weekStart: week1, day: "mo", slot: 2 });
});

test("carryForwardTarget: when the current week is full, finds the first FREE slot next week (skipping occupied ones)", () => {
  const week1 = "2026-09-14";
  const week2 = "2026-09-21";
  // Session sits at the very last position of week1 (fr, last slot) so every
  // remaining position "later in the same week" is exhausted immediately —
  // but we additionally fill the rest of week1 to be explicit/robust.
  const session = makeSession("a", "mo", SLOTS.length - 1, { weekStart: week1 });
  const restOfWeek1: Session[] = [session];
  for (const pos of allPositions()) {
    if (pos.day === "mo") continue; // "mo" only contains the session itself (last slot).
    restOfWeek1.push(makeSession(`fill-${pos.day}-${pos.slot}`, pos.day, pos.slot, { weekStart: week1 }));
  }
  // Occupy the first three slots of next week, leave the fourth (mo, slot 3) free.
  const week2Occupied = [
    makeSession("n0", "mo", 0, { weekStart: week2 }),
    makeSession("n1", "mo", 1, { weekStart: week2 }),
    makeSession("n2", "mo", 2, { weekStart: week2 }),
  ];
  const all = [...restOfWeek1, ...week2Occupied];
  const result = carryForwardTarget(all, session, week2);
  assert.deepEqual(result, { weekStart: week2, day: "mo", slot: 3 });
});

test("carryForwardTarget: returns null when both weeks are completely full", () => {
  const week1 = "2026-09-14";
  const week2 = "2026-09-21";
  const session = makeSession("a", "mo", SLOTS.length - 1, { weekStart: week1 });
  const week1Rest: Session[] = [session];
  for (const pos of allPositions()) {
    if (pos.day === "mo") continue; // "mo" only contains the session itself (last slot).
    week1Rest.push(makeSession(`fill1-${pos.day}-${pos.slot}`, pos.day, pos.slot, { weekStart: week1 }));
  }
  const week2Full = allPositions().map((pos) => makeSession(`fill2-${pos.day}-${pos.slot}`, pos.day, pos.slot, { weekStart: week2 }));
  const all = [...week1Rest, ...week2Full];
  const result = carryForwardTarget(all, session, week2);
  assert.equal(result, null);
});

test("carryForwardTarget: returns null for a template session (no weekStart)", () => {
  const session = makeSession("a", "mo", 0, { weekStart: null, templateId: "tmpl-1" });
  const result = carryForwardTarget([session], session, "2026-09-21");
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// planningWarnings
// ---------------------------------------------------------------------------

test("planningWarnings: flags an open (unassigned) group", () => {
  const teachers = [makeTeacher(), makeTeacher(), makeTeacher()];
  const groups = [makeGroup()];
  const session = makeSession("s1", "mo", 0, { title: "Testlektion", assignments: [] });
  const warnings = planningWarnings([session], groups, teachers);
  assert.deepEqual(warnings, ["Testlektion: Zuständigkeit noch offen."]);
});

test("planningWarnings: flags the same teacher teaching two groups different subjects", () => {
  const teachers = [makeTeacher(), makeTeacher(), makeTeacher()];
  const groups = [makeGroup(), makeGroup()];
  const session = makeSession("s1", "mo", 0, {
    title: "Testlektion",
    assignments: [
      { groupId: groups[0].id, teacherId: teachers[0].id, subject: "Englisch" },
      { groupId: groups[1].id, teacherId: teachers[0].id, subject: "Mathe" },
    ],
  });
  const warnings = planningWarnings([session], groups, teachers);
  assert.deepEqual(warnings, ["Testlektion: Eine Lehrperson ist gleichzeitig mehreren Gruppen mit unterschiedlichem Unterricht zugeteilt."]);
});

test("planningWarnings: same teacher, same subject for two groups (gemeinsamer Unterricht) is fine", () => {
  const teachers = [makeTeacher(), makeTeacher(), makeTeacher()];
  const groups = [makeGroup(), makeGroup()];
  const session = makeSession("s1", "mo", 0, {
    title: "Sport",
    assignments: [
      { groupId: groups[0].id, teacherId: teachers[0].id, subject: "Sport" },
      { groupId: groups[1].id, teacherId: teachers[0].id, subject: "Sport" },
    ],
  });
  assert.deepEqual(planningWarnings([session], groups, teachers), []);
});

test("planningWarnings: groups marked off need no teacher", () => {
  const teachers = [makeTeacher(), makeTeacher(), makeTeacher()];
  const groups = [makeGroup(), makeGroup()];
  const session = makeSession("s1", "mo", 0, {
    title: "M&I",
    assignments: [
      { groupId: groups[0].id, teacherId: "", off: true },
      { groupId: groups[1].id, teacherId: teachers[1].id, subject: "M&I" },
    ],
  });
  assert.deepEqual(planningWarnings([session], groups, teachers), []);
});

test("isVisibleFor / sessionTeacherIds consider co-teachers and ignore free groups", () => {
  const session = makeSession("s1", "mo", 0, {
    assignments: [
      { groupId: "g1", teacherId: "a", coTeacherId: "b" },
      { groupId: "g2", teacherId: "c", off: true },
    ],
  });
  assert.equal(isVisibleFor(session, "b"), true);
  assert.equal(isVisibleFor(session, "c"), false);
  assert.deepEqual(sessionTeacherIds(session), ["a", "b"]);
});

test("deriveTitle and setAssignment", () => {
  const list = setAssignment([{ groupId: "g1", teacherId: "a", subject: "Englisch" }], "g2", { teacherId: "b", subject: "Französisch", room: "" });
  assert.deepEqual(list.find((a) => a.groupId === "g2"), { groupId: "g2", teacherId: "b", subject: "Französisch" });
  assert.equal(deriveTitle(list, "x"), "Englisch · Französisch");
  assert.equal(deriveTitle([{ groupId: "g1", teacherId: "", off: true }], "Fallback"), "Fallback");
  const off = setAssignment(list, "g1", { off: true });
  assert.equal(off.find((a) => a.groupId === "g1")?.off, true);
  const on = setAssignment(off, "g1", { off: false });
  assert.equal("off" in (on.find((a) => a.groupId === "g1") ?? {}), false);
});

test("daysFromTemplate keeps attendance of known teachers only", () => {
  const t1 = makeTeacher();
  const days = daysFromTemplate({ mo: { attendance: [t1.id, "unknown"], note: "Hinweis", meetings: [] } }, [t1]);
  assert.deepEqual(days.mo.attendance, [t1.id]);
  assert.equal(days.mo.note, "Hinweis");
  assert.deepEqual(days.di.attendance, [t1.id]);
});

test("planningWarnings: flags an assigned teacher who is inactive", () => {
  const inactive = makeTeacher({ active: false });
  const teachers = [makeTeacher(), makeTeacher(), makeTeacher(), inactive];
  const groups = [makeGroup(), makeGroup()];
  const session = makeSession("s1", "mo", 0, {
    title: "Testlektion",
    assignments: [
      { groupId: groups[0].id, teacherId: teachers[0].id },
      { groupId: groups[1].id, teacherId: inactive.id },
    ],
  });
  const warnings = planningWarnings([session], groups, teachers);
  assert.deepEqual(warnings, ["Testlektion: Eine zugeteilte Lehrperson ist nicht aktiv."]);
});

test("planningWarnings: flags fewer than three active teachers", () => {
  const teachers = [makeTeacher(), makeTeacher({ active: false })];
  const warnings = planningWarnings([], [], teachers);
  assert.deepEqual(warnings, ["Mindestens drei aktive Lehrpersonen sind vorgesehen."]);
});

test("planningWarnings: ignores wholeClass sessions entirely", () => {
  const teachers = [makeTeacher(), makeTeacher(), makeTeacher()];
  const groups = [makeGroup(), makeGroup()];
  const session = makeSession("s1", "mo", 0, {
    title: "Testlektion",
    wholeClass: true,
    // Deliberately "broken" assignments that would normally trigger warnings.
    assignments: [
      { groupId: groups[0].id, teacherId: "" },
      { groupId: groups[1].id, teacherId: "" },
    ],
  });
  const warnings = planningWarnings([session], groups, teachers);
  assert.deepEqual(warnings, []);
});

// ---------------------------------------------------------------------------
// countChildren
// ---------------------------------------------------------------------------

test("countChildren: sums comma-separated child codes, trimming and ignoring blanks", () => {
  const groups = [
    makeGroup({ children: "A01, A02, A03" }),
    makeGroup({ children: "" }),
    makeGroup({ children: "B01,  ,B02" }),
  ];
  assert.equal(countChildren(groups), 5);
});

// ---------------------------------------------------------------------------
// initialsFrom
// ---------------------------------------------------------------------------

test("initialsFrom: builds initials from first and last name", () => {
  assert.equal(initialsFrom("Mira Frei"), "MF");
});

test("initialsFrom: falls back to first two letters of a single name", () => {
  assert.equal(initialsFrom("Mira"), "MI");
});

test("initialsFrom: returns '?' for an empty/blank name", () => {
  assert.equal(initialsFrom(""), "?");
  assert.equal(initialsFrom("   "), "?");
});

// ---------------------------------------------------------------------------
// normalizeDays
// ---------------------------------------------------------------------------

test("normalizeDays: fills in missing days with the default (active-teacher attendance)", () => {
  const active = makeTeacher();
  const inactive = makeTeacher({ active: false });
  const teachers = [active, inactive];
  const raw = { mo: { attendance: ["x"], meetings: [] } };
  const result = normalizeDays(raw, teachers);
  for (const day of DAYS) {
    if (day.id === "mo") continue;
    assert.deepEqual(result[day.id].attendance, [active.id]);
    assert.equal(result[day.id].note, "");
    assert.deepEqual(result[day.id].meetings, []);
  }
});

test("normalizeDays: caps meetings at 2 and keeps provided attendance/note", () => {
  const teachers = [makeTeacher()];
  const raw = {
    mo: {
      attendance: ["a", "b"],
      note: "Hinweis",
      meetings: [
        { time: "08:00", title: "eins" },
        { time: "09:00", title: "zwei" },
        { time: "10:00", title: "drei" },
      ],
    },
  };
  const result = normalizeDays(raw, teachers);
  assert.equal(result.mo.meetings.length, 2);
  assert.deepEqual(result.mo.meetings, [
    { time: "08:00", title: "eins" },
    { time: "09:00", title: "zwei" },
  ]);
  assert.deepEqual(result.mo.attendance, ["a", "b"]);
  assert.equal(result.mo.note, "Hinweis");
});

test("normalizeDays: filters out non-string attendance entries", () => {
  const teachers = [makeTeacher()];
  const raw = { di: { attendance: ["a", 5, "b", null] } } as unknown;
  const result = normalizeDays(raw, teachers);
  assert.deepEqual(result.di.attendance, ["a", "b"]);
});

// ---------------------------------------------------------------------------
// cloneTemplateToWeek
// ---------------------------------------------------------------------------

test("cloneTemplateToWeek: assigns new ids, sets weekStart, clears templateId, resets status to planned", () => {
  const template = [
    makeSession("tpl-1", "mo", 0, { templateId: "tmpl-A", status: "done", assignments: [{ groupId: "g1", teacherId: "t1" }] }),
    makeSession("tpl-2", "di", 1, { templateId: "tmpl-A", status: "open" }),
  ];
  const cloned = cloneTemplateToWeek(template, "2026-09-14");
  assert.equal(cloned.length, 2);
  for (const [i, s] of cloned.entries()) {
    assert.notEqual(s.id, template[i].id);
    assert.equal(s.weekStart, "2026-09-14");
    assert.equal(s.templateId, null);
    assert.equal(s.status, "planned");
    assert.equal(s.day, template[i].day);
    assert.equal(s.slot, template[i].slot);
  }
  const ids = new Set(cloned.map((s) => s.id));
  assert.equal(ids.size, cloned.length);
  // Assignments are deep-copied, not shared references.
  cloned[0].assignments[0].teacherId = "changed";
  assert.equal(template[0].assignments[0].teacherId, "t1");
});

// ---------------------------------------------------------------------------
// demo.ts: buildStarterContent / buildDemoSnapshot
// ---------------------------------------------------------------------------

test("buildStarterContent: sessions never collide on (day, slot) within the same template", () => {
  const { sessions } = buildStarterContent([]);
  const seen = new Map<string, Set<string>>();
  for (const s of sessions) {
    const key = String(s.templateId);
    const slotKey = `${s.day}-${s.slot}`;
    if (!seen.has(key)) seen.set(key, new Set());
    const set = seen.get(key)!;
    assert.equal(set.has(slotKey), false, `duplicate (day,slot) ${slotKey} within template ${key}`);
    set.add(slotKey);
  }
});

test("buildStarterContent: all ids (groups, templates, sessions) are unique", () => {
  const { groups, templates, sessions } = buildStarterContent([]);
  const ids = [...groups.map((g) => g.id), ...templates.map((t) => t.id), ...sessions.map((s) => s.id)];
  assert.equal(new Set(ids).size, ids.length);
});

test("buildDemoSnapshot: every week session has the given weekStart set, template sessions keep weekStart null", () => {
  const weekStart = "2026-09-14";
  const snapshot = buildDemoSnapshot(weekStart);
  const weekSessions = snapshot.sessions.filter((s) => s.templateId === null);
  assert.ok(weekSessions.length > 0);
  for (const s of weekSessions) assert.equal(s.weekStart, weekStart);
  const templateSessions = snapshot.sessions.filter((s) => s.templateId !== null);
  assert.ok(templateSessions.length > 0);
  for (const s of templateSessions) assert.equal(s.weekStart, null);
});

test("buildDemoSnapshot: all session ids are unique", () => {
  const snapshot = buildDemoSnapshot("2026-09-14");
  const ids = snapshot.sessions.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("buildDemoSnapshot: demo users reference members that exist in the snapshot", () => {
  const snapshot = buildDemoSnapshot("2026-09-14");
  const userIds = new Set(snapshot.members.map((m) => m.userId));
  assert.ok(userIds.has(DEMO_USERS.koordination.userId));
  assert.ok(userIds.has(DEMO_USERS.lehrperson.userId));
});

test("buildStarterContent: Stundenplan Kastanie with 5 teachers, classes 3–5, founder linked by first name", () => {
  const founder = makeTeacher({ name: "Andrea Muster" });
  const { teachers, groups, templates, sessions } = buildStarterContent([founder]);
  assert.deepEqual(teachers.map((t) => t.name), ["Dani", "Klara", "Nici", "Coni"]);
  assert.deepEqual(groups.map((g) => g.name), ["3. Klasse", "4. Klasse", "5. Klasse"]);
  assert.equal(templates[0].name, "Stundenplan Kastanie SJ 26/27");
  const main = sessions.filter((x) => x.templateId === templates[0].id);
  assert.equal(main.length, 31);
  assert.ok(main.every((x) => x.slot >= 0 && x.slot < 7));
  const monday4 = main.find((x) => x.day === "mo" && x.slot === 3);
  assert.equal(monday4?.title, "Englisch · Französisch");
  assert.ok(monday4?.assignments.some((a) => a.teacherId === founder.id && a.room === "Kreis"));
  assert.equal(templates[0].days?.mi?.note, "Klara: PICTS");
  const allTeacherIds = new Set([founder.id, ...teachers.map((t) => t.id)]);
  assert.ok(main.every((x) => x.assignments.every((a) => a.off || allTeacherIds.has(a.teacherId))));
  assert.deepEqual(planningWarnings(main, groups, [founder, ...teachers]), []);
});

test("buildDemoSnapshot uses invented names only (no real teacher names from the timetable)", () => {
  const snap = buildDemoSnapshot("2026-09-14");
  const text = JSON.stringify(snap);
  for (const real of ["Dani", "Andrea", "Klara", "Nici", "Coni", "Kastanie", "PICTS"]) {
    assert.equal(text.includes(real), false, `${real} darf in der Demo nicht vorkommen`);
  }
  assert.deepEqual(snap.teachers.map((t) => t.initials), ["AD", "MM", "SS", "HG", "RH"]);
  assert.equal(DEMO_USERS.koordination.displayName, "Minerva McGonagall");
  assert.equal(DEMO_USERS.lehrperson.displayName, "Hermine Granger");
});
