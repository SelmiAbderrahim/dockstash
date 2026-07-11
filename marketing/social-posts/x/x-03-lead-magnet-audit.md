# X-03 — Lead Magnet: the AUDIT script

**Pillar:** P1 · **Format:** single post · **CTA:** comment "AUDIT" → DM the script
**Prereq (hard):** the script exists, works on a plain docker-compose.yml, and is
hosted somewhere you control (gist/repo, UTM-tagged link). You will DM it by hand.

---

Your docker-compose.yml already knows whether your backups will restore.

The rule: every service whose data directory you're copying as files — postgres, mysql, mongo — is a service you're backing up wrong. Live database files don't restore. Dumps do.

I wrote a script that reads a compose file and flags each service that's backed up the wrong way, with the correct dump command for each one.

Comment "AUDIT" and I'll DM it. (Follow first, or the DM can't send.)

I build Dockstash, so yes — I have a horse in this race. The script is useful either way, and it doesn't need my product to run.

---

**The DM you send back** (no extra pitch — the magnet is the pitch):

> Here it is: <link>
> Run it against any compose file — it only reads, never writes. If it flags
> something surprising, I'd genuinely like to hear about it.

**Ops notes**
- The disclosure line doubles as credibility — don't cut it.
- Expect a spike of low-intent comments; DM everyone anyway. The list of handles who
  commented is itself the warm-audience list for later.
- Rerun cadence: once per ~3 weeks max (see x-growth/04 §4).
- Used on: ____
