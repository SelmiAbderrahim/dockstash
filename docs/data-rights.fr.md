> Note: this document is currently maintained in English. Localized parity is planned in a future prompt.

# Data rights & account deletion (GDPR)

Dockstash implements the GDPR data-rights surfaces described in the data-rights design:
export, right-to-deletion with a grace period, and legal-hold override.

## Export

- **Endpoint** — `POST /api/legal/export` (auth required).
- **Contents** — the calling user's account fields (email, profile, role,
  language, timestamps), every project they own, and each project's plan.
  The restic repo password is exported as **ciphertext only** — the same
  AES-256-GCM envelope stored in Mongo (see prompt 09 for the disaster-
  recovery equivalent).
- **Scope** — `userId` is taken from the JWT. Cross-user exports are rejected
  by the ownership check on `Project.owner`.

## Right to deletion

- **Endpoint** — `POST /api/legal/delete-account` (auth + CSRF).
- **Flow** —
  1. `User.deletionScheduledAt` is set to `now + ACCOUNT_DELETION_GRACE_HOURS`
     (default 30 days).
  2. A repo-purge job is enqueued via the prompt-05 scheduler queue for the
     purge timestamp.
  3. A final Resend warning email fires now, and again 24 hours before purge
     if the account is still scheduled.
- **Cancellation** — before the purge timestamp, the user can undo the
  request; `deletionScheduledAt` is cleared and the queued job is a no-op.
- **Purge** — `legal.service.ts::purgeAccount` runs at the scheduled time and:
  - refuses if `User.legalHold` is set;
  - skips any project with `legalHold: true` (retained until legal releases
    the hold);
  - runs the restic repo purge on remaining projects, then deletes the user.

The purge is a **queued job**, not synchronous. A crash between the request
and the scheduled time leaves the schedule intact; a nightly sweep re-attempts
the warning email if the first send failed.

## Legal hold

`legalHold` on a project or user overrides retention and deletion:

| Job | Held project | Held user |
|-----|-------------|-----------|
| `runPrune` (retention) | returns ok, no `forget --prune` issued | n/a |
| `scheduleAccountDeletion` | n/a | rejected with 403 |
| `purgeAccount` | skipped, other projects still purged | refused entirely |

Legal releases the hold by clearing the flag; retention/purge resumes on the
next scheduled tick.

## Data residency

You choose the storage target, so data residency is entirely under your
control: backups live wherever the restic repository you configured lives.

## Where this fits

You are the data controller for your own install. See
`docs/security-model.en.md` for the encryption + blast-radius model.
