import test from "node:test";
import assert from "node:assert/strict";
import { buildDailyContentPlan, shouldUseManualFollowUp } from "../src/content-plan.mjs";

test("daily plan contains a poll, an image, and conversation formats", () => {
  const plan = buildDailyContentPlan({ date: "2026-08-06", posts: 5 });
  assert.equal(plan.length, 5);
  assert.equal(plan.filter((slot) => slot.format === "poll").length, 1);
  assert.equal(plan.filter((slot) => slot.format === "image").length, 1);
  assert.ok(plan.some((slot) => slot.format === "question" && slot.questionBrief));
});

test("manual follow-up is only proposed for non-hard-blocked weak posts", () => {
  assert.equal(shouldUseManualFollowUp({ label: "skip", policy: { hardViolations: [] } }), true);
  assert.equal(shouldUseManualFollowUp({ label: "skip", policy: { hardViolations: ["private_wallet_secret"] } }), false);
  assert.equal(shouldUseManualFollowUp({ label: "like", policy: { hardViolations: [] } }), false);
});
