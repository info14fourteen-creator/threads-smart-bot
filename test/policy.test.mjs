import test from "node:test";
import assert from "node:assert/strict";
import profile from "../config/stan-at-4-threads.json" with { type: "json" };
import { checkPolicy, contentHash, dedupePosts, scorePost } from "../src/policy.mjs";

test("hard exclusions always skip", () => {
  const result = scorePost({ id: "1", text: "Guaranteed profit. Send your seed phrase for the airdrop." }, profile);
  assert.equal(result.label, "skip");
  assert.ok(result.policy.hardViolations.includes("private_wallet_secret"));
  assert.ok(result.policy.hardViolations.includes("profit_guarantee"));
});

test("crypto mechanism post is ranked like without side effects", () => {
  const result = scorePost({ id: "2", text: "Stablecoin liquidity is a distribution problem: measure where settlement actually clears before copying the narrative." }, profile);
  assert.equal(result.label, "like");
  assert.ok(result.topics.crypto_market);
  assert.deepEqual(result.actions, undefined);
});

test("financial claims require review", () => {
  const result = scorePost({ id: "3", text: "BTC target is 100k; buy the breakout and use this entry." }, profile);
  assert.equal(result.label, "needs_review");
  assert.ok(result.policy.reviewFlags.includes("financial_claim"));
});

test("dedupe uses ids and normalized content hashes", () => {
  const posts = [{ id: "a", text: "One" }, { id: "a", text: "Two" }, { text: " Same  text " }, { text: "same text" }];
  assert.equal(dedupePosts(posts).length, 2);
  assert.equal(contentHash(" Same  text "), contentHash("same text"));
  assert.equal(checkPolicy("Build, measure, ship.").passed, true);
});
