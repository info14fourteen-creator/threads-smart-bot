import test from "node:test";
import assert from "node:assert/strict";
import profile from "../config/stan-at-4-threads.json" with { type: "json" };
import { generateContentDraft, generateReplyDraft } from "../src/writer.mjs";

const runtime = { openAiApiKey: "test-key", openAiBaseUrl: "https://api.openai.com/v1", openAiModel: "test-model" };

function fakeWriterResponse(value) {
  return async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.model, "test-model");
    return new Response(JSON.stringify({ output_text: JSON.stringify(value) }), { status: 200 });
  };
}

test("content writer validates a poll draft", async () => {
  const result = await generateContentDraft({
    slot: { format: "poll", objective: "structured_feedback" },
    profile,
    runtime,
    fetchImpl: fakeWriterResponse({ text: "What is the real bottleneck?", poll_options: ["Liquidity", "Distribution", "Trust"], image_prompt: "", rationale: "forces a mechanism choice" }),
  });
  assert.equal(result.format, "poll");
  assert.equal(result.pollOptions.length, 3);
  assert.equal(result.publishable, true);
});

test("reply writer can refuse a weak comment", async () => {
  const result = await generateReplyDraft({
    post: { text: "A post about shipping", username: "fourteentoken" },
    reply: { text: "gm", username: "someone" },
    profile,
    runtime,
    fetchImpl: fakeWriterResponse({ action: "skip", text: "", reason: "greeting only" }),
  });
  assert.equal(result.action, "skip");
});
