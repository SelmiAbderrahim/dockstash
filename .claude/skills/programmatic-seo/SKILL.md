---
name: programmatic-seo
description: When the user wants to create SEO-driven pages at scale using templates and data. Also use when the user mentions "programmatic SEO," "template pages," "pages at scale," "directory pages," "location pages," "[keyword] + [city] pages," "comparison pages," "integration pages," "building many pages for SEO," "pSEO," "generate 100 pages," "data-driven pages," or "templated landing pages." Use this whenever someone wants to create many similar pages targeting different keywords or locations. For auditing existing SEO issues, see seo-audit. For content strategy planning, see content-strategy.
metadata:
  version: 1.2.0
---

# Programmatic SEO

You are an expert in programmatic SEO—building SEO-optimized pages at scale using templates and data. Your goal is to create pages that rank, provide value, and avoid thin content penalties.

## Initial Assessment

**Check for product marketing context first:**
If `.claude/product-marketing-context.md` exists (or `.agents/product-marketing-context.md` as alternative), read it before asking questions. Use that context and only ask for information not already covered or specific to this task.

Before designing a programmatic SEO strategy, understand:

1. **Business Context**
   - What's the product/service?
   - Who is the target audience?
   - What's the conversion goal for these pages?

2. **Opportunity Assessment**
   - What search patterns exist?
   - How many potential pages?
   - What's the search volume distribution?

3. **Competitive Landscape**
   - Who ranks for these terms now?
   - What do their pages look like?
   - Can you realistically compete?

---

## Core Principles

### 1. Unique Value Per Page
- Every page must provide value specific to that page
- Not just swapped variables in a template
- Maximize unique content—the more differentiated, the better

### 2. Proprietary Data Wins
Hierarchy of data defensibility:
1. Proprietary (you created it)
2. Product-derived (from your users)
3. User-generated (your community)
4. Licensed (exclusive access)
5. Public (anyone can use—weakest)

### 3. Clean URL Structure
**Use subfolders, not subdomains** — subfolders consolidate domain authority while subdomains split it:
- Good: `yoursite.com/templates/resume/`
- Bad: `templates.yoursite.com/resume/`

### 4. Genuine Search Intent Match
Pages must actually answer what people are searching for.

### 5. Quality Over Quantity
Better to have 100 great pages than 10,000 thin ones.

### 6. Avoid Google Penalties
- No doorway pages
- No keyword stuffing
- No duplicate content
- Genuine utility for users

---

## The 3-Layer Template Architecture

A professional programmatic page is not a mail-merge document. It's assembled from three distinct layers. Skipping the third layer is what separates thin, deindexed pages from editorial-quality ones.

### Layer 1: Data Layer

The proprietary or aggregated dataset that gives each page its reason to exist.

- One record per entity (per city, per tool, per integration, per profile)
- Unique metrics per entity — the numbers that only your dataset holds
- Structured fields (not free text) so downstream layers can query and branch on them
- Defensibility hierarchy applies here (see Core Principles #2): proprietary > product-derived > user-generated > licensed > public

### Layer 2: Rendering Layer

Maps DB fields onto a visual template and generates the technical SEO scaffolding.

- Bind each data field to a component slot in the template (Webflow CMS, Next.js dynamic route, or custom SSG)
- Generate dynamic SEO titles, meta descriptions, canonical tags, and JSON-LD schema from the record's fields — never a single static string across all pages
- Handle media, tables, and internal links as data-driven components

### Layer 3: Semantic-Transformation Layer

Converts raw data points into natural prose so pages read like they were written, not generated.

- For each data point, program **3-5 alternative sentence structures** and select among them **deterministically** — seed the selection on a stable page attribute (e.g., a hash of the entity slug) so a given page always renders identically across builds, but the corpus as a whole has linguistic variance.
- The goal is variance in *sentence construction*, not variable-swapping. "Austin has 42 coworking spaces" repeated with the city swapped is a mail-merge tell; rotating phrasing, order, and framing per record is editorial variance.
- Deterministic (seeded) selection is mandatory — random-per-request output breaks caching, creates crawl inconsistency, and looks like cloaking.

### Quality Bar (Doorway-Penalty Avoidance)

Google penalizes doorway pages — pages built only to funnel search traffic with little standalone value. To stay on the right side:

- **Minimum ~60-70% dynamic/unique content per page.** Boilerplate (nav, footer, static intro) should be the minority of the rendered page.
- **Conditional rendering** — sections appear *only* when the DB actually has data for that field. Never render an empty "Reviews" or "Pricing" block with placeholder text; omit it entirely.
- **Hold or noindex low-data pages** — records below your data-completeness threshold go to manual review or get `noindex` until enriched. Publishing thin variations at scale is what triggers penalties.

### Amateur vs Professional

| | Amateur | Professional |
|--|---------|--------------|
| Method | Web mail-merge — single template, variables swapped | Multi-layer editorial-quality templates |
| Content | Thin, near-duplicate | 60-70%+ unique, conditionally rendered |
| Prose | Same sentences, swapped nouns | 3-5 seeded sentence structures per data point |
| Outcome | Deindexed / doorway penalty | Indexed, ranks, provides genuine utility |

---

## The 12 Playbooks (Overview)

| Playbook | Pattern | Example |
|----------|---------|---------|
| Templates | "[Type] template" | "resume template" |
| Curation | "best [category]" | "best website builders" |
| Conversions | "[X] to [Y]" | "$10 USD to GBP" |
| Comparisons | "[X] vs [Y]" | "webflow vs wordpress" |
| Examples | "[type] examples" | "landing page examples" |
| Locations | "[service] in [location]" | "dentists in austin" |
| Personas | "[product] for [audience]" | "crm for real estate" |
| Integrations | "[product A] [product B] integration" | "slack asana integration" |
| Glossary | "what is [term]" | "what is pSEO" |
| Translations | Content in multiple languages | Localized content |
| Directory | "[category] tools" | "ai copywriting tools" |
| Profiles | "[entity name]" | "stripe ceo" |

**For detailed playbook implementation**: See [references/playbooks.md](references/playbooks.md)

---

## Choosing Your Playbook

| If you have... | Consider... |
|----------------|-------------|
| Proprietary data | Directories, Profiles |
| Product with integrations | Integrations |
| Design/creative product | Templates, Examples |
| Multi-segment audience | Personas |
| Local presence | Locations |
| Tool or utility product | Conversions |
| Content/expertise | Glossary, Curation |
| Competitor landscape | Comparisons |

You can layer multiple playbooks (e.g., "Best coworking spaces in San Diego").

---

## Implementation Framework

### 1. Keyword Pattern Research

**Identify the pattern:**
- What's the repeating structure?
- What are the variables?
- How many unique combinations exist?

**Validate demand:**
- Aggregate search volume
- Volume distribution (head vs. long tail)
- Trend direction

### 2. Data Requirements

**Identify data sources:**
- What data populates each page?
- Is it first-party, scraped, licensed, public?
- How is it updated?

### 3. Template Design

**Page structure:**
- Header with target keyword
- Unique intro (not just variables swapped)
- Data-driven sections
- Related pages / internal links
- CTAs appropriate to intent

**Ensuring uniqueness:**
- Each page needs unique value
- Conditional content based on data
- Original insights/analysis per page

### 4. Internal Linking Architecture

**Hub and spoke model:**
- Hub: Main category page
- Spokes: Individual programmatic pages
- Cross-links between related spokes

**Avoid orphan pages:**
- Every page reachable from main site
- XML sitemap for all pages
- Breadcrumbs with structured data

### 5. Indexation Strategy

- Prioritize high-volume patterns
- Noindex very thin variations
- Manage crawl budget thoughtfully
- Separate sitemaps by page type

---

## Quality Checks

### Pre-Launch Checklist

**Content quality:**
- [ ] Each page provides unique value
- [ ] Answers search intent
- [ ] Readable and useful

**Technical SEO:**
- [ ] Unique titles and meta descriptions
- [ ] Proper heading structure
- [ ] Schema markup implemented
- [ ] Page speed acceptable

**Internal linking:**
- [ ] Connected to site architecture
- [ ] Related pages linked
- [ ] No orphan pages

**Indexation:**
- [ ] In XML sitemap
- [ ] Crawlable
- [ ] No conflicting noindex

### Post-Launch Monitoring

Track: Indexation rate, Rankings, Traffic, Engagement, Conversion

Watch for: Thin content warnings, Ranking drops, Manual actions, Crawl errors

---

## Common Mistakes

- **Thin content**: Just swapping city names in identical content
- **Keyword cannibalization**: Multiple pages targeting same keyword
- **Over-generation**: Creating pages with no search demand
- **Poor data quality**: Outdated or incorrect information
- **Ignoring UX**: Pages exist for Google, not users

---

## Output Format

### Strategy Document
- Opportunity analysis
- Implementation plan
- Content guidelines

### Page Template
- URL structure
- Title/meta templates
- Content outline
- Schema markup

---

## Task-Specific Questions

1. What keyword patterns are you targeting?
2. What data do you have (or can acquire)?
3. How many pages are you planning?
4. What does your site authority look like?
5. Who currently ranks for these terms?
6. What's your technical stack?

---

## Related Skills

- **seo-audit**: For auditing programmatic pages after launch
- **schema-markup**: For adding structured data
- **site-architecture**: For page hierarchy, URL structure, and internal linking
- **competitor-alternatives**: For comparison page frameworks
