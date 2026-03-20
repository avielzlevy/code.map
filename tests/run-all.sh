#!/usr/bin/env bash
# Run all three platform smoke tests against complex e-commerce fixtures.
# Usage:  bash tests/run-all.sh   (from repo root)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PASS=0
FAIL=0
SKIP=0

run_test() {
  local name="$1"
  local cmd="$2"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo " $name"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  if eval "$cmd"; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
    echo "  [FAIL] $name"
  fi
}

cd "$REPO_ROOT"

NESTJS_TSNODE="$REPO_ROOT/backend/packages/nestjs/node_modules/.bin/ts-node"
NESTJS_TSCONFIG="$REPO_ROOT/backend/packages/nestjs/tsconfig.json"
NEXTJS_TSNODE="$REPO_ROOT/backend/packages/nextjs/node_modules/.bin/ts-node"
NEXTJS_TSCONFIG="$REPO_ROOT/backend/packages/nextjs/tsconfig.json"

# NestJS — requires: cd backend/packages/nestjs && npm install
if [ -f "$NESTJS_TSNODE" ]; then
  run_test "NestJS e-commerce" \
    "'$NESTJS_TSNODE' --project '$NESTJS_TSCONFIG' tests/smoke-nestjs.ts"
else
  echo ""
  echo "  [SKIP] NestJS — run: cd backend/packages/nestjs && npm install"
  SKIP=$((SKIP + 1))
fi

# Next.js — requires: cd backend/packages/nextjs && npm install
if [ -f "$NEXTJS_TSNODE" ]; then
  run_test "Next.js e-commerce" \
    "'$NEXTJS_TSNODE' --project '$NEXTJS_TSCONFIG' tests/smoke-nextjs.ts"
else
  echo ""
  echo "  [SKIP] Next.js — run: cd backend/packages/nextjs && npm install"
  SKIP=$((SKIP + 1))
fi

# FastAPI — requires: Python 3.11+ with flow_map in PYTHONPATH (backend/packages/python)
run_test "FastAPI e-commerce" \
  "python tests/smoke-fastapi.py"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Results: ${PASS} passed, ${FAIL} failed, ${SKIP} skipped"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
