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
