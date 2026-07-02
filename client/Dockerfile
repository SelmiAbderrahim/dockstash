# syntax=docker/dockerfile:1.7

# ---------- build stage ----------
FROM node:20-bookworm-slim AS build
WORKDIR /app

# Vite build-time env — sourced from compose build args, never literal.
ARG VITE_API_BASE_URL
ARG VITE_SOCKET_URL
ARG VITE_SITE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_SOCKET_URL=${VITE_SOCKET_URL} \
    VITE_SITE_URL=${VITE_SITE_URL}

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.node.json vite.config.ts index.html server.js app-paths.mjs app-paths.d.mts ./
COPY public ./public
COPY src ./src

# Produces dist/client (browser bundle + index.html) and dist/server (SSR bundle).
RUN npm run build


# ---------- runtime stage ----------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

# Production dependencies only (express, compression, sirv + SSR runtime deps).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js app-paths.mjs ./
COPY --from=build /app/dist ./dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "server.js"]
