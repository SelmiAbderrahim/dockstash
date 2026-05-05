---
name: legal-pages
description: >
  Legal page architecture for ServerlessBase covering Privacy Policy and Terms of Service,
  fully internationalized across 5 languages with GDPR and CCPA compliance.
---

# Legal Pages Skill

## Overview

This skill covers the legal page architecture for ServerlessBase, a SaaS cloud deployment platform. The legal pages consist of a Privacy Policy and Terms of Service, both fully internationalized across 5 languages (English, Arabic, French, German, Spanish) with GDPR and CCPA compliance.

## Architecture

### Page Structure

Legal pages are public routes (no authentication required) that use a shared layout system:

```
Route (/privacy or /terms)
  -> Header (landing page header)
  -> LegalPageLayout (container with title, dates, TOC)
     -> PrivacyPolicyContent or TermsOfServiceContent
        -> LegalSection (each major section)
           -> LegalSubsection (nested subsections)
           -> LegalList (bulleted or numbered lists)
           -> LegalTable (data tables)
           -> LegalHighlight (callout boxes)
     -> LegalTableOfContents (sticky sidebar, desktop only)
  -> Footer (landing page footer)
```

### Component Reference

| Component | File | Purpose |
|-----------|------|---------|
| `LegalPageLayout` | `client/src/components/legal/LegalPageLayout.tsx` | Shared layout with title, dates, print button, TOC sidebar, and back-to-top |
| `LegalSection` | `client/src/components/legal/LegalSection.tsx` | Top-level section with `id` for anchor links and `title` rendered as `h2` |
| `LegalSubsection` | `client/src/components/legal/LegalSection.tsx` | Nested subsection rendered as `h3` |
| `LegalList` | `client/src/components/legal/LegalSection.tsx` | Bullet (`type="bullet"`) or numbered (`type="number"`) list from `items` string array |
| `LegalTable` | `client/src/components/legal/LegalSection.tsx` | Responsive table with `headers` string array and `rows` string[][] |
| `LegalHighlight` | `client/src/components/legal/LegalSection.tsx` | Callout box with `variant="info"` (default) or `variant="warning"` |
| `LegalTableOfContents` | `client/src/components/legal/LegalTableOfContents.tsx` | Auto-generated sticky TOC that reads `section[id]` elements and tracks scroll position |
| `PrivacyPolicyContent` | `client/src/components/legal/PrivacyPolicyContent.tsx` | Full privacy policy content using LegalSection components |
| `TermsOfServiceContent` | `client/src/components/legal/TermsOfServiceContent.tsx` | Full terms of service content using LegalSection components |
| `ConsentBanner` | `client/src/components/privacy/ConsentBanner.tsx` | GDPR cookie consent banner mounted in `__root.tsx` |

### Barrel Export

All legal components are exported from `client/src/components/legal/index.ts`:

```typescript
export { LegalPageLayout } from "./LegalPageLayout";
export { LegalSection, LegalSubsection, LegalList, LegalTable, LegalHighlight } from "./LegalSection";
export { LegalTableOfContents } from "./LegalTableOfContents";
export { PrivacyPolicyContent } from "./PrivacyPolicyContent";
export { TermsOfServiceContent } from "./TermsOfServiceContent";
```

## Translation File Structure

All legal content lives in the `legal` i18n namespace:

```
client/public/locales/
  en/legal.json    # English (reference language)
  ar/legal.json    # Arabic (RTL)
  fr/legal.json    # French
  de/legal.json    # German
  es/legal.json    # Spanish
```

### Translation Key Naming Convention

**Privacy Policy keys** follow the pattern:

```
privacy.title                                    # Page title
privacy.meta.title                               # SEO meta title
privacy.meta.description                         # SEO meta description
privacy.lastUpdated                              # Date string (e.g., "January 26, 2026")
privacy.effectiveDate                            # Date string (e.g., "February 1, 2026")
privacy.sections.{sectionId}.title               # Section heading
privacy.sections.{sectionId}.content             # Section body text
privacy.sections.{sectionId}.intro               # Section introductory paragraph
privacy.sections.{sectionId}.{subsection}.title  # Subsection heading
privacy.sections.{sectionId}.{subsection}.description  # Subsection body
privacy.sections.{sectionId}.{subsection}.items  # Array of list items (accessed as items.0, items.1, etc.)
```

**Terms of Service keys** follow the same pattern with `terms.` prefix:

```
terms.title
terms.meta.title
terms.meta.description
terms.lastUpdated
terms.effectiveDate
terms.sections.{sectionId}.title
terms.sections.{sectionId}.content
...
```

**Common keys** shared across both pages:

```
common.lastUpdated          # Label: "Last Updated"
common.effectiveDate        # Label: "Effective Date"
common.tableOfContents      # Label: "Table of Contents"
common.backToTop            # Label: "Back to top"
common.printPage            # Label: "Print this page"
```

### Existing Privacy Policy Sections

| Section ID | Translation Key Prefix | Component ID |
|------------|----------------------|--------------|
| introduction | `privacy.sections.introduction` | `introduction` |
| dataCollection | `privacy.sections.dataCollection` | `data-collection` |
| dataUsage | `privacy.sections.dataUsage` | `data-usage` |
| dataSharing | `privacy.sections.dataSharing` | `data-sharing` |
| dataRetention | `privacy.sections.dataRetention` | `data-retention` |
| userRights | `privacy.sections.userRights` | `user-rights` |
| cookies | `privacy.sections.cookies` | `cookies` |
| security | `privacy.sections.security` | `security` |
| internationalTransfers | `privacy.sections.internationalTransfers` | `international-transfers` |
| children | `privacy.sections.children` | `children` |
| changes | `privacy.sections.changes` | `changes` |
| contact | `privacy.sections.contact` | `contact` |

### Existing Terms of Service Sections

| Section ID | Translation Key Prefix | Component ID |
|------------|----------------------|--------------|
| acceptance | `terms.sections.acceptance` | `acceptance` |
| serviceDescription | `terms.sections.serviceDescription` | `service-description` |
| accounts | `terms.sections.accounts` | `accounts` |
| acceptableUse | `terms.sections.acceptableUse` | `acceptable-use` |
| billing | `terms.sections.billing` | `billing` |
| serviceLevel | `terms.sections.serviceLevel` | `service-level` |
| intellectualProperty | `terms.sections.intellectualProperty` | `intellectual-property` |
| userContent | `terms.sections.userContent` | `user-content` |
| thirdPartyServices | `terms.sections.thirdPartyServices` | `third-party-services` |
| limitationLiability | `terms.sections.limitationLiability` | `limitation-liability` |
| indemnification | `terms.sections.indemnification` | `indemnification` |
| termination | `terms.sections.termination` | `termination` |
| disputeResolution | `terms.sections.disputeResolution` | `dispute-resolution` |
| modifications | `terms.sections.modifications` | `modifications` |
| general | `terms.sections.general` | `general` |
| contact | `terms.sections.contact` | `contact` |

## How to Add a New Section

### Step 1: Add Translation Keys

Add the new section keys to `client/public/locales/en/legal.json` first (the reference language), then translate to all other 4 languages.

Example for a new privacy section called "Automated Decision-Making":

```json
{
  "privacy": {
    "sections": {
      "automatedDecisions": {
        "title": "Automated Decision-Making",
        "intro": "We may use automated processes to make decisions about your account.",
        "details": {
          "title": "How We Use Automated Processing",
          "description": "Our platform uses automated systems for:",
          "items": [
            "Fraud detection and prevention",
            "Usage-based billing calculations",
            "Service health monitoring and alerting"
          ]
        },
        "rights": {
          "title": "Your Rights Regarding Automated Decisions",
          "description": "Under GDPR, you have the right to request human review of any significant automated decision affecting you."
        }
      }
    }
  }
}
```

### Step 2: Add LegalSection in the Content Component

Add the new section to `PrivacyPolicyContent.tsx` (or `TermsOfServiceContent.tsx`):

```tsx
<LegalSection id="automated-decisions" title={t("privacy.sections.automatedDecisions.title")}>
  <p>{t("privacy.sections.automatedDecisions.intro")}</p>

  <LegalSubsection title={t("privacy.sections.automatedDecisions.details.title")}>
    <p>{t("privacy.sections.automatedDecisions.details.description")}</p>
    <LegalList
      items={[
        t("privacy.sections.automatedDecisions.details.items.0"),
        t("privacy.sections.automatedDecisions.details.items.1"),
        t("privacy.sections.automatedDecisions.details.items.2"),
      ]}
    />
  </LegalSubsection>

  <LegalSubsection title={t("privacy.sections.automatedDecisions.rights.title")}>
    <p>{t("privacy.sections.automatedDecisions.rights.description")}</p>
  </LegalSubsection>
</LegalSection>
```

### Step 3: Translate to All 5 Languages

Update each locale file with the translated content:
- `client/public/locales/en/legal.json` (already done in step 1)
- `client/public/locales/ar/legal.json`
- `client/public/locales/fr/legal.json`
- `client/public/locales/de/legal.json`
- `client/public/locales/es/legal.json`

The Table of Contents updates automatically since `LegalTableOfContents` reads all `section[id]` elements from the DOM.

### Step 4: Update Dates

When adding or modifying sections, update `lastUpdated` and `effectiveDate` in **all 5 language files**:

```json
{
  "privacy": {
    "lastUpdated": "March 16, 2026",
    "effectiveDate": "April 1, 2026"
  }
}
```

Date format per language:
- English: `"March 16, 2026"`
- Arabic: `"16 مارس 2026"`
- French: `"16 mars 2026"`
- German: `"16. Marz 2026"`
- Spanish: `"16 de marzo de 2026"`

## GDPR/CCPA/2025 Compliance Requirements

### GDPR Requirements (EU/EEA users)

The Privacy Policy must include:
- [ ] Lawful basis for each processing activity
- [ ] Data subject rights: access, rectification, erasure, portability, restriction, objection
- [ ] Data protection officer contact (if applicable)
- [ ] International transfer mechanisms (Standard Contractual Clauses)
- [ ] Cookie consent with granular opt-in (analytics, marketing)
- [ ] Breach notification procedures (72-hour notification)
- [ ] Clear description of data retention periods
- [ ] Right to lodge a complaint with a supervisory authority

### CCPA Requirements (California users)

The Privacy Policy must include:
- [ ] Categories of personal information collected in preceding 12 months
- [ ] Right to know what personal information is collected and why
- [ ] Right to access personal information
- [ ] Right to delete personal information
- [ ] Right to opt-out of the sale of personal information
- [ ] Non-discrimination statement for exercising rights
- [ ] Financial incentive disclosures (if applicable)
- [ ] "Do Not Sell My Personal Information" notice

### 2025 Regulatory Updates

- EU AI Act implications for automated decision-making disclosures
- Updated Standard Contractual Clauses for international transfers
- California Privacy Rights Act (CPRA) refinements
- State-level privacy laws (Virginia VCDPA, Colorado CPA, Connecticut CTDPA)
- Age-appropriate design code considerations
- Enhanced cookie consent granularity requirements

## Versioning

When legal content changes:

1. Update `lastUpdated` in all 5 language files to the current date
2. Set `effectiveDate` to a date at least 30 days in the future (to give users notice)
3. For material changes, the application should send an email notification (handled by the backend)
4. The `changes` section of the Privacy Policy and the `modifications` section of the Terms document the update notification process

## ConsentBanner Integration

The `ConsentBanner` component is mounted in `client/src/routes/__root.tsx` and appears site-wide. It uses `client/src/lib/consent.ts` for managing user preferences.

### Consent Categories

| Category | Default | User Control | Cookie Key |
|----------|---------|-------------|------------|
| Functional (essential) | Always on | Cannot disable | Part of `serverlessbase_consent_preferences` |
| Analytics | Off | Opt-in | Part of `serverlessbase_consent_preferences` |
| Marketing | Off | Opt-in | Part of `serverlessbase_consent_preferences` |

### Key Functions from `lib/consent.ts`

| Function | Purpose |
|----------|---------|
| `getAnalyticsConsent()` | Get current preferences from localStorage |
| `setAnalyticsConsent(prefs)` | Save preferences and dispatch `consent-change` event |
| `isAnalyticsAllowed()` | Check if analytics tracking is permitted |
| `isMarketingAllowed()` | Check if marketing tracking is permitted |
| `clearConsentPreferences()` | Clear all preferences (for account deletion) |
| `subscribeToConsentChanges(cb)` | Listen for preference changes |
| `withAnalyticsConsent()` | Wrapper that conditionally executes analytics calls |

## Component Patterns

### LegalSection

Every top-level section uses `LegalSection` with an `id` (for anchor links and TOC) and `title`:

```tsx
<LegalSection id="section-slug" title={t("privacy.sections.sectionId.title")}>
  <p>{t("privacy.sections.sectionId.content")}</p>
</LegalSection>
```

The `id` should be kebab-case and corresponds to the anchor in the URL (e.g., `/privacy#data-collection`). The `title` is rendered as an `h2` with a border-bottom divider.

### LegalSubsection

Nested headings within a section use `LegalSubsection` with a `title` (rendered as `h3`):

```tsx
<LegalSubsection title={t("privacy.sections.sectionId.subsection.title")}>
  <p>{t("privacy.sections.sectionId.subsection.description")}</p>
</LegalSubsection>
```

### LegalList

For bulleted or numbered lists, pass an `items` array of strings:

```tsx
<LegalList
  items={[
    t("privacy.sections.sectionId.items.0"),
    t("privacy.sections.sectionId.items.1"),
    t("privacy.sections.sectionId.items.2"),
  ]}
/>

<LegalList type="number" items={[...]} />
```

### LegalTable

For structured data (e.g., data retention periods, service providers), use `headers` and `rows`:

```tsx
<LegalTable
  headers={[
    t("privacy.sections.dataRetention.table.dataType"),
    t("privacy.sections.dataRetention.table.retentionPeriod"),
  ]}
  rows={[
    [t("...periods.accountData.type"), t("...periods.accountData.period")],
    [t("...periods.financial.type"), t("...periods.financial.period")],
  ]}
/>
```

### LegalHighlight

For callout boxes highlighting important information:

```tsx
{/* Default info variant (blue-tinted) */}
<LegalHighlight>
  <p><strong>Important:</strong> Contact us to exercise your rights.</p>
</LegalHighlight>

{/* Warning variant (amber-tinted) */}
<LegalHighlight variant="warning">
  <p>{t("terms.sections.limitationLiability.disclaimer")}</p>
</LegalHighlight>
```

## File Locations Reference

| Purpose | File Path |
|---------|-----------|
| Privacy Policy route | `client/src/routes/privacy.tsx` |
| Terms of Service route | `client/src/routes/terms.tsx` |
| Legal components | `client/src/components/legal/` |
| Component barrel export | `client/src/components/legal/index.ts` |
| Layout component | `client/src/components/legal/LegalPageLayout.tsx` |
| Section components | `client/src/components/legal/LegalSection.tsx` |
| Table of contents | `client/src/components/legal/LegalTableOfContents.tsx` |
| Privacy content | `client/src/components/legal/PrivacyPolicyContent.tsx` |
| Terms content | `client/src/components/legal/TermsOfServiceContent.tsx` |
| Consent banner | `client/src/components/privacy/ConsentBanner.tsx` |
| Consent library | `client/src/lib/consent.ts` |
| Root route (banner mount) | `client/src/routes/__root.tsx` |
| English translations | `client/public/locales/en/legal.json` |
| Arabic translations | `client/public/locales/ar/legal.json` |
| French translations | `client/public/locales/fr/legal.json` |
| German translations | `client/public/locales/de/legal.json` |
| Spanish translations | `client/public/locales/es/legal.json` |
| Legacy skill reference | `.claude/skills/legal-content-generator/SKILL.md` |
| GDPR checklist | `.claude/skills/legal-content-generator/references/gdpr-compliance-checklist.md` |
| CCPA checklist | `.claude/skills/legal-content-generator/references/ccpa-compliance-checklist.md` |

## RTL Support

All legal components use logical CSS properties and are RTL-compatible. Key patterns:

- `ms-auto` instead of `ml-auto` (LegalPageLayout print button)
- `me-2` instead of `mr-2` (icon spacing)
- `text-start` instead of `text-left` (LegalTable headers, LegalTableOfContents buttons)
- `ps-6` instead of `pl-6` (ConsentBanner descriptions)
- `inset-x-4` / `sm:end-4` for ConsentBanner positioning

Arabic translations must use locale-appropriate date formats and the full content must read naturally in RTL layout.

## Related Skills

- `.claude/skills/legal-content-generator/` -- Generic legal content generation templates and compliance checklists
- `.claude/agents/legal-pages-manager/` -- Agent for reviewing, updating, and maintaining legal page content
