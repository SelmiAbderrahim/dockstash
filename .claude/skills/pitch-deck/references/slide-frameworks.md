# Slide Frameworks

Detailed slide-by-slide templates for 5 deck types. Each slide includes headline guidance, body content guidance, visual direction, speaker note guidance, and anti-patterns.

---

## 1. Investor Pitch (Full) — 12 Slides

**When to use:** VC meetings, angel pitch meetings, investor one-on-ones. 20-30 minute presentation time.

### Slide 1: Title

- **Headline:** Company name + one-line value proposition
- **Body:** Founder name, date, round type and amount ("Seed Round: $[X]M")
- **Visual:** Clean logo, minimal text, no clutter. Brand colors only.
- **Speaker notes:** Open with a 15-second hook — a surprising stat, a personal story, or a bold claim. Do not read the slide.
- **Anti-pattern:** Do not put your mission statement, founding year, or team photos on the title slide.

### Slide 2: Problem

- **Headline:** State the problem as a claim ("Deployment complexity costs small teams 10+ hours per week")
- **Body:** 3 pain points with quantified impact. Use customer language, not technical jargon.
- **Visual:** Before/after comparison, or a "day in the life" showing the pain. Icon-based if no data.
- **Speaker notes:** Tell a specific story — "Last month, a 3-person startup told us they spent their entire first sprint setting up AWS." Transition: "And this problem is getting worse."
- **Anti-pattern:** Do not list generic problems. "Cloud is complex" is too vague. Show the specific cost of the problem.

### Slide 3: Why Now

- **Headline:** Market shift creating the opportunity ("Three forces are converging to make this the right moment")
- **Body:** 2-3 market trends: Heroku decline, AI-native tooling emergence, PaaS consolidation, developer expectations shifting.
- **Visual:** Timeline or trend arrows showing convergence.
- **Speaker notes:** Connect each trend to why ServerlessBase is positioned to capture it. Anticipated question: "Why hasn't someone else solved this?" — answer with timing + AI advantage.
- **Anti-pattern:** Do not use "AI is changing everything" without specifics. Show how AI specifically enables your approach.

### Slide 4: Solution

- **Headline:** What ServerlessBase does in one sentence
- **Body:** 3-4 key capabilities mapped to the problems from Slide 2. Not features — outcomes.
- **Visual:** Product screenshot showing the dashboard. One clean screenshot, not four tiny ones.
- **Speaker notes:** Walk through one deployment flow — "In 3 clicks, this developer went from GitHub repo to live application with a PostgreSQL database and custom domain." Transition to demo or traction.
- **Anti-pattern:** Do not list 10 features. Pick 3-4 that solve the problems you just described.

### Slide 5: Product Demo / Screenshots

- **Headline:** "See it in action" or skip headline entirely
- **Body:** 3-4 annotated screenshots or a recorded demo GIF. Show: dashboard overview, one-click deploy, database management, monitoring.
- **Visual:** Full-width screenshots with callout annotations. Dark mode preferred for developer tools.
- **Speaker notes:** If presenting live, do a live demo instead of this slide. If sending by email, annotate screenshots with numbered callouts.
- **Anti-pattern:** Do not show every screen. Pick the 3-4 most impressive moments.

### Slide 6: Traction

- **Headline:** Lead with your strongest metric ("$[X]K MRR, growing [X]% month-over-month")
- **Body:** Table or chart with 5-7 key metrics: MRR, users, paid customers, growth rate, activation rate, churn, NPS.
- **Visual:** MRR line chart showing upward trajectory. Supplementary metrics in a clean table below.
- **Speaker notes:** Call out the trend, not just the number. "We've sustained 20% MoM growth for 4 consecutive months." Anticipated question: "What's driving the growth?" — answer with channels (SEO, organic, referral).
- **Anti-pattern:** Do not show only vanity metrics (total signups without activation). Always show engagement depth (WAD, activation rate).

### Slide 7: Market

- **Headline:** Quantified market opportunity with clear logic
- **Body:** TAM → SAM → SOM funnel with assumptions stated. Show the math, not just the number.
- **Visual:** Concentric circles or funnel diagram. TAM (outer) → SAM (middle) → SOM (inner) with dollar amounts.
- **Speaker notes:** Walk through the SOM calculation step by step. "There are 30M developers worldwide. 3M work in teams of 2-15 on web applications. If 1% adopt us at $29/month, that's $10M ARR." Anticipated question: "Is the SOM realistic?" — anchor to comparable SaaS adoption rates.
- **Anti-pattern:** Do not quote a Gartner report number without showing how you slice it to your specific segment.

### Slide 8: Business Model

- **Headline:** Revenue model and unit economics
- **Body:** Pricing tiers (Free / Pro $29 / Enterprise custom). Unit economics: CAC, LTV, LTV:CAC ratio, gross margin, payback period. Use actuals where available, estimates with [est.] label otherwise.
- **Visual:** Pricing table + unit economics summary. Keep it to one visual, not two slides.
- **Speaker notes:** Emphasize the "consolidation play" — "$29 replaces $60+ of separate tools." Anticipated question: "Can you move upmarket?" — discuss Enterprise tier roadmap.
- **Anti-pattern:** Do not show pricing without context. Always frame against the cost of alternatives.

### Slide 9: Competition

- **Headline:** Honest positioning, not "we have no competitors"
- **Body:** 2x2 matrix or feature comparison table positioning ServerlessBase against 3-4 named competitors. Axes: Simplicity vs Power, Cost vs Features.
- **Visual:** Positioning matrix with ServerlessBase in the upper-right quadrant. Supplement with a 4-column comparison table.
- **Speaker notes:** Acknowledge competitor strengths before explaining your advantage. "Vercel is excellent for frontend. But if you need databases, Docker, and monitoring too, you're back to stitching tools together." Anticipated question: "What stops Vercel from building this?" — answer with focus and architecture differences.
- **Anti-pattern:** Never say "we have no competition." Never position against more than 4 competitors — it dilutes the message.

### Slide 10: Team

- **Headline:** Why this team wins
- **Body:** Founder credentials + AI-augmented operations story. Quantify the leverage: "1 founder + 169 AI agents operating 89 skills — shipping at the velocity of a 15-person team."
- **Visual:** Founder photo + AI leverage visualization (1 person → 15-person equivalent output).
- **Speaker notes:** Address the single-founder question proactively. "The AI-augmented model isn't a limitation — it's the competitive advantage. Our cost structure is 10x more capital-efficient than competitors who raised $10M to hire 20 people." Key hires planned: "First two hires will be [Role A] and [Role B] to cover [gap]."
- **Anti-pattern:** Do not pretend you have a traditional team. Own the AI-first operating model as a strength.

### Slide 11: Financials

- **Headline:** Revenue trajectory and use of funds
- **Body:** Revenue projection table (current, +6mo, +12mo, +24mo) with stated assumptions. Use of funds breakdown (engineering %, growth %, operations %).
- **Visual:** Stacked bar chart for use of funds. Line chart for revenue projection with assumption footnotes.
- **Speaker notes:** Walk through the assumptions, not just the numbers. "We're projecting 15% MoM growth, which is conservative versus our current 20%." Anticipated question: "When do you break even?" — share the timeline.
- **Anti-pattern:** Do not show a hockey stick without assumptions. Do not project more than 24 months — anything beyond that is fiction for a seed-stage company.

### Slide 12: The Ask

- **Headline:** Specific amount, specific milestones
- **Body:** "Raising $[X]M to reach [3 specific milestones]." Milestones should be metric-based: "$[X]K MRR," "[X] paying customers," "Enterprise tier launched." Include timeline for each milestone.
- **Visual:** Timeline showing milestones with dates. Clean, linear, left-to-right.
- **Speaker notes:** End with forward momentum. "We're raising $[X]M to get to $[Y]K MRR within 18 months. With your network in DevTools, we'd love to discuss how we can work together." Close with a specific next step — not "let us know."
- **Anti-pattern:** Do not end with a generic "thank you" slide. End with the ask and a clear next step. Do not list 8 milestones — pick the 3 that matter most.

---

## 2. Demo Day Deck — 8 Slides

**When to use:** Accelerator demo days, pitch competitions, 3-5 minute presentations.

Every second counts. Each slide gets 20-30 seconds maximum. Headlines must carry the story alone.

### Slide 1: Hook + Title
- **Headline:** Bold claim or surprising stat. Company name secondary.
- **Body:** One sentence. Round type if fundraising.
- **Visual:** Logo, clean background.
- **Speaker notes:** You have 5 seconds to hook the room. Lead with the most surprising thing about your business.

### Slide 2: Problem
- **Headline:** The pain in one sentence with a number
- **Body:** 2 bullets maximum. Customer quote if you have one.
- **Visual:** Single icon or illustration.
- **Speaker notes:** 20 seconds. State the problem, give one example, move on.

### Slide 3: Solution
- **Headline:** What you built, for whom, in one sentence
- **Body:** 1 screenshot. No feature list.
- **Visual:** Full-width product screenshot, annotated.
- **Speaker notes:** 25 seconds. "We built [X] so that [persona] can [outcome] in [timeframe]."

### Slide 4: Traction
- **Headline:** Your strongest number — make it the headline
- **Body:** 3-4 metrics in a clean row. MRR, users, growth rate, one engagement metric.
- **Visual:** Large number for the headline metric. Smaller supporting metrics below.
- **Speaker notes:** 20 seconds. State the number, state the trend, move on.

### Slide 5: Market
- **Headline:** SAM number + one-sentence logic
- **Body:** One line explaining the SAM calculation.
- **Visual:** Single large number.
- **Speaker notes:** 15 seconds. Do not walk through TAM/SAM/SOM — just state the SAM with one sentence of logic.

### Slide 6: Business Model
- **Headline:** How you make money, in one sentence
- **Body:** Pricing tiers. One line on unit economics if impressive.
- **Visual:** Simple pricing table (3 columns max).
- **Speaker notes:** 15 seconds. "$29/mo replaces $60+ of separate tools. Free tier drives adoption."

### Slide 7: Why Now / Why Us
- **Headline:** The insight or advantage that makes this team win
- **Body:** 2 bullets: market timing + team unfair advantage.
- **Visual:** Founder photo optional. Keep clean.
- **Speaker notes:** 25 seconds. Combine "why now" and "why us" — demo day doesn't have time for separate slides.

### Slide 8: The Ask
- **Headline:** "Raising $[X]M for [milestone]"
- **Body:** 2-3 milestones. Contact info.
- **Visual:** QR code to your deck or website.
- **Speaker notes:** 15 seconds. State the ask, one milestone, and "come find me after" or "scan the QR code."

---

## 3. Partnership Deck — 10 Slides

**When to use:** Strategic partner proposals, integration partnerships, co-marketing proposals. 15-20 minute presentation.

### Slide 1: Title
- **Headline:** "[ServerlessBase] + [Partner Name]: [Mutual Value Proposition]"
- **Body:** Date, presenter name.
- **Visual:** Both logos side by side. Clean, professional.

### Slide 2: About ServerlessBase
- **Headline:** What we do, who we serve
- **Body:** One-paragraph overview. Key metrics (users, services supported, languages).
- **Visual:** Product screenshot + 3-4 metric badges.

### Slide 3: Shared Audience
- **Headline:** "We serve the same developers"
- **Body:** Venn diagram or overlap analysis showing shared target audience.
- **Visual:** Venn diagram with audience overlap highlighted.

### Slide 4: The Opportunity
- **Headline:** Specific gap or opportunity this partnership addresses
- **Body:** What's missing today for the shared audience. Quantify the opportunity.
- **Visual:** Gap analysis or market data.

### Slide 5: Proposed Integration / Partnership
- **Headline:** What the partnership looks like in practice
- **Body:** Concrete deliverables: integration scope, co-marketing activities, timeline.
- **Visual:** Architecture diagram or user flow showing integration.

### Slide 6: User Experience
- **Headline:** How end users benefit
- **Body:** Before/after showing the improved user journey.
- **Visual:** Mockups or flow diagrams.

### Slide 7: Mutual Value
- **Headline:** What each side gets
- **Body:** Two-column table: "Value for [Partner]" and "Value for ServerlessBase."
- **Visual:** Clean two-column layout with benefit icons.

### Slide 8: Success Metrics
- **Headline:** How we measure partnership success
- **Body:** 3-5 KPIs both parties will track.
- **Visual:** Metric dashboard mockup.

### Slide 9: Timeline and Resources
- **Headline:** Proposed timeline and investment
- **Body:** Phase 1 (weeks 1-4), Phase 2 (weeks 5-8), Phase 3 (ongoing). Resource requirements from each side.
- **Visual:** Gantt-style timeline.

### Slide 10: Next Steps
- **Headline:** Specific actions to move forward
- **Body:** 3 concrete next steps with owners and dates.
- **Visual:** Numbered action list.

---

## 4. Email Deck — 10 Slides

**When to use:** Sent ahead of investor meetings via warm intro. Must be self-explanatory without a presenter.

Key difference from live pitch: more text, the ask appears early (slide 2), every slide has enough context to stand alone.

### Slide 1: Title + One-Liner
- **Headline:** Company name + one-line description + round
- **Body:** "Deploy anything. Manage everything. Raising $[X]M Seed."
- **Visual:** Logo, clean.

### Slide 2: TL;DR
- **Headline:** The entire pitch in 3 sentences
- **Body:** Problem, solution, traction, ask — all in one slide. This is for investors who won't read past slide 2.
- **Visual:** Clean text, maybe one key metric callout.

### Slide 3: Problem
- **Headline:** Problem statement with quantified cost
- **Body:** 3-4 bullet points with specific pain and cost.
- **Visual:** Light icon-based layout.

### Slide 4: Solution
- **Headline:** How ServerlessBase solves it
- **Body:** 3 capabilities mapped to 3 problems. Annotated screenshot.
- **Visual:** Product screenshot with numbered callouts.

### Slide 5: Traction
- **Headline:** Strongest metric as headline
- **Body:** Full metric table with month-over-month trends.
- **Visual:** MRR chart + metrics table.

### Slide 6: Market
- **Headline:** TAM/SAM/SOM with clear math
- **Body:** Show the calculation logic, not just the number.
- **Visual:** Funnel diagram.

### Slide 7: Business Model + Competition
- **Headline:** Pricing and competitive positioning combined
- **Body:** Pricing table + 2x2 competitive matrix on one slide. Space is tight — combine to keep deck short.
- **Visual:** Split layout: pricing left, competition right.

### Slide 8: Team + AI Advantage
- **Headline:** Why this team wins
- **Body:** Founder bio + AI-augmented operations story.
- **Visual:** Photo + leverage metrics.

### Slide 9: Financials
- **Headline:** Revenue trajectory and use of funds
- **Body:** Projection table + use of funds breakdown.
- **Visual:** Combined chart.

### Slide 10: The Ask + Contact
- **Headline:** "Raising $[X]M — here's what it gets us"
- **Body:** 3 milestones. Calendar link. Email. LinkedIn.
- **Visual:** Clean with prominent contact info and calendar booking link.

---

## 5. Business Proposal — 10 Slides

**When to use:** Non-equity business deals, enterprise proposals, agency partnerships. 15-20 minute presentation.

### Slide 1: Title
- **Headline:** "Proposal: [Specific deliverable] for [Client/Partner Name]"
- **Body:** Date, prepared by.
- **Visual:** Both logos if applicable.

### Slide 2: Executive Summary
- **Headline:** The proposal in 3 sentences
- **Body:** Their challenge, our solution, expected outcome.
- **Visual:** Clean text.

### Slide 3: Understanding Your Needs
- **Headline:** "Here's what we heard" (mirror their language)
- **Body:** 3-4 challenges they described. Show you listened.
- **Visual:** Numbered list or quote callouts.

### Slide 4: Proposed Solution
- **Headline:** What we'll deliver
- **Body:** Scope, deliverables, integration points.
- **Visual:** Solution architecture or process flow.

### Slide 5: How It Works
- **Headline:** Technical or operational walkthrough
- **Body:** Step-by-step showing their experience.
- **Visual:** User flow diagram.

### Slide 6: Proof Points
- **Headline:** Evidence this works
- **Body:** Relevant metrics, case studies, or comparable deployments.
- **Visual:** Metric cards or testimonial quotes.

### Slide 7: Timeline
- **Headline:** Implementation plan with dates
- **Body:** Phased timeline with milestones and deliverables per phase.
- **Visual:** Gantt chart or timeline.

### Slide 8: Investment
- **Headline:** Pricing and terms
- **Body:** Transparent pricing. What's included, what's not. Payment terms.
- **Visual:** Pricing table with inclusions list.

### Slide 9: Expected ROI
- **Headline:** What they'll get back
- **Body:** Time saved, cost reduced, or revenue enabled. Quantify where possible.
- **Visual:** Before/after comparison or ROI calculator output.

### Slide 10: Next Steps
- **Headline:** How to move forward
- **Body:** 3 specific actions with dates. Decision timeline.
- **Visual:** Action list with contact information.
