# 4teenWebSite OpenAI integration

## Verified location

The working project is:

`/Users/stanataev/Documents/Work/4teen/4teenWebSite`

There is no OpenAI SDK dependency in `package.json`; the project uses direct `fetch` calls.

## Existing agent access

The existing automation already calls the OpenAI Responses API from:

- `scripts/blog-automation/daily-digest-runner.mjs`
- `scripts/blog-automation/generate-tronix-rent-seo-posts.mjs`
- `scripts/ops-remote-runner.mjs`

The main generation endpoint is `https://api.openai.com/v1/responses`. Image generation/editing is also wired in the daily digest runner.

## Credential path

The GitHub Actions workflow retrieves `openAiApiKey`, `openAiOrgId`, and `openAiProjectId` from the 4TEEN ops control plane endpoint and exports them as:

- `OPENAI_API_KEY`
- `OPENAI_ORG_ID`
- `OPENAI_PROJECT_ID`

The workflow then passes those values to the blog automation and remote runner. No real OpenAI credential is copied into this repository.

## Threads bot connection plan

The Threads bot should reuse the same control-plane credential path through a server-side adapter, rather than embedding an OpenAI key in the Threads repository. The adapter can call the existing Responses API with the Stan At 4 Threads profile instructions and return structured decisions for:

1. content generation;
2. deterministic safety and duplication checks;
3. private like/skip/needs-review classification;
4. draft or auto-publish recommendation.

The classifier must not perform likes, follows, replies, or DMs. Threads publishing remains a separate explicit action guarded by the bot policy.

For local development, this repository now uses a separate project key named
`threads-smart-bot` in the ignored `.env.local` file. The key value is never
tracked or printed.
