import mongoose, { type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * Per-owner reservation counter for gated resource creation. Closes the TOCTOU
 * window between `countDocuments()` and `Project.create()`: a concurrent second
 * request at `remaining == 1` fails the atomic guard
 * (`findOneAndUpdate({ owner, projects: { $lt: cap } }, { $inc: { projects: 1 } })`)
 * — either the `$lt` filter no longer matches, or the upsert-insert collides on
 * the unique `owner` index. Either way, exactly one request wins. See
 * `.claude/rules/entitlement-cap-ordering.md`.
 *
 * Invariant: `projects` reflects the count of ACTIVE (non-paused) projects
 * owned by `owner`. Mutated only through the reserve/release/decrement helpers
 * in `entitlements.service.ts` and the lifecycle-side pause/unpause paths in
 * `lifecycle.service.ts` / `legal.service.ts`. Drift-high (counter > real) is
 * safe (over-strict); drift-low would over-cap and is prevented by
 * increment-before-insert ordering.
 */
const usageCounterSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    projects: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);

export type UsageCounterDocument = InferSchemaType<typeof usageCounterSchema>;
export type UsageCounterHydrated = HydratedDocument<UsageCounterDocument>;

export const UsageCounter =
  (mongoose.models.UsageCounter as mongoose.Model<UsageCounterDocument>) ||
  mongoose.model('UsageCounter', usageCounterSchema);
