#!/usr/bin/env bash
# Run all platform smoke tests against complex e-commerce fixtures.
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

# Prefer python3, fall back to python
PYTHON="$(command -v python3 || command -v python || echo '')"
if [ -z "$PYTHON" ]; then
  echo "ERROR: python3/python not found in PATH" >&2
  exit 1
fi

NESTJS_TSNODE="$REPO_ROOT/backend/packages/nestjs/node_modules/.bin/ts-node"
NESTJS_TSCONFIG="$REPO_ROOT/backend/packages/nestjs/tsconfig.json"
NEXTJS_TSNODE="$REPO_ROOT/backend/packages/nextjs/node_modules/.bin/ts-node"
NEXTJS_TSCONFIG="$REPO_ROOT/backend/packages/nextjs/tsconfig.json"

# ── TypeScript suites ───────────────────────────────────
# All three share the same @code-map/nestjs runtime (AstParserService detects
# the framework from the fixture's package.json automatically).

# NestJS — requires: cd backend/packages/nestjs && npm install
if [ -f "$NESTJS_TSNODE" ]; then
  run_test "NestJS e-commerce" \
    "'$NESTJS_TSNODE' --project '$NESTJS_TSCONFIG' tests/smoke-nestjs.ts"
else
  echo ""
  echo "  [SKIP] NestJS — run: cd backend/packages/nestjs && npm install"
  SKIP=$((SKIP + 1))
fi

# Express — same nestjs ts-node binary, detects express from package.json
if [ -f "$NESTJS_TSNODE" ]; then
  run_test "Express e-commerce" \
    "'$NESTJS_TSNODE' --project '$NESTJS_TSCONFIG' tests/smoke-express.ts"
else
  echo ""
  echo "  [SKIP] Express — run: cd backend/packages/nestjs && npm install"
  SKIP=$((SKIP + 1))
fi

# Fastify — same nestjs ts-node binary, detects fastify from package.json
if [ -f "$NESTJS_TSNODE" ]; then
  run_test "Fastify e-commerce" \
    "'$NESTJS_TSNODE' --project '$NESTJS_TSCONFIG' tests/smoke-fastify.ts"
else
  echo ""
  echo "  [SKIP] Fastify — run: cd backend/packages/nestjs && npm install"
  SKIP=$((SKIP + 1))
fi

# Hono — same nestjs ts-node binary, detects hono from package.json
if [ -f "$NESTJS_TSNODE" ]; then
  run_test "Hono e-commerce" \
    "'$NESTJS_TSNODE' --project '$NESTJS_TSCONFIG' tests/smoke-hono.ts"
else
  echo ""
  echo "  [SKIP] Hono — run: cd backend/packages/nestjs && npm install"
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

# ── Python suites ────────────────────────────────────────
# All three use the same code_map Python package (AstParserService detects
# the framework from requirements.txt / pyproject.toml automatically).
# Requires: Python 3.11+ with flow_map in PYTHONPATH (backend/packages/python)

run_test "FastAPI e-commerce" \
  "'$PYTHON' tests/smoke-fastapi.py"

run_test "Flask e-commerce" \
  "'$PYTHON' tests/smoke-flask.py"

run_test "Django REST e-commerce" \
  "'$PYTHON' tests/smoke-django-rest.py"

# ── Summary ──────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Results: ${PASS} passed, ${FAIL} failed, ${SKIP} skipped"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
