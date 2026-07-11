# Case: Warm Inbound — They DM'd You First

**Who:** anyone who DMs/emails asking about Dockstash — usually triggered by a post
(the lead magnets in social-posts/x-03 and x-01 tweet 13, or a comparison thread).
These are the warmest contacts the whole motion produces; a personal conversation
converts at a multiple of any landing page.
**Channel:** wherever they wrote. Reply in kind, same day if possible.
**Label:** only mint a link if the influencer-program criteria apply (they create
content our ICP reads). A regular user asking questions gets great answers and the
Free tier — not a free year. Don't cheapen the program by spraying it.

## Pattern 1 — the technical question

> **Them:** "How does the restore drill actually work? Does it touch my running DB?"
>
> **You:** Never touches the live system. The drill restores the latest snapshot
> into a throwaway container on the scratch path, verifies the restore (for a DB
> dump: loads it and checks it applies cleanly), then destroys the container. You
> get a pass/fail report with the reason legible. The point is that the failure
> happens in the sandbox at 3am, not in prod during an outage.
>
> Happy to go deeper on any part — and if you want to just see it, the Free tier
> runs it on one project, no card: dockstash.com

Answer first, fully, like an engineer. The link rides along; it never replaces the
answer.

## Pattern 2 — the skeptic

> **Them:** "Why wouldn't I just keep my restic cron script?"
>
> **You:** If it dumps your databases correctly (not file-copies of live data dirs),
> alerts you when it *silently stops* (not just on error), and you test-restore on
> a schedule — keep it, honestly. You've built what I sell. Dockstash is for
> everyone who has one or two of those pieces missing and doesn't want to maintain
> the glue. The compose-audit script I posted will tell you in 10 seconds if your
> dumps are the weak spot: <link>

Concede-first, always. Skeptics you release gracefully talk about you better than
customers you argued into a trial.

## Pattern 3 — the creator you didn't spot

If the inbound person turns out to be a creator in our niche (check before replying
fully): answer their question exactly as above, **then** offer the program:

> Separately — I see you run <their channel/newsletter>. I have a small program
> where I give creators in this space a free year of the Business plan, single-use
> link, no post expected, disclosure requested if you ever mention it. Want one?

Consent-first ("want one?"), because they came to you — dropping an unrequested link
into a support conversation flips it back into being pitched.

## Rules

- Same-day replies while the source post is hot; these DMs decay in hours.
- Every promised artifact (AUDIT script, DRILL checklist) sends with zero added
  pitch — the artifact is the pitch.
- Log every inbound question; three of the same question = a public post
  (post bank #40) and probably an FAQ entry.
- Never paste boilerplate. These are the only people who *asked*. Act like it.
