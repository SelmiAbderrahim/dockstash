# 03 — Outbound DM Playbook: List → Connect → Value → Conversation

The core motion of this program, and the LinkedIn twin of `../09-cold-outreach.md`.
Same target (Marco), same prospect sheet, same personalization bar — different
channel and different opener. The source playbook ran this exact system with a sales
team to book 200 calls/month; we run it founder-scale first and earn the right to
scale.

**Sequence discipline with doc 09:** one CRM sheet, a `channel` column per prospect.
A prospect in the email sequence is not simultaneously in the DM sequence, and vice
versa. LinkedIn is the default for EU prospects (doc 09's legal note) and for anyone
without a findable email.

## 1. The offer before the outreach

Nothing here works until the **free resource** exists (`01` §4 principle 4). Reuse
the x-growth lead-magnet inventory (`../x-growth/04-content-playbook.md` §4) — built
once, spent everywhere:

| Resource | Best for | Status |
|---|---|---|
| **Backup audit script** — reads `docker-compose.yml`, flags every DB being *copied* instead of *dumped* | The default DM offer. Hands Marco his own bad news in ten seconds | build first |
| **Agency restore-drill checklist** — how to restore-test a client site by hand, what "passed" means, + a client-report template line | The follow-up offer; turns backups into a billable deliverable (doc 09 E2 angle) | build second |
| Dump-commands cheat sheet (pg/mysql/mongo/redis) | Dana, or technical repliers | exists per x-growth |

The resource must be genuinely good — it is the first "result" a prospect gets from
us, and Dockstash appears *inside* it as the way to automate the method. That is
where the selling happens; the DM never pitches.

## 2. List building with Sales Navigator (~3 hrs for the first 200)

Sales Navigator (~$100/mo; start on the trial) filters the whole member database.
The recipe for Marco:

1. **Title/keywords:** `founder OR owner OR director` + `agency`, `web`, `hosting`,
   `WordPress maintenance`, `managed services`. Also try current-title contains
   `sysadmin` + keywords `freelance`, `clients`.
2. **Company headcount: 2–20.** Solo freelancers can't afford $29/mo as easily as
   they claim; 50+ shops have in-house infra teams. 2–20 is the sweet spot where the
   owner still personally fears the backup question.
3. **Geography:** start `US + UK + DE + NL` (English-comfortable, VPS-heavy hosting
   cultures; Hetzner country included on purpose).
4. **Posted on LinkedIn in the last 90 days** filter ON — active accounts answer
   DMs; dead ones waste the invite cap.
5. Save the search. Export nothing — work the list inside Sales Nav, record to the
   shared sheet: name, agency, evidence (their care-plan page, a "we host" claim, a
   compose file in a public repo — doc 09 §sourcing), and `channel = linkedin`.

**Evidence rule carried from doc 09: no evidence of hosting client sites = don't
reach out.** The list is a few hundred verified names, not ten thousand titles.

Segment the list (e.g. WP-maintenance vs dev-agency vs freelance-sysadmin). Script
performance differs by segment, and you can't learn that from a blended list.

## 3. The connection request

Send the invite **with no note**. Counter-intuitive but the source playbook's
tested finding: blank invites get *higher* acceptance than noted ones — a note
pattern-matches to "pitch incoming." (The influencer program uses a content-praise
note; that's a different motion to warm targets and stays as-is.)

- Volume: **~15–20 invites/day**, weekdays. LinkedIn's cap is roughly 100–200/week
  and the throttle tightens on low acceptance. Stay under it forever.
- If acceptance runs < ~25% after 100 invites: the profile isn't confirming the
  headline promise (`02`), or the list segment is off — fix those, don't push volume.
- A/B it anyway once: 50 blank vs 50 with a one-line non-pitch note. Trust your own
  data over the source's.

## 4. The DM sequence (starts when they accept)

### Touch 1 — the value DM (same day as accept)

Pattern from the source playbook: *"I talk to a lot of {ICP} and most aren't doing
{thing} — so I made a free resource on it. Hope it helps."* Nonchalant, complete in
itself, no ask. Dockstash version:

> Hi {FirstName} — I talk to a lot of agency folks hosting client sites on their own
> servers, and almost none can answer one question comfortably: has any client
> backup ever actually been restore-tested, or would you find out live?
>
> I built a small free script for exactly this — it reads a docker-compose.yml and
> flags every database that's being copied live instead of dumped (the #1 silent
> restore-killer). Grab it here if useful: {utm_link}
>
> No pitch — I build backup tooling so I see this daily, figured it's more useful
> shared. — Selmi

Rules: the link is the resource, never the pricing page. UTM-tagged
(`utm_source=linkedin&utm_medium=social&utm_campaign=dm-audit`, doc 11). Founder
status disclosed in-message ("I build backup tooling") — the headline discloses it
too, but say it anyway.

### Touch 2 — day +2, the nudge

> Hey {FirstName} — did you get a chance to run the audit script? Curious whether it
> flagged anything (it usually finds at least one copied-live database).

If they reply "yes, liked it" → conversational close: *"How'd it look? If you want
the flagged ones dumped correctly + restore-tested on a schedule, that's literally
what I built Dockstash for — free tier covers one project if you want to see it on
an internal site first."* This is the only place the product is named with intent,
and by now it's an answer to their situation, not a pitch.

### Touch 3 — day +4, the pattern-break (optional)

The source playbook sends a meme here (Hyperise-personalized, integrates with the
automation tools). Optional for us and only if it's actually funny to a sysadmin —
a "backup succeeded / restore: 404" type joke fits the brand; generic sales memes
don't. If in doubt, skip to touch 4.

### Touch 4 — day +8, the breakup

> Last one from me, {FirstName} — I'll assume backups are handled and leave you
> alone. The script stays free either way, and if restore-proof per client ever
> becomes relevant: dockstash.com (one project free, no card). Good luck with
> {Agency}.

Then **stop** (hard rule, `README.md`). Log the outcome in the sheet.

### Script variant B — the quick question

The source playbook's second proven opener; also doc 09's E1 question. Run it
against variant A on separate list segments:

> Hi {FirstName} — quick question: if one of your client servers died today, have
> the backups ever actually been restore-tested, or would you find out live?

Shorter, more direct, invites a reply instead of a click. Whichever variant wins on
**reply rate** after ~50 sends each becomes the default; keep testing challengers.

## 5. Handling replies (the actual job)

The system's entire output is conversations — respond fast and like a person, not a
sequence. Doc 09's rules carry over: every objection logged and fed to doc 01;
technical questions answered properly (the restore-drill mechanics *are* the
product); the ask escalates gently — resource → "want me to show you on one of your
stacks?" (15-min screenshare or a 2-min video, their pick) → Business trial. Never
jump a step the prospect didn't earn.

## 6. The automation decision (read before installing anything)

The source playbook automates everything through Expandi (~$99/mo): a **connector
campaign** (auto-sends ~20 invites/day from an uploaded list) + a **messenger
campaign** (auto-DMs on accept, with timed follow-ups). It works, and it's how the
200-calls/month number happened.

**The honest catch: all invite/DM automation violates LinkedIn's User Agreement.**
Detection risk is real and the penalty is account restriction or ban — and this
account also carries doc 07's content, the influencer program, and every connection
made so far. The source playbooks don't price that risk; we do.

Decision gate, in order:
1. **Weeks 3–8: fully manual.** At 15–20 invites/day, manual costs ~20 min/day.
   We're testing *messaging*, and manual sends read replies faster anyway.
2. **Only consider automation when** reply rate is proven, the list is >500, and
   the time cost measurably crowds out product work.
3. **If automating:** cloud-based tool (Expandi-class, never a browser plugin —
   plugins are detected first), settings under LinkedIn's human limits (≤20
   invites/day, warm-up ramp, working-hours sending), and accept in writing to
   yourself that the account can die. If that sentence is unacceptable, stay manual.

## 7. Scaling (the source model, filed for later)

The source playbook scales by hiring VAs/SDRs: write the SOP, buy each hire a
Sales Nav + automation seat (~$200/mo/seat), give each a list segment; the founder
only handles replies. That is a real path **after** product-market-fit signals from
this motion at founder scale — dozens of booked conversations, a converting segment,
Business-tier revenue that pays for seats. Until then it's a distraction. Revisit
when `06`'s numbers say the machine works.

## 8. Weekly rhythm

- **Mon:** 20 invites (fresh list rows) · **Tue–Fri:** 15–20 invites/day + same-day
  value DMs to yesterday's accepts + follow-up queue by day-offset.
- **Daily:** replies answered within a few hours during work time.
- **Fri:** sheet hygiene — outcomes logged, objections exported to doc 01, next
  week's list rows staged. Numbers into `06-metrics-and-review.md`.

Time cost: ~30–40 min/day. If it's taking more, the list quality is too low
(research happening at send time — do it in the Monday batch).
