#!/bin/sh
# Seed the superadmin account (idempotent, create-once) before starting the
# API. The seeder exits 0 on skipped/exists/created and 1 on genuine failure,
# so a misconfigured Mongo fails the container fast instead of booting broken.
set -e
node dist/seed-superadmin.cjs
exec node dist/server.cjs
