const QUESTION_BRIEFS = [
  "Ask which crypto infrastructure bottleneck founders underestimate, then require a mechanism or example.",
  "Force a choice between shipping faster and measuring better; ask what breaks first in practice.",
  "Ask builders what part of an AI agent is mostly theater and what part actually compounds.",
  "Ask TRON builders which constraint matters more right now: energy, liquidity, distribution, or trust.",
];

export function buildDailyContentPlan({ date = new Date().toISOString().slice(0, 10), posts = 5, automation = {} } = {}) {
  const count = Math.max(3, Math.min(10, Number(posts) || 5));
  const slots = [
    { slot: "morning", format: "text", objective: "mechanism_insight" },
    { slot: "midday", format: "question", objective: "conversation", questionBrief: QUESTION_BRIEFS[date.length % QUESTION_BRIEFS.length] },
    { slot: "afternoon", format: "poll", objective: "structured_feedback", pollOptions: 4 },
    { slot: "evening", format: "image", objective: "visual_explanation", assetRequired: true },
    { slot: "late_evening", format: "text", objective: "founder_operator_take" },
    { slot: "late_evening_image", format: "image", objective: "visual_explanation", assetRequired: true },
  ];
  const requestedImages = Math.max(1, Math.min(2, Number(automation.image_posts_per_day_min || 1)));
  const selected = slots.slice(0, count);
  while (selected.filter((slot) => slot.format === "image").length < requestedImages && selected.length < 10) {
    selected.push(slots[selected.length]);
  }
  return selected.slice(0, count).map((item, index) => ({
    id: `${date}-${item.slot}`,
    order: index + 1,
    ...item,
    safety: "policy_check_required",
    publish: "dry_run_until_live_flag",
  }));
}

export function shouldUseManualFollowUp(decision) {
  return decision?.label === "skip" && !decision?.policy?.hardViolations?.length;
}
