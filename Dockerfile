# Light the Ham! - Production Dockerfile
# Multi-stage build for minimal image size

# =============================================================================
# Stage 1: Build
# =============================================================================
FROM node:24.22.1-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .

# Create data directory for build (SQLite needs it during Astro build)
RUN mkdir -p data && pnpm build

# =============================================================================
# Stage 2: Production
# =============================================================================
FROM node:24.22.1-alpine AS runner

# Install pnpm for production deps
RUN corepack enable && corepack prepare pnpm@latest --activate

# Add non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 astro

WORKDIR /app

# Copy package files and install ALL deps (need drizzle-kit for migrations)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy built application and source (needed for drizzle schema)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/drizzle.config.ts ./
# Versioned migration files — the entrypoint reads ./drizzle/ on startup.
COPY --from=builder /app/drizzle ./drizzle

# Create data and uploads directories
RUN mkdir -p data public/uploads && \
    chown -R astro:nodejs data public/uploads /app

# Copy entrypoint script with execute permissions
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# Switch to non-root user
USER astro

# Expose port
EXPOSE 4321

# Environment defaults
ENV HOST=0.0.0.0
ENV PORT=4321
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:4321/ || exit 1

# Run entrypoint (migrations) then server
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "./dist/server/entry.mjs"]
