# LinkedIn Growth — Program Guide

This folder is the complete playbook for turning LinkedIn into a Dockstash customer
channel. It distills two source playbooks — the LinkedIn outbound-DM system (Sales
Navigator + connector/messenger campaigns, "book 200 calls/month") and the LinkedIn
ads lead-gen funnel (lead forms → video → booked call → remarketing) — into one
Dockstash-specific operating manual.

**This is a deep dive under `../07-social-content.md`, not a replacement for it.** Doc
07 owns LinkedIn as a channel alongside X and Mastodon: it sets the pillar mix, the
1–2 posts/week cadence, the "founder profile, not company page" rule, and the
links-in-first-comment rule. This folder inherits all of that and goes deep on
LinkedIn-only mechanics (profile, outbound DMs, ads, remarketing). Where the two ever
disagree, doc 07 wins — fix it here. All product facts trace to
`../01-positioning-and-icp.md` and `server/src/modules/billing/plans.ts`.

Sibling programs:
- `../09-cold-outreach.md` — the agency/MSP **email** motion. This folder's DM
  playbook (`03`) is the LinkedIn twin of that sequence; they share the prospect
  list, the personalization rules, and the CRM sheet. Doc 09's "LinkedIn parallel
  track" paragraph is superseded by `03` here.
- `../influencer-outreach/linkedin-dm.md` — creator outreach with free-year invite
  links. Different motion (gift, not sale); its scripts stay there.

## The one-paragraph strategy

X is where **Ines** (indie dev) lives; LinkedIn is where **Marco** (agency owner) and
**Dana** (DevOps lead) live — the two personas who buy the $29/mo Business tier. They
are not on LinkedIn to buy backup software; they are there to look competent in front
of clients and employers. So the play is: build a credible **founder profile**, post
1–2×/week (doc 07's adapted posts), and run a **value-first outbound DM motion** —
find the ICP with Sales Navigator, connect, and lead with a genuinely useful free
resource (the backup-audit script, the restore-drill checklist) instead of a pitch.
The resource does the selling; the DM just delivers it. Ads, if ever funded, exist to
pour fuel on messaging the DMs have already proven. Success is measured in **replies
and booked conversations**, not impressions.

## A note on budget

The current plan (`../README.md`) funds Google Search, Reddit ads, and newsletters —
**there is no LinkedIn line.** Two costs to know about:

- **Sales Navigator** (~$100/mo; the source playbook quotes $65 — pricing drifts,
  check current) is the only tool this program *needs*, and only from Week 3. Start
  on the free trial; fund it from the $50 tools line or out of pocket once the DM
  motion shows replies.
- **LinkedIn ads** (`05`) require a real budget (LinkedIn's floor is ~$10/day ≈
  $300/mo). That money does not exist today. `05` is the spec for if/when it does —
  read its §0 trigger conditions before assuming otherwise.

The outbound DM motion itself (`03`) costs nothing but time. Don't wait on a budget.

## Reading order

| File | What it covers | When you need it |
|---|---|---|
| `01-foundations.md` | Who we target on LinkedIn, personal vs company page, core principles from both source playbooks | Read first, once |
| `02-profile-setup.md` | Photo, banner, headline, About, Featured section — the profile as landing page | Day 1 setup |
| `03-outbound-dm-playbook.md` | Sales Navigator list-building, connection→DM→follow-up scripts, automation decision, scaling | The core motion — Week 3+ |
| `04-content-playbook.md` | Doc 07's pillars adapted to LinkedIn: formats, hooks, a 10-post bank | When writing |
| `05-linkedin-ads-playbook.md` | Lead-gen-form funnel, ad creative rules, targeting, remarketing | Only if/when funded |
| `06-metrics-and-review.md` | What to measure, the weekly review, kill/keep rules | Weekly |

There is no separate AI-writing file: the Claude project and swipe file from
`../x-growth/07-ai-writing-system.md` serve both platforms — add a LinkedIn-format
instruction (see `04` §4) rather than building a second system.

## The 90-day arc

**Weeks 1–2 — Foundation.** Rebuild the profile (`02`). Start doc 07's LinkedIn
cadence (1–2 posts/week) so the profile isn't a ghost town when prospects check it.
No outreach yet — an empty profile burns the list.

**Weeks 3–6 — The DM motion.** Build the ICP list on a Sales Navigator trial (`03`
§2). Connect at ~15–20 invites/day, manually. Send the value-first DM on accept.
Iterate the script against reply rate; log every objection into doc 01. Share the
prospect sheet with doc 09's email motion — same names, two channels, never both in
the same week.

**Weeks 7–12 — Scale what worked.** Double down on the list segment and script that
got replies. Make the automation decision (`03` §6) with eyes open. If — and only
if — messaging is proven *and* an ads budget materializes, start `05`'s lead-form
funnel with the proven message as the offer.

## Hard rules (carried from `../README.md` — they apply here too)

- **Always disclose you built Dockstash.** In the profile headline, in every DM, in
  every comment that could read as a pitch. Non-negotiable.
- **Lead with value, never with the pitch.** The first message asks for nothing. No
  demo ask, no call ask, no link-to-pricing in touch one.
- **No fake scarcity, no invented deadlines.** Honest urgency only.
- **Real metrics, real screenshots.** Drill reports come from the real product; a
  failed drill shown honestly beats a mocked-up green dashboard.
- **No absolute claims.** "Proves it restores" is the product's behaviour; "never
  lose data again" is a lie and a banned phrase.
- **Respect the no.** One follow-up cycle, then stop. Nobody gets re-added to a
  sequence next quarter without a genuinely new reason (same rule as
  `../influencer-outreach/`).
- Source-playbook numbers quoted in these docs (200 calls/month, six-figure months,
  $200/mo tooling) are **benchmarks from the source creators** running sales teams in
  other niches. Treat them as direction, not promises.
