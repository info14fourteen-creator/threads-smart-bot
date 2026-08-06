# Threads Smart Bot

Autonomous Threads content intelligence and publishing agent for 4TEEN.

The first objective is not automated engagement. The bot should learn and apply
Stan's content preferences: identify posts that are worth reading, explain why,
place them into a review queue, and use the approved signal to improve future
content selection.

## Operating boundaries

- Read, classify, rank, tag, and summarize Threads content.
- Draft and schedule original Threads posts through the official Threads API.
- Collect account and post insights.
- Do not automate likes, follows, unfollows, mass replies, cold DMs, scraping,
  or any other artificial engagement.
- Keep OpenAI, Threads, database, and deployment credentials outside Git.

## Project plan

See [docs/PLAN.md](docs/PLAN.md).

## Read-only scanner

The first runnable slice is a dry-run scanner. It reads the account's own
Threads posts or searches public keyword results, deduplicates them, applies
the deterministic policy, and optionally asks the OpenAI classifier for a
private `like` / `skip` / `needs_review` decision. It never likes, follows,
replies, sends DMs, or publishes.

The local ignored `.env.local` should contain the Threads token and the
separate OpenAI key. Run:

```bash
npm test
npm run scan
node --env-file=.env.local src/cli.mjs --source=search --query="TRON" --limit=25 --ai
```

Results are written to `data/decision-queue.json`, which is ignored by Git.
Use `--ai` only when OpenAI classification is desired; deterministic scoring
works without an OpenAI key.

The implementation deliberately exposes only read methods in
`src/threads-client.mjs`. Write-side Threads operations will require a
separate policy gate and are not part of this phase.

## Orchestration cycle

Run the dry-run orchestrator to detect new manual posts, read replies on your
own threads, draft safe replies, and create the daily mix of text, question,
poll, image, and operator posts:

```bash
npm run orchestrate
```

The cycle writes `data/orchestration-cycle.json` and
`data/threads-state.json`. It does not publish. `--live` is intentionally
explicit and will only publish policy-passing text/poll posts and replies;
image slots remain deferred until a public asset URL is available.

The configured default is five posts per day: one poll, one image slot, two
conversation questions, and one founder/operator post. The reply monitor caps
itself at ten meaningful replies per cycle and one reply per user per day.
When the OpenAI project has no credits, run `node --env-file=.env.local
src/orchestrate-cli.mjs --ai=false` to validate the Threads/state layer without
AI calls.

A manually published post is never deleted or immediately duplicated. The
agent keeps strong posts as learning signals and drafts a distinct follow-up
for weak but non-blocked posts.
