#!/bin/sh
# Seed the superadmin account (idempotent, create-once) before starting the
# API. The seeder exits 0 on skipped/exists/created and 1 on genuine failure,
# so a misconfigured Mongo fails the container fast instead of booting broken.
set -e
node dist/seed-superadmin.cjs
# Pricing tiers: create-once on first boot, then reconcile product IDs from env
# on every subsequent boot (idempotent upsert). Run ASYNC (backgrounded) so it
# never blocks server startup — the read path also seeds a cold/empty DB as a
# fallback. Non-fatal: a seeder hiccup must not stop the API from booting.
node dist/seed-pricing-tiers.cjs &
exec node dist/server.cjs
