import assert from "node:assert/strict";
import { test } from "node:test";

import { highlightsBySession, relativeTime, unseenChanges } from "./changes.ts";
import type { ChangeEntry } from "./types.ts";

const e = (id: string, minutesAgo: number, extra: Partial<ChangeEntry> = {}): ChangeEntry => ({
  id, weekStart: "2026-09-14", sessionId: "s1", kind: "edited", importance: "minor", summary: id, authorId: "other", authorName: "Kim",
  createdAt: new Date(Date.now() - minutesAgo * 60000).toISOString(), ...extra,
});

test("unseenChanges: nur fremde Einträge nach dem letzten Besuch, neueste zuerst", () => {
  const since = new Date(Date.now() - 60 * 60000).toISOString();
  const list = [e("alt", 90), e("neu", 10), e("eigen", 5, { authorId: "me" }), e("neuer", 2)];
  assert.deepEqual(unseenChanges(list, since, "me").map((c) => c.id), ["neuer", "neu"]);
});

test("highlightsBySession: wichtig schlägt klein, sonst die neueste", () => {
  const since = new Date(Date.now() - 60 * 60000).toISOString();
  const list = [e("k1", 30), e("w1", 40, { importance: "major", kind: "moved" }), e("k2", 5), e("s2", 3, { sessionId: "s2" }), e("ohne", 1, { sessionId: null })];
  const map = highlightsBySession(list, since, "me");
  assert.equal(map.get("s1")?.id, "w1");
  assert.equal(map.get("s2")?.id, "s2");
  assert.equal(map.size, 2);
});

test("relativeTime: gerade eben, Minuten, Stunden", () => {
  const now = new Date("2026-09-18T10:00:00");
  assert.equal(relativeTime(new Date(now.getTime() - 20000).toISOString(), now), "gerade eben");
  assert.equal(relativeTime(new Date(now.getTime() - 5 * 60000).toISOString(), now), "vor 5 Min.");
  assert.equal(relativeTime(new Date(now.getTime() - 2 * 3600000).toISOString(), now), "vor 2 Std.");
  assert.match(relativeTime(new Date(now.getTime() - 26 * 3600000).toISOString(), now), /^gestern /);
});
