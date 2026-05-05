---
name: team-scaling-playbook
description: Team growth advisor that recommends hiring timing, creates AI-augmented job descriptions, and plans team scaling. Use when asked about "hiring", "team growth", or "when should I hire".
---

# Team Scaling Playbook

## Purpose

Provide data-driven hiring recommendations for a solo-founder SaaS operation augmented by 169 AI agents. This skill evaluates current metrics against predefined hiring triggers, generates role-specific job descriptions that emphasize AI-native workflows, and plans team scaling in a capital-efficient sequence.

The core philosophy: hire humans for what AI cannot do (judgment, relationships, creative strategy, user empathy) and use AI for everything else. Every hire should unlock a growth constraint that agents alone cannot solve.

## When to Use

- Quarterly planning sessions to evaluate headcount needs
- When a specific bottleneck appears that AI agents cannot address
- Before fundraising to model team scaling scenarios
- When asked "should I hire", "hiring plan", "team growth", or "when should I hire"
- When evaluating contractor vs. full-time trade-offs

## Input Sources

| Source | Path | Purpose |
|--------|------|---------|
| Hiring Plan | `leadership/team/hiring-plan.md` | Hiring triggers, sequence, budget |
| Team Topology | `leadership/team/team-topology.md` | Current org structure and responsibilities |
| KPI Dashboard | `leadership/metrics/kpi-dashboard.md` | Current metrics for trigger evaluation |
| Product Marketing Context | `.claude/product-marketing-context.md` | Business stage and positioning |

## Workflow

### Step 1: Evaluate Hiring Triggers

Read current metrics from the KPI dashboard and compare against hiring trigger thresholds:

| Trigger | Metric | Threshold | Role Unlocked |
|---------|--------|-----------|---------------|
| Growth ceiling | WAD growth <5% for 3 weeks | Stalling despite marketing effort | Growth Marketer |
| Support overload | Response time >8 hours | Solo founder cannot keep up | Developer Support |
| Feature bottleneck | Deploy queue >2 weeks | More features needed than one dev can ship | Full-Stack Engineer |
| Revenue plateau | MRR growth <10% for 2 months | Need outbound sales motion | Sales/Partnerships |

### Step 2: Assess Readiness

For each triggered role, evaluate readiness criteria:

- **Financial**: Can MRR cover the hire within 3 months of start date?
- **Process**: Are SOPs documented enough for onboarding?
- **AI Tooling**: Are the AI agents/skills for this function mature?
- **Impact**: Will this hire unlock >2x their cost in growth?

### Step 3: Generate Recommendation

Output a structured hiring recommendation:

```markdown
## Hiring Recommendation — [Date]

### Triggers Activated
- [Trigger name]: [Current value] vs [Threshold] — [Role]

### Recommended Next Hire
**Role**: [Title]
**Timing**: [Now / 1 month / 3 months / Not yet]
**Reasoning**: [Why this role, why now]
**Expected Impact**: [Specific metric improvement expected]
**Budget**: [Compensation range + tools/overhead]

### Roles NOT Yet Triggered
- [Role]: [Metric] at [Value], threshold is [Threshold]

### Alternative: Contractor/Fractional
- [Assessment of whether a contractor could fill the gap instead]
```

### Step 4: Generate Job Description (if hire recommended)

Produce a complete JD using the role template from the references file. Customize based on:
- Current business stage and metrics
- Specific AI tools the role will use daily
- Unique aspects of working in an AI-augmented solo-founder company
- Compensation calibrated to stage and location

### Step 5: Onboarding Plan Sketch

For the recommended hire, outline a 30-60-90 day plan:
- **Day 1-30**: Learn the product, meet the AI agent roster, understand metrics
- **Day 31-60**: Own one key metric, run first independent initiative
- **Day 61-90**: Full ownership of function, measurable impact on target metric

## Hiring Sequence (Capital-Efficient Order)

| Order | Role | MRR Trigger | Why This Order |
|-------|------|-------------|----------------|
| 1 | Growth Marketer (Part-time/Contract) | $500 MRR | Revenue multiplier; AI handles execution, human sets strategy |
| 2 | Developer Support (Part-time) | $1,500 MRR | Retention protector; human empathy AI cannot replicate |
| 3 | Full-Stack Engineer | $3,000 MRR | Ship faster; unblock feature requests from growing user base |
| 4 | Sales/Partnerships | $5,000 MRR | Enterprise pipeline; relationships require human presence |
| 5 | Product Designer | $8,000 MRR | UX differentiation; design thinking beyond AI capabilities |

## Solo-Founder AI Leverage Model

Before any hire, verify that AI agents are fully utilized for the function:

| Function | AI Coverage | Human-Only Gap |
|----------|-------------|----------------|
| Development | 169 agents, 89 skills | Architecture decisions, user research |
| Marketing | 32 marketing skills | Brand voice, community relationships |
| Support | AI chatbot, docs generation | Complex debugging, empathy in escalations |
| Sales | Lead scoring, email generation | Relationship building, negotiation |
| Operations | Automated deployments, monitoring | Vendor negotiations, legal review |

## Output

- Hiring recommendation document saved to `leadership/team/recommendations/[date]-recommendation.md`
- Job description saved to `leadership/team/job-descriptions/[role-slug].md`
- Onboarding plan saved to `leadership/team/onboarding/[role-slug]-onboarding.md`

## Tips

- Re-run monthly or when metrics shift significantly
- Pair with `leadership-dashboard` for up-to-date metric context
- Use `investor-update` skill to frame team scaling in fundraising narrative
- Always prefer contractors/fractional for the first person in a function
