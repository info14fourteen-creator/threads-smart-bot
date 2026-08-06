import { FeedbackStore } from "./feedback-store.mjs";

const store = new FeedbackStore(process.argv[2] || "data/feedback.sqlite");
try {
  const examples = store.learningExamples({ limit: 20 });
  process.stdout.write(`${JSON.stringify({ summary: store.summary(), examples }, null, 2)}\n`);
} finally {
  store.close();
}
