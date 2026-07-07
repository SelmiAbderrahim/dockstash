# No Query Injection + I18n-Keys-Only Errors (Surface #8) - Strict Rule

## MANDATORY REQUIREMENT - ZERO TOLERANCE

**Every Mongoose query builder in `server/src/modules/**` is fed a
zod-parsed, typed object. NEVER spread `req.query` / `req.body` /
`req.params` (or a member thereof) into a `.find(...)` / `.findOne(...)`
/ `.updateOne(...)` / `.updateMany(...)` / `.deleteOne(...)` /
`.deleteMany(...)` / `.countDocuments(...)` / `.where(...)` /
`.findOneAndUpdate(...)` / `.findOneAndDelete(...)` filter. Every URL
`id` is cast with `isValidObjectId` (or an anchored `[0-9a-fA-F]{24}$`
zod regex) BEFORE it reaches Mongoose — invalid ids return 400/404,
never a Mongoose CastError 500. No user-controlled `$where` / `$regex`
/ `$expr` reaches a query — the only regex searches allowed are anchored
matches on caller-escaped input with a length cap.

`/api/superadmin` is gated at the app-level mount by
`[requireAuth, requireVerified, requireRole(ROLE_SUPERADMIN)]`. The
sub-router NEVER re-imports its own auth middleware — the parent mount is
the single source of the gate. A future sub-route that skips the parent
mount is a Critical finding.

Data-rights flows are owner-scoped (`userId: req.user.id`, never trust
a body `userId`). Deletion schedules a purge `ACCOUNT_DELETION_GRACE_HOURS`
in the future via `PurgeQueue.enqueuePurge` — NEVER a synchronous hard
purge. A `legalHold` flag on the user OR project skips purge and blocks
schedule.

Error responses reaching the client are i18n keys (resolved per
`Accept-Language`), never `err.stack`, never a raw `err.message`
untranslated, never an internal file path, never a secret. The stack is
logged (pino-redacted), never sent on the wire — even in
`NODE_ENV=development`.**

See `prompts/dockstash-security/08-injection-and-output-opus-4.7.md`,
`prompts/SECURITY.md` § "8. INJECTION & OUTPUT",
`docs/security-model.en.md` § "Injection & Output",
`docs/data-rights.en.md` for the threat model + purge runbook.

## Why This Rule Exists

Five failure modes this rule blocks in one pattern:

1. **Operator injection.** `Model.find(req.query)` with
   `?role[$gt]=` lets a caller build the `{$gt:''}` filter server-side
   and read every row. Zod-parsed, typed inputs strip unknown keys
   (`.strip()` default) or reject them (`.strict()`), so `$`-prefixed
   keys never reach the DB.
2. **Cast-error 500 vs 400.** Passing a non-ObjectId string to
   `findById` throws a `CastError` that the error handler maps to 500 —
   both leaks (a distinguishable failure mode) and noise. An anchored
   regex or `isValidObjectId` returns 400 uniformly.
3. **`$where` / `$regex` DoS.** A user-controlled regex is a
   ReDoS-in-Mongo primitive; `$where` runs arbitrary JS server-side.
   Neither is ever accepted from a request body / query.
4. **Superadmin isolation drift.** Mount-level gating is auditable in
   one place; per-handler gating drifts and eventually misses one.
5. **Stack / message leakage.** `err.stack` on the wire reveals file
   paths, module boundaries, and anything captured in the throw. Raw
   `err.message` reveals internal state (Mongoose messages, third-party
   library text). The error handler translates i18n keys only; unknown
   errors resolve to `errors.internal`.

## CORRECT

```ts
// Strict zod rejects operator-injection keys ($gt, $where, $regex) at the boundary.
const listSchema = z.object({
  status: z.enum(['active', 'archived']).optional(),
  page: z.coerce.number().int().min(1).default(1),
}).strict();

const q = listSchema.parse(req.query);          // typed values — never spread req.query
if (req.params.id && !isValidObjectId(req.params.id)) {
  throw HttpError.badRequest('errors.invalidId');
}
const rows = await Project.find({
  owner: req.user.id,                            // always owner-scoped
  ...(q.status ? { status: q.status } : {}),    // explicit typed fields only
});
```

```ts
// Owner-scoped data-rights export — the id comes from the JWT, not the body.
export const exportMyData: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw HttpError.unauthorized(req.t?.('errors.unauthorized'));
  const data = await exportUserData(req.user.id, { t: req.t });  // JWT id ONLY
  res.status(200).json(data);
});
```

```ts
// Grace-window purge — mark + enqueue, never a synchronous hard delete.
const purgeAt = new Date(now.getTime() + deps.graceHours * 60 * 60 * 1000);
user.deletionScheduledAt = purgeAt;
await user.save();
await deps.queue.enqueuePurge({ userId, purgeAt });
```

```ts
// error-handler.ts — i18n key + correlation id ONLY; never err.stack / err.message raw.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    const message = translateMessage(req, err.message);
    res.status(err.status).json({ error: { message, details: err.details } });
    return;
  }
  logger.error({ reqId: req.id, err }, 'unhandled error');  // full detail to logs (redacted)
  res.status(500).json({ error: { message: translateMessage(req, 'errors.internal') } });
};
```

## FORBIDDEN

```ts
// WRONG — spread of req.query into a query filter. Operator injection.
const rows = await Project.find({ owner: req.user.id, ...req.query });

// WRONG — bare req.body as a Mongoose filter.
await User.updateOne(req.body, { $set: { role: 'admin' } });

// WRONG — findById on a raw request param. CastError 500 on non-ObjectId input.
const project = await Project.findById(req.params.id);
```

```ts
// WRONG — user-controlled $where / $regex reaching the DB.
await User.find({ $where: `this.email == '${req.query.email}'` });
await Project.find({ name: { $regex: req.query.q } });
```

```ts
// WRONG — data-rights export trusting a body userId. Cross-tenant exfil.
export const exportMyData: RequestHandler = async (req, res) => {
  const data = await exportUserData(req.body.userId);   // attacker-controlled
  res.status(200).json(data);
};

// WRONG — synchronous hard purge with no grace window / legalHold check.
await User.deleteOne({ _id: req.user.id });
await Project.deleteMany({ owner: req.user.id });
```

```ts
// WRONG — stack on the wire. Even in development.
res.status(500).json({ error: { message: err.message, stack: err.stack } });

// WRONG — raw err.message on the wire. Leaks Mongoose text / library internals.
res.status(500).json({ error: { message: err.message } });

// WRONG — spread of the exception body. Leaks captured context.
res.status(500).json({ error: { ...err } });
```

```ts
// WRONG — superadmin sub-router re-importing its own gate. Auditability sinkhole.
// server/src/modules/superadmin/superadmin.routes.ts
import { requireRole } from '../../shared/middleware/require-role.js';
superadminRouter.use(requireRole(ROLE_SUPERADMIN));
```

## Contract

For every mutating / listing controller:

1. **Zod-parse first.** `Schema.parse(req.body/query/params)` before any
   Mongoose call. `.strict()` on any schema that must reject unknown
   keys (default `.strip()` is acceptable for most surfaces because it
   drops `$`-prefixed keys silently, but strict is preferred for
   list/query surfaces where operator injection is the primary risk).
2. **Cast every id.** Anchored `[0-9a-fA-F]{24}$` regex in the zod
   schema, OR `isValidObjectId(...)` before `findOne({_id, owner})`.
3. **No user-controlled `$where` / `$regex` / `$expr`.** Any regex
   search escapes the input with `escapeRegExp`, anchors the match, and
   caps the input length.
4. **Owner-scoped queries.** Every owner-scoped resource load carries
   `owner: req.user.id` at query time — see
   `.claude/rules/owner-scoped-queries.md`.
5. **Superadmin gate at the mount.** `app.ts` mounts
   `/api/superadmin` behind
   `[requireAuth, requireVerified, requireRole(ROLE_SUPERADMIN)]`. The
   sub-router imports NO auth middleware.
6. **Data-rights owner-scope + grace + legalHold.** The controller uses
   `req.user.id`, never a body `userId`. `scheduleAccountDeletion`
   enqueues a purge `env.ACCOUNT_DELETION_GRACE_HOURS` in the future;
   `purgeAccount` respects `user.legalHold` (block) and
   `project.legalHold` (skip). No synchronous hard purge.
7. **Error handler = i18n keys only.** `HttpError`'s message is treated
   as a key when it looks like one (`errors.foo.bar`) and translated;
   otherwise verbatim. Unknown errors resolve to `errors.internal`.
   Response body: `{ error: { message, details? } }` — never `stack`,
   never `err.message` untranslated, never `...err`.

## Escape Hatch

None. A regression on any bullet above is a Critical finding, not a
judgment call. The one narrow allowance: a `Model.findById(id)` in a
service that received its `id` from an already-owner-scoped join (e.g.
`ownerOfAgentJob` returning a Project owner id) is fine, because the
`id` was DB-derived, not URL-derived. Mark such calls with an inline
`// idor-safe:` comment (audited in review; overlaps
`.claude/rules/owner-scoped-queries.md`).

## Validation

```bash
# STEP 5 static guard — green:
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm \
  npx vitest run src/shared/middleware/injection-and-output-meta.test.ts

# Grep smoke tests (should all return nothing):
grep -rnE '\.find(?:One|OneAndUpdate|OneAndDelete)?\(\s*(?:\{\s*)?\.{0,3}req\.(query|body|params)' \
  server/src/modules --include='*.ts'
grep -rnE '\$where|\$regex|\$expr' server/src/modules --include='*.ts'
```

All three must return clean / green.

## Checklist

- [ ] Every list/get/update/delete controller zod-parses its inputs
      BEFORE any Mongoose call.
- [ ] Every URL id is cast (`isValidObjectId` or anchored regex) —
      invalid → 400, never 500.
- [ ] No `req.query`/`req.body`/`req.params` spread into any Mongoose
      filter.
- [ ] No user-controlled `$where` / `$regex` / `$expr` anywhere.
- [ ] `/api/superadmin` is gated at the app.ts mount only; the sub-
      router imports no auth middleware.
- [ ] Data-rights export uses `req.user.id`; deletion enqueues a purge
      after the env-configured grace window and respects `legalHold`.
- [ ] `error-handler.ts` emits i18n keys + optional zod details only;
      no `stack`, no raw `err.message`, no `...err` on the wire.
- [ ] `injection-and-output-meta.test.ts` stays green.
