# Case: DevOps Podcast Host

**Who:** host of a devops/self-hosting podcast that does interview episodes. The
ask here is different from every other file: not "use my tool" first, but "here's a
story your audience would like" — with the free year as a sidenote, not the lede.
Podcasts run on stories; a founder with a portable horror-story angle is inventory.
**Channel:** email (podcast contact/booking address).
**Label:** `pc-<handle>`.

## Example prospect (invented — replace everything)

"Ops After Dark", biweekly interview podcast, ~90 min episodes. Recent episode was a
postmortem special; host said on air he wants more "failure architecture" episodes.

## The email

> **Subject:** failure-architecture episode idea: why backups lie
>
> Hi Jonas — the postmortem special was excellent (the section on alert fatigue
> especially), and you mentioned wanting more failure-architecture episodes. Pitch:
>
> **"Why your backups lie to you"** — the anatomy of silent backup failure.
> Material I can bring, all public-source or first-hand:
>
> - why copying a live database file produces a backup that exits 0 and never
>   restores (torn pages, WAL/heap disagreement — explainable in plain English)
> - GitLab 2017 / Code Spaces 2014 / OVH fire 2021 as three different failure
>   *classes*: unverified, reachable-by-attacker, same-blast-radius
> - what "verified" has to mean: restore drills, dead-man's switches, and why
>   "alert on silence" beats "alert on error"
> - the uncomfortable founder angle: I sell backups, and the honest version of
>   that marketing is publishing my product's failure counts
>
> Context: I'm the founder of Dockstash (Docker-aware backups with scheduled
> restore drills). Happy for the episode to be 90% practice, 10% product — or 100%
> practice; your call and your edit.
>
> Separately and with no strings: a free year of the Business plan if you ever want
> to point it at your own stack — single-use link, no card, no mention expected:
> {invite_link}
>
> — Selmi

## Follow-up — day 7, one only

> Bumping the episode pitch once — if the calendar's full or the topic's not a fit,
> a plain "pass" is genuinely fine and useful.

## Why this shape

- You're selling them a *show*, not a tool. The bullet list is the segment outline —
  the host can read it and hear the episode.
- "90% practice, 10% product — your call" pre-answers the only objection that
  matters to a host (becoming an infomercial).
- The invite link is deliberately last and deliberately detached from the pitch.

## Do not

- Ask for the episode *and* condition anything on it. The free year exists whether
  the episode happens or not.
- Script your product mentions. If the episode happens, answer questions live and
  let disclosure happen naturally ("I build one of these, so discount accordingly").
- Pitch shows you haven't listened to. One episode minimum, and the reference must
  prove it.
