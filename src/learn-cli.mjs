import { loadProfile, loadRuntimeConfig, requireRuntimeConfig } from "./config.mjs";
import { FeedbackStore } from "./feedback-store.mjs";
import { proposeProfileTuning } from "./learning.mjs";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith("--")) continue;
    const [key, inline] = argv[i].slice(2).split("=", 2);
    args[key] = inline ?? (argv[i + 1]?.startsWith("--") ? true : argv[++i]);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const runtime = loadRuntimeConfig();
const profile = await loadProfile(args.profile || "config/stan-at-4-threads.json");
const store = new FeedbackStore(args.feedback || "data/feedback.sqlite");
try {
  const examples = store.learningExamples({ limit: Number(args.limit || 100) });
  const useAi = args.ai !== "false";
  requireRuntimeConfig(runtime, { requireOpenAi: useAi });
  const proposal = useAi
    ? await proposeProfileTuning({ profile, examples, runtime })
    : { summary: "AI learning disabled.", evidence: [], topic_weight_deltas: {}, add_quality_rules: [], remove_quality_rules: [], voice_adjustments: [], confidence: 0, needs_more_data: true };
  store.saveProfileProposal({ sourceWindow: `${examples.length}_examples`, proposal });
  process.stdout.write(`${JSON.stringify({ status: "proposed", examples: examples.length, proposal }, null, 2)}\n`);
} finally {
  store.close();
}
