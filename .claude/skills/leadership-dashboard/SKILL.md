---
name: leadership-dashboard
description: Weekly KPI review and leadership dashboard generator. Produces a structured review of all key metrics, highlights trends, and recommends actions. Use when asked for "weekly review", "KPI review", or "how are we doing".
---

# Leadership Dashboard

## Purpose

Generate comprehensive weekly leadership reviews that surface the most important metrics, trends, and action items for a solo-founder SaaS operation running 169 AI agents. This skill transforms raw KPI data into executive-level insight, enabling fast decision-making without manual spreadsheet wrangling.

## When to Use

- Weekly review sessions (recommended: every Monday morning)
- Before investor calls or advisory meetings
- When feeling uncertain about overall business health
- After major launches or marketing pushes to assess impact
- When asked "how are we doing", "weekly review", or "KPI review"

## Input Sources

| Source | Path | Purpose |
|--------|------|---------|
| KPI Dashboard | `leadership/metrics/kpi-dashboard.md` | Current metric values and targets |
| Weekly Review Template | `leadership/metrics/weekly-review-template.md` | Structured review format |
| Product Marketing Context | `.claude/product-marketing-context.md` | Business context, positioning, audience |
| OKR Data | `leadership/okrs/` | Quarterly objectives for alignment |

## Workflow

### Step 1: Gather Current Metrics

Read the KPI dashboard file and extract current values for all tracked metrics. Compare against targets and previous week values.

### Step 2: Calculate Trends

For each metric, determine:
- **Direction**: Up, down, or flat vs. previous week
- **Velocity**: Rate of change (accelerating, decelerating, steady)
- **Distance to target**: How far from the quarterly/annual goal
- **Projected arrival**: At current velocity, when will target be hit

### Step 3: Identify Highlights

Classify into four buckets:
- **Wins**: Metrics that improved or hit targets
- **Concerns**: Metrics trending in the wrong direction
- **Blockers**: Issues preventing progress on key results
- **Opportunities**: Emerging signals worth investigating

### Step 4: Generate Review

Produce a formatted weekly review following the template structure:

```markdown
# Weekly Leadership Review — [Date]

## Health Score: [X/10]

## Key Metrics Snapshot
| Metric | Current | Target | Trend | Status |
|--------|---------|--------|-------|--------|
| ...    | ...     | ...    | ...   | ...    |

## Wins This Week
- ...

## Concerns
- ...

## Blockers
- ...

## Top 3 Priorities for Next Week
1. ...
2. ...
3. ...

## Decisions Needed
- ...
```

### Step 5: Recommend Actions

Based on the data, recommend the top 3 priorities for the coming week. Priorities should be:
- Specific and actionable (not vague)
- Tied to the most at-risk OKR key results
- Achievable within the week given solo-founder + AI capacity
- Ordered by expected impact on revenue or growth

## Output Format

Markdown document saved to `leadership/metrics/reviews/week-[YYYY-MM-DD].md`.

## Health Score Calculation

The overall health score (1-10) is a weighted composite:

| Weight | Metric Category | Score Driver |
|--------|----------------|--------------|
| 30% | Revenue (MRR, conversions) | Distance to monthly target |
| 25% | Growth (WAD, signups) | Week-over-week growth rate |
| 20% | Product (deploy success, uptime) | Reliability and performance |
| 15% | Engagement (activation, retention) | User behavior health |
| 10% | Operations (agent efficiency, costs) | Operational overhead |

## Tips

- Run this skill at the same time each week for consistent comparison
- Pair with `okr-tracker` skill for deeper quarterly alignment
- Use output as input for `investor-update` skill when preparing monthly updates
- Keep the review under 2 pages; if longer, the metrics need better prioritization
