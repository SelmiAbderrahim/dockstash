# Base DM Template

Every platform file below is this message, resized. Read this one first.

## Slots

| Slot | What goes in it |
|---|---|
| `{name}` | First name. Not the handle, not "hey there". |
| `{platform}` | Where you found them (only if it reads naturally) |
| `{content_reference}` | One **specific** thing they made. See the checklist. |
| `{invite_link}` | Their single-use link, `https://dockstash.com/invite/<token>` |

## The template

> Hi {name} — {content_reference}
>
> I built Dockstash: it backs up a whole Docker project (volumes, databases,
> configs) with restic, and then runs a scheduled **restore drill** that actually
> restores the snapshot into a throwaway container to prove it works. Most backup
> tools tell you the backup succeeded. This one tells you the restore succeeded.
>
> I'd like you to have a free year of the Business plan — no card, nothing to
> cancel. This link is yours alone and works once: {invite_link}
>
> There's no post required. If you do end up mentioning it, please say you got the
> year free. And if you try it and it's bad, I'd rather hear that than nothing.
>
> — Selmi

## Why it's shaped like that

- **Line 1 proves you consumed their work.** It's the only line that can't be
  automated, and it's the only line that decides whether the rest is read.
- **Line 2 is the differentiator, not the feature list.** Restore drills. Don't
  list retention tiers, cron flexibility, or agent counts. One idea.
- **Line 3 is the offer and the risk reversal in one breath.** Free year, no
  card, single-use link. The scarcity is a fact about the link, not a tactic.
- **Line 4 removes the transaction.** "No post required" is what separates this
  from every sponsorship DM in their inbox. Then the disclosure ask, then an
  invitation to tell you it's bad — which is what a real engineer wants to hear.

## Personalization checklist

Send nothing until every box is true.

- [ ] You can name **one specific artifact** they made — a video, a post, a repo,
      a comment thread — and say something about it that a bot could not.
- [ ] The reference is **recent** (last ~6 months) or evergreen enough to still
      matter.
- [ ] They actually run Docker. Not "cloud". Not "DevOps" as a job title on a
      profile. Evidence of `docker compose` in the wild.
- [ ] The link is **freshly minted for them** and labelled `<platform>-<handle>`.
- [ ] You have not sent them anything before, or if you have, ≥3 months ago.
- [ ] The disclosure sentence is present, verbatim-ish.

## `{content_reference}` — good vs. bad

**Bad** (generic, interchangeable, obviously templated):

- "I love your content!"
- "I've been following your work on Docker for a while."
- "Your channel is a great resource for self-hosters."

**Good** (specific, verifiable, has a point of view):

- "your Proxmox + Docker migration writeup convinced me to stop running
  containers on the hypervisor directly — the bind-mount section especially."
- "in the homelab teardown video you said the backup script is 'the thing I keep
  meaning to test.' That line is the reason I'm writing."
- "your comment on r/selfhosted about `restic check --read-data` being too slow
  to run weekly — that trade-off is exactly what I've been chewing on."

The third one is the best kind: you're not complimenting them, you're
continuing an argument they started.

## Audience

Creators who actually operate containers:

- self-hosting / homelab (Proxmox, Unraid, TrueNAS, r/selfhosted)
- Docker & Compose educators
- DevOps / SRE / platform engineering, especially backup + DR content
- indie hackers running their own VPS

**Not** for: general "tech" creators, cloud-vendor evangelists, crypto, growth
accounts, or anyone whose Docker content is a wrapper around an affiliate link.

## Never

- Mail-merge blast copy. One creator, one message, or don't send it.
- A made-up deadline, a made-up "spots left", a made-up "we only picked 5 people".
- Paying for a positive review, or implying the year is contingent on one.
- Sending the same link to two people.
- Posting an invite link publicly. It burns on the first click.
