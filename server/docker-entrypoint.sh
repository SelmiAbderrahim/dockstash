#!/bin/sh
# Seed the superadmin account (idempotent, create-once) before starting the
# API. The seeder exits 0 on skipped/exists/created and 1 on genuine failure,
# so a misconfigured Mongo fails the container fast instead of booting broken.
set -e
node dist/seed-superadmin.cjs
# Reconcile pricing-tier product IDs from env (idempotent). Keeps plans
# purchasable after Polar product IDs are configured post-initial-seed.
node dist/seed-pricing-tiers.cjs
exec node dist/server.cjs
