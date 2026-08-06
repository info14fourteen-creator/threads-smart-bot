import { checkPolicy, normalizeText } from "./policy.mjs";

function fitThreadsText(value, max = 500) {
  const text = normalizeText(value || "");
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(/\s+\S*$/, "").trim()}…`;
}

export function detectLanguage(value) {
  const text = normalizeText(value);
  const cyrillic = (text.match(/[А-Яа-яЁё]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  if (!cyrillic && !latin) return "unknown";
  return cyrillic > latin ? "ru" : "en";
}

function extractResponseText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  for (const item of payload?.output || []) {
    for (const part of item?.content || []) if (typeof part?.text === "string" && part.text.trim()) return part.text.trim();
  }
  return "";
}

function parseJson(text) {
  try { return JSON.parse(text); } catch {}
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
  throw new Error("OpenAI writer returned invalid JSON");
}

async function callWriter({ system, input, runtime, fetchImpl = fetch }) {
  if (!runtime.openAiApiKey) throw new Error("OPENAI_API_KEY is required for writing");
  const headers = { Authorization: `Bearer ${runtime.openAiApiKey}`, "Content-Type": "application/json" };
  if (runtime.openAiOrganizationId) headers["OpenAI-Organization"] = runtime.openAiOrganizationId;
  const response = await fetchImpl(`${runtime.openAiBaseUrl}/responses`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: runtime.openAiModel,
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user", content: [{ type: "input_text", text: JSON.stringify(input) }] },
      ],
      text: { format: { type: "json_object" } },
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI request failed: ${response.status}`);
  return parseJson(extractResponseText(payload));
}

export async function generateContentDraft({ slot, profile, runtime, fetchImpl = fetch }) {
  const draft = await callWriter({
    runtime,
    fetchImpl,
    system: [
      "You write for Stan At 4 Threads, a developer-founder and founder-operator.",
      "Be direct, mechanism-first, skeptical, useful, and occasionally witty.",
      "Return JSON only: {text, poll_options, image_prompt, rationale}.",
      `Hard exclusions: ${profile.hard_exclusions.join("; ")}.`,
      "Never promise returns, invent facts, use culture-war bait, or request private wallet information.",
      "A conversation question must invite a concrete experience, trade-off, or mechanism; never ask for empty engagement.",
    ].join("\n"),
    input: { slot, topics: profile.topic_weights, voice: profile.voice, quality_rules: profile.post_quality_rules },
  });
  const text = fitThreadsText(draft.text);
  const policy = checkPolicy(text);
  return {
    format: slot.format,
    text,
    pollOptions: Array.isArray(draft.poll_options) ? draft.poll_options.map(normalizeText).filter(Boolean).slice(0, 4) : [],
    imagePrompt: normalizeText(draft.image_prompt || ""),
    rationale: normalizeText(draft.rationale || ""),
    policy,
    publishable: policy.passed && !policy.requiresReview && Boolean(text),
  };
}

export async function generateReplyDraft({ post, reply, profile, runtime, fetchImpl = fetch }) {
  const language = detectLanguage(reply.text);
  const draft = await callWriter({
    runtime,
    fetchImpl,
    system: [
      "You write concise, human replies for Stan At 4 Threads.",
      "Reply only when the comment contains a real question, useful disagreement, or concrete experience.",
      "Do not reply to spam, greetings, insults, financial-advice requests, or unsupported token claims.",
      `Reply in the same language as the comment. Detected comment language: ${language}. Do not translate it to another language.`,
      "Return JSON only: {action, text, reason}. action must be reply, skip, or needs_review.",
      `Hard exclusions: ${profile.hard_exclusions.join("; ")}.`,
    ].join("\n"),
    input: { post: { text: post.text, username: post.username }, comment: { text: reply.text, username: reply.username }, language },
  });
  const text = fitThreadsText(draft.text);
  const policy = checkPolicy(text);
  const action = policy.hardViolations.length ? "skip" : ["reply", "skip", "needs_review"].includes(draft.action) ? draft.action : "needs_review";
  return { action, text, reason: normalizeText(draft.reason || ""), language, policy };
}

export async function generateManualFollowUp({ post, profile, runtime, fetchImpl = fetch }) {
  const draft = await callWriter({
    runtime,
    fetchImpl,
    system: [
      "Rewrite a weak manually published post into a distinct follow-up for Stan At 4 Threads.",
      "Do not create a duplicate or pretend the original did not exist.",
      "Return JSON only: {action, text, reason}. action must be follow_up or needs_review.",
      `Hard exclusions: ${profile.hard_exclusions.join("; ")}.`,
    ].join("\n"),
    input: { original_post: { text: post.text, permalink: post.permalink }, voice: profile.voice, topics: profile.topic_weights },
  });
  const text = fitThreadsText(draft.text);
  const policy = checkPolicy(text);
  const action = policy.hardViolations.length ? "needs_review" : ["follow_up", "needs_review"].includes(draft.action) ? draft.action : "needs_review";
  return { action, text, reason: normalizeText(draft.reason || ""), policy };
}
