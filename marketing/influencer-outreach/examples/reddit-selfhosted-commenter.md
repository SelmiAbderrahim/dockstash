# Case: r/selfhosted Power Commenter

**Who:** not a "creator" in the follower sense — a high-karma, high-signal commenter
whose backup opinions get upvoted in r/selfhosted / r/homelab. These people set tool
consensus on the exact forum our buyers read.
**Channel:** Reddit — and Reddit is the etiquette minefield. Unsolicited commercial
DMs get screenshot and posted. So: contribute in-thread first, ask permission, *then* DM.
**Label:** `rd-<handle>`.

## Example prospect (invented — replace everything)

u/wintermuted, regular in r/selfhosted backup threads. Yesterday, in a "how do you
back up your compose stacks?" thread, wrote a detailed comment on why they run
`restic check --read-data` monthly but find it too slow to run weekly.

## Step 1 — the in-thread reply (public, genuinely useful, no link)

> The weekly/monthly trade-off on --read-data is real. One middle path: weekly
> `check` (structure only, seconds) + monthly `--read-data`, and treat a *restore
> test* as the weekly data-level check instead — restoring latest into a scratch
> container and diffing exercises the read path on the snapshot you'd actually
> reach for, and it's much faster than reading the whole repo.
>
> Disclosure: I build a Docker backup tool (Dockstash) that automates exactly that
> drill, so I'm biased toward it as the verification layer. The pattern works with
> plain restic + a script too.

The disclosure is mandatory (subreddit rules + our own ground rules). The comment
must earn upvotes with the ask removed.

## Step 2 — the permission ask (only if they engage with your reply)

> Enjoyed this thread — I'd like to send you something related (a free year of the
> tool I mentioned, no strings, genuinely no post expected). OK to DM?

## Step 3 — the DM (only after a yes)

> Thanks — short version: Dockstash backs up compose projects with restic (DBs
> dumped correctly from the running container, not file-copied) and runs the
> scheduled restore drills we were talking about. Your read on where it falls short
> would honestly be more useful to me than a mention.
>
> Free year of the Business plan, single-use link, expires in 30 days, year starts
> at activation, lapses to Free after: {invite_link}
>
> If you ever do write about it anywhere, please say you got the year free.
> — Selmi

## Why this shape

- Reddit's currency is contribution; the DM is only legitimate because the comment
  stood on its own and they opted in.
- This persona will read the source and the security model before activating.
  Expect hard questions about the socket proxy and SSH pinning — answer precisely;
  that conversation *is* the win.

## Do not

- DM cold. One screenshot in r/selfhosted costs more than 50 creators gain.
- Post an invite link in a thread (single-use — first stranger burns it).
- Argue with their tool preferences. If they're happy with Borg + scripts, the
  correct reply is "that setup is solid" — and mean it.
