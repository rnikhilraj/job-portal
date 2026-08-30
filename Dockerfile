# syntax=docker/dockerfile:1
#
# Node 22 LTS, not 20: Node 20 left maintenance in April 2026, so an image built
# on it no longer receives security patches. 22 is supported to April 2027.

# ---------------------------------------------------------------------------
# Stage 1 — install dependencies (cached independently of source changes)
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci


# ---------------------------------------------------------------------------
# Stage 2 — build the Next.js standalone server
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# No runtime secrets are needed here: env parsing is lazy (see src/lib/env.ts),
# so the build never touches MONGODB_URI or JWT_SECRET.
RUN npm run build


# ---------------------------------------------------------------------------
# Stage 3 — minimal runtime image
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Patch the base image's OS packages, then delete npm.
#
# `output: 'standalone'` emits a server that runs as `node server.js` and never
# shells out to a package manager, so npm is dead weight in this stage — and not
# harmless dead weight: every HIGH/CRITICAL CVE the image scan reported came
# from npm's own bundled dependencies (tar, sigstore, pacote, brace-expansion),
# not from anything this app installs. Removing it drops the whole class and
# shrinks the runtime attack surface to the Node binary and the traced modules.
#
# The `apk upgrade` covers the other half — libssl3/libcrypto3 lag the base tag
# between releases, so pinning the tag alone leaves known-fixed OS CVEs in place.
RUN apk --no-cache upgrade \
  && rm -rf /usr/local/lib/node_modules/npm \
    /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm \
    /usr/local/bin/npx \
    /usr/local/bin/corepack \
    /opt/yarn-v* \
    /usr/local/bin/yarn \
    /usr/local/bin/yarnpkg

# Run as an unprivileged user rather than root.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# `output: 'standalone'` emits server.js plus only the traced node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Mount point for the resume volume; must be writable by the runtime user.
RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
