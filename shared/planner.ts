import { z } from "zod";
const text = z.string().max(10000);
const id = z.string().min(1).max(100);
const day = z.enum(["mo", "di", "mi", "do", "fr"]);
const session = z.object({ id, day, slot: z.number().int().min(0).max(7), title: text, focus: text, room: text, notes: text, children: text, childOverrides: z.array(id).max(100).optional(), wholeClass: z.boolean().optional(), assignments: z.array(z.object({ groupId: id, teacherId: z.string().max(100) })).max(100), status: z.enum(["planned", "open", "done", "carried"]) });
const dayMeta = z.object({ attendance: z.array(id).max(100), note: text, meetings: z.array(z.object({ time: text, title: text })).max(100) });
export const plannerSchema = z.object({
  groups: z.array(z.object({ id, name: text, short: text, color: z.string().regex(/^#[0-9a-fA-F]{6}$/), children: text })).max(100),
  teachers: z.array(z.object({ id, name: text, initials: text, color: z.string().regex(/^#[0-9a-fA-F]{6}$/), active: z.boolean() })).max(100),
  templates: z.record(z.array(session).max(100)),
  weeks: z.record(z.object({ sessions: z.array(session).max(100), days: z.object({ mo: dayMeta, di: dayMeta, mi: dayMeta, do: dayMeta, fr: dayMeta }) })),
});
export type PlannerData = z.infer<typeof plannerSchema>;
export type TeamUser = { id: string; username: string; name: string; role: "admin" | "teacher"; teacherId: string };
export type ChildConflict = { childId: string; day: string; slot: number; sessions: string[]; groups: string[] };
function childIds(value: string) { return value.split(/[\s,;]+/).map(value => value.trim().toUpperCase()).filter(value => /^[A-ZÄÖÜ]{1,4}\d{1,3}$/.test(value)); }
/** A child may belong to multiple groups. Conflicts only exist when two assigned groups overlap in the same lesson. */
export function analyzeChildConflicts(data: PlannerData): ChildConflict[] {
  const memberships = new Map<string, string[]>();
  for (const group of data.groups) for (const child of childIds(group.children)) memberships.set(child, [...(memberships.get(child) || []), group.id]);
  const conflicts: ChildConflict[] = [];
  for (const week of Object.values(data.weeks)) {
    const byTime = new Map<string, typeof week.sessions>();
    for (const lesson of week.sessions) byTime.set(`${lesson.day}:${lesson.slot}`, [...(byTime.get(`${lesson.day}:${lesson.slot}`) || []), lesson]);
    for (const [time, lessons] of byTime) {
      const attendance = new Map<string, { sessions: string[]; groups: string[] }>();
      for (const lesson of lessons) {
        const assignedGroups = lesson.assignments.map(item => item.groupId);
        const override = new Set((lesson.childOverrides || []).map(value => value.toUpperCase()));
        for (const [child, groups] of memberships) {
          if (override.has(child)) continue;
          if (!lesson.wholeClass && !groups.some(group => assignedGroups.includes(group))) continue;
          const entry = attendance.get(child) || { sessions: [], groups: [] };
          entry.sessions.push(lesson.id); entry.groups.push(...groups.filter(group => assignedGroups.includes(group)));
          attendance.set(child, entry);
        }
      }
      const [day, slotText] = time.split(":");
      for (const [child, entry] of attendance) if (entry.sessions.length > 1) conflicts.push({ childId: child, day, slot: Number(slotText), sessions: [...new Set(entry.sessions)], groups: [...new Set(entry.groups)] });
    }
  }
  return conflicts;
}
export function canChangeSettings(before: PlannerData, after: PlannerData, role: string) { return role === "admin" || JSON.stringify([before.groups, before.teachers, before.templates]) === JSON.stringify([after.groups, after.teachers, after.templates]); }
