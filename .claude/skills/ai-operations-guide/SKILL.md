---
name: ai-operations-guide
description: Agent and skill discovery guide. Helps find the right AI agent or skill for any task. Use when asked "which agent", "AI workflow", or "agent roster".
---

# AI Operations Guide

## Purpose

Navigate the 169-agent, 89-skill AI operations layer of ServerlessBase. This skill matches business tasks to the right agent or skill, recommends multi-agent workflows for complex objectives, and serves as the organizational directory for the entire AI workforce.

Running a company with 169 AI agents creates a discovery problem: knowing which agent or skill to invoke for a given task. This skill solves that problem.

## When to Use

- When unsure which agent or skill handles a specific task
- When planning a multi-step workflow that requires coordination across agents
- When onboarding a new human team member who needs to understand the AI roster
- When auditing agent coverage to find gaps
- When asked "which agent", "AI workflow", "agent roster", or "find the right agent"

## Input Sources

| Source | Path | Purpose |
|--------|------|---------|
| Agent Team Roster | `leadership/ai-operations/agent-team-roster.md` | Complete agent/skill inventory |
| Agent Function Map | `.claude/skills/ai-operations-guide/references/agent-function-map.md` | Business function to agent mapping |
| Skills Registry | `.claude/skills/` | All available skill definitions |
| Product Marketing Context | `.claude/product-marketing-context.md` | Business context for recommendations |

## Workflow

### Step 1: Understand the Task

Parse the user's request to identify:
- **Domain**: Which business function (development, marketing, operations, etc.)
- **Action type**: Create, analyze, review, automate, generate, monitor
- **Complexity**: Single-agent task vs. multi-agent workflow
- **Urgency**: Real-time need vs. batch/scheduled

### Step 2: Match to Agents/Skills

Search the agent roster and skill registry for matches:

1. **Exact match**: A skill exists for this exact task (e.g., "SEO audit" matches `seo-audit` skill)
2. **Category match**: An agent group covers this domain (e.g., "marketing content" matches marketing agents)
3. **Composite match**: Multiple agents/skills needed in sequence (e.g., "launch a feature" needs development + marketing + operations agents)

### Step 3: Recommend Workflow

For single-agent tasks:
```markdown
## Recommendation

**Task**: [User's task description]
**Agent/Skill**: [Name]
**Invocation**: [How to invoke — slash command or agent name]
**Expected Output**: [What the agent will produce]
**Time Estimate**: [How long it typically takes]
```

For multi-agent workflows:
```markdown
## Workflow: [Task Name]

### Step 1: [Action]
- **Agent**: [Name]
- **Input**: [What to provide]
- **Output**: [What it produces]

### Step 2: [Action]
- **Agent**: [Name]
- **Input**: [Output from Step 1]
- **Output**: [What it produces]

### Coordination Notes
- [Any dependencies or sequencing requirements]
- [Estimated total time]
```

### Step 4: Identify Gaps

If no agent or skill matches:
```markdown
## Gap Identified

**Task**: [Description]
**Coverage**: No existing agent or skill covers this function
**Recommendation**:
- Short-term: [Manual workaround or general-purpose agent]
- Long-term: [Suggest creating a new skill/agent]
```

## Agent Discovery Search Strategy

When matching tasks to agents, search in this priority order:

1. **Skill name match**: Check if a skill name contains the task keyword
2. **Skill description match**: Search skill YAML descriptions for task-related terms
3. **Agent category match**: Match the business domain to an agent group
4. **Reference file match**: Search reference docs for relevant capabilities
5. **General-purpose fallback**: Recommend a general coding/writing agent with context

## Quick Reference: Common Tasks

| Task | Skill/Agent | Invocation |
|------|-------------|------------|
| Weekly KPI review | `leadership-dashboard` | "Run weekly review" |
| Write blog post | `copywriting` + `seo-audit` | "Write blog post about X" |
| Audit landing page | `page-cro` | "Audit landing page" |
| Plan A/B test | `ab-test-setup` | "Design A/B test for X" |
| Hire recommendation | `team-scaling-playbook` | "Should I hire?" |
| Investor update | `investor-update` | "Generate investor update" |
| OKR scoring | `okr-tracker` | "Score this quarter's OKRs" |
| SEO improvements | `seo-audit` + `ai-seo` | "Run SEO audit" |
| Email sequence | `email-sequence` | "Create onboarding email sequence" |
| Pricing review | `pricing-strategy` | "Review pricing tiers" |
| Competitive analysis | `competitor-alternatives` | "Analyze competitor X" |
| Schema markup | `schema-markup` | "Generate JSON-LD for page X" |

## Multi-Agent Workflow Templates

### Product Launch Workflow
1. `content-strategy` — Plan announcement content
2. `copywriting` — Write launch copy
3. `email-sequence` — Create launch email sequence
4. `social-content` — Generate social posts
5. `paid-ads` + `ad-creative` — Set up launch ads
6. `analytics-tracking` — Configure event tracking
7. `launch-strategy` — Orchestrate timing and channels

### Monthly Growth Review Workflow
1. `leadership-dashboard` — Generate KPI review
2. `okr-tracker` — Score quarterly OKRs
3. `seo-audit` — Check SEO health
4. `page-cro` — Audit conversion funnels
5. `investor-update` — Draft investor update (if applicable)

### New Feature Development Workflow
1. Spec-driven development agents — Specify, plan, implement
2. `content-strategy` — Plan feature announcement
3. `copywriting` — Write changelog entry and docs
4. `email-sequence` — Notify existing users
5. `social-content` — Announce on social channels

## Output

Formatted recommendation document with:
- Matched agent(s) or skill(s) with invocation instructions
- Workflow sequence for complex tasks
- Gap identification for uncovered functions
- Confidence level (exact match / partial match / gap)

## Tips

- If a task spans multiple domains, always recommend a multi-agent workflow rather than forcing a single agent
- Check the marketing skills catalog (32 skills) first for any growth/marketing tasks
- For development tasks, the 169 coding agents are organized by specialization — check the agent roster
- When in doubt, start with the most specific skill and broaden if it does not match
- Keep a log of gap identifications to prioritize new skill/agent creation
