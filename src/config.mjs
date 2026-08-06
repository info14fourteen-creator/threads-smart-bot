import { readFile } from "node:fs/promises";

export const DEFAULT_THREADS_BASE_URL = "https://graph.threads.net/v1.0";
export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

export async function loadProfile(path = "config/stan-at-4-threads.json") {
  return JSON.parse(await readFile(path, "utf8"));
}

export function loadRuntimeConfig(env = process.env) {
  return {
    threadsAccessToken: env.THREADS_ACCESS_TOKEN?.trim() || "",
    threadsBaseUrl: (env.THREADS_API_BASE_URL || DEFAULT_THREADS_BASE_URL).replace(/\/$/, ""),
    openAiApiKey: env.OPENAI_API_KEY_OVERRIDE?.trim() || env.OPENAI_API_KEY?.trim() || "",
    openAiOrganizationId: (env.OPENAI_ORGANIZATION_ID || env.OPENAI_ORG_ID)?.trim() || "",
    openAiBaseUrl: (env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL).replace(/\/$/, ""),
    openAiModel: env.OPENAI_MODEL || "gpt-5-mini",
    threadsUserId: env.THREADS_USER_ID?.trim() || "",
    threadsUsername: env.THREADS_USERNAME?.trim() || "",
  };
}

export function requireRuntimeConfig(config, { requireOpenAi = false, requireThreads = true } = {}) {
  if (requireThreads && !config.threadsAccessToken) {
    throw new Error("THREADS_ACCESS_TOKEN is required");
  }
  if (requireOpenAi && !config.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is required for AI classification");
  }
}
