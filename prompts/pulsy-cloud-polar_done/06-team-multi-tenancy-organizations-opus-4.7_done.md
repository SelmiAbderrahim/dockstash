# Team Multi-Tenancy (Organizations) — Build Prompt

> **Team tier seats** — additive organization + member model layered on top of Pulsy's per-user scoping. Free/Pro user = org-of-one.

---

## Agent

`polar-integration` (org plugin + entitlement gating). Coordinate with
`uptime-monitor-specialist` for monitor scope changes.

## Mission

Introduce `organization` + `organizationMember` (better-auth org plugin), gated
behind the Team entitlement + `teamSeats`, scoping monitors to `organizationId`
when present and falling back to `userId` otherwise. This is the riskiest piece:
**keep it additive — do not remove per-user scoping.**

## Operating Constraints

| Rule | Detail |
|---|---|
| Additive only | Per-user scoping stays. A Free/Pro user is an implicit org-of-one; their monitors keep working unchanged. |
| Entitlement-gated | Creating an org / inviting members requires Team entitlement + available `teamSeats`. |
| Scope fallback | Queries resolve scope as `organizationId ?? userId`. Existing rows (null org) keep working. |
| Auth | Use better-auth's organization plugin; configure in `apps/server/src/auth/auth.ts`. |
| Authorization | Every org-scoped query filtered by membership per `tob-authorization.md`. |
| Excluded | No multi-region/SMS. |

## Phases

### Phase 0 — Study current scoping + better-auth org plugin
Read `apps/server/src/auth/auth.ts`, `trpc/trpc.ts` (context), and how
`uptime.ts` filters by `ctx.user.id`. Read the better-auth organization plugin
docs (use Context7) for plugin config + member/invite APIs.

### Phase 1 — Enable org plugin
Configure the organization plugin in `auth.ts`. Ensure `organization` /
`organizationMember` tables (created in prompt 01) align with the plugin's
expectations; reconcile if the plugin owns its own tables.

### Phase 2 — Scope resolution
Add a `resolveScope(ctx)` helper returning `{ userId, organizationId? }`. Thread
it through monitor/incident/channel/share queries so they filter by org when the
user acts within an org, else by `userId`. Default (no org) = today's behavior.

### Phase 3 — Org tRPC procedures
Add org procedures (`protectedProcedure`): `organization.create` (Team-gated),
`organization.invite` (seat-gated via `teamSeats`), `organization.members`,
`organization.removeMember`, `organization.leave`. Localized errors.

### Phase 4 — Entitlement integration
Org entitlements resolve from the org owner's subscription. Seat count enforced
against `teamSeats` from prompt 04.

### Tests
- Free/Pro user with no org: all existing monitor flows behave exactly as today
  (regression).
- Team user creates org, invites up to `teamSeats`; the (seats+1)th invite is
  rejected with the seat-limit key.
- Non-Team user attempting `organization.create` → forbidden with localized key.
- Monitor created in org context is scoped to `organizationId`; non-member cannot
  read it; member can.
- Scope fallback: a monitor with null `organizationId` remains owner-visible.
- 100% coverage of org procedures + scope helper. Docker-only.

### i18n
- New backend keys (prompt 08): `errors.teamSeatsExceeded`,
  `errors.orgRequiresTeam`, `errors.notOrgMember` — all 5 languages via `ctx.t`.

### Documentation
- Org model documented for `ARCHITECTURE.md` §5/§8 (prompt 10) per
  `architecture-doc-maintenance.md`.

### Agents & Skills
- Agent: `polar-integration` + `uptime-monitor-specialist`.
- Skill: `polar-provider` (entitlement gating).

## Idempotency Contract

Re-running MUST NOT re-enable the plugin twice or duplicate org procedures.
Existing single-user rows MUST remain valid (null org) after every run.
