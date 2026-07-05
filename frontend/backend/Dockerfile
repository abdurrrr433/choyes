# syntax=docker/dockerfile:1
# ── Build stage ────────────────────────────────────────────────────────────────
# Secrets (JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, SESSION_ENC_KEY_BASE64, etc.)
# are NOT passed as ARG or ENV here. They are injected by Railway at runtime
# via its environment variable system and read by the app via process.env.
# This satisfies Docker's SecretsUsedInArgOrEnv lint rule.
FROM node:20-alpine AS deps

WORKDIR /app

# Copy only dependency manifests first for layer caching. The lockfile is
# optional because this backend can be deployed independently from /frontend.
COPY package*.json ./

# Install all deps (including devDeps needed for prisma generate)
RUN npm install

# ── Runtime stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Generate Prisma client at build time (uses schema only, no DB connection needed)
RUN node_modules/.bin/prisma generate

# Expose the port Railway injects at runtime via $PORT
EXPOSE 4000

# start.sh handles: prisma migrate deploy → node src/index.js
# All secrets are read from Railway's runtime environment — never baked in here.
CMD ["sh", "start.sh"]
