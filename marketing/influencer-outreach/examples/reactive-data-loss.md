# Case: Someone Who Just Lost Data — DO NOT PITCH

**Who:** anyone — creator or not — currently posting about an active or fresh data
loss ("our DB is gone", "backups turned out to be empty", "restoring from a 3-week-old
snapshot, wish us luck").
**Channel:** whatever platform it's happening on.
**Label:** none — because in this case **you send no offer**.

## The rule

A backup vendor DMing a person mid-data-loss is an ambulance chaser. It will feel
justified ("we literally solve this!") and it will read as ghoulish — to them and to
everyone they later tell. The stronger the fit, the worse the look.

**During the incident: help or stay silent. No product. No link. No founder title.**

## What you MAY send during the incident (only if you can actually help)

Concrete, tool-agnostic technical help, credentials-free:

> Saw the thread — if the "empty backup" is a pg_dump that ran against a container
> that was down, check whether the volume itself still has the WAL: point-in-time
> recovery from the data directory may still be possible even without a valid dump.
> Happy to talk through it if useful. (No product involved — I just work in this
> space and this exact failure is recoverable more often than people think.)

If you have no genuinely useful knowledge for their specific situation: **silence.**
An emoji-sympathy reply from a backup founder is still marketing.

## What you may do AFTER — weeks later, if at all

If they post a public retro/postmortem once the dust settles, two options:

1. **Public, no product:** engage with the retro on its lessons, as in post bank #41.
   Never "this is why you need…". The audience draws the conclusion alone.
2. **DM, only if you helped during the incident and they engaged:** the relationship
   exists now; the normal program rules apply (reference their retro, full-honesty
   offer, disclosure ask). Weeks later — not days.

> Glad the retro ended on "we now test restores." For what it's worth, that
> practice is the entire reason my product exists (I build Dockstash — scheduled
> restore drills for Docker projects). If you ever want a year of it free to make
> that habit automatic, say the word and I'll mint you a link. Zero obligation,
> and the offer expires never.

Note the inversion: **ask before sending the link.** After a data loss, consent-first
is the only acceptable mode.

## Why this file exists

Every other file optimizes conversion. This one optimizes not becoming the
screenshot titled "backup vendors are vultures." One of those undoes a year of
honest community work. The self-host crowd keeps receipts.
