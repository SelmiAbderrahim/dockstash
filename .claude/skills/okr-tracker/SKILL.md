---
name: okr-tracker
description: OKR tracking and scoring tool. Reviews progress against quarterly objectives, scores key results, and recommends focus areas. Use when asked about "OKR", "quarterly goals", or "key results".
---

# OKR Tracker

## Purpose

Score and track quarterly Objectives and Key Results for ServerlessBase. This skill reads current OKR definitions, evaluates progress using live metrics, assigns scores on a 0.0-1.0 scale, identifies at-risk key results, and recommends weekly priorities to improve the most impactful scores.

OKRs are the bridge between strategy (what we want to achieve) and execution (what we do this week). This skill keeps that bridge in good repair.

## When to Use

- Weekly during the leadership review to check OKR health
- Mid-quarter for a formal progress check
- End of quarter for final scoring and retrospective
- When planning the next quarter's OKRs
- When asked "OKR", "quarterly goals", "key results", or "are we on track"

## Input Sources

| Source | Path | Purpose |
|--------|------|---------|
| Current Quarter OKRs | `leadership/okrs/[YYYY]-Q[N].md` | OKR definitions and targets |
| KPI Dashboard | `leadership/metrics/kpi-dashboard.md` | Current metric values |
| Scoring Guide | `.claude/skills/okr-tracker/references/scoring-guide.md` | Scoring methodology |
| Previous Quarter OKRs | `leadership/okrs/` (older files) | Historical context |

## Workflow

### Step 1: Load Current OKRs

Read the current quarter's OKR file. Each Objective should have 3-5 Key Results with:
- Clear metric or milestone definition
- Starting value (baseline)
- Target value (what 0.7 looks like)
- Stretch value (what 1.0 looks like)

### Step 2: Gather Current Values

For each Key Result, pull the current value from the KPI dashboard or relevant data source. Map each KR to its data source:

| KR Type | Data Source |
|---------|-------------|
| Revenue metric | Stripe / KPI dashboard |
| User metric | User table / KPI dashboard |
| Product metric | Deployment table / monitoring |
| Quality metric | Test results / uptime logs |
| Binary milestone | Changelog / release notes |

### Step 3: Score Each Key Result

Apply the scoring methodology from the references file:

```markdown
### Key Result: [Description]

| Property | Value |
|----------|-------|
| Baseline | [Starting value] |
| Current | [Current value] |
| Target (0.7) | [Target value] |
| Stretch (1.0) | [Stretch value] |
| **Score** | **[0.0-1.0]** |
| Status | [On Track / At Risk / Off Track] |
| Trend | [Improving / Flat / Declining] |
```

### Step 4: Score Each Objective

Objective score = weighted average of its Key Results.

Default: equal weight across KRs. Override if the OKR file specifies weights.

```markdown
## Objective: [Description]
**Score: [0.0-1.0]** | Status: [On Track / At Risk / Off Track]

| Key Result | Score | Status | Trend |
|------------|-------|--------|-------|
| KR1: [desc] | 0.X | [status] | [trend] |
| KR2: [desc] | 0.X | [status] | [trend] |
| KR3: [desc] | 0.X | [status] | [trend] |
```

### Step 5: Identify At-Risk Key Results

Flag any KR that is:
- Below 0.3 with more than half the quarter elapsed
- Declining trend for 2+ consecutive weeks
- Blocked by a dependency outside the team's control

### Step 6: Recommend Weekly Priorities

Based on the scoring, recommend 3 priorities for the coming week:

1. **Highest-impact at-risk KR**: The KR where a week of focused effort would most improve the overall OKR score
2. **Quick win**: A KR that is close to its target and could be completed with a small push
3. **Unblock**: A KR that is stuck due to a dependency; action = remove the blocker

```markdown
## Recommended Priorities for [Week of Date]

1. **[Priority 1]**: [KR reference] — [Specific action] — Expected impact: +[X] on KR score
2. **[Priority 2]**: [KR reference] — [Specific action] — Expected impact: +[X] on KR score
3. **[Priority 3]**: [KR reference] — [Specific action] — Expected impact: unblock [dependency]
```

### Step 7: Generate Report

Produce a complete OKR progress report:

```markdown
# OKR Progress Report — [Quarter] Week [N]

## Overall Score: [X.X / 1.0]

## Objectives Summary
| # | Objective | Score | Status |
|---|-----------|-------|--------|
| O1 | [desc] | 0.X | [status] |
| O2 | [desc] | 0.X | [status] |
| O3 | [desc] | 0.X | [status] |

## Detailed Scoring
[Per-objective, per-KR breakdown]

## At-Risk Key Results
[List with diagnosis and recommended action]

## Weekly Priorities
[Top 3 actions]

## Notes
[Any context, caveats, or data quality issues]
```

## OKR Lifecycle

| Phase | Timing | Activity |
|-------|--------|----------|
| Planning | Last 2 weeks of prior quarter | Draft objectives, define KRs, set targets |
| Kickoff | First week of quarter | Finalize OKRs, communicate priorities |
| Weekly Check | Every week | Score, identify risks, adjust priorities |
| Mid-Quarter Review | Week 6-7 | Formal review, consider adjustments |
| Final Scoring | Last week of quarter | Score all KRs, retrospective, lessons learned |
| Retrospective | First week of next quarter | What worked, what didn't, input to next quarter |

## Integration with Other Skills

| Skill | Integration |
|-------|------------|
| `leadership-dashboard` | OKR scores feed into the weekly health score |
| `investor-update` | OKR progress framed as quarterly achievements |
| `team-scaling-playbook` | At-risk KRs may trigger hiring evaluations |
| `ai-operations-guide` | Agent assignments aligned to priority KRs |

## Output

- Weekly progress report saved to `leadership/okrs/reviews/[YYYY]-Q[N]-week-[NN].md`
- Final quarter scoring saved to `leadership/okrs/[YYYY]-Q[N]-final.md`

## Tips

- Aim for an average score of 0.7 across all OKRs; consistently scoring 1.0 means targets are too easy
- Limit to 3-4 Objectives per quarter; more dilutes focus
- Each Objective should have 3-5 Key Results; fewer is better
- At least one KR per Objective should be a "stretch" that is uncomfortable
- Review and adjust KRs mid-quarter if the business context changes significantly (pivot, not give up)
- Use binary milestones sparingly; quantitative KRs provide better gradient feedback
