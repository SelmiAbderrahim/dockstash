# Backup core

Dockstash treats every project at `/var/www/<name>` as a bundle of four backup layers:
project files, databases, reverse-proxy configs, and compose metadata. This page
explains what `scanProject` detects and how a run actually executes.

## What `scanProject` detects

Given a project path, `scanProject`:

1. Reads `<path>/docker-compose.yml`.
2. Walks every service. For each `image`, the adapter registry (`postgres`,
   `mysql`, `mariadb`, `mongo`) claims it and records a database layer with a
   resolved container name and an argv-only dump command.
3. Notes reverse-proxy config paths — `/etc/traefik` when a service uses a
   Traefik image, `/etc/nginx` for nginx.
4. Returns a `plan { paths, databases[], configs[] }` you can edit in the UI
   before saving it on the project.

## The dump-then-restic rule

Live database files are **never** copied off disk. For every enabled database
layer, Dockstash runs `docker exec <container> <dumpCmd>` and streams the dump
straight into `restic backup --stdin`. Consistency flags are baked into each
adapter — `mysqldump --single-transaction`, `mongodump --oplog`, `pg_dumpall`
against the live server.

Every command is an **argv array** — no shell interpolation, no `sh -c`. A
compose env value containing `$(rm -rf /)` becomes a literal token, not a
subshell.

## The `/var/www/*` allowlist

Every path — the project's own path, extra paths in the plan, values submitted
by the API — is validated against the `/var/www/*` allowlist. Empty strings,
traversal segments (`..`), NUL bytes, symlink shortcuts, and any path outside
`/var/www` are rejected before restic or dockerode ever see them.

## Ownership

Projects are user-scoped. Every route on `/api/backups` requires a JWT, and
every project resource is loaded through an ownership check that returns `403`
when the caller is not the owner. The Restic repo password lives in the project
record only as an AES-256-GCM ciphertext; the plaintext is only ever decrypted
in-process at run time and is never returned to the client.
