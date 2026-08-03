# syntax=docker/dockerfile:1.7

# ---------- build stage ----------
FROM node:24-bookworm-slim AS build
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends fontconfig fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/*

# Vite build-time env — sourced from compose build args, never literal.
ARG VITE_API_BASE_URL
ARG VITE_SOCKET_URL
# AGPL-3.0 §13 source offer — point at your fork if you deploy modifications.
ARG VITE_SOURCE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_SOCKET_URL=${VITE_SOCKET_URL} \
    VITE_SOURCE_URL=${VITE_SOURCE_URL}

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.node.json vite.config.ts index.html server.js ./
COPY public ./public
COPY scripts ./scripts
RUN npm run assets:brand
COPY src ./src

# Produces dist/ — the hashed browser bundle plus index.html.
RUN npm run build


# ---------- runtime stage ----------
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

# Production dependencies only (express, helmet, compression, sirv).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js ./
COPY --from=build /app/dist ./dist

# Non-root runtime user (mirrors agent/Dockerfile). The web server binds an
# unprivileged port (3000) and only reads from /app, so no root is needed.
RUN groupadd --system --gid 10001 app \
 && useradd  --system --uid 10001 --gid app --home /app --shell /usr/sbin/nologin app \
 && chown -R app:app /app
USER app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "server.js"]
