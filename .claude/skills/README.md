# Skills

Project-specific skills for the MERN starter. Each skill is a focused set of instructions that the agent loads dynamically for specialized tasks.

## Ported Skills (4)

| Skill | File | Purpose |
|-------|------|---------|
| **Review Changes** | `review-changes.md` | Structured code review using diff analysis, impact tracing, and rule validation |
| **Refactor Safely** | `refactor-safely.md` | Plan and execute refactoring with dependency analysis, Redux state migrations, and Mongoose schema changes |
| **Debug Issue** | `debug-issue.md` | Systematic debugging across Express, Mongoose, and React/Redux layers |
| **PR Fix: Actions** | `pr-fix-actions/SKILL.md` | Fix failing CI checks and GitHub Actions on a Pull Request |

## Relationship to Rules

Skills reference the governance rules in `.claude/rules/`:
- `mern-feature-modules.md` — feature module boundaries
- `mern-mongoose-typed-schemas.md` — Mongoose schema typing requirements
- `mern-no-default-exports.md` — named exports only
- `environment-variables.md` — root `.env` policy
- `site-url-env-pattern.md` — no hardcoded URLs

## Source

Marketing/SEO skills (`social-content/`, `schema-markup/`, `internal-comms/`) were intentionally dropped — they target a marketing pipeline not present in this project.
