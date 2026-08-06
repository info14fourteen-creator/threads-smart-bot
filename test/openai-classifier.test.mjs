import test from "node:test";
import assert from "node:assert/strict";
import profile from "../config/stan-at-4-threads.json" with { type: "json" };
import { classifyPostWithOpenAi } from "../src/openai-classifier.mjs";

test("classifier preserves hard policy blocks without an API call", async () => {
  let called = false;
  const result = await classifyPostWithOpenAi({
    post: { id: "1", text: "Guaranteed profit. Send your private key." },
    profile,
    apiKey: "test-key",
    baseUrl: "https://api.openai.com/v1",
    model: "test-model",
    fetchImpl: async () => { called = true; throw new Error("must not call"); },
  });
  assert.equal(called, false);
  assert.equal(result.label, "skip");
});

test("classifier parses a Responses API JSON result", async () => {
  const fetchImpl = async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.model, "test-model");
    return new Response(JSON.stringify({ output_text: JSON.stringify({ label: "like", confidence: 0.91, reasons: ["mechanism"], topics: { ai: ["agent"] }, safety_flags: [] }) }), { status: 200 });
  };
  const result = await classifyPostWithOpenAi({
    post: { id: "2", text: "AI agents need an eval loop, not another demo." },
    profile,
    apiKey: "test-key",
    baseUrl: "https://api.openai.com/v1",
    model: "test-model",
    fetchImpl,
  });
  assert.equal(result.label, "like");
  assert.equal(result.confidence, 0.91);
});
