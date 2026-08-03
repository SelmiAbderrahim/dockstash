# Dockstash documentation

Start with **[Self-hosting](self-hosting.md)** — it takes you from `git clone`
to a running stack with your first account.

## Locale convention

Most pages are translated into all seven supported locales. The filename
carries the locale suffix:

```
<topic>.en.md   English      <topic>.de.md   German
<topic>.ar.md   Arabic       <topic>.es.md   Spanish
<topic>.fr.md   French       <topic>.ru.md   Russian
                             <topic>.zh.md   Chinese
```

Links below point at the English version; swap the suffix for any other locale.
Pages with no suffix (`self-hosting.md`, this index) are English-only.

## Operating the install

| Page | What it covers |
|---|---|
| [self-hosting.md](self-hosting.md) | Requirements, quick start, the `make` targets, reverse proxy + TLS, first account, upgrading, troubleshooting |
| [fleet-agents.en.md](fleet-agents.en.md) | The pull-based VPS agent: install, token model, discovery, upgrades, troubleshooting |
| [oauth-setup.en.md](oauth-setup.en.md) | Wiring Google / GitHub sign-in (English only) |
| [languages-and-regional-settings.en.md](languages-and-regional-settings.en.md) | The seven locales, detection order, RTL |

## Using the product

| Page | What it covers |
|---|---|
| [using-the-dashboard.en.md](using-the-dashboard.en.md) | Day-to-day tour of the app surfaces |
| [backup-core.en.md](backup-core.en.md) | What gets backed up: files, databases, proxy configs, compose metadata |
| [schedules-live-logs.en.md](schedules-live-logs.en.md) | Cron schedules, retention, streaming job logs |
| [backup-verification.en.md](backup-verification.en.md) | Restore drills — proving a backup actually restores |
| [alerts-audit-and-health.en.md](alerts-audit-and-health.en.md) | Health rollups, alert channels, the audit log |

## Disaster recovery

| Page | What it covers |
|---|---|
| [self-backup.en.md](self-backup.en.md) | Backing up Dockstash's own database into a reserved restic repo |
| [bootstrap-recovery.en.md](bootstrap-recovery.en.md) | Rebuilding an install from that self-backup |

## Security, privacy, and engineering

| Page | What it covers |
|---|---|
| [security-model.en.md](security-model.en.md) | Threat model, controls, and what is deliberately out of scope |
| [data-rights.en.md](data-rights.en.md) | Data export, account deletion, grace window, legal hold |
| [ci-gates.en.md](ci-gates.en.md) | The typecheck → lint → 100%-coverage → audit pipeline |

Contributing? Read [CONTRIBUTING.md](../CONTRIBUTING.md) first — the Docker-only
command rule surprises everyone once.
