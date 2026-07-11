# 07 — The AI Writing System (the "Hybrid Method")

A Claude Project trained on real high-performing tweets in our niche, fed daily with
research, producing posts in our voice 10x faster than writing manually. "Hybrid"
because the upfront human work (collecting winning tweets, extracting principles) is
what makes the AI output usable — do the research once, benefit on every post.

Source benchmark: this exact system carried an account to 15K followers and 7.7M
impressions, posting daily with AI-drafted, human-picked content. Those are the source
creator's numbers, not ours.

## 1. One-time setup: build the Claude Project

Create a Claude Project named **"Dockstash X Ghostwriter"** and upload four knowledge
files. Maintain them in this repo under `swipe-file/` (edit here, re-upload there —
this folder is the source of truth).

| Project file | Contents | Repo source |
|---|---|---|
| `high-performing-tweets.md` | 15–20 real tweets from our niche, each with 50k–100k+ views, pasted verbatim, with an analysis header telling Claude how to use them | `swipe-file/high-performing-tweets.md` |
| `writing-principles.md` | General copywriting rules (hooks, rhythm, specificity, formatting) + the Dockstash voice spec | `swipe-file/writing-principles.md` |
| `copy-principles.json` (or .md) | Structured extraction FROM the swipe file: hook techniques, content structures, engagement triggers, voice/tone patterns | generate with Claude from the swipe file, save alongside |
| `lead-magnet-principles.md` | What makes lead-magnet posts work (see `04` §4): the offer, the comment keyword, the DM mention, follow requirement | derive from `04-content-playbook.md` §4 |

Also paste into the Project's custom instructions:

- **Who we are.** Dockstash: a Docker-aware backup orchestrator built on restic. It
  detects a compose project, dumps databases from the *running container*, and runs
  scheduled restore drills that prove the backup restores. Founder voice, first person.
- **The pillar mix** from `04` (which is doc 07's mix: education/horror 40%, product
  proof 25%, build-in-public 20%, community 15%).
- **The honesty rules** from `README.md` — real numbers only, always disclose that we
  built the product, concede competitor strengths before naming the gap.
- **Words to use:** restore drill, proven restorable, dumped from the running
  container, compose-aware, your storage / your keys, plain restic repo, PITR.
  **Words that auto-reject a draft:** "military-grade", "blazing fast", "never lose
  data again", "set and forget", and any statistic we can't source.
- **Format law:** *"Always produce 10 hook options before any full post. Single posts
  must fit one tweet length. Thread tweets must each fit one tweet length."*

### Building the swipe file (the actual work)
1. Scroll the X feed + Explore/search on our topics (docker, backup, restore, restic,
   self-hosted, homelab, build in public, devtools).
2. Collect posts with outsized numbers — rough bar: **75k+ impressions** (or clearly
   outlier engagement for that account's size).
3. Paste each verbatim into `swipe-file/high-performing-tweets.md` with its metrics
   and a one-line note on *why it worked*.
4. Target **15–20 examples** before first use; keep adding forever. Prune stale ones.
5. Then ask Claude (once): *"Analyze these tweets. Extract patterns in: hook
   techniques, content structure, engagement triggers, topic selection, voice and
   tone. Output as structured JSON."* → save as `copy-principles.json`, upload.

## 2. The research loop (where post ideas come from)

Never ask the AI to invent from nothing — feed it found material:

- **Reddit (the gold mine).** Subscribe: r/selfhosted, r/homelab, r/docker, r/devops,
  r/sysadmin, r/webhosting, r/indiehackers. Scroll the subscribed feed; when a
  post/story/insight stops you — for us that's data-loss postmortems, "my backup
  didn't restore" threads, corrupt-Postgres-directory questions, per-server backup
  pricing rage, self-hosting wins — copy it into the project. Screenshot-of-Reddit +
  commentary is itself a proven post format.
- **X itself.** Outlier posts from the daily routine reading (`03`); competitor
  content (Backrest, Duplicati, SimpleBackups, restic itself); questions people ask in
  replies.
- **YouTube.** Grab a relevant video's transcript → *"pull out the 3 key points"* →
  *"turn into a thread, each tweet one-tweet length."*
- **Voice notes.** Anything you think of while working on Dockstash — dictate straight
  into the project (superwhisper/Wispr Flow or phone dictation). Shipped an adapter?
  Watched a restore drill fail for a real reason? That's tomorrow's build-in-public post.
- **The product itself.** A drill report, a detection screenshot, a support question
  answered twice — all three are posts. Real artifacts beat invented ones, and doc 07's
  rule stands: every screenshot comes from the real product.
- **This repo.** `05-post-bank.md` skeletons → feed one in, ask for 3 variants in
  our voice.

## 3. The writing workflow (per post, ~5 minutes)

1. Paste the raw material (Reddit find, voice note, feature note) into the project.
2. Ask for **10 opening hooks first** — "10 hooks that grab attention, open a
   curiosity loop, and stop the scroll. Post must fit one tweet length."
3. Pick the best hook (or say *"like #3 and #7 but not quite — fresh batch"* —
   fast iteration is the whole reason this is a chat project and not an automation).
4. Have it write the full post from the chosen hook. Edit by hand — capital letters,
   kill brackets, shorten the first line (long first lines get truncated in feed),
   check spacing/readability.
5. Run the swap test (`swipe-file/writing-principles.md` §6): replace "Dockstash" with
   a generic SaaS name. If the post still works, it has no reason to come from us —
   rewrite it around dumps, drills, or restores.
6. Attach media if relevant. **Image rule:** most of our audience runs dark mode —
   a light-background image pops harder in their feed. Test both, watch the data.
7. Into Typefully (drafts → schedule). Threads: verify no tweet needs "show more."

## 4. Scheduling & delivery: Typefully

- ~$10/month tier is enough. Drafts, spacing preview, scheduling, analytics.
- Maintain a 1–2 week queue (filled in the weekly batch, `03` §3); leave slots open
  for live/reactive posts.
- **Auto-DM for lead magnets** (mechanics in `04` §4): follow required ✓, reply to
  first tweet ✓, keyword set, DM contains the resource link. Remember: post must say
  a DM is coming; auto-DM runs only 3 days — sweep late commenters manually.
- Every link that leaves X carries a UTM (`utm_source=x`, convention in doc 11).

## 5. Distribution assists

- The moment a post you care about goes live, the boost network (`03` §5) matters
  most: one early comment/RT from a bigger account signals value to the algorithm
  and cascades. Cultivate those relationships daily; ask sparingly.
- Posts that prove themselves organically → ads machine (`06`), 24h later, never
  sooner.

## 6. Cadence targets

- ≥1 post/day floor; 2–4/day in growth mode (phases 1–2 of `03` §1). This is the
  X-specific floor; doc 07's "3–4 posts/week" is the *cross-platform* cadence for the
  same ideas adapted to Mastodon and LinkedIn.
- 1–2 threads/week, 1 lead magnet / 2–3 weeks.
- Weekly batch writes 10–15 posts in one sitting; daily effort is picking, polishing,
  and reacting — not staring at a blank compose box.
- The algorithm shifts constantly — what worked at the start won't keep working.
  The swipe file and a peer group sharing "what's working now" are the drift
  correction. Re-extract `copy-principles.json` quarterly.
