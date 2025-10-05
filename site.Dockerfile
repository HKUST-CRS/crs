# Reference
# https://github.com/vercel/next.js/tree/canary/examples/with-docker

# Use Bun's official image
FROM oven/bun:1-alpine AS base

WORKDIR /app

# Install dependencies with bun
FROM base AS deps
COPY package.json bun.lock* ./
COPY packages/service/package.json ./packages/service/
COPY packages/server/package.json ./packages/server/
COPY packages/site/package.json ./packages/site/
RUN bun install --no-save --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED=1

RUN cd packages/site && bun run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

# Uncomment the following line in case you want to disable telemetry during runtime.
ENV NEXT_TELEMETRY_DISABLED=1

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# No /public directory in this project now, so commented out.
# COPY --from=builder /app/packages/site/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/packages/site/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/packages/site/.next/static ./packages/site/.next/static

USER nextjs

EXPOSE 3000

CMD ["bun", "./packages/site/server.js"]