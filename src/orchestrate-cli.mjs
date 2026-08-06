import { mkdir, writeFile } from "node:fs/promises";
import { loadProfile, loadRuntimeConfig, requireRuntimeConfig } from "./config.mjs";
import { ThreadsClient } from "./threads-client.mjs";
import { runCycle } from "./orchestrator.mjs";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith("--")) continue;
    const [key, inline] = argv[i].slice(2).split("=", 2);
    args[key] = inline ?? (argv[i + 1]?.startsWith("--") ? true : argv[++i]);
  }
  return args;
}

try {
  const args = parseArgs(process.argv.slice(2));
  const runtime = loadRuntimeConfig();
  const profile = await loadProfile(args.profile || "config/stan-at-4-threads.json");
  const useAi = args.ai !== "false";
  const live = args.live === true || args.live === "true";
  requireRuntimeConfig(runtime, { requireOpenAi: useAi });
  const client = new ThreadsClient({ accessToken: runtime.threadsAccessToken, baseUrl: runtime.threadsBaseUrl });
  const result = await runCycle({
    client,
    profile,
    runtime,
    statePath: args.state || "data/threads-state.json",
    postLimit: Math.min(100, Math.max(1, Number(args.limit || 25))),
    useAi,
    draftContent: args["draft-content"] !== "false",
    live,
    maxReplies: Math.min(20, Math.max(1, Number(args["max-replies"] || 10))),
    date: args.date,
    publishSlot: args.slot,
  });
  const outputPath = args.out || "data/orchestration-cycle.json";
  await mkdir(outputPath.split("/").slice(0, -1).join("/") || ".", { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(JSON.stringify({
    dryRun: result.dryRun,
    fetchedPosts: result.fetchedPosts,
    manualPosts: result.manualPosts.length,
    replyCandidates: result.replyCandidates.length,
    replyErrors: result.replyErrors.length,
    contentSlots: result.contentPlan.length,
    actions: result.actions.length,
    output: outputPath,
  }) + "\n");
} catch (error) {
  process.stderr.write(`${JSON.stringify({ error: error.name || "Error", message: error.message, path: error.path || null, code: error.code || null })}\n`);
  process.exitCode = 1;
}
