# OKR Tracker — Scoring Guide

## Scoring Scale

OKRs are scored on a 0.0 to 1.0 continuous scale. The target is 0.7, not 1.0. Consistently scoring 1.0 indicates targets are not ambitious enough.

| Score Range | Label | Meaning |
|-------------|-------|---------|
| 0.0 - 0.3 | Failed | No meaningful progress or significant regression |
| 0.4 - 0.6 | Progress | Meaningful effort but fell short of target |
| 0.7 | Target | Achieved the intended outcome (this is success) |
| 0.8 - 0.9 | Exceeded | Surpassed expectations |
| 1.0 | Stretch | Achieved the most ambitious possible outcome |

### Key Principle

**0.7 = success.** The OKR framework is designed so that hitting 70% of the target represents full achievement. Targets should be set aggressively enough that 0.7 requires real effort and 1.0 is only achievable under ideal conditions.

---

## Scoring Formulas by Key Result Type

### Type 1: Numeric Target (Most Common)

For KRs expressed as "Increase X from A to B":

```
score = (current - baseline) / (stretch - baseline)
```

Clamped to [0.0, 1.0].

**Setting target vs. stretch:**
- **Target (0.7 score)**: The outcome you realistically expect with focused effort
- **Stretch (1.0 score)**: The best-case outcome if everything goes perfectly

**Example: "Increase MRR from $500 to $2,000"**

| Value | What It Represents |
|-------|--------------------|
| Baseline | $500 (starting point) |
| Target (0.7) | $1,550 (realistic with effort) |
| Stretch (1.0) | $2,000 (best case) |

Scoring at various current values:
- Current = $500: `(500-500)/(2000-500) = 0.0`
- Current = $800: `(800-500)/(2000-500) = 0.20`
- Current = $1,100: `(1100-500)/(2000-500) = 0.40`
- Current = $1,550: `(1550-500)/(2000-500) = 0.70` (target achieved)
- Current = $2,000: `(2000-500)/(2000-500) = 1.00` (stretch achieved)

### Type 2: Percentage Target

For KRs expressed as "Improve X rate from A% to B%":

Same formula as numeric, but using percentage values:

```
score = (current_pct - baseline_pct) / (stretch_pct - baseline_pct)
```

**Example: "Improve free-to-Pro conversion from 3% to 10%"**

| Value | Percentage |
|-------|-----------|
| Baseline | 3% |
| Target (0.7) | 7.9% |
| Stretch (1.0) | 10% |

- Current = 5%: `(5-3)/(10-3) = 0.29`
- Current = 7.9%: `(7.9-3)/(10-3) = 0.70` (target)
- Current = 10%: `(10-3)/(10-3) = 1.00` (stretch)

### Type 3: Decrease Target

For KRs expressed as "Reduce X from A to B" (lower is better):

```
score = (baseline - current) / (baseline - stretch)
```

**Example: "Reduce churn from 8% to 3%"**

| Value | Percentage |
|-------|-----------|
| Baseline | 8% |
| Target (0.7) | 4.5% |
| Stretch (1.0) | 3% |

- Current = 7%: `(8-7)/(8-3) = 0.20`
- Current = 4.5%: `(8-4.5)/(8-3) = 0.70` (target)
- Current = 3%: `(8-3)/(8-3) = 1.00` (stretch)

### Type 4: Binary Milestone

For KRs that are either done or not done (e.g., "Launch feature X"):

| Status | Score |
|--------|-------|
| Not started | 0.0 |
| In progress (design complete) | 0.2 |
| In progress (implementation started) | 0.4 |
| In progress (testing/QA) | 0.6 |
| Shipped to production | 0.7 |
| Shipped + positive user feedback | 0.8 |
| Shipped + measurable impact on target metric | 1.0 |

**Guidance:** Avoid binary KRs when possible. "Launch referral program" is weaker than "Acquire 50 users through referral program." The latter provides gradient feedback throughout the quarter.

### Type 5: Quality/Satisfaction Metric

For KRs based on survey scores (NPS, CSAT):

Use the numeric target formula with the score as the value.

**Example: "Achieve NPS of 40"**

| Value | Score |
|-------|-------|
| Baseline | 10 |
| Target (0.7) | 31 |
| Stretch (1.0) | 40 |

### Type 6: Composite/Index Metric

For KRs that combine multiple signals:

1. Score each component individually
2. Weight components by importance
3. Composite score = weighted average

**Example: "Improve platform reliability index"**
- Uptime (40% weight): score based on 99.9% target
- Deploy success rate (30% weight): score based on 98% target
- Median deploy time (30% weight): score based on <60s target

---

## Status Classification

| Status | Criteria |
|--------|----------|
| On Track | Score >= expected score for this point in the quarter |
| At Risk | Score is 0.1-0.2 below expected, or declining trend |
| Off Track | Score is >0.2 below expected, or blocked |

### Expected Score by Week

For a 13-week quarter, linear progress would suggest:

| Week | Expected Score (Linear) |
|------|------------------------|
| 1 | 0.00 |
| 3 | 0.16 |
| 5 | 0.31 |
| 7 (mid-quarter) | 0.46 |
| 9 | 0.62 |
| 11 | 0.77 |
| 13 (end) | 0.70 (target) |

Note: Many KRs are not linear. Early weeks may show slower progress (setup, experimentation) with acceleration later. Adjust expectations based on KR type.

---

## Common Scoring Mistakes

### Mistake 1: Scoring Binary as 0 or 1

**Wrong:**
```
KR: Launch referral program
Status: Not launched yet
Score: 0.0
```

**Right:**
```
KR: Launch referral program
Status: Design complete, implementation 60% done
Score: 0.4
```

Use the milestone progression scale (0.0 to 1.0) even for binary KRs.

### Mistake 2: Ignoring Trend

**Wrong:** Scoring only based on current value.

**Right:** Note the trend direction. A KR at 0.3 and accelerating is healthier than a KR at 0.5 and declining.

### Mistake 3: Sandbagging Targets

**Symptoms:** All KRs scoring 0.9-1.0 at mid-quarter.

**Fix:** Targets should be set so that 0.7 requires genuine effort. If scoring consistently above 0.8, raise targets next quarter.

### Mistake 4: Vanity Scoring

**Wrong:** Giving a KR a 0.5 because "we worked hard on it" even though the metric did not move.

**Right:** Score based on the metric value only. Effort without results = low score. That is valuable information.

### Mistake 5: Not Clamping Scores

**Wrong:** Scoring 1.3 because the metric exceeded the stretch target.

**Right:** Cap at 1.0. If consistently exceeding 1.0, the stretch target was too conservative.

---

## Objective Scoring

Objective score = average of its Key Result scores (or weighted average if weights are specified).

```
Objective Score = (KR1_score * KR1_weight + KR2_score * KR2_weight + ...) / total_weight
```

Default: equal weights (each KR = 1.0 weight).

### Objective Status

| Score | Status | Color |
|-------|--------|-------|
| >= 0.6 | On Track | Green |
| 0.4 - 0.59 | At Risk | Yellow |
| < 0.4 | Off Track | Red |

---

## Quarter-End Scoring Protocol

At the end of the quarter:

1. **Freeze metrics**: Use the final day's values for all scoring
2. **Score all KRs**: Apply formulas above
3. **Score all Objectives**: Weighted average of KR scores
4. **Calculate overall score**: Average of all Objective scores
5. **Write retrospective** for each Objective:
   - What worked
   - What did not work
   - What to carry forward to next quarter
   - What to stop doing

### Retrospective Questions

For each KR scoring below 0.5:
- Was the target realistic given what we now know?
- Was the failure due to execution (we did not do enough) or strategy (wrong approach)?
- Should this KR carry forward, be modified, or be dropped?

For each KR scoring above 0.9:
- Was the target ambitious enough?
- What would a more challenging version look like?
- Can we raise the bar next quarter?

---

## Example: Fully Scored Quarter

```markdown
# Q1 2026 OKR Final Scoring

## Overall Score: 0.62

### O1: Achieve Product-Market Fit Signal
**Score: 0.68** | Status: At Risk (borderline)

| KR | Target | Current | Score | Status |
|----|--------|---------|-------|--------|
| Reach 500 registered users | 500 | 480 | 0.65 | At Risk |
| Achieve 30% 30-day retention | 30% | 28% | 0.60 | At Risk |
| NPS > 30 | 30 | 35 | 0.80 | On Track |

### O2: Build Sustainable Revenue Engine
**Score: 0.55** | Status: At Risk

| KR | Target | Current | Score | Status |
|----|--------|---------|-------|--------|
| MRR of $1,000 | $1,000 | $720 | 0.45 | At Risk |
| 30 Pro subscribers | 30 | 22 | 0.50 | At Risk |
| Free-to-Pro conversion > 7% | 7% | 6.5% | 0.70 | On Track |

### O3: Establish Technical Foundation
**Score: 0.72** | Status: On Track

| KR | Target | Current | Score | Status |
|----|--------|---------|-------|--------|
| Deploy success > 95% | 95% | 96.5% | 0.80 | On Track |
| Uptime > 99.9% | 99.9% | 99.85% | 0.65 | At Risk |
| Ship WebSmith AI builder | Shipped | Shipped + 23 projects | 0.80 | On Track |
```

---

## Recommended OKR Cadence for Solo Founder

| Activity | Frequency | Time Investment |
|----------|-----------|-----------------|
| Score KRs | Weekly (via `okr-tracker` skill) | 10 minutes |
| Review priorities | Weekly | 15 minutes |
| Mid-quarter deep review | Once (week 6-7) | 1 hour |
| Final scoring + retro | Once (last week) | 2 hours |
| Next quarter planning | Once (last 2 weeks) | 3 hours |
