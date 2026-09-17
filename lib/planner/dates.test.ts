import test from "node:test";
import assert from "node:assert/strict";

import { addDays, isoDate, isoWeekNumber, mondayOf, parseIsoDate, weekStartFor } from "./dates.ts";

test("isoDate formats local date as YYYY-MM-DD", () => {
  assert.equal(isoDate(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(isoDate(new Date(2026, 11, 1)), "2026-12-01");
});

test("parseIsoDate is the inverse of isoDate", () => {
  const parsed = parseIsoDate("2026-09-14");
  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 8);
  assert.equal(parsed.getDate(), 14);
});

test("mondayOf returns the same date when already Monday", () => {
  // 2026-09-14 is a Monday.
  const result = mondayOf(new Date(2026, 8, 14));
  assert.equal(isoDate(result), "2026-09-14");
});

test("mondayOf rolls a Sunday back to the previous Monday", () => {
  // 2026-09-20 is a Sunday; the previous Monday is 2026-09-14.
  const result = mondayOf(new Date(2026, 8, 20));
  assert.equal(isoDate(result), "2026-09-14");
});

test("mondayOf rolls a mid-week date back to that week's Monday", () => {
  // 2026-09-17 is a Thursday.
  const result = mondayOf(new Date(2026, 8, 17));
  assert.equal(isoDate(result), "2026-09-14");
});

test("addDays adds and subtracts calendar days, crossing month boundaries", () => {
  assert.equal(isoDate(addDays(new Date(2026, 0, 30), 3)), "2026-02-02");
  assert.equal(isoDate(addDays(new Date(2026, 1, 2), -3)), "2026-01-30");
});

test("weekStartFor with offset 0 returns the Monday of the base week", () => {
  // Base date is a Thursday (2026-09-17) in the week starting 2026-09-14.
  assert.equal(weekStartFor(new Date(2026, 8, 17), 0), "2026-09-14");
});

test("weekStartFor with positive offset moves forward whole weeks", () => {
  assert.equal(weekStartFor(new Date(2026, 8, 17), 1), "2026-09-21");
  assert.equal(weekStartFor(new Date(2026, 8, 17), 2), "2026-09-28");
});

test("weekStartFor with negative offset moves backward whole weeks", () => {
  assert.equal(weekStartFor(new Date(2026, 8, 17), -1), "2026-09-07");
});

test("weekStartFor normalizes a non-Monday base before applying the offset", () => {
  // Base is Sunday 2026-09-20 (week of 2026-09-14); offset 1 -> week of 2026-09-21.
  assert.equal(weekStartFor(new Date(2026, 8, 20), 1), "2026-09-21");
});

test("isoWeekNumber: 2026-01-01 is ISO week 1 (Thursday of that week is in 2026)", () => {
  assert.equal(isoWeekNumber(new Date(2026, 0, 1)), 1);
});

test("isoWeekNumber: 2026-12-28 is ISO week 53 (2026 has 53 ISO weeks)", () => {
  assert.equal(isoWeekNumber(new Date(2026, 11, 28)), 53);
});

test("isoWeekNumber: 2027-01-04 is ISO week 1 of 2027", () => {
  assert.equal(isoWeekNumber(new Date(2027, 0, 4)), 1);
});

test("isoWeekNumber: 2026-09-14 is ISO week 38", () => {
  assert.equal(isoWeekNumber(new Date(2026, 8, 14)), 38);
});
