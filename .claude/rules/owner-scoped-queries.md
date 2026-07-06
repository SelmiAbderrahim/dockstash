# Owner-Scoped Queries at Query Time - Strict Rule

## MANDATORY REQUIREMENT - ZERO TOLERANCE

**Every load of an owner-scoped resource by a URL-supplied id MUST filter by
`owner` at query time.** The database — not a subsequent `if` — is the check
that keeps foreign-tenant rows out. The pattern `Model.findById(id)` followed
by `if (row.owner !== userId)` is FORBIDDEN in controllers and services.

See `prompts/dockstash-security/02-cross-account-idor-isolation-opus-4.7.md`
and `docs/security-model.en.md` § "Cross-Account / IDOR Isolation" for the
threat model.

## Why This Rule Exists

Three failure modes the `if` catches too late:

1. **Refactor drift.** Someone splits the loader into a helper, forgets the
   `if`, and every callsite silently loses ownership.
2. **Nested children.** A `Snapshot` / `AgentJob` / `Schedule` load by URL id
   returns the row for its owner AND for anyone who guesses a valid id; the
   `if` compares against `child.parentId`, which the request may have forged.
3. **Existence oracle.** Even if the `if` throws 403, the *status difference*
   between "no row → 404" and "wrong owner → 403" enumerates the whole
   directory. Iterating ObjectIds lists every tenant's projects.

The owner-scoped query fixes all three: the query returns nothing, the
loader throws 404, the attacker's oracle collapses.

## CORRECT

```ts
// Owner scope AT QUERY TIME. The DB never returns the unowned row.
if (!isValidObjectId(projectId)) {
  throw HttpError.notFound(t('backups.error.projectNotFound'));
}
const project = await Project.findOne({ _id: projectId, owner: userId });
if (!project) throw HttpError.notFound(t('backups.error.projectNotFound'));
```

```ts
// Nested child — re-derive the owner THROUGH the parent; never trust the
// URL parentId, and additionally scope the child by the parent's _id.
const parent = await Project.findOne({ _id: req.params.projectId, owner: userId });
if (!parent) throw HttpError.notFound(t('backups.error.projectNotFound'));
const snapshot = await Snapshot.findOne({
  _id: req.params.snapshotId,
  project: parent._id,
});
if (!snapshot) throw HttpError.notFound(t('backups.error.snapshot.notFound'));
```

## FORBIDDEN

```ts
// WRONG — IDOR: findById returns the row before ownership is checked.
// An attacker iterating ObjectIds enumerates every tenant's directory by
// the 403 vs 404 status oracle.
const project = await Project.findById(req.params.id);
if (!project) throw HttpError.notFound('...');
if (project.owner.toString() !== userId) {
  throw HttpError.forbidden('...');
}

// WRONG — trusts a URL parentId for a child load. A malicious owner-B request
// with `?projectId=<owner-A-id>` returns owner-A's snapshot.
const snapshot = await Snapshot.findOne({
  _id: req.params.snapshotId,
  project: req.params.projectId,
});

// WRONG — no isValidObjectId cast; Mongoose CastError bubbles as 500 instead
// of a clean 404 (leaks that the shape was wrong vs the id was foreign).
const agent = await Agent.findOne({ _id: agentId, owner: userId });
```

## Status Conventions

| Surface | Wrong-owner status | Rationale |
|---|---|---|
| Owner-scoped resources (backups, scheduler, agents, snapshots, alerts) | **404** (cloak existence) | An attacker iterating ObjectIds cannot enumerate a tenant's directory. |
| Role-gated routes (`requireRole(...)`) | **403** | The caller *is* authenticated but lacks the role; existence of the route is public knowledge. |
| Structured import collisions (recovery envelope where the caller supplied the id) | **403** | The caller already knows the id — cloaking adds no defence. |
| Non-owner request against `requireVerified` | **403** `EMAIL_NOT_VERIFIED` | The verify gate is prior to any resource load. |

## Escape Hatch

A load path that is genuinely safe by design (e.g. Passport strategy
verifying its own JWT subject id) may bypass the ESLint rule with an inline
`// idor-safe: <one-line reason>` comment on the preceding line. The comment
is audited in code review. There are currently zero exemptions in the
codebase.

## Validation

```bash
# No controller reads a resource by URL id without an owner filter:
grep -rnE '\.findById\(\s*req\.params' server/src/modules --include='*.controller.ts' \
  | grep -v 'idor-safe:'

# Every mounted product router has a cross-account test:
#   server/src/shared/middleware/idor-meta.test.ts
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm \
  npx vitest run src/shared/middleware/idor-meta.test.ts
```

Both must return clean / green.

## Checklist

- [ ] Every URL-id load in a controller/service goes through a
      `findOne({ _id, owner })` (or an owner-scoped helper like `loadOwnedX`).
- [ ] Every nested child re-derives its owner through the parent — never
      trusts the URL `parentId`.
- [ ] Invalid ObjectId → 400/404 via `isValidObjectId`, never Mongoose 500.
- [ ] Foreign-owner requests return **404** on owner-scoped resources.
- [ ] Every product router has a cross-account test that seeds two users and
      asserts the second gets a non-200.
- [ ] `idor-meta.test.ts` stays green; no new ESLint escape-hatch comments
      without review.
