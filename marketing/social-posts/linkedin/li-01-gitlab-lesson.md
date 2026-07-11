# LI-01 — The GitLab Lesson (flagship post)

**Angle:** DevOps lesson, real public incident · **Length:** ~200 words
**CTA:** question + link in first comment. Post from founder profile.

---

In 2017, GitLab lost six hours of production data — with five backup mechanisms in place.

An engineer deleted the wrong directory. That part is famous. The part that matters more: when they reached for the backups, not one of the five mechanisms worked the way anyone expected. They recovered what they could from a staging copy, live-streaming the whole thing.

The lesson is not "don't delete the wrong directory." Fatigue guarantees someone eventually will.

The lesson is: a backup you haven't restored is a hypothesis.

I see the same architecture on Docker servers every week. "The volume gets copied nightly" — except the volume holds live Postgres data files, mid-write, torn. The job exits 0 every night. The log says success. The backup will never start a database.

Verified means something specific: on a schedule, restore the latest snapshot into a scratch environment, check it, tear it down. A restore drill. Boring, automatable, and the only thing that turns "I think we have backups" into "I know."

I build Dockstash around exactly this idea (link in comments) — but tool aside, steal the practice.

When did your team last restore a backup on purpose?

---

**First comment:** Dockstash — Docker-aware backups with scheduled restore drills.
Free for one project: https://dockstash.com?utm_source=linkedin&utm_medium=social&utm_campaign=li01
GitLab's own postmortem, worth reading in full: https://about.gitlab.com/blog/2017/02/10/postmortem-of-database-outage-of-january-31/

**Ops notes**
- The GitLab facts are public and verifiable — keep the description exactly this
  careful ("not one worked the way anyone expected", not "all five were broken").
- Reply to every comment for 2 hours; the question at the end is the engagement engine.
- Used on: ____
