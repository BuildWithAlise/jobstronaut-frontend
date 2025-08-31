#!/usr/bin/env bash
set -euo pipefail
BRANCH="${1:-main}"
IGNORE='(^|/)\.git/|(^|/)node_modules/|(^|/)\.venv/|(^|/)venv/|(^|/)__pycache__/|(^|/)build/|(^|/)dist/'
cd "$(dirname "$0")"
echo "Watching $(pwd) … pushing to $BRANCH"
while inotifywait -qr -e modify,create,delete,move --exclude "$IGNORE" .; do
  if [ -n "$(git status --porcelain)" ]; then
    git add -A
    git commit -m "autopush(front): $(date -Iseconds)" || true
    git push origin "$BRANCH" || true
  fi
done
