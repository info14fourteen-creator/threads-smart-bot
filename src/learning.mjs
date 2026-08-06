import { normalizeText } from "./policy.mjs";

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
  throw new Error("Learning analyst returned invalid JSON");
}

async function callAnalyst({ profile, examples, runtime, fetchImpl = fetch }) {
  if (!runtime.openAiApiKey) throw new Error("OPENAI_API_KEY is required for learning analysis");
  const headers = { Authorization: `Bearer ${runtime.openAiApiKey}`, "Content-Type": "application/json" };
  if (runtime.openAiOrganizationId) headers["OpenAI-Organization"] = runtime.openAiOrganizationId;
  const response = await fetchImpl(`${runtime.openAiBaseUrl}/responses`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: runtime.openAiModel,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: [
            "You are the editorial learning analyst for Stan At 4 Threads.",
            "Analyze the author's own posts and replies as examples of real voice and preference.",
            "Do not optimize for empty engagement, spam, or financial hype.",
            "Do not change hard exclusions or publishing safety rules.",
            "Do not infer a stable preference from one example; include evidence and confidence.",
            "Return JSON only with: summary, evidence, topic_weight_deltas, add_quality_rules, remove_quality_rules, voice_adjustments, confidence, needs_more_data.",
            "topic_weight_deltas must be small numbers between -0.05 and 0.05.",
          ].join("\n") }],
        },
        { role: "user", content: [{ type: "input_text", text: JSON.stringify({ profile, examples }) }] },
      ],
      text: { format: { type: "json_object" } },
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI learning request failed: ${response.status}`);
  return parseJson(extractResponseText(payload));
}

export async function proposeProfileTuning({ profile, examples, runtime, fetchImpl = fetch }) {
  if (!examples.length) {
    return { summary: "No learning examples collected yet.", evidence: [], topic_weight_deltas: {}, add_quality_rules: [], remove_quality_rules: [], voice_adjustments: [], confidence: 0, needs_more_data: true };
  }
  const proposal = await callAnalyst({ profile, examples, runtime, fetchImpl });
  return {
    summary: normalizeText(proposal.summary || ""),
    evidence: Array.isArray(proposal.evidence) ? proposal.evidence.slice(0, 10) : [],
    topic_weight_deltas: proposal.topic_weight_deltas && typeof proposal.topic_weight_deltas === "object" ? proposal.topic_weight_deltas : {},
    add_quality_rules: Array.isArray(proposal.add_quality_rules) ? proposal.add_quality_rules.map(String).slice(0, 5) : [],
    remove_quality_rules: Array.isArray(proposal.remove_quality_rules) ? proposal.remove_quality_rules.map(String).slice(0, 5) : [],
    voice_adjustments: Array.isArray(proposal.voice_adjustments) ? proposal.voice_adjustments.map(String).slice(0, 5) : [],
    confidence: Math.max(0, Math.min(1, Number(proposal.confidence) || 0)),
    needs_more_data: Boolean(proposal.needs_more_data),
  };
}
