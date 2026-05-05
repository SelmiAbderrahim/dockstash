---
name: legal-content-generator
description: |
  Generates compliant legal content for SaaS platforms including Privacy Policies and Terms of Service.
  This skill should be used when creating or updating legal pages for ServerlessBase or similar SaaS platforms.
  Covers GDPR, CCPA, and 2025 regulatory requirements with SaaS-specific clauses.
license: MIT
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
metadata:
  version: "1.0.0"
  author: "ServerlessBase"
  category: "legal-content"
  tags:
    - privacy-policy
    - terms-of-service
    - gdpr
    - ccpa
    - saas
    - compliance
---

# Legal Content Generator Skill

This skill provides guidance and templates for generating compliant legal content for SaaS platforms.

## When to Use This Skill

Use this skill when:
- Creating new Privacy Policy or Terms of Service pages
- Updating existing legal content for compliance
- Generating legal content for new supported languages
- Reviewing legal pages for regulatory compliance
- Adding new data collection practices that need documentation

## How to Use

### Privacy Policy Generation

1. Load `references/privacy-policy-requirements-2025.md` for current requirements
2. Customize content for specific SaaS context
3. Include all mandatory sections from checklist
4. Specify exact data retention periods
5. List all third-party services with purposes

### Terms of Service Generation

1. Load `references/terms-of-service-requirements-2025.md` for requirements
2. Apply SaaS-specific clauses
3. Include billing and subscription terms
4. Add SLA commitments if applicable
5. Include dispute resolution provisions

### Compliance Checklists

- Load `references/gdpr-compliance-checklist.md` for EU/EEA compliance
- Load `references/ccpa-compliance-checklist.md` for California compliance

## Content Guidelines

### Writing Style
- Use plain language (8th-grade reading level)
- Avoid legal jargon where possible
- Be specific, not vague
- Include concrete examples

### Data Retention
Specify exact timeframes:
- "While your account is active"
- "30 days after account deletion"
- "7 years for financial records"
- NOT: "as long as necessary"

### Third-Party Services
List each service with:
- Service name
- Purpose of use
- Data shared
- Privacy policy link

### User Rights
Document rights by jurisdiction:
- GDPR (EU/EEA): Access, rectification, erasure, portability, objection
- CCPA (California): Know, delete, opt-out, non-discrimination

## Reference Files

| File | Purpose |
|------|---------|
| `references/privacy-policy-requirements-2025.md` | Privacy policy section requirements |
| `references/terms-of-service-requirements-2025.md` | Terms of service section requirements |
| `references/gdpr-compliance-checklist.md` | GDPR compliance checklist |
| `references/ccpa-compliance-checklist.md` | CCPA compliance checklist |

## Asset Files

| File | Purpose |
|------|---------|
| `assets/legal-page-template.md` | Template for legal page structure |

## Integration with ServerlessBase

### Company Details
- Company Name: ServerlessBase
- Contact Email: support@serverlessbase.com
- Jurisdiction: International (multi-jurisdictional)

### Service Details
- Type: SaaS deployment platform
- Data Centers: Multiple regions (EU, US, Asia)
- Supported Languages: English, Arabic, German, Spanish, French

## Annual Review Process

1. Review all legal content annually (minimum)
2. Update for new regulatory requirements
3. Add new data collection practices
4. Update third-party service list
5. Update effective dates
6. Notify users of material changes
