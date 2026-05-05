# Legal Page Template

## Page Structure

```tsx
/**
 * Legal Page Template
 *
 * Standard structure for Privacy Policy and Terms of Service pages.
 */

import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { Header, Footer } from "@/components/landing";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";

function LegalPage() {
  const { t } = useTranslation("legal");

  return (
    <>
      {/* SEO Meta Tags */}
      <Helmet>
        <title>{t("page.meta.title")} | ServerlessBase</title>
        <meta name="description" content={t("page.meta.description")} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={`${siteUrl}/page`} />
      </Helmet>

      {/* Page Structure */}
      <div className="min-h-screen bg-background text-foreground">
        <Header />

        <main id="main-content" role="main">
          <LegalPageLayout
            title={t("page.title")}
            lastUpdated={t("page.lastUpdated")}
            effectiveDate={t("page.effectiveDate")}
          >
            <LegalContent />
          </LegalPageLayout>
        </main>

        <Footer />
      </div>
    </>
  );
}
```

## Section Structure

```tsx
/**
 * Legal Section Template
 */

import { LegalSection } from "@/components/legal/LegalSection";

function LegalContent() {
  const { t } = useTranslation("legal");

  return (
    <>
      <LegalSection
        id="section-id"
        title={t("page.sections.sectionName.title")}
      >
        <p>{t("page.sections.sectionName.content")}</p>

        {/* Lists */}
        <ul className="list-disc list-inside space-y-2 mt-4">
          <li>{t("page.sections.sectionName.items.0")}</li>
          <li>{t("page.sections.sectionName.items.1")}</li>
        </ul>

        {/* Tables */}
        <div className="overflow-x-auto mt-4">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-start py-2">{t("common.column1")}</th>
                <th className="text-start py-2">{t("common.column2")}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="py-2">Data</td>
                <td className="py-2">Value</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Emphasis */}
        <p className="mt-4">
          <strong>{t("page.sections.sectionName.emphasis")}</strong>
        </p>
      </LegalSection>
    </>
  );
}
```

## Translation Structure

```json
{
  "pageName": {
    "title": "Page Title",
    "meta": {
      "title": "SEO Title",
      "description": "SEO description for search engines."
    },
    "lastUpdated": "January 26, 2026",
    "effectiveDate": "February 1, 2026",
    "sections": {
      "sectionName": {
        "title": "Section Title",
        "content": "Section content paragraph.",
        "items": [
          "List item 1",
          "List item 2"
        ],
        "emphasis": "Important text to emphasize."
      }
    }
  }
}
```

## Styling Guidelines

### RTL Support
```tsx
// Use logical properties
<div className="ms-4 me-2 ps-6 pe-4">
<div className="text-start">
<div className="start-0 end-0">
```

### Responsive Design
```tsx
// Mobile-first
<div className="text-sm sm:text-base">
<div className="grid grid-cols-1 lg:grid-cols-2">
<div className="hidden lg:block">
```

### Accessibility
```tsx
// ARIA landmarks
<main role="main">
<nav aria-label="Table of contents">

// Heading hierarchy
<h1>Page Title</h1>
<h2>Section Title</h2>
<h3>Subsection Title</h3>

// Touch targets
<a className="min-h-[44px] min-w-[44px]">
```

### Dark Mode
```tsx
// Use semantic tokens
<div className="bg-background text-foreground">
<div className="bg-card text-card-foreground">
<div className="border-border">
<div className="text-muted-foreground">
```

## Content Guidelines

### Plain Language
- Use 8th-grade reading level
- Avoid legal jargon
- Define technical terms
- Use active voice

### Specificity
- State exact timeframes ("30 days")
- Name third-party services
- List specific rights
- Provide concrete examples

### Organization
- Use clear headings
- Break up long paragraphs
- Use bullet points for lists
- Include a table of contents

### Updates
- Include effective date
- Include last updated date
- Explain how users will be notified
- Annual review minimum
