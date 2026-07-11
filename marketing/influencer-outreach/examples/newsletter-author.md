# Case: Self-Hosting Newsletter Author

**Who:** author of a weekly self-hosting/devops newsletter (selfh.st-class: curated
links + short takes, a few thousand technical readers). One mention here outperforms
most single social posts because the audience is 100% ICP.
**Channel:** email — newsletters publish their contact address; use it.
**Label:** `nl-<handle>` (add to the attribution table when first used).
**This is NOT a sponsorship buy.** Paid placements go through doc 10 with their rate
card. This is the free-year program: the goal is that they *use* it, and mention it
only if it earns a spot in their links section. Never blur the two in one email.

## Example prospect (invented — replace everything)

"The Weekly Homelab", ~6k subscribers, Fridays. Issue #142 linked a Backrest release
with the note: "still waiting for something that understands databases in containers."

## The email

> **Subject:** the "understands databases in containers" gap from issue #142
>
> Hi Dana — in #142, next to the Backrest release, you wrote you're "still waiting
> for something that understands databases in containers." That's close enough to
> Dockstash's reason for existing that I owed you this email.
>
> Dockstash reads a compose project, dumps each database correctly from the running
> container (pg_dumpall / mysqldump --single-transaction / mongodump --oplog),
> backs up with restic to your own storage, and runs scheduled restore drills that
> restore the latest snapshot into a throwaway container and verify it. Self-
> hostable, free tier for one project, plain restic repos underneath — no lock-in.
>
> Two things, kept separate on purpose:
>
> 1. A free year of the Business plan for you, to run on your own stack —
>    single-use link, no card, no coverage expected: {invite_link}
> 2. If, after using it, it merits a line in the newsletter someday — that's your
>    call entirely, and if it happens, please note the free year (disclosure keeps
>    everyone honest).
>
> Not asking for placement, not asking for a rate card conversation — if you sell
> sponsorships I may separately be interested some month, but I'd want the two
> never to touch.
>
> If it breaks on your setup, that report is the most valuable reply.
>
> — Selmi, founder, Dockstash

## Follow-up — day 7, one only

> Bumping once — the link from last week is still live ({invite_link}, dies
> {expiry_date}). "Not for me" is a fine reply and I'll not follow up again.

## Why this shape

- Quoting their own editorial line ("understands databases in containers") makes
  this the easiest yes in the program — you're answering a wish they published.
- The explicit 1/2 separation (free year vs possible future sponsorship) protects
  their editorial integrity *and* keeps the door open for doc-10 paid placement
  later, cleanly.

## Do not

- Offer payment for a mention, or hint the free year expects one. Newsletter
  authors live on reader trust; implying otherwise ends the relationship.
- Ask to "see a draft" if they do write about it. You get what you get.
