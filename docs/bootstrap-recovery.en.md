# Bootstrap recovery

This runbook covers the "production VPS is gone" scenario. It assumes only
three things survived:

1. The **storage VPS** (with your restic repositories intact).
2. The **`MASTER_ENCRYPTION_KEY`** (backed up out of band).
3. Your saved **configuration export envelope** (`dockstash-export-*.json`).

Without all three the repositories are unrecoverable — the export envelope is
inert without the master key, and the master key is useless without the
storage repos to point at.

## 1. Stand up a fresh agent

Provision a clean production VPS. Clone the repo, populate `.env`, and bring
up the stack:

```bash
docker compose up -d
```

The `api`, `web`, `mongo`, `redis`, and `docker-socket-proxy` services come up
against an empty Mongo. No projects are visible yet.

## 2. Supply the same `MASTER_ENCRYPTION_KEY`

Populate `./secrets/master_encryption_key` with the byte-identical key from
the old agent. Do **not** generate a new one — every ciphertext in the export
envelope is bound to this key.

## 3. Import the export envelope

Sign in as any user with the same identity as the old owner, then POST the
saved envelope to `/api/recovery/import`:

```bash
curl -X POST http://localhost:8080/api/recovery/import \
  -H "Authorization: JWT $TOKEN" \
  -H "Content-Type: application/json" \
  -d @dockstash-export-2026-07-01.json
```

The import validates the envelope shape (`.strict()` zod), refuses any field
that looks like a plaintext secret, and decrypts every ciphertext with your
master key. A tampered envelope, or an envelope whose `keyVersion` this agent
cannot decrypt, is rejected with `HTTP 400`.

## 4. Confirm storage reachability

After import, `restic snapshots` runs against each project's repo using the
decrypted password. A green response confirms:

- The storage VPS is reachable.
- The password decrypts under the current `MASTER_ENCRYPTION_KEY`.
- The repository is not corrupted.

## 5. Restore

Trigger a restore drill from the dashboard or via the scheduler. Snapshots
are restored to a scratch workspace and byte/row-diffed against expected
metadata.

## The three-thing invariant

**Losing the master key or the recovery codes makes the export envelope
inert.** The envelope carries only AES-256-GCM ciphertext. It is safe to
store off-box precisely because a copy in the wrong hands is useless without
the key.

Store `MASTER_ENCRYPTION_KEY` and the recovery codes on separate media, in
separate physical locations, and never in the same backup as the envelope.
