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
existing_state_files=()
for state_file in "${state_files[@]}"; do
  [[ -e "$state_file" ]] && existing_state_files+=("$state_file")
done

if ((${#existing_state_files[@]} == 0)); then
  exit 0
fi

git config user.name "threads-smart-bot"
git config user.email "threads-smart-bot@users.noreply.github.com"

if git fetch origin bot-state >/dev/null 2>&1; then
  state_tmp_dir="$(mktemp -d)"
  state_worktree="$state_tmp_dir/worktree"
  trap 'git worktree remove --force "$state_worktree" >/dev/null 2>&1 || true; rmdir "$state_tmp_dir" >/dev/null 2>&1 || true' EXIT
  git worktree add --detach "$state_worktree" origin/bot-state >/dev/null
  for state_file in "${existing_state_files[@]}"; do
    mkdir -p "$state_worktree/$(dirname "$state_file")"
    cp "$state_file" "$state_worktree/$state_file"
  done
  (
    cd "$state_worktree"
    git add -f "${existing_state_files[@]}"
    if git diff --cached --quiet; then exit 0; fi
    git commit -m "chore: update Threads worker state [skip ci]"
    git push origin HEAD:bot-state
  )
else
  for state_file in "${existing_state_files[@]}"; do git add -f "$state_file"; done
  git commit -m "chore: initialize Threads worker state [skip ci]"
  git push origin HEAD:bot-state
fi
