import test from "node:test";
import assert from "node:assert/strict";
import { markScheduledTask, resolveSchedulePlan } from "../src/scheduler.mjs";

test("scheduled heartbeat maps Tashkent content time and replies", () => {
  const plan = resolveSchedulePlan({ now: new Date("2026-08-07T07:36:00Z"), eventName: "schedule" });
  assert.equal(plan.date, "2026-08-07");
  assert.equal(plan.time, "12:36");
  assert.equal(plan.replies, true);
  assert.deepEqual(plan.contentSlots, ["morning"]);
  assert.equal(plan.learning, false);
});

test("scheduled heartbeat catches the learning window after a small delay", () => {
  const plan = resolveSchedulePlan({ now: new Date("2026-08-06T22:06:00Z"), eventName: "schedule" });
  assert.equal(plan.date, "2026-08-07");
  assert.equal(plan.time, "03:06");
  assert.equal(plan.learning, true);
});

test("completed tasks are not repeated within the same Tashkent date", () => {
  const state = { completed: { "2026-08-07": { "content:morning": "2026-08-07T07:36:00Z" } } };
  const plan = resolveSchedulePlan({ now: new Date("2026-08-07T07:45:00Z"), eventName: "schedule", state });
  assert.deepEqual(plan.contentSlots, []);
});

test("a delayed heartbeat does not replay a missed slot after its grace window", () => {
  const plan = resolveSchedulePlan({ now: new Date("2026-08-07T08:30:00Z"), eventName: "schedule" });
  assert.deepEqual(plan.contentSlots, []);
});

test("manual task selection bypasses the clock", () => {
  const plan = resolveSchedulePlan({ eventName: "workflow_dispatch", manualTask: "content", manualSlot: "midday" });
  assert.deepEqual(plan.contentSlots, ["midday"]);
  assert.equal(plan.replies, false);
  assert.equal(plan.learning, false);
});

test("scheduler state keeps only recent dates", () => {
  const state = { completed: { "2026-08-01": { learning: "x" }, "2026-08-02": { learning: "x" } } };
  const next = markScheduledTask(state, { date: "2026-08-03", key: "learning", completedAt: "now" });
  assert.deepEqual(Object.keys(next.completed), ["2026-08-01", "2026-08-02", "2026-08-03"]);
  assert.equal(next.completed["2026-08-03"].learning, "now");
});
