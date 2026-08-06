# Threads Smart Bot

Autonomous Threads content intelligence and publishing agent for 4TEEN.

Requires Node.js 22.5+ because the feedback store uses the built-in SQLite
runtime. The database file is local and ignored by Git.

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
explicit and requires one `--slot` value, so a scheduler cannot publish the
whole day in one batch. It only publishes policy-passing text/poll posts and
replies; image slots remain deferred until a public asset URL is available.

Initial live slots (Asia/Tashkent):

```bash
npm run orchestrate -- --live --slot=morning
npm run orchestrate -- --live --slot=midday
npm run orchestrate -- --live --slot=afternoon
```

The configured default is five posts per day: one poll, one image slot, two
conversation questions, and one founder/operator post. The reply monitor caps
itself at ten meaningful replies per cycle and one reply per user per day.
Replies preserve the detected language of the comment (Russian stays Russian,
English stays English). The reply monitor runs every 30 minutes and only acts
on new comments that have not already been handled.
When the OpenAI project has no credits, run `node --env-file=.env.local
src/orchestrate-cli.mjs --ai=false` to validate the Threads/state layer without
AI calls.

A manually published post is never deleted or immediately duplicated. The
agent keeps strong posts as learning signals and drafts a distinct follow-up
for weak but non-blocked posts.

## Feedback and AI tuning

Every orchestration cycle stores manual posts, manual replies, incoming
comments, and bot replies in `data/feedback.sqlite`. Inspect the collected
examples with:

```bash
npm run feedback
```

Generate a versioned AI tuning proposal without changing the live profile:

```bash
npm run learn
```

Proposals are stored in SQLite with status `proposed`. Hard exclusions and
publishing safety rules are never changed by the analyst automatically.

For each recent post, the orchestrator also records official Threads Insights
snapshots at approximately 1, 24, and 72 hours after publication. The current
read path uses `views`, `likes`, `replies`, `reposts`, `quotes`, and `shares`.
