import { createHash } from "node:crypto";

const TOPIC_TERMS = {
  tron: ["tron", "trc-20", "trc20", "energy", "bandwidth", "sunpump", "justlend"],
  crypto_market: ["crypto", "bitcoin", "btc", "ethereum", "eth", "liquidity", "market", "stablecoin", "yield"],
  vibe_coding: ["vibe coding", "vibe-coding", "ship", "shipping", "prototype", "builder", "no-code", "cursor"],
  ai: [" ai ", "llm", "agent", "agents", "model", "inference", "prompt", "openai", "automation"],
  "4teen_and_wallet_building": ["4teen", "wallet", "airdrop", "token", "on-chain", "onchain", "payment rail"],
};

const HARD_EXCLUSION_PATTERNS = [
  { label: "ethnic_hostility", pattern: /\b(?:kill|hate|exterminate)\s+(?:all\s+)?(?:[a-z]+\s+)?(?:people|ethnic|race)/i },
  { label: "sexual_content", pattern: /\b(?:onlyfans|porn|nudes?|explicit sex|sex tape)\b/i },
  { label: "gender_war", pattern: /\b(?:all men are|all women are|men are trash|women are trash)\b/i },
  { label: "harassment_or_threat", pattern: /\b(?:doxx|doxxing|kill yourself|i will find you|go die)\b/i },
  { label: "private_wallet_secret", pattern: /\b(?:seed phrase|secret phrase|private key|wallet password|recovery phrase)\b/i },
  { label: "profit_guarantee", pattern: /\b(?:guaranteed|risk[- ]?free|100x|sure win|can't lose)\b.{0,40}\b(?:profit|return|gain|token|coin|yield)\b/i },
];

const REVIEW_PATTERNS = [
  { label: "financial_claim", pattern: /\b(?:entry|target|price|yield|apy|apr|return|profit|bullish|bearish)\b/i },
  { label: "financial_claim", pattern: /\b(?:buy|sell)\s+(?:btc|bitcoin|eth|ethereum|crypto|token|coin|tron|trx|stablecoin)\b|\b(?:btc|bitcoin|eth|ethereum|crypto|token|coin|tron|trx|stablecoin)\s+(?:buy|sell)\b/i },
  { label: "financial_claim", pattern: /\b(?:long|short)\s+(?:btc|bitcoin|eth|ethereum|crypto|token|coin|tron|trx|stablecoin)\b/i },
  { label: "unverified_claim", pattern: /\b(?:breaking|confirmed|official|partnership|launching|airdrop|แจก|guaranteed)\b/i },
  { label: "wallet_or_contract_link", pattern: /(?:0x[a-f0-9]{20,}|T[a-z0-9]{20,}|https?:\/\/\S+)/i },
];

export function normalizeText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function contentHash(text) {
  return createHash("sha256").update(normalizeText(text).toLowerCase()).digest("hex");
}

export function checkPolicy(text) {
  const normalized = normalizeText(text);
  const hardViolations = HARD_EXCLUSION_PATTERNS.filter(({ pattern }) => pattern.test(normalized)).map(({ label }) => label);
  const reviewFlags = REVIEW_PATTERNS.filter(({ pattern }) => pattern.test(normalized)).map(({ label }) => label);
  return {
    passed: hardViolations.length === 0,
    hardViolations,
    reviewFlags,
    requiresReview: hardViolations.length > 0 || reviewFlags.length > 0,
  };
}

function topicScore(text, topicWeights = {}) {
  const padded = ` ${normalizeText(text).toLowerCase()} `;
  const matches = {};
  let score = 0;
  for (const [topic, terms] of Object.entries(TOPIC_TERMS)) {
    const found = terms.filter((term) => padded.includes(term.toLowerCase()));
    if (found.length) {
      matches[topic] = found;
      score += Number(topicWeights[topic] || 0) * Math.min(found.length, 3) / 3;
    }
  }
  return { score: Math.min(score, 1), matches };
}

export function normalizePost(post = {}) {
  return {
    id: post.id || null,
    text: normalizeText(post.text || post.caption || ""),
    username: post.username || null,
    timestamp: post.timestamp || null,
    permalink: post.permalink || null,
    raw: post,
  };
}

export function scorePost(post, profile) {
  const normalized = normalizePost(post);
  const policy = checkPolicy(normalized.text);
  const topics = topicScore(normalized.text, profile.topic_weights);
  const mechanismSignal = /\b(?:because|mechanism|how|test|measure|ship|build|system|infrastructure|cash flow|liquidity|distribution)\b/i.test(normalized.text);
  const lengthSignal = normalized.text.length >= 50 && normalized.text.length <= 900;
  const qualityScore = (mechanismSignal ? 0.15 : 0) + (lengthSignal ? 0.1 : 0);
  const relevanceScore = Math.min(1, topics.score + qualityScore);
  let label = relevanceScore >= 0.22 ? "like" : "skip";
  if (policy.hardViolations.length) label = "skip";
  else if (policy.requiresReview) label = "needs_review";
  return {
    ...normalized,
    hash: contentHash(normalized.text),
    label,
    confidence: Number(Math.min(0.99, 0.45 + relevanceScore * 0.5).toFixed(3)),
    relevanceScore: Number(relevanceScore.toFixed(3)),
    topics: topics.matches,
    policy,
    reasons: [
      ...Object.keys(topics.matches).map((topic) => `topic:${topic}`),
      ...(mechanismSignal ? ["mechanism_signal"] : []),
      ...(lengthSignal ? ["usable_length"] : []),
      ...policy.hardViolations.map((flag) => `blocked:${flag}`),
      ...policy.reviewFlags.map((flag) => `review:${flag}`),
    ],
  };
}

export function dedupePosts(posts = []) {
  const seen = new Set();
  return posts.filter((post) => {
    const key = post.id || contentHash(post.text || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
