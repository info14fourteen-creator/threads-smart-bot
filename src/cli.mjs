import { mkdir, writeFile } from "node:fs/promises";
import { loadProfile, loadRuntimeConfig, requireRuntimeConfig } from "./config.mjs";
import { buildDecisionQueue } from "./agent.mjs";
import { ThreadsClient } from "./threads-client.mjs";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (!value.startsWith("--")) continue;
    const [key, inline] = value.slice(2).split("=", 2);
    args[key] = inline ?? (argv[i + 1]?.startsWith("--") ? true : argv[++i]);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
try {
  const runtime = loadRuntimeConfig();
  const profile = await loadProfile(args.profile || "config/stan-at-4-threads.json");

  if (args.mode === "profile") {
    process.stdout.write(`${JSON.stringify(profile, null, 2)}\n`);
    process.exit(0);
  }

  const useAi = args.ai === true || args.ai === "true";
  requireRuntimeConfig(runtime, { requireOpenAi: useAi });
  const client = new ThreadsClient({ accessToken: runtime.threadsAccessToken, baseUrl: runtime.threadsBaseUrl });
  const limit = Math.min(100, Math.max(1, Number(args.limit || 25)));
  const source = args.source || "mine";
  const posts = source === "search"
    ? await client.searchKeyword({ query: args.query, limit, maxItems: limit })
    : await client.listMyThreads({ limit, maxItems: limit });
  const decisions = await buildDecisionQueue(posts, { profile, runtime, useAi });
  const output = {
    generated_at: new Date().toISOString(),
    source,
    query: args.query || null,
    dry_run: true,
    actions_taken: [],
    decisions,
  };

  const outputPath = args.out || "data/decision-queue.json";
  await mkdir(outputPath.split("/").slice(0, -1).join("/") || ".", { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  const counts = decisions.reduce((result, item) => ({ ...result, [item.label]: (result[item.label] || 0) + 1 }), {});
  process.stdout.write(JSON.stringify({ source, fetched: posts.length, decisions: counts, output: outputPath, dry_run: true }) + "\n");
} catch (error) {
  process.stderr.write(`${JSON.stringify({ error: error.name || "Error", message: error.message, path: error.path || null })}\n`);
  process.exitCode = 1;
}
