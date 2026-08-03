---
name: Bug report
about: Something behaves differently than documented
title: ''
labels: bug
assignees: ''
---

<!--
SECURITY ISSUES: do not file them here. See SECURITY.md for the private
disclosure channel.
-->

## What happened

<!-- What you observed. Include the exact error text if there is one. -->

## What you expected

## Steps to reproduce

1.
2.
3.

## Environment

- Dockstash commit / version:
- Host OS and `docker --version`:
- Which surface: <!-- web app / api / fleet agent -->
- Agent version, if relevant:
- Reverse proxy in front (nginx / Caddy / none):
- `RESTIC_RUNNER` value: <!-- process | placeholder -->

## Logs

<!--
Relevant output from `docker compose logs api --tail=100` or the agent.

⚠️ REDACT BEFORE PASTING: tokens, JWTs, MASTER_ENCRYPTION_KEY, restic repo
passwords, SSH keys, and anything from your .env.
-->

```
paste here
```

## Anything else

<!-- Screenshots, a hypothesis, what you already tried. -->
