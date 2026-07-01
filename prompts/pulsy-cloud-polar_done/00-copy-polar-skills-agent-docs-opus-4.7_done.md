# Copy & Adapt Polar Skills, Agent, and Self-Hosting Doc — Build Prompt

> **Foundation step** — bring the Polar.sh knowledge assets from password-manager into Pulsy so every later prompt (02–04) can cite them. No payment code yet.

---

## Agent

`base-template-generator` (foundation/scaffolding work). The `polar-integration`
agent is **created by this prompt**; later prompts (01–06) use it.

## Mission

Copy and **adapt** the Polar.sh skills, the integration agent, and the
self-hosting doc from the password-manager repo
(`/Users/macbook/Desktop/password-manager`) into Pulsy. This is pure knowledge
transfer — it scaffolds the references the implementation prompts depend on.

| From `password-manager` | To Pulsy | Adapt |
|---|---|---|
| `.claude/skills/polar-api/` (SKILL + all `references/`) | `.claude/skills/polar-api/` | none — Polar API reference is verbatim |
| `.claude/skills/polar-provider/` (SKILL + `references/`, incl. `integration-checklist.md`, `type-mapping.md`) | `.claude/skills/polar-provider/` | repoint all seam paths from `pssmngr-server/packages/server/src/...` → Pulsy `apps/server/src/...`; rename plan ids → `pro_monthly`/`pro_yearly`/`team_monthly`/`team_yearly`; `pssmngr`→`pulsy`, `family`→`pro`/`team` |
| `.claude/agents/polar-integration.md` | `.claude/agents/polar-integration.md` | repoint to Pulsy paths + stack (Express/tRPC/`@pulsy/db`) |
| `docs/self-hosting/polar.md` | `docs/self-hosting/polar.md` | Pulsy plans, `pulsy-server` container, webhook route `/api/webhooks/payment/polar` |

## Operating Constraints

| Rule | Detail |
|---|---|
| Knowledge only | This prompt creates `.claude/skills/`, `.claude/agents/`, and `docs/` files **only** — no `apps/` or `packages/` source code. |
| Preserve structure | Keep the source directory layout and the `references/` split intact. |
| Pulsy naming | Container names `pulsy-*`; never `dokploy-*`/`pssmngr-*`/`serverless-*`. |
| Plan ids | `free`, `pro_monthly`, `pro_yearly`, `team_monthly`, `team_yearly`. |
| Excluded scope | Do not introduce multi-region or SMS/voice concepts anywhere in the copied references. |

## Phases

### Phase 0 — Inventory the source
0.1 Read the password-manager `.claude/skills/polar-api/SKILL.md` and every file
under `references/` (api-overview, checkout, subscriptions, webhooks, errors,
affiliates). Note which are verbatim-portable.
0.2 Read `.claude/skills/polar-provider/SKILL.md` and `references/`
(`integration-checklist.md`, `type-mapping.md`, any affiliate-attribution doc).
0.3 Read `.claude/agents/polar-integration.md` and `docs/self-hosting/polar.md`.

### Phase 1 — Port `polar-api` (verbatim)
Copy `.claude/skills/polar-api/` into Pulsy unchanged. This is provider API
reference; it carries no project-specific paths.

### Phase 2 — Port and adapt `polar-provider`
2.1 Copy `.claude/skills/polar-provider/` into Pulsy.
2.2 Rewrite every seam path to Pulsy's: `apps/server/src/payments/`,
`apps/server/src/webhooks/`, `apps/server/src/billing/`,
`apps/server/src/services/polar.ts`, `packages/db/src/schema/billing.ts`.
2.3 Rename plan ids and the `pssmngr`/`family` vocabulary to Pulsy's `pro`/`team`.
2.4 Keep `references/integration-checklist.md` step order intact (enum → service
→ provider → export → factory → webhook handler → router → ingestion → config
probe → key cache → plan→product config → verify) — only the paths change.

### Phase 3 — Port and adapt the agent
Copy `.claude/agents/polar-integration.md`; repoint its file map and stack
references to Pulsy (Express + `@trpc/server` + Drizzle + `@pulsy/db`).

### Phase 4 — Port and adapt the self-hosting doc
Copy `docs/self-hosting/polar.md`; rewrite for Pulsy plans, the `pulsy-server`
container, root `.env` vars, and the Express webhook route
`POST /api/webhooks/payment/polar`.

### Tests
- N/A for executable code (knowledge files only). Verify by structural checks:
  - `.claude/skills/polar-api/SKILL.md` and `references/` exist.
  - `.claude/skills/polar-provider/SKILL.md` and `references/integration-checklist.md` + `references/type-mapping.md` exist and contain **no** `pssmngr`/`family`/`serverless` strings.
  - `.claude/agents/polar-integration.md` exists and references Pulsy paths.
  - `docs/self-hosting/polar.md` exists.

### i18n
- Not applicable (skill/agent/doc reference content is English-only by convention).
- The self-hosting doc may later get 5-lang variants in prompt 10; not here.

### Documentation
- `docs/self-hosting/polar.md` is the doc deliverable of this prompt (see Phase 4).

### Agents & Skills
- **Creates** `.claude/agents/polar-integration.md`, `.claude/skills/polar-api/`,
  `.claude/skills/polar-provider/`. These are prerequisites cited by prompts 01–06.

## Idempotency Contract

Re-running MUST be a no-op when the four targets already exist and contain no
source-repo vocabulary (`pssmngr`, `family`, `serverless`). If a target exists
but still carries source paths/ids, re-adapt it in place; never duplicate.
