# Swipe File — High-Performing Tweets (niche research)

<!--
ANALYSIS HEADER (keep this — it is read by the Claude Project):
This collection contains real tweets from the docker/backup/self-hosted/devtools/
indie-hacker niche that achieved outlier engagement (target bar: 50k–100k+ views, or
clear outliers for the account's size). Use these examples to identify patterns in:
hook techniques, content structure, engagement triggers, topic selection, voice and
tone, formatting (line breaks, lists, emoji use), and media choices. Do NOT copy them —
extract the patterns and apply them to Dockstash's topics (correct database dumps,
restore drills, self-hosting, data loss) in the founder's voice.
-->

## How to maintain this file (human instructions)

1. While doing the daily routine (`../03-daily-routine.md`) and research loop
   (`../07-ai-writing-system.md` §2), whenever you hit a post with outlier numbers in
   our niche — copy it here **verbatim**.
2. Record: author handle, date, metrics (views/likes/comments/bookmarks if visible),
   media type, and ONE line on why you think it worked.
3. Target: 15–20 entries before first use of the Claude Project. Keep adding; prune
   entries that feel dated (algorithm and formats drift — refresh quarterly).
4. After every ~10 new entries, re-run the extraction prompt (bottom of this file)
   and refresh `copy-principles.json` in the Claude Project.

Sourcing tips:
- X Explore/search: `docker`, `backup`, `restore`, `restic`, `self-hosted`,
  `selfhosted`, `homelab`, `data loss`, `postgres`, `build in public`, `devops`.
- The comment sections of the target-account list (`../03-daily-routine.md` §2B).
- Data-loss postmortems from any industry — the emotional structure transfers even
  when the stack doesn't.
- Lead-magnet posts in ANY niche are worth swiping for structure (they share
  mechanics regardless of topic).

---

## Entries

### 001
- **Author:** @
- **Date:** 
- **Metrics:** views · likes · comments · bookmarks
- **Media:** none / image (light|dark) / video / screenshot-of-reddit
- **Why it worked (1 line):** 

> (paste tweet verbatim, preserving line breaks)

### 002
- **Author:** @
- **Date:** 
- **Metrics:** 
- **Media:** 
- **Why it worked:** 

> 

<!-- duplicate the block above per entry; renumber sequentially -->

---

## Extraction prompt (run against this file, save output as copy-principles.json)

> Analyze all tweets in this collection. Extract recurring patterns and output
> structured JSON with these keys: `hook_techniques` (named patterns + one example
> each), `content_structures` (post skeletons observed), `engagement_triggers`
> (what makes people reply/bookmark/share), `topic_selection` (which angles win),
> `voice_and_tone` (sentence length, formatting, emoji, capitalization habits),
> `media_patterns`. Be specific and prescriptive — this JSON will be used as writing
> rules, not description.
