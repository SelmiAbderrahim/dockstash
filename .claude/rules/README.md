# Rules Index

Governance rules for the MERN starter project. Each rule is a focused `.md` file in this directory.

## Kept Rules (13)

| Rule | Source | Summary |
|------|--------|---------|
| `git-destructive-commands.md` | ported as-is | Never run destructive git commands without explicit per-turn user confirmation |
| `docker-only-commands.md` | authored | Every build/test/runtime command runs inside Docker (`node:20-bookworm` dev tooling, `docker compose` stack ops); bare host `npm`/`node` forbidden |
| `dockstash-design-system.md` | authored | Visual source of truth: monochrome shadcn tokens, serif-accent headlines, flat cards, inverted CTA bands (packaged as the `dockstash-design` skill) |
| `environment-variables.md` | ported + adapted | Root `.env` only; MERN-typical vars (`MONGODB_URI`, `JWT_SECRET`, `PORT`, etc.) |
| `site-url-env-pattern.md` | ported + adapted | Never hardcode URLs; derive from `CLIENT_URL` / `SERVER_URL` env vars |
| `url-tab-state.md` | ported + adapted | Tab state MUST persist in `?tab=` query parameter |
| `spec-driven-development.md` | ported + adapted | Spec-first workflow for features of meaningful complexity |
| `ui-ux-patterns.md` | new (replaces `ui-ux-pro-max-patterns.md` + `uncodixify-ui.md`) | Anti-Codex design principles, accessibility, loading/error states (visuals superseded by `dockstash-design-system.md`) |
| `interaction-hygiene.md` | promoted (G-17, Phase 02) | Pointer/not-allowed cursors from base primitive; in-button `Spinner` via `Button` `loading`; all six interaction states present |
| `shared-layout-system.md` | promoted (G-17, Phase 02) | Exactly one Header/Footer/shell system with two variants (app sidebar + marketing top-nav); no inlined chrome in feature layouts |
| `mern-feature-modules.md` | authored | `features/<name>` on client, `modules/<name>` on server; no cross-feature internal imports |
| `mern-no-default-exports.md` | authored | Named exports only; no `export default` on components, actions, reducers, utilities |
| `mern-mongoose-typed-schemas.md` | authored | Every Mongoose schema gets a type (JSDoc now, `InferSchemaType` on TS migration) |

## Dropped Rules (43)

The following source rules were intentionally NOT ported because they encode product-specific or infra-specific decisions that do not apply to a generic MERN stack:

| Source Rule | Reason |
|-------------|--------|
| `android-twa-patterns.md` | product-specific |
| `architecture-doc-maintenance.md` | product-specific |
| `backend-i18n-patterns.md` | product-specific |
| `blog-highlighting-tokens.md` | product-specific |
| `blog-i18n-routing.md` | product-specific |
| `blog-search-locale-filtering.md` | product-specific |
| `brand-asset-patterns.md` | product-specific |
| `bulk-selection-patterns.md` | product-specific |
| `chatbot-patterns.md` | product-specific |
| `clawdbot-patterns.md` | product-specific |
| `collaboration-health-checks.md` | product-specific |
| `deployment-target-waterfall.md` | product-specific |
| `dns-provider-patterns.md` | product-specific |
| container-only-dev.md | infra-specific |
| `docs-help-link-patterns.md` | product-specific |
| `domain-dns-unification.md` | product-specific |
| `email-deliverability.md` | product-specific |
| `feature-flag-docs-landing-parity.md` | product-specific |
| `fire-forget-patterns.md` | product-specific |
| `marketing-folder.md` | product-specific |
| `marketing-skills-patterns.md` | product-specific |
| `marketplace-patterns.md` | product-specific |
| `mcp-billing-patterns.md` | product-specific |
| `multi-brand-source-of-truth.md` | product-specific |
| `nginx-config-source-of-truth.md` | infra-specific |
| `nginx-proxy-patterns.md` | infra-specific |
| `postal-transactional-patterns.md` | product-specific |
| `pricing-config-db-backed.md` | product-specific |
| `pricing-source-of-truth.md` | product-specific |
| `public-docs-governance.md` | product-specific |
| `pwa-patterns.md` | product-specific |
| `ralph-wiggum-integration.md` | product-specific |
| `rtl-support-arabic.md` | product-specific |
| `ruflo-integration.md` | product-specific |
| `sandbox-network-resilience.md` | product-specific |
| `sandbox-node-patterns.md` | product-specific |
| `sandbox-port-resilience.md` | product-specific |
| `service-component-patterns.md` | product-specific |
| `social-media-patterns.md` | product-specific |
| `stalwart-mail-patterns.md` | product-specific |
| `switch-component-styling.md` | product-specific |
| api-layer-patterns.md | infra-specific |
| `uncodixify-ui.md` | merged into `ui-ux-patterns.md` |
| `uptime-monitor-patterns.md` | product-specific |
| `websmith-patterns.md` | product-specific |
| `zai-provider-patterns.md` | product-specific |
