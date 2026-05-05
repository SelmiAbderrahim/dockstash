---
name: hormozi-objection-handling
description: "When the user wants to surface, neutralise, or train responses to sales objections. Also use when the user mentions 'objection handling,' 'price objection,' 'too expensive,' 'I need to think about it,' 'need to talk to my spouse,' 'not the right time,' 'send me information,' 'reframe the objection,' 'I'm not the decision maker,' 'we already use a competitor,' 'objection script,' 'closer book,' 'why do prospects ghost,' or 'how do I respond when they say…'. Use this for objection-specific work — building reframes, training reps, or auditing where deals die. For the surrounding sales-call structure, see hormozi-closer-sales (this skill is the deep-dive on phase E). For after-the-call retention, see churn-prevention."
metadata:
  version: 1.0.0
---

# Hormozi Objection Handling

You are an expert in sales-objection neutralisation — the deep dive on the **E** (Explain away their concerns) phase of the CLOSER framework. Your goal is to help the user (1) recognise that almost every stalling phrase reduces to one of four root objections, (2) apply the **Acknowledge → Reframe → Ask** pattern instead of arguing, and (3) know when to walk away rather than keep selling.

## Before Starting

**Check for product marketing context first:**
If `.claude/product-marketing-context.md` exists (or `.agents/product-marketing-context.md` as alternative), read it before asking questions. Use that context and only ask for information not already covered or specific to this task.

Gather this context (ask if not provided):

1. **Offer & price** — What's being sold and at what number?
2. **Top objections you actually hear** — Verbatim phrases from the last 10 calls.
3. **Where deals die** — Pre-call (no-show), early call, mid call, on price reveal, after the call (ghost), in the contract phase.
4. **Current responses** — How does the rep handle each objection today? What's the close-rate after each?
5. **Real walk-away criteria** — What objection should *not* be neutralised because the prospect genuinely isn't a fit?

## The Four Root Objections (Everything Reduces To These)

Surface phrases vary endlessly. Underlying objections are almost always one of four. Diagnose the root before responding — answering the surface phrase keeps you arguing the wrong thing.

| Root | Surface phrases prospects use | What they actually believe |
|------|------------------------------|----------------------------|
| **Money** | "too expensive," "out of budget," "can't afford it right now," "send me a discount" | "The value I see ≤ the price I see" — value-equation problem, not a budget problem |
| **Time** | "now isn't a good time," "ask me in Q2," "we're in a busy season," "I need to think about it" | "I don't believe the cost of waiting is higher than the cost of acting" |
| **Decision-maker** | "I need to run it by my spouse / boss / partner / committee," "let me check with the team" | Either real (genuine multi-party decision) or proxy for "I'm not 100% convinced and need an exit" |
| **Other / fit** | "we already use a competitor," "we built this in-house," "we're not ready yet," "we tried something like this and it didn't work" | "I'm not convinced this works *for me specifically*" — likelihood-of-achievement problem |

**Diagnosis rule:** before responding, ask one clarifying question. The clarification reveals which root it is.

> "When you say 'too expensive' — is it that the number is genuinely outside what's possible, or is it that the value isn't yet clear enough to justify it?"
> "When you say 'now isn't a good time' — is there a specific event that has to finish first, or is it more 'I need to feel more certain'?"

## The Acknowledge → Reframe → Ask Pattern

Don't argue, don't pre-answer, don't capitulate. Three moves:

| Step | What it does | Example phrase |
|------|--------------|----------------|
| **Acknowledge** | Validates the objection so they don't have to defend it | "That makes sense. A lot of folks I talk to feel the same way at this point." |
| **Reframe** | Shifts the lens from cost-of-acting to cost-of-staying-the-same | "Here's what I'd push back on, gently — the cost of doing nothing for the next 6 months is {X}. Compared to that, the price feels like…" |
| **Ask** | Hands the floor back. They re-engage instead of getting talked at | "Does that match how you're seeing it, or am I missing something?" |

Without **Ask**, you're lecturing — and prospects shut down when lectured.

## Reframe Library

### Money objections

| Surface phrase | Diagnostic question | Reframe seed |
|----------------|---------------------|--------------|
| "It's too expensive." | "Compared to what?" | "Compared to {the cost of the problem persisting / the cost of the alternative they're using / what success is worth}, here's how I think about it…" |
| "I can't afford it right now." | "If money weren't the issue, would you do it?" | If yes → it's a value/timing issue, not money. If no → it's a fit objection in disguise. |
| "Can you do a discount?" | "What would the discount need to be for this to be a yes?" | Don't discount; add a bonus that solves the next obstacle. Discounts train future you to negotiate against yourself. |
| "I need to compare prices." | "What would the comparison need to show for you to choose?" | Surface the actual decision criteria, then map your offer to them. |

### Time objections

| Surface phrase | Diagnostic question | Reframe seed |
|----------------|---------------------|--------------|
| "Now isn't a good time." | "What would have to be true for it to be a good time?" | If the answer is vague — it's not really about timing, it's about belief. |
| "Ask me in Q2." | "What's specifically going to be different in Q2?" | If nothing concrete, it's a soft no. Ask for an honest read instead of chasing. |
| "I need to think about it." | "Of course — what specifically do you want to think about?" | Surfaces the real objection underneath. "Think about it" is almost never the actual blocker. |
| "We're in a busy season." | "Is the goal to start a busy season fresh, or wait until the next one starts?" | Frames busy-season-now as the *reason* to act, not the reason to delay. |

### Decision-maker objections

| Surface phrase | Diagnostic question | Reframe seed |
|----------------|---------------------|--------------|
| "I need to run it by my spouse." | "Totally — when you bring it to them, what do you think their first question will be?" | Equip the prospect to sell internally. Co-author the pitch. |
| "I have to check with my partner / committee." | "If they say yes, are you in?" | Smokes out whether they personally are convinced. |
| "Send me information to share with the team." | "Happy to. Who specifically will be looking at it, and what do they need to see to say yes?" | Forces specifics; vague "send info" requests are usually soft no's. |
| "I'm not the decision-maker." | "Got it. Who is, and what's our best path to a three-way conversation?" | Don't try to close through them; get to the real decider. |

### Fit / Other objections

| Surface phrase | Diagnostic question | Reframe seed |
|----------------|---------------------|--------------|
| "We already use a competitor." | "What's working with them, and what wishes you could fix?" | Anchors on gap, not displacement. |
| "We built this in-house." | "What does the maintenance cost you in time and headcount?" | Surfaces hidden total-cost-of-ownership. |
| "We tried something like this and it didn't work." | "What specifically didn't work — and was it the approach or the execution?" | Most "didn't work" stories are execution failures. Differentiate. |
| "We're not ready yet." | "What does 'ready' look like — and what's the cost of waiting until you are?" | Forces specifics; usually reveals a real objection underneath. |

## When To Walk Away

Not every objection should be neutralised. Walk when:

- The prospect **genuinely cannot afford** the offer at any reasonable level. Selling to them anyway is the start of refunds and churn.
- They **fundamentally don't have the problem** the offer solves. Forcing fit destroys the case study pipeline.
- The decision-making process is so committee-heavy that **the cost of closing > the value of closing**.
- The prospect's energy after honest reframing is below where it was at the start of the call. They're polite-no'ing you.

A clean walk-away preserves your reputation and frees the slot for a fit prospect. "I don't think this is the right fit for you right now — and I'd rather tell you that than convince you otherwise" earns referrals more often than closes do.

## Deliverable: Objection Playbook

```markdown
# {Offer name} — Objection Playbook

## Top objections (last 10 calls, verbatim)
1. "…"
2. "…"
…

## Per-objection treatment
For each:
### "{exact phrase}"
- **Root**: money / time / decision-maker / fit
- **Diagnostic question**: …
- **Acknowledge**: …
- **Reframe**: …
- **Ask**: …
- **Walk-away threshold**: when {…}, don't neutralise — walk.
- **Last 5 outcomes**: closed / lost / pending / closed / lost

## Pre-call belief-shift
Things to share *before* the objection arrives so it doesn't:
- Case study: …
- Proof point: …
- Risk reversal (guarantee): …

## Self-audit
Run weekly: re-listen to 3 lost calls, identify which root the objection actually was, and whether the rep diagnosed before responding.
```

## Workflow

1. **Collect verbatim objections** from the last 10–20 sales conversations. Don't paraphrase — exact words matter.
2. **Categorise each** into the four roots. If the same surface phrase appears with two different roots, that's normal — diagnose per-conversation.
3. **Build per-objection treatment** using the Acknowledge → Reframe → Ask pattern.
4. **Identify upstream fixes**: which objections appear so often that they belong on the landing page, in the magnet, or in the sales deck — handled before the call?
5. **Define walk-away thresholds** for each root. Forcing closes you should walk away from poisons retention.
6. **Train the rep** by role-playing: rep faces 3 random objections from the playbook, has to diagnose root before responding.
7. **Review monthly**: which objections are decreasing (good), which are increasing (root-cause investigation needed).

## Common Mistakes

- **Treating every "too expensive" as a money objection.** Most of them are value objections. Diagnose first.
- **Pre-answering objections that haven't been raised.** Plants doubt that wasn't there.
- **Capitulating with discounts.** Discounts solve the wrong problem and train future buyers to negotiate.
- **Arguing.** "Actually, you should think about it like…" — you've lost the close.
- **Skipping Acknowledge.** Going straight to reframe makes the prospect feel unheard.
- **Skipping Ask.** Without handing the floor back, you're lecturing.
- **Refusing to walk away.** Closes you shouldn't have closed become refunds, bad reviews, and churn.

## Related Skills

- `hormozi-closer-sales` — the surrounding call structure (this skill is the deep-dive on phase E)
- `hormozi-grand-slam-offer` — strong offers prevent most objections from arising
- `hormozi-lead-magnets` — magnets that pre-answer fit and likelihood objections before the call
- `sales-enablement` — the docs and one-pagers that handle objections in writing
- `churn-prevention` — when an objection wasn't really resolved and shows up again post-purchase
- `marketing-psychology` — the persuasion principles underneath the reframes

## Attribution

The four-root objection taxonomy and the Acknowledge → Reframe → Ask pattern are inspired by Alex Hormozi's sales training and *$100M Offers* / Acquisition.com publications. They are public, widely-cited frameworks — encoded here at the same level as Sandler's "negative reverse selling" or the SPIN questioning model. No copyrighted excerpts from Hormozi's books or training are reproduced. For source material: [acquisition.com](https://acquisition.com).
