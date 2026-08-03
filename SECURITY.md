# Security policy

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Email **support@dockstash.com** with:

- what the issue is, and the impact you believe it has;
- the steps to reproduce it (a minimal repro beats a long description);
- the version or commit you tested against;
- anything you already know about a fix.

You should get an acknowledgement within **3 business days**. We aim to give you
an assessment and a rough remediation timeline within **10 business days** of
that acknowledgement. If a fix is warranted, we will coordinate disclosure with
you and credit you in the release notes unless you would rather stay anonymous.

If you have not heard back within a week, please send a follow-up — a missed
email is far more likely than a deliberate silence.

## Supported versions

Dockstash is self-hosted software released from a single `master` line. Security
fixes land on `master` and are described in `CHANGELOG.md`; there are no
long-lived maintenance branches.

| Version | Supported |
|---|---|
| Latest `master` | ✅ |
| Anything older | ❌ — upgrade first, then report if it persists |

Before reporting, please confirm the issue reproduces on current `master`.

## Scope

**In scope** — anything in this repository that a self-hoster runs:

- The API (`server/`), including auth, the fleet-agent machine surface
  (`/api/agent/*`), and the data-rights endpoints.
- The web app (`client/`).
- The fleet agent daemon (`agent/`).
- The container images and `docker-compose.yml` as shipped, including the
  socket-proxy configuration.
- Secret handling: the AES-256-GCM envelope layer, key derivation, log
  redaction.

**Out of scope**:

- Vulnerabilities in third-party dependencies with no exploitable path through
  Dockstash — report those upstream.
- Findings that require an attacker to already have host root, the
  `MASTER_ENCRYPTION_KEY`, or an admin session.
- Misconfiguration of *your* deployment: an exposed Mongo port, a missing
  reverse proxy, a reused secret from `.env.example`.
- Social engineering, physical access, and denial of service via raw volume.
- Missing hardening that is documented as deliberately out of scope in
  [docs/security-model.en.md](docs/security-model.en.md).

## Threat model

The controls Dockstash implements, why they exist, and what is deliberately not
covered are documented separately in
**[docs/security-model.en.md](docs/security-model.en.md)**. That document is the
threat model; this one is the reporting process. Reading the former first will
tell you whether something is a finding or a documented trade-off.

## A note on the master key

`MASTER_ENCRYPTION_KEY` wraps every secret at rest, including the passwords to
the restic repositories holding backups. Anything that can exfiltrate it, log
it, or reduce its effective entropy is a critical finding — please report it
even if the path looks narrow.
