# Swipe File — Writing Principles

General copywriting rules for every Dockstash post. Upload this file to the Claude
Project (`../07-ai-writing-system.md` §1) and treat it as binding for drafts.
Extend it whenever a mentor note, a thread on copywriting, or our own data teaches
us something — this is a living file.

## 1. The reader only cares about themselves

Every reader is silently asking: *can I relate this to me? does this help me? am I
this person?* Write to that. "You" beats "we/I" except in build-in-public and story
posts — and even those must end in a lesson the reader keeps. Engagement questions
should let people talk about themselves or brag ("what's your backup stack?", "when
did you last restore one?") — people answer prompts about themselves; they ignore
statements.

## 2. Structure: Hook → Story → Education → Engagement

The four-beat skeleton (also the pin-tweet formula):
1. **Hook** — one short line, curiosity gap or bold claim. 80% of the work.
2. **Story** — a concrete moment (time, place, number). Specificity = credibility.
3. **Education** — the takeaway the reader can use today. This is what gets
   bookmarked and what gets followers *results* (the retention lever).
4. **Engagement** — a question they'll enjoy answering. Easy prompt > open void.

Not every post needs all four; every post needs #1, and value posts need #3.

## 3. Sentence-level rules

- Short sentences. Short paragraphs (1–2 lines). White space is formatting.
- First line short — long first lines truncate in the feed preview.
- Concrete numbers over adjectives: "6 hours of writes gone" not "a lot of data lost".
- Cut throat-clearing: no "I think", "just", "actually", "in my opinion".
- Write like you talk in DMs. If it sounds like a press release, rewrite it.
- One idea per post. Two ideas = two posts.
- Plain words: "use" not "utilize", "fix" not "remediate".
- No hashtags on X. (Mastodon is the exception — `../07-social-content.md`.)
  Minimal emoji (one, functional, if any).
- Read it out loud once before scheduling — cadence problems are audible.

## 4. Platform mechanics

- **Single posts fit one tweet length** — no "show more" cutoff.
- **Thread tweets each fit one tweet length** — never force mid-thread "show more".
  Tweet 1 = hook + promise only. Last tweet = summary + soft follow-CTA.
- **No links in TOF content** (the ads/organic reach tax — `../06-x-ads-playbook.md`
  §0). The bio link does the clicking work. Links allowed: BOF/promo posts, reply
  ("changelog in the reply") pattern. Every link that ships carries a UTM (doc 11).
- Images: test light background first (dark-mode feeds make light images pop);
  screenshots must be legible on a phone. **Every screenshot comes from the real
  product** — no mockups, no invented dashboards (doc 07 rule).
- Lead-magnet posts must state a DM is coming + follow requirement (`../04` §4).

## 5. Voice (Dockstash founder)

- Builder talking to builders — technical, direct, a little dry humor. Never
  corporate, never hype ("game-changer", "🚀 excited to announce" are banned).
- Honest to a fault: real numbers, failures included, drills that failed acknowledged.
  Honesty is the differentiator, not a compliance cost (see README hard rules).
- **Words to use:** restore drill · proven restorable · dumped from the running
  container · compose-aware · your storage / your keys · plain restic repo · PITR.
- **Words that auto-reject a draft:** "military-grade" · "blazing fast" · "never lose
  data again" · "set and forget" · any statistic you can't source. We sell testing,
  not absolutes — an absolute claim contradicts the product.
- Concede before you compare. Backrest is a good restic UI. Duplicati has a huge
  backend list. Provider snapshots take zero effort. *Then* name the gap. One-sided
  comparisons read as ads and get discounted by humans and AI answer engines alike.
- Always disclose that you built it. Every time. No exceptions.
- Opinionated where we genuinely are (test your restores, own your storage and keys,
  boring tech), generous everywhere else — competitors get fairness, users get credit.
- Personality is the retention differentiator (`../03` §4) — keep the quirks in.

## 6. Anti-patterns (auto-reject a draft that has these)

- Generic-guru voice ("Most people fail because they don't take action…").
- Fake authority claims or invented metrics. Placeholders shipped unfilled.
- Fear without a fix. We trade in a real fear — silent backup failure — so every
  fear post owes the reader an actionable check they can run today.
- Engagement-bait unrelated to the niche ("RT if you agree!").
- Selling in a TOF post; more than ~1 promo post per 20.
- Sushi-restaurant violations: off-niche content because it "might go viral"
  (`../03-daily-routine.md` §4).
- **The swap test.** A hook that would work for any product — if you can swap
  "Dockstash" for any SaaS and nothing changes, the post has no reason to come from
  us. Rewrite it around a dump, a drill, or a restore.
