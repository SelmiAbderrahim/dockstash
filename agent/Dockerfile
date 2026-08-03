# syntax=docker/dockerfile:1.7

# ---------- build stage ----------
FROM node:26-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src

RUN npm run build \
 && npm prune --omit=dev


# ---------- runtime stage ----------
FROM node:26-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production

# Same pinned backup toolchain as the api image (server/Dockerfile):
# restic (pinned release, SHA256-verified) + openssh-client for the sftp backend.
ARG RESTIC_VERSION=0.17.3
ARG TARGETARCH
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        bzip2 \
        openssh-client; \
    curl -fsSLo /tmp/restic.bz2 \
      "https://github.com/restic/restic/releases/download/v${RESTIC_VERSION}/restic_${RESTIC_VERSION}_linux_${TARGETARCH}.bz2"; \
    curl -fsSLo /tmp/SHA256SUMS \
      "https://github.com/restic/restic/releases/download/v${RESTIC_VERSION}/SHA256SUMS"; \
    grep "restic_${RESTIC_VERSION}_linux_${TARGETARCH}.bz2" /tmp/SHA256SUMS \
      | sed 's#  .*#  /tmp/restic.bz2#' | sha256sum -c -; \
    bunzip2 -c /tmp/restic.bz2 > /usr/local/bin/restic; \
    chmod 0755 /usr/local/bin/restic; \
    rm -f /tmp/restic.bz2 /tmp/SHA256SUMS; \
    /usr/local/bin/restic version; \
    apt-get purge -y --auto-remove curl bzip2; \
    rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

# Non-root runtime user.
RUN groupadd --system --gid 10001 app \
 && useradd  --system --uid 10001 --gid app --home /app --shell /usr/sbin/nologin app \
 && chown -R app:app /app
USER app

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.HEALTH_PORT||9924)+'/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["node", "dist/index.js"]
