# Landing Page Analytics Event Catalog

## Overview

This catalog lists every analytics event fired on the ServerlessBase landing page. Each event follows the naming convention `landing.{section}.{action}` and includes documented properties, firing conditions, and the section where it originates.

All events are fired via the `useAnalyticsTracking` hook at `client/src/hooks/analytics/useAnalyticsTracking.ts`.

---

## CTA Events

### `landing.cta_click`

CTA button clicks across all landing page sections.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `event_type` | `string` | Yes | `"landing.cta_click"` |
| `section` | `string` | Yes | Section containing the CTA (e.g., `"hero"`, `"pricing"`, `"comparison"`, `"migration"`, `"cta_final"`) |
| `cta_text` | `string` | Yes | Visible button text (e.g., `"Start Deploying Free"`) |
| `cta_position` | `string` | Yes | `"primary"` or `"secondary"` |
| `variant` | `string` | No | A/B test variant identifier if applicable |
| `device_type` | `string` | Yes | `"mobile"` \| `"tablet"` \| `"desktop"` |
| `session_id` | `string` | Yes | Unique session identifier |

**When it fires**: User clicks any CTA button on the landing page.

**Section**: All sections containing CTA buttons -- HeroSection, ComparisonSection, PricingSection, MigrationSection, CTASection, FeaturesSection.

**Example**:
```typescript
trackEvent("landing.cta_click", {
  section: "hero",
  cta_text: "Start Deploying Free",
  cta_position: "primary",
  variant: "control",
  device_type: "desktop",
  session_id: "abc-123",
});
```

---

### `landing.cta_email_capture`

Email address submitted through any email capture form on the landing page.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `event_type` | `string` | Yes | `"landing.cta_email_capture"` |
| `section` | `string` | Yes | Section containing the capture form (e.g., `"email_capture"`, `"exit_intent"`, `"cta_final"`) |
| `capture_method` | `string` | Yes | `"inline_form"` \| `"exit_intent"` \| `"sticky_cta"` \| `"cta_section"` |
| `offer` | `string` | No | What was offered in exchange (e.g., `"savings_report"`, `"deployment_guide"`) |
| `variant` | `string` | No | A/B test variant identifier |
| `device_type` | `string` | Yes | `"mobile"` \| `"tablet"` \| `"desktop"` |
| `session_id` | `string` | Yes | Unique session identifier |
| `time_on_page` | `number` | Yes | Seconds since page load when email was submitted |

**When it fires**: User submits a valid email address in any capture form. Fires AFTER successful form submission, not on button click.

**Section**: EmailCapture, ExitIntentCapture, CTASection (if email field present).

**Example**:
```typescript
trackEvent("landing.cta_email_capture", {
  section: "email_capture",
  capture_method: "inline_form",
  offer: "savings_report",
  device_type: "mobile",
  session_id: "abc-123",
  time_on_page: 45,
});
```

**Privacy note**: Never include the actual email address in event properties.

---

## Section View Events

### `landing.section_view`

Fires when a landing page section enters the viewport for the first time.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `event_type` | `string` | Yes | `"landing.section_view"` |
| `section` | `string` | Yes | Section identifier (e.g., `"hero"`, `"pain_points"`, `"comparison"`, `"savings_calculator"`, `"features"`, `"testimonials"`, `"pricing"`, `"faq"`, `"cta_final"`) |
| `viewport_percent` | `number` | No | Percentage of section visible when event fired (0-100) |
| `scroll_depth` | `number` | No | Current scroll depth percentage when section became visible |
| `device_type` | `string` | Yes | `"mobile"` \| `"tablet"` \| `"desktop"` |
| `session_id` | `string` | Yes | Unique session identifier |
| `time_on_page` | `number` | Yes | Seconds since page load |

**When it fires**: Section enters viewport with at least 50% visibility. Fires ONCE per section per session (use `useRef` guard).

**Section**: All landing page sections. Each section registers its own Intersection Observer.

**Tracked sections** (in page order):
1. `hero`
2. `logo_wall`
3. `social_proof`
4. `pain_points`
5. `comparison`
6. `savings_calculator`
7. `how_it_works`
8. `features`
9. `app_studio`
10. `testimonials`
11. `stats`
12. `pricing`
13. `security`
14. `migration`
15. `faq`
16. `cta_final`

**Example**:
```typescript
trackEvent("landing.section_view", {
  section: "pricing",
  viewport_percent: 75,
  scroll_depth: 68,
  device_type: "desktop",
  session_id: "abc-123",
  time_on_page: 32,
});
```

---

## Scroll Depth Events

### `landing.scroll_depth`

Fires when the user reaches scroll depth milestones on the landing page.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `event_type` | `string` | Yes | `"landing.scroll_depth"` |
| `depth_percent` | `number` | Yes | Milestone reached: `25` \| `50` \| `75` \| `100` |
| `max_depth` | `number` | Yes | Maximum scroll depth reached so far (0-100) |
| `device_type` | `string` | Yes | `"mobile"` \| `"tablet"` \| `"desktop"` |
| `session_id` | `string` | Yes | Unique session identifier |
| `time_on_page` | `number` | Yes | Seconds since page load when milestone was reached |

**When it fires**: User scrolls past 25%, 50%, 75%, or 100% of the total page height. Each milestone fires ONCE per session.

**Section**: Page-level (not tied to a specific section component). Implemented via `useScrollDepthTracking` hook.

**Milestones**:
- **25%**: Visitor engaged beyond hero section
- **50%**: Visitor reached mid-page (comparison/calculator area)
- **75%**: Visitor reached pricing section
- **100%**: Visitor scrolled to bottom (high intent)

**Example**:
```typescript
trackEvent("landing.scroll_depth", {
  depth_percent: 50,
  max_depth: 52,
  device_type: "mobile",
  session_id: "abc-123",
  time_on_page: 18,
});
```

---

## Savings Calculator Events

### `landing.savings_calculator.interaction`

Fires when the user interacts with the savings calculator (slider changes, dropdown selections).

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `event_type` | `string` | Yes | `"landing.savings_calculator.interaction"` |
| `section` | `string` | Yes | `"savings_calculator"` |
| `input_field` | `string` | Yes | Which input changed: `"platform"` \| `"team_size"` \| `"bandwidth"` \| `"services"` |
| `input_value` | `string \| number` | Yes | New value of the changed input |
| `calculated_savings` | `number` | No | Annual savings displayed after interaction (in cents) |
| `device_type` | `string` | Yes | `"mobile"` \| `"tablet"` \| `"desktop"` |
| `session_id` | `string` | Yes | Unique session identifier |

**When it fires**: User changes any calculator input. DEBOUNCED to fire at most once per 500ms to avoid flooding during slider drag.

**Section**: SavingsCalculator

**Example**:
```typescript
trackEvent("landing.savings_calculator.interaction", {
  section: "savings_calculator",
  input_field: "team_size",
  input_value: 8,
  calculated_savings: 168000,  // $1,680.00 in cents
  device_type: "desktop",
  session_id: "abc-123",
});
```

---

### `landing.savings_calculator.cta_click`

Fires when the user clicks the CTA button within the savings calculator section.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `event_type` | `string` | Yes | `"landing.savings_calculator.cta_click"` |
| `section` | `string` | Yes | `"savings_calculator"` |
| `cta_text` | `string` | Yes | Button text (e.g., `"See Your Full Savings Report"`) |
| `selected_platform` | `string` | Yes | Competitor platform selected in calculator |
| `team_size` | `number` | Yes | Current team size value |
| `calculated_savings` | `number` | Yes | Annual savings displayed at time of click (in cents) |
| `device_type` | `string` | Yes | `"mobile"` \| `"tablet"` \| `"desktop"` |
| `session_id` | `string` | Yes | Unique session identifier |

**When it fires**: User clicks the CTA button inside the savings calculator output area.

**Section**: SavingsCalculator

**Example**:
```typescript
trackEvent("landing.savings_calculator.cta_click", {
  section: "savings_calculator",
  cta_text: "See Your Full Savings Report",
  selected_platform: "vercel",
  team_size: 5,
  calculated_savings: 264000,  // $2,640.00 in cents
  device_type: "desktop",
  session_id: "abc-123",
});
```

---

## Sticky CTA Events

### `landing.sticky_cta.shown`

Fires when the sticky bottom CTA bar becomes visible.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `event_type` | `string` | Yes | `"landing.sticky_cta.shown"` |
| `section` | `string` | Yes | `"sticky_cta"` |
| `trigger` | `string` | Yes | What triggered it: `"scroll_threshold"` \| `"time_delay"` |
| `scroll_depth` | `number` | Yes | Scroll depth percentage when shown |
| `device_type` | `string` | Yes | `"mobile"` \| `"tablet"` \| `"desktop"` |
| `session_id` | `string` | Yes | Unique session identifier |
| `time_on_page` | `number` | Yes | Seconds since page load |

**When it fires**: Sticky CTA bar transitions from hidden to visible. Fires ONCE per session.

**Section**: StickyBottomCTA

**Example**:
```typescript
trackEvent("landing.sticky_cta.shown", {
  section: "sticky_cta",
  trigger: "scroll_threshold",
  scroll_depth: 15,
  device_type: "mobile",
  session_id: "abc-123",
  time_on_page: 8,
});
```

---

### `landing.sticky_cta.click`

Fires when the user clicks the sticky bottom CTA button.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `event_type` | `string` | Yes | `"landing.sticky_cta.click"` |
| `section` | `string` | Yes | `"sticky_cta"` |
| `cta_text` | `string` | Yes | Button text |
| `scroll_depth` | `number` | Yes | Scroll depth at time of click |
| `time_visible` | `number` | Yes | Seconds the sticky CTA was visible before click |
| `device_type` | `string` | Yes | `"mobile"` \| `"tablet"` \| `"desktop"` |
| `session_id` | `string` | Yes | Unique session identifier |

**When it fires**: User clicks the CTA button within the sticky bottom bar.

**Section**: StickyBottomCTA

**Example**:
```typescript
trackEvent("landing.sticky_cta.click", {
  section: "sticky_cta",
  cta_text: "Start Free",
  scroll_depth: 42,
  time_visible: 15,
  device_type: "mobile",
  session_id: "abc-123",
});
```

---

### `landing.sticky_cta.dismiss`

Fires when the user dismisses (closes) the sticky bottom CTA bar.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `event_type` | `string` | Yes | `"landing.sticky_cta.dismiss"` |
| `section` | `string` | Yes | `"sticky_cta"` |
| `dismiss_method` | `string` | Yes | `"close_button"` \| `"swipe_down"` |
| `scroll_depth` | `number` | Yes | Scroll depth at time of dismiss |
| `time_visible` | `number` | Yes | Seconds the sticky CTA was visible before dismiss |
| `device_type` | `string` | Yes | `"mobile"` \| `"tablet"` \| `"desktop"` |
| `session_id` | `string` | Yes | Unique session identifier |

**When it fires**: User explicitly closes the sticky CTA bar via close button or swipe gesture.

**Section**: StickyBottomCTA

**Example**:
```typescript
trackEvent("landing.sticky_cta.dismiss", {
  section: "sticky_cta",
  dismiss_method: "close_button",
  scroll_depth: 55,
  time_visible: 22,
  device_type: "mobile",
  session_id: "abc-123",
});
```

---

## Exit Intent Events

### `landing.exit_intent.shown`

Fires when the exit intent modal is displayed.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `event_type` | `string` | Yes | `"landing.exit_intent.shown"` |
| `section` | `string` | Yes | `"exit_intent"` |
| `trigger` | `string` | Yes | What triggered it: `"mouse_leave"` \| `"back_button"` \| `"tab_switch"` \| `"scroll_velocity"` |
| `scroll_depth` | `number` | Yes | Scroll depth when exit intent triggered |
| `time_on_page` | `number` | Yes | Seconds on page before exit intent |
| `sections_viewed` | `number` | Yes | Count of sections viewed before exit intent |
| `device_type` | `string` | Yes | `"mobile"` \| `"tablet"` \| `"desktop"` |
| `session_id` | `string` | Yes | Unique session identifier |

**When it fires**: Exit intent overlay transitions from hidden to visible. Fires ONCE per session (exit intent should only show once).

**Section**: ExitIntentCapture

**Desktop trigger**: Mouse cursor moves above the browser viewport (toward close/back buttons).

**Mobile triggers**: Back button press, tab switch (Page Visibility API), or rapid upward scroll velocity.

**Example**:
```typescript
trackEvent("landing.exit_intent.shown", {
  section: "exit_intent",
  trigger: "mouse_leave",
  scroll_depth: 35,
  time_on_page: 22,
  sections_viewed: 5,
  device_type: "desktop",
  session_id: "abc-123",
});
```

---

### `landing.exit_intent.dismiss`

Fires when the user closes the exit intent modal without providing an email.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `event_type` | `string` | Yes | `"landing.exit_intent.dismiss"` |
| `section` | `string` | Yes | `"exit_intent"` |
| `dismiss_method` | `string` | Yes | `"close_button"` \| `"overlay_click"` \| `"escape_key"` |
| `time_visible` | `number` | Yes | Seconds the modal was visible before dismiss |
| `device_type` | `string` | Yes | `"mobile"` \| `"tablet"` \| `"desktop"` |
| `session_id` | `string` | Yes | Unique session identifier |

**When it fires**: User closes the exit intent modal without submitting an email address.

**Section**: ExitIntentCapture

**Example**:
```typescript
trackEvent("landing.exit_intent.dismiss", {
  section: "exit_intent",
  dismiss_method: "close_button",
  time_visible: 4,
  device_type: "desktop",
  session_id: "abc-123",
});
```

---

### `landing.exit_intent.email_captured`

Fires when a user submits their email via the exit intent modal.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `event_type` | `string` | Yes | `"landing.exit_intent.email_captured"` |
| `section` | `string` | Yes | `"exit_intent"` |
| `offer` | `string` | Yes | What was offered (e.g., `"savings_report"`, `"deployment_guide"`, `"discount"`) |
| `time_visible` | `number` | Yes | Seconds the modal was visible before submission |
| `scroll_depth` | `number` | Yes | Scroll depth when exit intent was triggered |
| `device_type` | `string` | Yes | `"mobile"` \| `"tablet"` \| `"desktop"` |
| `session_id` | `string` | Yes | Unique session identifier |

**When it fires**: User submits a valid email in the exit intent form. Fires AFTER successful submission.

**Section**: ExitIntentCapture

**Privacy note**: Never include the actual email address in event properties.

**Example**:
```typescript
trackEvent("landing.exit_intent.email_captured", {
  section: "exit_intent",
  offer: "savings_report",
  time_visible: 8,
  scroll_depth: 35,
  device_type: "desktop",
  session_id: "abc-123",
});
```

---

## Migration Events

### `landing.migration.cta_click`

Fires when the user clicks a CTA in the migration section.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `event_type` | `string` | Yes | `"landing.migration.cta_click"` |
| `section` | `string` | Yes | `"migration"` |
| `cta_text` | `string` | Yes | Button text (e.g., `"Migrate in 5 Minutes"`) |
| `source_platform` | `string` | No | Selected source platform if applicable (e.g., `"vercel"`, `"railway"`) |
| `device_type` | `string` | Yes | `"mobile"` \| `"tablet"` \| `"desktop"` |
| `session_id` | `string` | Yes | Unique session identifier |

**When it fires**: User clicks any CTA button within the MigrationSection component.

**Section**: MigrationSection

**Example**:
```typescript
trackEvent("landing.migration.cta_click", {
  section: "migration",
  cta_text: "Migrate in 5 Minutes",
  source_platform: "vercel",
  device_type: "desktop",
  session_id: "abc-123",
});
```

---

## Comparison Events

### `landing.comparison.swipe`

Fires when a user swipes the comparison table on mobile devices.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `event_type` | `string` | Yes | `"landing.comparison.swipe"` |
| `section` | `string` | Yes | `"comparison"` |
| `direction` | `string` | Yes | `"left"` \| `"right"` |
| `visible_competitor` | `string` | Yes | Competitor column now visible after swipe |
| `swipe_count` | `number` | Yes | Total number of swipes in this session |
| `device_type` | `string` | Yes | `"mobile"` \| `"tablet"` \| `"desktop"` |
| `session_id` | `string` | Yes | Unique session identifier |

**When it fires**: User swipes horizontally on the mobile comparison table to reveal a different competitor column.

**Section**: ComparisonSection (mobile layout only)

**Example**:
```typescript
trackEvent("landing.comparison.swipe", {
  section: "comparison",
  direction: "left",
  visible_competitor: "railway",
  swipe_count: 2,
  device_type: "mobile",
  session_id: "abc-123",
});
```

---

## Event Summary Table

| Event Name | Section | Trigger | Key Properties |
|------------|---------|---------|---------------|
| `landing.cta_click` | Multiple | Button click | `section`, `cta_text`, `cta_position` |
| `landing.cta_email_capture` | EmailCapture, ExitIntent, CTA | Form submit | `capture_method`, `offer`, `time_on_page` |
| `landing.section_view` | All sections | Viewport entry (50%) | `section`, `viewport_percent`, `time_on_page` |
| `landing.scroll_depth` | Page-level | Scroll milestone | `depth_percent`, `max_depth`, `time_on_page` |
| `landing.savings_calculator.interaction` | SavingsCalculator | Input change | `input_field`, `input_value`, `calculated_savings` |
| `landing.savings_calculator.cta_click` | SavingsCalculator | Button click | `selected_platform`, `team_size`, `calculated_savings` |
| `landing.sticky_cta.shown` | StickyBottomCTA | Scroll/time trigger | `trigger`, `scroll_depth`, `time_on_page` |
| `landing.sticky_cta.click` | StickyBottomCTA | Button click | `cta_text`, `scroll_depth`, `time_visible` |
| `landing.sticky_cta.dismiss` | StickyBottomCTA | Close action | `dismiss_method`, `scroll_depth`, `time_visible` |
| `landing.exit_intent.shown` | ExitIntentCapture | Exit behavior | `trigger`, `scroll_depth`, `sections_viewed` |
| `landing.exit_intent.dismiss` | ExitIntentCapture | Close action | `dismiss_method`, `time_visible` |
| `landing.exit_intent.email_captured` | ExitIntentCapture | Form submit | `offer`, `time_visible`, `scroll_depth` |
| `landing.migration.cta_click` | MigrationSection | Button click | `cta_text`, `source_platform` |
| `landing.comparison.swipe` | ComparisonSection | Swipe gesture | `direction`, `visible_competitor`, `swipe_count` |

## Funnel Sequence

The primary conversion funnel and expected events in order:

```
1. landing.section_view { section: "hero" }
2. landing.scroll_depth { depth_percent: 25 }
3. landing.section_view { section: "comparison" }
4. landing.section_view { section: "savings_calculator" }
5. landing.savings_calculator.interaction { ... }
6. landing.scroll_depth { depth_percent: 50 }
7. landing.section_view { section: "pricing" }
8. landing.scroll_depth { depth_percent: 75 }
9. landing.cta_click { section: "pricing" }
   OR
9. landing.cta_email_capture { ... }
10. landing.scroll_depth { depth_percent: 100 }
```

Alternative paths:
- Sticky CTA: `landing.sticky_cta.shown` -> `landing.sticky_cta.click`
- Exit intent: `landing.exit_intent.shown` -> `landing.exit_intent.email_captured`
- Migration: `landing.migration.cta_click`
