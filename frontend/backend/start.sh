#!/usr/bin/env sh
set -e

echo "Starting Railway boot sequence..."

# Prisma CLI can be omitted in strict production installs.
if [ -x "./node_modules/.bin/prisma" ]; then
  echo "Generating Prisma client..."
  if ! ./node_modules/.bin/prisma generate; then
    echo "WARNING: prisma generate failed. Continuing startup..."
  fi

  if [ "${RUN_PRISMA_MIGRATIONS:-false}" = "true" ] && [ -d "./prisma/migrations" ]; then
    echo "Running Prisma migrations (deploy)..."
    if ! ./node_modules/.bin/prisma migrate deploy; then
      echo "WARNING: prisma migrate deploy failed. Continuing startup..."
    fi
  elif [ "${RUN_PRISMA_DB_PUSH:-false}" = "true" ]; then
    echo "No prisma/migrations directory found. Running prisma db push..."
    if ! ./node_modules/.bin/prisma db push; then
      echo "WARNING: prisma db push failed. Continuing startup..."
    fi
  else
    echo "Skipping Prisma schema push. Set RUN_PRISMA_DB_PUSH=true only for empty/dev databases."
  fi
else
  echo "Prisma CLI not found in node_modules. Skipping generate/migrate."
fi

echo "Launching API..."
if [ -f "./src/index.js" ]; then
  exec node ./src/index.js
fi

if [ -f "./backend/src/index.js" ]; then
  exec node ./backend/src/index.js
fi

echo "ERROR: Cannot find src/index.js from current working directory."
echo "Current dir: $(pwd)"
exit 1
