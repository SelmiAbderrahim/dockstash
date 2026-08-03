# Schedules & live logs

Dockstash runs backup / prune / check / drill jobs on schedules — through a
serialized queue that guarantees **one job per repo at a time**. This page
explains what you can schedule, the retention → forget-flag mapping, and how to
watch a running job's live restic output.

## Schedule kinds

| Kind | What it does |
|---|---|
| `backup` | Streams DB dumps + backs up paths/configs via `restic backup`. |
| `prune` | Runs `restic forget --prune` with your retention policy. |
| `check` | Runs `restic check` — structural integrity of the repo. |
| `drill` | Restores the latest snapshot into a scratch workspace and diffs it. |

Each schedule has a cron expression (`0 3 * * *` = daily at 03:00), an
`enabled` toggle, and — for `prune` — a retention policy.

## One job per repo, always

A repository can only run one job at a time. Two schedules that fire together
on the same repo are serialized — the second waits for the first. Different
repos run in parallel.

**Why:** concurrent restic operations on the same repo corrupt the repo. The
queue is not an optimization — it's the correctness contract.

Prune is a separate kind, never inline with a backup — it holds the repo lock
and is destructive. Running it in the same job as a backup would leave you
with neither backup nor prune if either failed halfway.

## Retention → `forget` flags

Your `retention` policy maps directly to restic `forget --prune`:

```
retention.keepDaily   → --keep-daily <n>
retention.keepWeekly  → --keep-weekly <n>
retention.keepMonthly → --keep-monthly <n>
```

Example: `{ keepDaily: 7, keepWeekly: 4, keepMonthly: 6 }` runs
`restic forget --prune --keep-daily 7 --keep-weekly 4 --keep-monthly 6`.

## Live logs

Every running job streams its restic stdout/stderr over the retained Socket.IO
server. Connect to the `/scheduler` namespace with your JWT, then:

```
socket.emit('join', { jobId: '<id>' }, (ack) => { /* { ok, room } */ })
```

You can only join rooms for jobs you own. On success you'll receive `log`
events line-by-line, then a terminal `done` (ok) or `failed` (with detail).
Non-owners are rejected at join with `{ ok: false, reason: 'forbidden' }`.

## Recovery

If a run crashes and leaves a stale restic lock, the next retry detects the
orphaned lock (no other live job holds the repo) and runs `restic unlock`
before proceeding. A live-held repo is never unlocked out from under a running
job.

Jobs auto-retry with capped exponential backoff. Repeated failures mark the
schedule `failed` and fire the alert hook (email / webhook in a later phase).
