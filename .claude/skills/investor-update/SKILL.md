---
name: investor-update
description: Investor update and fundraising document generator. Produces monthly investor updates, pitch deck outlines, and fundraising materials. Use when asked about "investor update", "pitch deck", or "fundraising".
---

# Investor Update

## Purpose

Generate professional monthly investor updates, pitch deck outlines, and fundraising preparation materials. This skill transforms raw metrics and product progress into investor-grade communications that maintain trust, demonstrate momentum, and set up future fundraising conversations.

Even before raising capital, sending monthly updates to advisors and prospective investors builds relationships and creates a track record of execution.

## When to Use

- End of each month for the monthly investor update
- Before investor meetings or pitch practice sessions
- When preparing fundraising materials (deck, one-pager, financial model narrative)
- When asked "investor update", "pitch deck", "fundraising", or "how do I present our numbers"

## Input Sources

| Source | Path | Purpose |
|--------|------|---------|
| KPI Dashboard | `leadership/metrics/kpi-dashboard.md` | Current metrics and targets |
| Fundraising Prep | `leadership/playbooks/fundraising-prep.md` | Fundraising strategy and materials |
| Update Template | `.claude/skills/investor-update/references/update-template.md` | Structured update format |
| OKR Data | `leadership/okrs/` | Quarterly objectives and progress |
| Product Marketing Context | `.claude/product-marketing-context.md` | Positioning and narrative |

## Workflow

### Step 1: Gather Metrics

Pull current values for investor-relevant metrics:

| Metric | Why Investors Care |
|--------|-------------------|
| MRR / MRR Growth | Revenue traction and trajectory |
| Total Users / Growth Rate | Market adoption signal |
| WAD (Weekly Active Deployers) | Engagement depth beyond vanity signups |
| Free-to-Pro Conversion Rate | Monetization efficiency |
| Churn Rate | Revenue durability |
| CAC and LTV | Unit economics health |
| Deploy Success Rate | Product reliability |
| Cash Position / Runway | Financial health |

### Step 2: Identify Narrative Themes

Every update should tell a story. Identify the dominant theme:

| Situation | Theme |
|-----------|-------|
| Strong growth month | "Momentum accelerating" |
| New feature shipped | "Product velocity" |
| Key customer wins | "Market validation" |
| Challenging month | "Lessons and pivots" (honesty builds trust) |
| Approaching milestone | "Closing in on [target]" |

### Step 3: Write the Update

Follow the template structure from the references file:

1. **TL;DR** (2-3 sentences): The one thing they should know
2. **Key Metrics** (table): Numbers with month-over-month change
3. **Highlights** (3-5 bullets): Best things that happened
4. **Challenges** (2-3 bullets): Honest about difficulties
5. **Product Updates** (3-5 bullets): What shipped
6. **Team Updates** (if any): Hires, AI agent milestones
7. **Financial Summary**: Revenue, costs, runway
8. **Ask** (if any): Specific help needed (intros, feedback, hiring)
9. **Next Month Focus**: What to expect in the next update

### Step 4: Tone Calibration

| DO | AVOID |
|----|-------|
| Lead with metrics, not opinions | Vanity metrics without context |
| Be honest about challenges | Burying bad news |
| Show month-over-month trends | Standalone numbers without comparison |
| Include specific asks | Vague "let me know if you can help" |
| Keep under 500 words | Multi-page essays |
| Send consistently on schedule | Skipping months when news is bad |

### Step 5: Format and Save

Output a polished markdown document ready to copy-paste into email.

## Fundraising Materials

### Pitch Deck Outline Generator

When asked for pitch deck content, generate slides for:

| Slide | Content |
|-------|---------|
| 1. Title | ServerlessBase — Deploy Without the Headache |
| 2. Problem | Deployment complexity kills developer productivity |
| 3. Solution | One-click deployment platform for modern apps |
| 4. Traction | Key metrics: users, MRR, growth rate, WAD |
| 5. Market | $XX B cloud deployment market, growing XX%/yr |
| 6. Product | Screenshots + feature highlights |
| 7. Business Model | Freemium: Free / Pro ($29/mo) / Enterprise |
| 8. AI Advantage | 169 agents, 89 skills — 1 person operating like 20 |
| 9. Go-to-Market | SEO + content + community + partnerships |
| 10. Team | Solo founder + AI operations (unique efficiency story) |
| 11. Financials | Revenue, projections, unit economics |
| 12. Ask | Raising $X for Y milestones |

### One-Pager Generator

Condensed version of pitch deck for email forwards. Single page covering: problem, solution, traction, team, ask.

## Output

- Monthly update saved to `leadership/investor-updates/[YYYY-MM]-update.md`
- Pitch materials saved to `leadership/fundraising/`

## Tips

- Send updates on the same day each month (e.g., first Monday)
- BCC all investors/advisors; personalize the intro line for key recipients
- Include a "reply requested" ask at least quarterly to maintain engagement
- Track open rates if using an email tool; follow up with non-openers
- Pair with `leadership-dashboard` skill for accurate metric gathering
- Use `okr-tracker` skill to frame progress against quarterly goals
