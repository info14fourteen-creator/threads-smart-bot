import { classifyPostWithOpenAi } from "./openai-classifier.mjs";
import { dedupePosts, scorePost } from "./policy.mjs";

export async function buildDecisionQueue(posts, { profile, runtime, useAi = false, fetchImpl = fetch } = {}) {
  const uniquePosts = dedupePosts(posts);
  const decisions = [];
  for (const post of uniquePosts) {
    decisions.push(useAi
      ? await classifyPostWithOpenAi({
        post,
        profile,
        apiKey: runtime.openAiApiKey,
        organizationId: runtime.openAiOrganizationId,
        baseUrl: runtime.openAiBaseUrl,
        model: runtime.openAiModel,
        fetchImpl,
      })
      : scorePost(post, profile));
  }
  return decisions.sort((a, b) => b.relevanceScore - a.relevanceScore);
}
