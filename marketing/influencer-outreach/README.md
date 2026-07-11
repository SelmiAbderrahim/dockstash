# Influencer Outreach — 1 Free Year of Business

The program: hand DevOps / self-hosting / Docker creators a **single-use
invitation link** that unlocks the **Business plan for 1 year, free**. They try
it on a project they already run. If it earns a mention, great. If it doesn't,
they keep the year anyway.

That last sentence is the whole offer. Read it again before you send anything.

## Why this works

The ask is not "please post about us." The ask is "please use the thing." A
creator who backs up their own homelab with Dockstash for a year, and who
watched a restore drill actually restore, has something to say. A creator who
was paid to say it does not.

The invitation link is also the lead magnet: it's concrete, it's theirs alone,
and it expires. No demo call, no trial credit card, no sales sequence.

## Minting a link

1. Sign in as superadmin → **Superadmin → Invitations**.
2. Plan: **Business**. Grant duration: **1 year**. Link expires in: **30 days**.
3. Label: the attribution handle (see below).
4. **Create link**, then **Copy link**. You get
   `https://dockstash.com/invite/<token>`.

One link per creator. Never reuse a link, never post one publicly — the first
person to open it burns it.

## Attribution convention

The `label` field never reaches the recipient; it exists so a claim maps back to
the DM that produced it. Use `<platform>-<handle>`, lowercase, no spaces:

| Platform | Label |
|---|---|
| LinkedIn | `li-adalovelace` |
| X / Twitter | `x-adalovelace` |
| YouTube | `yt-adalovelace` |
| Reddit | `rd-adalovelace` |
| Bluesky | `bs-adalovelace` |

The Invitations tab shows **Label**, **Status**, and **Claimed by**, so a scan
of the list tells you which platform is converting and which is dead air. Every
claim also emails the operator inbox (`CONTACT_RECIPIENT`) with the label
attached.

## Mechanics you must state honestly

Both constraints are real. Say them plainly; don't dress them up.

- **Single-use.** The link works exactly once. Once claimed it is dead for
  everyone else — including the creator, if they open it on a throwaway account
  by mistake.
- **The link expires in 30 days.** Not the grant — the *link*. The 12-month
  grant starts the day they activate, not the day you send it. A creator who
  activates on day 29 still gets a full year.
- **After 12 months it lapses to Free.** No card on file, no auto-charge,
  nothing to cancel. Projects over the Free cap are paused, never deleted.

Never invent a second deadline, never say "only 3 left this month" unless you
have literally minted three links.

## Status meanings in the tab

| Status | What happened |
|---|---|
| **Pending** | Sent (or not) — nobody has activated it |
| **Claimed** | Activated. `Claimed by` shows the account email |
| **Expired** | Link expiry passed without a claim. Mint a new one if they resurface |
| **Revoked** | You killed it manually. Only possible while pending |

## Disclosure — non-negotiable

If a creator posts about Dockstash after receiving a free year, they must
disclose the material connection (FTC 16 CFR Part 255 and equivalents). Put it
in the DM, not in a follow-up. Wording that works:

> If you do end up posting about it, please say you got a free year — I'd rather
> the disclosure be boring than have anyone squint at it.

We are asking them to **try it and share it if they like it**. We are not buying
coverage. If a creator asks "what do I have to post?", the correct answer is
"nothing."

## Reply & objection handling

| They say | You say |
|---|---|
| "What's the catch?" | None. It lapses to Free after a year, no card needed. If it's useful you'll probably stay; if not, you lost nothing. |
| "I don't do sponsored content." | Neither do we. There's no post required and no contract. The link is yours whether you write a word or not. |
| "I already use restic / Borg / Duplicati." | Then you're the person I most want on this. Dockstash is restic underneath — the part we add is scheduled restore *drills* that prove the snapshot restores. Try it against a project you already back up and tell me where it's wrong. |
| "Send me a rate card." | We don't have one. This is a free year, not a placement. |
| "Can I give the link to my community?" | It's single-use, so the first click wins and everyone else hits a dead page. Point them at the Free tier instead. |
| No reply | One follow-up on day 3, one on day 8, then stop. See the per-platform files. |

## The files

| File | Use |
|---|---|
| [dm-template.md](dm-template.md) | The base message + personalization checklist. Start here. |
| [linkedin-dm.md](linkedin-dm.md) | LinkedIn DM, connection note, 2 follow-ups |
| [x-dm.md](x-dm.md) | X DM + public-reply opener for closed DMs |
| [other-platforms.md](other-platforms.md) | Reddit, YouTube business inquiry, Bluesky |
| [examples/](examples/) | Worked, filled examples per creator type — YouTube homelab, X indie hacker, agency lead, Reddit, Mastodon, newsletter, podcast — plus the two special cases: reactive data-loss (do-not-pitch) and warm inbound |
