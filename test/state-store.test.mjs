import test from "node:test";
import assert from "node:assert/strict";
import { remember } from "../src/state-store.mjs";

test("state remembers unique ids and keeps bounded history", () => {
  const state = { seenPostIds: ["a"] };
  remember(state, "seenPostIds", ["a", "b", "c"], 2);
  assert.deepEqual(state.seenPostIds, ["b", "c"]);
});
