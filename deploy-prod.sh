#!/usr/bin/env bash
# Jobstronaut Frontend: One-click Production Deploy (minified)
# Copies index.min.html over index.html, commits, and pushes to main.

set -euo pipefail

# Colors
GREEN="\033[0;32m"
RED="\033[0;31m"
NC="\033[0m"

echo -e "${GREEN}==> Jobstronaut: Production deploy starting...${NC}"

# Ensure we are in a git repo
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo -e "${RED}Error:${NC} Not inside a git repository. cd into your frontend repo and retry."
  exit 1
fi

# Verify required files
if [ ! -f "index.min.html" ]; then
  echo -e "${RED}Error:${NC} index.min.html not found in current directory."
  exit 1
fi

# Optional: confirm branch
current_branch=$(git rev-parse --abbrev-ref HEAD)
echo "Current branch: $current_branch"
if [ "$current_branch" != "main" ] && [ "$current_branch" != "master" ]; then
  echo -e "${RED}Warning:${NC} You are on branch '$current_branch'. Proceeding anyway..."
fi

# Copy minified over the served file
cp index.min.html index.html

# Stage and commit
git add index.html
commit_msg="feat(frontend): production build (minified) - $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
git commit -m "$commit_msg" || {
  echo -e "${RED}Nothing to commit.${NC} Did index.html change?"
  exit 0
}

# Push
git push origin "$current_branch"

echo -e "${GREEN}==> Done.${NC} Render should auto-deploy your static site."
