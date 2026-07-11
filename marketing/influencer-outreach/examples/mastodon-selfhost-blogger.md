# Case: Mastodon / Fediverse Self-Host Blogger

**Who:** self-host blogger active on the fediverse (often also writes a personal
blog with real reach in this niche). The fediverse overindexes on exactly our ICP —
and has the strongest allergy to marketing-speak of any platform. Growth-hack tone
that works on X reads as a slur here.
**Channel:** Mastodon DM (mention set to "private" visibility) or their blog's
contact email — email often better; check their profile for a stated preference.
**Label:** `bs-<handle>` convention covers Bluesky; use `md-<handle>` for Mastodon.

## Example prospect (invented — replace everything)

@petra@fosstodon.org — runs a "self-hosting diary" blog; recent post series migrating
her family's Nextcloud + Vaultwarden + Immich stack to a new box, with a paragraph
titled "backups: the part I'm least proud of."

## The DM (note the tone shift: quieter, zero formatting tricks)

> Hi Petra — I read the migration series; the honesty in "backups: the part I'm
> least proud of" is rarer than it should be. (For what it's worth: photos in Immich
> are exactly the data class where a copy-the-volume approach quietly fails —
> Postgres underneath.)
>
> I build Dockstash, a self-hostable backup tool for Docker projects: it dumps
> databases properly from the running container, backs up with restic to storage
> you own, and runs scheduled restore drills that actually restore a snapshot to
> scratch and verify it. Free tier runs entirely on your own hardware, no account
> with anyone required.
>
> I'd like to give you a year of the paid tier to run it on the family stack —
> single-use link, no card, no obligation to write a word about it: {invite_link}
>
> If you do ever mention it, please disclose the free year. And if your conclusion
> is "this shouldn't exist, plain restic is enough" — I'd like to read that post
> too, honestly.
>
> — Selmi

## Why this shape

- **Self-hostability leads.** For this persona "runs on your hardware, no account
  required" outranks every feature. It's true, so say it first.
- The Immich/Postgres aside proves technical reading, not flattery-reading.
- "I'd like to read that post too" is the whole program's ethos in one line, and
  this is the audience that will test whether you mean it.

## Do not

- Use X-style formatting (thread-speak, "🧵", "comment X and I'll DM"). Instant loss.
- Push the SaaS angle. Lead self-host; the managed tier can come up on its own.
- Send follow-ups at X cadence. ONE follow-up, a week later, then silence:
  > No reply needed — link's live until {expiry_date} if you ever want it. Thanks
  > for the blog either way; the proxmox-to-bare-metal post saved me an evening.
