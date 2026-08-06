# Threads Smart Bot — implementation plan

## Product goal

Build a mostly autonomous Threads operating system for 4TEEN that can:

1. understand Stan's crypto/content preferences;
2. discover and score relevant public conversations;
3. maintain a queue of recommended posts with reasons;
4. prepare and publish an approved content plan;
5. measure which topics produce useful reach and future wallet/token users.

The bot is a content intelligence and publishing system. It is not an
engagement farm.

## Architecture

```text
Threads API ──> ingest ──> normalizer ──> preference agent ──> decision queue
                                      │                         │
                                      └──> topic memory         └──> safe actions

content plan ──> writer agent ──> policy/fact checker ──> scheduler ──> Threads API
                                                          │
insights API <─────────────────────────────────────────────┘
```

Initial implementation target: Node.js + TypeScript, a small persistent
database, OpenAI Responses API, and official Threads OAuth/API calls.

## Phases

## Current status

- Meta Threads app created and configured for testing.
- `fourteentoken` authorization completed.
- Official `/v1.0/me` API call verified the token and profile identity.
- Existing 4TEEN OpenAI Responses API access mapped in
  `docs/4teenwebsite-openai-integration.md`.
- Read-only Threads client, deterministic policy scoring, deduplication, and
  private OpenAI classification are implemented in `src/`.
- Own-profile scan is verified against live Threads data and the new OpenAI
  key. Public keyword search is implemented but requires re-authorization of
  the current token with `threads_keyword_search`.
- Next implementation step: complete OAuth re-authorization, then add
  persistence, scheduled ingestion, and a review queue UI; publishing stays
  behind the policy gate.

### Phase 0 — repository and safety foundation

- Public repository and documented boundaries.
- Environment variable contract without real secrets.
- Structured logs, dry-run mode, and idempotency keys.
- No API calls that create engagement.

### Phase 1 — preference model

- Import the existing 4TEEN editorial prompts and style rules.
- Create a versioned preference profile covering topics, tone, quality,
  red flags, and exclusions.
- Score posts on relevance, usefulness, originality, credibility, and risk.
- Return `like`, `skip`, or `needs_review` with a short explanation.

### Phase 2 — Threads read-only intelligence

- Add OAuth token handling and the official Threads API client.
- Ingest posts, replies, topics, mentions, and available insights.
- Deduplicate posts and store source, timestamp, author, and content hash.
- Expose a queue sorted by relevance and expected value.

### Phase 3 — content planning and publishing

- Turn the editorial calendar into scheduled post jobs.
- Generate drafts in Stan's mechanism-first crypto style.
- Validate links, contract addresses, factual claims, and risk language.
- Publish text/media through the official API.
- Keep sensitive crypto claims behind an approval gate.

### Phase 4 — learning loop

- Store final decisions and outcomes.
- Compare predicted relevance with views, replies, reposts, quotes, and
  downstream conversions.
- Update topic weights and content formats without silently changing safety
  rules.

### Phase 5 — deployment and operations

- Run the worker on a managed deployment.
- Reuse the existing 4TEEN control-plane secret delivery pattern where
  appropriate; never copy the OpenAI key into this repository.
- Add health checks, retries, rate-limit handling, and failure alerts.
- Provide a dry-run and pause switch for every write action.

## Automation policy

### Allowed without a person in the loop

- classify and rank posts;
- summarize conversations;
- draft content;
- schedule pre-approved content templates;
- publish approved drafts;
- collect insights and generate reports.

### Approval required

- token price, liquidity, supply, or contract claims;
- wallet links and transaction instructions;
- partnership, reward, airdrop, or campaign claims;
- replies that could be interpreted as financial advice;
- any new content format not covered by the preference profile.

### Never automate

- likes, follows, unfollows, or artificial engagement;
- scraping or browser automation against Threads;
- mass comments or cold DMs;
- seed phrases, private keys, or transaction signing;
- guarantees of profit or token price.

## Success metrics

- percentage of recommendations marked useful;
- precision of `like` recommendations;
- time from relevant story to draft;
- post views, replies, reposts, and quotes;
- qualified wallet waitlist registrations;
- activated wallet users;
- 4TEEN users attributed to content;
- zero policy or credential incidents.
