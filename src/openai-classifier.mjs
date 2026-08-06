import { checkPolicy, normalizePost, scorePost } from "./policy.mjs";

function extractResponseText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  for (const item of payload?.output || []) {
    for (const part of item?.content || []) {
      if (typeof part?.text === "string" && part.text.trim()) return part.text.trim();
    }
  }
  return "";
}

function parseJson(text) {
  try { return JSON.parse(text); } catch {}
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
  throw new Error("OpenAI classifier returned invalid JSON");
}

export async function classifyPostWithOpenAi({ post, profile, apiKey, baseUrl, model, fetchImpl = fetch }) {
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for AI classification");
  const normalized = normalizePost(post);
  const deterministic = scorePost(normalized, profile);
  if (deterministic.policy.hardViolations.length) return deterministic;

  const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/responses`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: [
            "You are a private editorial preference classifier for Stan At 4 Threads.",
            "Return JSON only: {label, confidence, reasons, topics, safety_flags}.",
            "Allowed labels: like, skip, needs_review.",
            "Never recommend likes, follows, replies, DMs, or any engagement action.",
            `Topics: ${Object.keys(profile.topic_weights).join(", ")}.`,
            `Hard exclusions: ${profile.hard_exclusions.join("; ")}.`,
          ].join("\n") }],
        },
        { role: "user", content: [{ type: "input_text", text: JSON.stringify({ text: normalized.text, username: normalized.username }) }] },
      ],
      text: { format: { type: "json_object" } },
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI request failed: ${response.status}`);
  const ai = parseJson(extractResponseText(payload));
  const policy = checkPolicy(normalized.text);
  const allowed = new Set(["like", "skip", "needs_review"]);
  const label = policy.hardViolations.length ? "skip" : (allowed.has(ai.label) ? ai.label : "needs_review");
  return {
    ...deterministic,
    label,
    confidence: Number.isFinite(Number(ai.confidence)) ? Number(ai.confidence) : deterministic.confidence,
    reasons: [...new Set([...deterministic.reasons, ...(Array.isArray(ai.reasons) ? ai.reasons.map(String) : [])])],
    topics: ai.topics && typeof ai.topics === "object" ? ai.topics : deterministic.topics,
    aiSafetyFlags: Array.isArray(ai.safety_flags) ? ai.safety_flags.map(String) : [],
  };
}
