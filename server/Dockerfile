# syntax=docker/dockerfile:1.7

# ---------- build stage ----------
FROM node:26-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsup.config.ts ./
COPY src ./src

RUN npm run build \
 && npm prune --omit=dev


# ---------- runtime stage ----------
FROM node:26-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080

# Bake the backup toolchain into the api image so no host tooling is assumed.
# restic         → snapshot engine (pinned release; apt bookworm ships 0.14,
#                  which lacks the snapshot `summary` the snapshots API reads)
# openssh-client → restic's sftp backend shells out to `ssh` (pinned host keys)
# pg_dump        → postgres logical dumps
# mysqldump      → mysql/mariadb dumps
# mongodump      → mongodb dumps
ARG RESTIC_VERSION=0.17.3
ARG MONGODB_DATABASE_TOOLS_VERSION=100.16.1
ARG TARGETARCH
# ponytail: MongoDB publishes Debian 12 tools only for amd64; the official
# Ubuntu 22.04 ARM64 archive is glibc-compatible. Add new arches here.
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        bzip2 \
        openssh-client \
        postgresql-client \
        default-mysql-client; \
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
    case "${TARGETARCH}" in \
      amd64) tools_platform=debian12-x86_64; tools_sha256=cb8e6a890a3697d1db4b63385093736396ab1732116c7b4c90bb5b9c03b61bbc ;; \
      arm64) tools_platform=ubuntu2204-arm64; tools_sha256=e1d5cc57741eefc1333725838e034e822674451a2e2928a3393d35afa8e8aef6 ;; \
      *) echo "Unsupported architecture: ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    tools_archive="mongodb-database-tools-${tools_platform}-${MONGODB_DATABASE_TOOLS_VERSION}"; \
    curl -fsSLo /tmp/mongodb-database-tools.tgz \
      "https://fastdl.mongodb.org/tools/db/${tools_archive}.tgz"; \
    echo "${tools_sha256}  /tmp/mongodb-database-tools.tgz" | sha256sum -c -; \
    tar -xzf /tmp/mongodb-database-tools.tgz -C /tmp; \
    install -m 0755 "/tmp/${tools_archive}"/bin/* /usr/local/bin/; \
    rm -rf "/tmp/${tools_archive}" /tmp/mongodb-database-tools.tgz; \
    mongodump --version; \
    apt-get purge -y --auto-remove curl bzip2; \
    rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --chmod=0755 docker-entrypoint.sh ./docker-entrypoint.sh

# Non-root user for the runtime process.
RUN groupadd --system --gid 10001 app \
 && useradd  --system --uid 10001 --gid app --home /app --shell /usr/sbin/nologin app \
 && mkdir -p /self-backup \
 && chown -R app:app /app /self-backup
USER app

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+ (process.env.PORT || 8080) +'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

# Entrypoint wrapper — execs the server.
ENTRYPOINT ["/app/docker-entrypoint.sh"]
