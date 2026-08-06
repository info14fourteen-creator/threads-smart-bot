import test from "node:test";
import assert from "node:assert/strict";
import { ThreadsClient } from "../src/threads-client.mjs";

test("client uses bearer auth and never sends token in URL", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({ data: [{ id: "1", text: "hello" }] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const client = new ThreadsClient({ accessToken: "secret-token", fetchImpl });
  await client.getMe();
  assert.equal(calls.length, 1);
  assert.equal(new URL(calls[0].url).searchParams.has("access_token"), false);
  assert.equal(calls[0].options.headers.Authorization, "Bearer secret-token");
});

test("client follows pagination up to maxItems", async () => {
  let count = 0;
  const fetchImpl = async (url) => {
    count += 1;
    const payload = count === 1
      ? { data: [{ id: "1" }], paging: { next: "https://graph.threads.net/v1.0/me/threads?after=abc" } }
      : { data: [{ id: "2" }, { id: "3" }] };
    return new Response(JSON.stringify(payload), { status: 200 });
  };
  const client = new ThreadsClient({ accessToken: "secret-token", fetchImpl });
  const result = await client.listMyThreads({ maxItems: 2 });
  assert.deepEqual(result.map((item) => item.id), ["1", "2"]);
  assert.equal(count, 2);
});
