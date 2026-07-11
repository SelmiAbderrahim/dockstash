# 05 — LinkedIn Ads Playbook: The Funnel, For When It's Funded

The paid-reach system from the second source playbook: **attract, don't ambush** —
a structured funnel (offer → lead form → warm-up video → booked conversation →
remarketing) instead of a cold "sign up now" ad. Written as a spec for when the
money and the prerequisites exist. Philosophy in one line: **the ad's only job is to
start the conversation the DM motion already proved people want.**

## 0. Non-negotiables before spending

### Budget reality first

**LinkedIn ads are not funded.** `../README.md` allocates $500/mo with no LinkedIn
line, and LinkedIn's practical floor (~$10/day per campaign, expensive CPCs) means a
meaningful test costs **$300–600/mo** — this is a top-of-range ($1,000/mo) decision,
not spare change. Doc 11's blended CAC ceiling is $30; LinkedIn will blow past that
on self-serve signups, so the *only* justification is Business-tier pipeline, where
a booked call that closes a 10-server agency pays for a month of ads.

Trigger conditions — ALL must hold before the first dollar:
1. The DM motion (`03`) has proven a message: a script variant with a healthy reply
   rate and ≥ a handful of Business-tier conversations from it.
2. Budget expanded to the top of the $300–1,000 range, or a funded line freed up —
   this does not cannibalize Google Search money (doc 06's high-intent search is
   strictly better spend at small budgets).
3. LinkedIn Insight Tag installed on `dockstash.com` **weeks in advance** (it needs
   to accumulate visitor audiences before remarketing works — install it in Week 1
   even if ads are months away; it's free).

If any condition fails, stop reading and go run `03`.

### Then the mechanics

- [ ] Company page filled in (ads run from it; it will be checked by clickers).
- [ ] Every destination UTM-tagged (`utm_source=linkedin&utm_medium=cpc`, doc 11).
- [ ] Offer asset ready: for Dockstash the offer is the **Free tier / hands-on
      trial** and (for fleet-size agencies) a **15-minute walkthrough**. The source
      playbook is explicit: skip white-paper lead magnets for SaaS — demo or trial,
      framed by outcome.
- [ ] Outcome framing locked (from `01` §4): *"We help agencies hosting client
      sites hand every client proof their backups restore — without babysitting
      backup scripts or paying per-site."*

## 1. The funnel (stage by stage)

| Stage | Asset | Why this order |
|---|---|---|
| 1. Ad | Single-image, pattern-breaking, problem-first | Stops the scroll (see §2) |
| 2. **LinkedIn Lead Gen Form** — not a landing page yet | Native form: loads instantly, pre-fills name/email/company. Fewer moving parts = find the working audience+message *fast* |
| 3. Warm-up video (2–3 min, emailed + shown post-submit) | Not a technical demo — show life *after*: the drill report landing in the inbox, the one-dashboard fleet view, the client-report line. First date, not spec sheet |
| 4. Ask | Calendly link for the 15-min walkthrough **or** direct free-tier signup — their pick | Two lanes: Marco books, smaller shops self-serve |
| 5. Remarketing (§4) | The actual growth lever | Most buyers need multiple touches; almost nobody on LinkedIn remarkets, so it's cheap attention |

**Upgrade to a landing-page funnel only after the lead-form funnel works.** A page
converts better (higher schedule/show/close rates per the source playbook) but has
10× the moving parts; prove audience + message on native forms first, then rebuild
the winner as a page on `dockstash.com`.

## 2. The ads themselves

- **Single image beats video for cold** (tested finding, counter-intuitive, cheap
  to iterate). Video's job is stage 3 and remarketing, not the first touch.
- **Break the corporate pattern.** The feed is funding announcements and "delighted
  to share" — an ad that sounds like a person is the chicken suit at the networking
  event. If it reads like a press release, it's invisible.
- Formula: **bold headline calling out the problem**, or a light visual of the pain
  everyone recognizes. If the target laughs, nods, or mutters "…that's me", it
  works.

Dockstash starters (test 3–5 at once, one variable at a time):

1. Headline: **"Your client backup script says 'success'. Has anyone ever tested a
   restore?"** — image: a terminal `backup complete — exit 0` next to a red
   `restore failed`.
2. **"Backups that were never restore-tested are a feeling, not a backup."** —
   plain text card, near-monochrome (on-brand).
3. **"Stop paying per-site to back up client servers."** — fleet-view screenshot,
   real product.
4. Light one: cron log `success ✓ success ✓ success ✓` captioned **"14 months of
   this. Zero restorable snapshots."**

Copy under the image: two plain sentences + the outcome frame + "free on one
project — no card." No "synergy", no "revolutionize", nothing a human wouldn't say
across a desk.

## 3. Targeting — always multiple audiences

The biggest stated mistake: one audience, job-title-only. Run **three ad groups**
and let data pick (there is "almost no exception to this rule"):

| Audience | Build | Guess |
|---|---|---|
| **A. Job titles** | Owner / Founder / Managing Director at companies 2–20, industries: IT services, web design, marketing agencies | The obvious one — often loses |
| **B. Function + seniority** | Function: IT / Engineering / Ops · Seniority: Owner, Partner, Director · headcount 2–50 | Broader, cheaper, often wins |
| **C. Wildcard: seniority + function + skill** | Seniority Director+ · Function IT · Member skills: Docker, DevOps, Linux system administration | Skill targeting is the sleeper — finds Dana |

Geo: same as the DM list (US/UK/DE/NL). Exclude your own employees/competitors.
Budget: $10/day per audience for 2–3 weeks; kill the losers, feed the winner.

## 4. Remarketing — the growth hack that is the actual point

Most LinkedIn advertisers never remarket; the source playbook calls setting it up
"turning the whole system up to 11." The mechanics:

1. **Audiences (Matched Audiences):** ad clickers · video viewers (25%+) · website
   visitors via Insight Tag (that's why it's installed in Week 1) · lead-form
   openers who didn't submit. The two B2B money segments: **leads who didn't book**
   and **prospects mid-conversation** (the DM pipeline sees these ads too — the
   channels compound).
2. **Objective: Brand Awareness** (cheapest), loaded with **many creatives** —
   seeing the same ad five times is annoying; seeing a new proof point each time
   builds the case. Rotate:
   - Feature-in-context videos (a drill failing and alerting; PITR to the minute).
   - Objection handlers: "What if Dockstash dies?" → plain-restic answer as a
     15-sec card. "Another dashboard?" → the client-report line.
   - Proof: real drill stats (`<N> drills, <N> caught failures — that's the
     product working`), testimonials/G2 **only when real ones exist** — never
     mocked, never before.
3. Frequency modest, spend small ($5/day serves a tiny warm audience fine). Keep
   the content fresh monthly.

## 5. Operating rules

- Weeks 1–2 of any new campaign: costs ugly, judge nothing. Same warm-up discipline
  as `../x-growth/06-x-ads-playbook.md`.
- One variable per test (image OR headline OR audience — never all three).
- Leads answered same-day; a lead-form submit that waits three days is dead. The
  Calendly lane books straight into the founder's calendar.
- **Kill rule:** after a fair $500–800 total across the three audiences, no booked
  walkthroughs and no Business-tier trials → stop, write down why, return the money
  to search/newsletters. Killing the ads never kills the channel — content (`04`)
  and DMs (`03`) stay.

## 6. Recap card

```
Funding:      NOT in the current budget. Requires proven DM messaging + expanded budget.
Offer:        Free tier / hands-on trial + 15-min walkthrough — never a white paper.
Funnel:       image ad -> native lead form -> warm-up video -> calendly OR signup -> remarket
Creative:     single image, problem-first, human language. Video only for warm-up + remarketing.
Targeting:    3 audiences always (titles / function+seniority / +Docker skill), $10/day each
Remarketing:  Insight Tag from Week 1; brand-awareness campaign, many creatives, objections+proof
Upgrade path: lead forms -> landing page, only after the funnel converts
North star:   booked walkthroughs + Business-tier trials, not clicks
```
