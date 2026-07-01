# GSC Regex Recipes for BOFU Query Mining

Copy-paste regex patterns for Google Search Console's query filter, to surface hidden bottom-of-funnel queries you already rank for. BOFU terms are low-volume, so they hide at the bottom of the Queries report — regex + a CTR sort pulls them out.

---

## Contents
- The GSC workflow (filter → sort → read)
- Catch-all BOFU regex
- Per-intent regex recipes (comparison, pricing, purchase, evaluative)
- Question vs commercial splitter
- Reading the results

---

## The GSC workflow

1. Open **Search Console → Performance → Search results**.
2. Ensure **Average CTR** and **Total impressions** are toggled on above the chart.
3. Click **+ New → Query → Custom (regex)**.
4. Paste one of the patterns below. GSC uses **RE2** syntax; `|` is OR, matching is case-insensitive for these terms but add `(?i)` to force it.
5. Apply, then **sort the table by CTR descending**.
6. Scan for rows with **low impressions + high CTR** — these are high-intent queries where the handful of searchers are already clicking you. Each is a candidate for a dedicated, conversion-optimized page.

Why low-impression/high-CTR matters: high impressions + low CTR = broad informational term you rank mid-page for. Low impressions + high CTR = narrow, high-intent term where searchers who see you choose you. The second is the BOFU gold.

---

## Catch-all BOFU regex

Grabs every major commercial-intent modifier at once:

```
vs|alternative|alternatives|pricing|price|cost|best|top|cheap|discount|coupon|near me|competitor
```

Use this first for a broad sweep, then narrow with the per-intent patterns below.

---

## Per-intent regex recipes

### Comparison (highest intent)

```
(vs|versus|compared to|or)\b|alternatives?|competitors?
```

Dockstash hits: `dockstash vs backrest`, `simplebackups alternatives`, `restic or duplicati`.

### Pricing / Financial

```
pricing|price|cost|how much|cheap|affordable|free tier|discount|coupon|plans|worth it
```

Dockstash hits: `docker backup pricing`, `how much does dockstash cost`, `cheap restic backup`.

### Purchase / Action (ready to act)

```
buy|sign ?up|get started|download|try|schedule|set ?up|install|automate
```

Dockstash hits: `docker backup sign up`, `schedule docker backups`, `automate compose backups`.

### Evaluative / Category

```
best|top|reliable|secure|automated|easy|simple|self-?hosted|managed|open source|software|tool|service|for (docker|compose|agencies|homelab|production)
```

Dockstash hits: `best docker backup tool`, `self-hosted container backup`, `backup tool for docker compose`.

---

## Question vs commercial splitter

Separate informational questions (usually TOFU, lower priority) from commercial queries.

**Informational (deprioritize / consider discarding):**

```
^(how|what|why|when|who|where|is|are|can|does|do)\b
```

**Commercial (prioritize):** combine the catch-all BOFU regex above, or invert the informational match by filtering it OUT (GSC lets you add a second "Query does not match regex" condition).

A useful two-filter combo: **Query matches** the catch-all BOFU regex **AND Query does not match** `^(how|what|why)\b` — this strips "how does the best backup tool work" style hybrids down to cleaner commercial intent.

---

## Reading the results

For each surfaced query, log into the intent-scoring sheet (SKILL.md Step 4):
- **Impressions** → `volume` proxy
- **CTR** → intent signal (high CTR on a commercial term = strong)
- **Position** → if you rank 5-15 on a high-intent term, a dedicated page can quickly capture it
- Apply the product-fit gate (`icp_pain_aligned`, `direct_product_solution`) before keeping.

Export the filtered table (GSC → Export) and paste directly into the scoring sheet to avoid retyping.
