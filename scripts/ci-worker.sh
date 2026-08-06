#!/usr/bin/env bash
set -euo pipefail

MODE="${1:?mode is required}"
SLOT="${2:-}"

mkdir -p data
if git fetch origin bot-state >/dev/null 2>&1; then
  git checkout origin/bot-state -- data >/dev/null 2>&1 || true
fi

case "$MODE" in
  content)
    case "$SLOT" in
      morning|midday|afternoon) npm run orchestrate:ci -- --live --slot="$SLOT" --max-replies=0 --limit=25 ;;
      *) echo "Unknown content slot: $SLOT" >&2; exit 2 ;;
    esac
    ;;
  replies)
    npm run orchestrate:ci -- --live --draft-content=false --max-replies=10 --limit=25
    ;;
  learn)
    npm run learn:ci -- --limit=100
    ;;
  health)
    npm run orchestrate:ci -- --ai=false --draft-content=false --max-replies=0 --limit=25
    ;;
  *)
    echo "Unknown mode: $MODE" >&2
    exit 2
    ;;
esac

shopt -s nullglob
state_files=(data/feedback.sqlite data/feedback.sqlite-* data/threads-state.json data/orchestration-cycle.json)
for state_file in "${state_files[@]}"; do
  [[ -e "$state_file" ]] || continue
  git add -f "$state_file"
done

if git diff --cached --quiet; then
  exit 0
fi

git config user.name "threads-smart-bot"
git config user.email "threads-smart-bot@users.noreply.github.com"
git commit -m "chore: update Threads worker state [skip ci]"
git push origin HEAD:bot-state
