# AI Operations Guide — Agent Function Map

## Business Function to Agent/Skill Mapping

This document maps every business function to the recommended agents and skills. Use this as the primary lookup table when routing tasks.

---

## Development

| Function | Agent/Skill | Typical Workflow |
|----------|-------------|------------------|
| Feature implementation | Coder agents (spec-driven) | Specify > Plan > Tasks > Implement > Review |
| Bug fixing | Coder agents | Reproduce > Diagnose > Fix > Test |
| Code review | Review agents | PR analysis > Security scan > Style check |
| Architecture design | Planner agents | Requirements > Design > Document |
| Database schema changes | Coder agents + schema skills | Design > Migrate > Validate |
| API endpoint creation | Coder agents (tRPC patterns) | Schema > Router > Service > Hook > UI |
| Frontend components | Coder agents (React/Shadcn) | Design > Implement > RTL > Test |
| Docker configuration | Infrastructure agents | Compose > Build > Test > Deploy |
| Testing | Tester agents | Unit > Integration > E2E |
| Performance optimization | Profiling agents | Benchmark > Analyze > Optimize > Verify |
| Security audit | Security agents | Scan > Report > Remediate |
| Documentation (technical) | Documentation agents | Outline > Draft > Review |

### Key Development Patterns
- All development follows spec-driven methodology (8 phases)
- Docker-only execution (never host commands)
- RTL support mandatory for all UI components
- tRPC for all API calls
- Service layer pattern for data access

---

## Marketing

| Function | Agent/Skill | Typical Workflow |
|----------|-------------|------------------|
| Content strategy | `content-strategy` | Audit > Calendar > Production pipeline |
| Blog writing | `copywriting` + `seo-audit` | Topic > Outline > Draft > SEO optimize > Publish |
| Landing page copy | `copywriting` + `page-cro` | Draft > CRO audit > Revise > Test |
| SEO audit | `seo-audit` | Technical > Content > Backlink analysis |
| AI-optimized content | `ai-seo` | Topic cluster > Generate > Optimize |
| Schema markup | `schema-markup` | Identify pages > Generate JSON-LD > Validate |
| Site architecture | `site-architecture` | Map > Optimize > Implement |
| Programmatic SEO | `programmatic-seo` | Template > Data source > Generate pages |
| Social media content | `social-content` | Pillars > Calendar > Create > Schedule |
| Email sequences | `email-sequence` | Map journey > Write > Automate > Measure |
| Cold outreach | `cold-email` | List build > Personalize > Sequence > Track |
| Paid advertising | `paid-ads` + `ad-creative` | Audience > Creative > Launch > Optimize |
| A/B testing | `ab-test-setup` | Hypothesis > Design > Implement > Analyze |
| Conversion optimization | `page-cro` / `form-cro` / `signup-flow-cro` | Audit > Hypothesis > Test > Implement |
| Onboarding optimization | `onboarding-cro` | Map flow > Identify drops > Test improvements |
| Popup optimization | `popup-cro` | Audit > Redesign > Test > Measure |
| Paywall optimization | `paywall-upgrade-cro` | Audit > Reposition > Test > Measure |
| Pricing strategy | `pricing-strategy` | Research > Model > Test > Implement |
| Referral program | `referral-program` | Design > Build > Launch > Optimize |
| Free tool strategy | `free-tool-strategy` | Identify > Build > Distribute > Convert |
| Launch planning | `launch-strategy` | Timeline > Assets > Channels > Execute |
| Analytics setup | `analytics-tracking` | Events > Implementation > Dashboards |
| Competitor analysis | `competitor-alternatives` | Identify > Compare > Position > Publish |
| Copy editing | `copy-editing` | Review > Polish > Consistency check |
| Marketing psychology | `marketing-psychology` | Identify triggers > Apply > Test |
| Marketing ideation | `marketing-ideas` | Brainstorm > Prioritize > Plan |
| Churn prevention | `churn-prevention` | Signals > Interventions > Automate |
| Sales enablement | `sales-enablement` | Collateral > Battlecards > Training |
| Revenue operations | `revops` | Pipeline > Metrics > Optimization |

### Key Marketing Patterns
- Always run `product-marketing-context` first before other marketing skills
- Marketing skills output to `marketing/` directory
- 5-language support for any user-facing marketing content
- All marketing experiments tracked in `marketing/experiments/`

---

## Operations

| Function | Agent/Skill | Typical Workflow |
|----------|-------------|------------------|
| Deployment management | Infrastructure agents | Build > Deploy > Monitor > Rollback |
| Server monitoring | Monitoring agents | Configure > Alert > Respond |
| Database administration | DB management agents | Backup > Monitor > Optimize |
| SSL certificate management | SSL agents | Request > Install > Auto-renew |
| DNS configuration | DNS agents | Record setup > Propagation check > Verify |
| Nginx configuration | Nginx agents | Config > Validate > Reload |
| Docker container management | Docker agents | Build > Deploy > Scale > Clean |
| Log analysis | Log analysis agents | Collect > Parse > Alert |
| Incident response | On-call agents | Detect > Diagnose > Mitigate > Post-mortem |
| Cost optimization | FinOps agents | Audit > Recommend > Implement |
| Backup management | Backup agents | Schedule > Execute > Verify > Restore test |

### Key Operations Patterns
- All operations through Docker (`serverless-*` naming)
- Nginx config: dual-file sync (production + git-tracked)
- Port ranges: 48080 (client), 38291 (API), 49000-49999 (WebSmith), 50000-50999 (App Studio)

---

## Leadership

| Function | Agent/Skill | Typical Workflow |
|----------|-------------|------------------|
| Weekly KPI review | `leadership-dashboard` | Gather > Analyze > Report > Prioritize |
| OKR tracking | `okr-tracker` | Score > Identify risks > Recommend focus |
| Hiring decisions | `team-scaling-playbook` | Evaluate triggers > Recommend > JD |
| Investor updates | `investor-update` | Metrics > Narrative > Format > Send |
| Agent/skill discovery | `ai-operations-guide` | Parse task > Match agent > Recommend |
| Strategic planning | Planner agents | Research > Analyze > Plan > Execute |
| Financial modeling | Finance agents | Model > Scenario > Forecast |
| Risk assessment | Risk agents | Identify > Assess > Mitigate |

### Key Leadership Patterns
- Weekly review cadence (Monday mornings)
- Monthly investor updates
- Quarterly OKR scoring
- Hiring triggers evaluated monthly

---

## Quality Assurance

| Function | Agent/Skill | Typical Workflow |
|----------|-------------|------------------|
| Unit testing | Tester agents | Write > Run > Coverage report |
| Integration testing | Integration test agents | Scenario > Implement > Run |
| Accessibility audit | A11y agents | Scan > Report > Fix |
| RTL validation | RTL agents | Check properties > Mirror icons > Test |
| Performance testing | Performance agents | Benchmark > Profile > Optimize |
| Security scanning | Security agents | Scan > Triage > Remediate |
| Type checking | TypeScript agents | Compile > Fix > Verify |
| Linting | Lint agents | Run > Auto-fix > Verify |

---

## Sales

| Function | Agent/Skill | Typical Workflow |
|----------|-------------|------------------|
| Lead research | Research agents + `cold-email` | Identify > Research > Score |
| Outreach sequences | `cold-email` + `email-sequence` | Write > Personalize > Automate |
| Battlecard creation | `sales-enablement` | Research > Compare > Document |
| Demo preparation | Demo prep agents | Customize > Practice > Deliver |
| Proposal generation | Proposal agents | Template > Customize > Review |
| Pipeline reporting | `revops` | Extract > Analyze > Report |
| Churn intervention | `churn-prevention` | Detect > Intervene > Report |

---

## Cross-Functional Workflow Examples

### New User Onboarding Optimization
```
1. analytics-tracking   → Set up funnel tracking
2. onboarding-cro       → Audit current flow
3. ab-test-setup        → Design improvement tests
4. Coder agents         → Implement winning variants
5. email-sequence       → Create onboarding emails
6. leadership-dashboard → Monitor impact on activation rate
```

### Quarterly Business Review
```
1. leadership-dashboard → Generate KPI review
2. okr-tracker          → Score all OKRs
3. seo-audit            → Content/SEO health check
4. page-cro             → Conversion audit
5. team-scaling-playbook → Hiring readiness check
6. investor-update      → Draft quarterly update
```

### Competitive Response
```
1. competitor-alternatives → Deep competitive analysis
2. pricing-strategy        → Price positioning review
3. copywriting             → Update comparison page copy
4. page-cro                → Optimize comparison page conversion
5. sales-enablement        → Update battlecards
6. social-content          → Draft response messaging
```

---

## Agent Inventory Summary

| Category | Agent Count | Skill Count | Coverage |
|----------|-------------|-------------|----------|
| Development | ~100 | ~30 | High |
| Marketing | ~25 | 32 | High |
| Operations | ~20 | ~10 | Medium |
| Leadership | ~10 | 5 | Medium |
| Quality | ~10 | ~8 | Medium |
| Sales | ~4 | ~4 | Low (pre-hire) |
| **Total** | **~169** | **~89** | |

### Coverage Gaps (Prioritized)

| Gap | Impact | Recommended Action |
|-----|--------|--------------------|
| Customer success automation | High | Create retention monitoring skill |
| Legal/compliance review | Medium | Create compliance checklist skill |
| Financial reporting | Medium | Create monthly P&L generation skill |
| Community management | Medium | Create community engagement skill |
| Localization QA | Low | Extend RTL agents to cover all 5 languages |
