import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FeedbackStore } from "../src/feedback-store.mjs";
import { proposeProfileTuning } from "../src/learning.mjs";

test("feedback store upserts events and returns learning examples", async () => {
  const directory = await mkdtemp(join(tmpdir(), "threads-feedback-"));
  const path = join(directory, "feedback.sqlite");
  const store = new FeedbackStore(path);
  store.recordEvent({ eventType: "manual_reply", sourceId: "r1", parentId: "p1", username: "stan", language: "ru", text: "Как устроено?" });
  store.recordEvent({ eventType: "manual_reply", sourceId: "r1", parentId: "p1", username: "stan", language: "ru", text: "Как именно устроено?" });
  assert.equal(store.learningExamples().length, 1);
  assert.equal(store.learningExamples()[0].text, "Как именно устроено?");
  assert.equal(store.summary().events[0].count, 1);
  store.close();
  await rm(directory, { recursive: true, force: true });
});

test("learning analyst returns a bounded proposal without mutating profile", async () => {
  const profile = { topic_weights: { ai: 0.2 }, hard_exclusions: ["private keys"] };
  const before = JSON.stringify(profile);
  const proposal = await proposeProfileTuning({
    profile,
    examples: [{ event_type: "manual_post", text: "AI agents need evals.", language: "en" }],
    runtime: { openAiApiKey: "test-key", openAiBaseUrl: "https://api.openai.com/v1", openAiModel: "test-model" },
    fetchImpl: async () => new Response(JSON.stringify({ output_text: JSON.stringify({ summary: "More mechanism-first AI posts.", evidence: [], topic_weight_deltas: { ai: 0.03 }, add_quality_rules: ["Show a concrete test."], remove_quality_rules: [], voice_adjustments: [], confidence: 0.8, needs_more_data: false }) }), { status: 200 }),
  });
  assert.equal(proposal.topic_weight_deltas.ai, 0.03);
  assert.equal(JSON.stringify(profile), before);
});
