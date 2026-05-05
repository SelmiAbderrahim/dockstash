---
name: analytics-instrumentation
description: Analytics event instrumentation toolkit for the ServerlessBase landing page and dashboard. Covers event naming conventions, scroll depth tracking, interaction tracking, conversion funnels, and event catalog. Use when implementing analytics events, conversion tracking, event instrumentation, scroll tracking, or landing page metrics.
license: MIT
metadata:
  version: "1.0"
  author: "ServerlessBase Team"
  category: "analytics"
  dependencies: "react@18+, typescript"
---

# Analytics Instrumentation

## Overview

This skill provides standards and patterns for instrumenting analytics events across the ServerlessBase landing page and dashboard. It defines the event naming convention, required properties, and a complete catalog of landing page events. All analytics implementation must use the existing tracking hooks and follow the patterns documented here.

**Keywords**: analytics events, tracking, conversion tracking, event instrumentation, scroll depth, interaction tracking, landing page metrics, A/B testing events, CTA tracking, funnel analysis

## When to Use This Skill

- Adding analytics events to new or existing landing page sections
- Implementing scroll depth or viewport tracking
- Tracking CTA clicks, email captures, or form submissions
- Setting up conversion funnel measurement
- Instrumenting A/B test variants
- Debugging missing or incorrect analytics events
- Reviewing event naming for consistency

## Core Hook Reference

All analytics events are fired through the tracking hook located at:

```
client/src/hooks/analytics/useAnalyticsTracking.ts
```

Supporting hooks:

| Hook | Location | Purpose |
|------|----------|---------|
| `useAnalyticsTracking` | `client/src/hooks/analytics/useAnalyticsTracking.ts` | Primary event tracking |
| `useScrollDepthTracking` | `client/src/hooks/analytics/useScrollDepthTracking.ts` | Scroll milestone tracking |
| `usePageTracking` | `client/src/hooks/analytics/usePageTracking.ts` | Page view tracking |
| `useSessionId` | `client/src/hooks/analytics/useSessionId.ts` | Session identification |
| `useWebVitals` | `client/src/hooks/analytics/useWebVitals.ts` | Core Web Vitals tracking |
| `useFeatureTracking` | `client/src/hooks/analytics/useFeatureTracking.ts` | Feature usage tracking |
| `useDashboardAnalytics` | `client/src/hooks/analytics/useDashboardAnalytics.ts` | Dashboard-specific tracking |

Utility:

| Utility | Location | Purpose |
|---------|----------|---------|
| `deviceDetection` | `client/src/hooks/analytics/utils/deviceDetection.ts` | Device type classification |

## Event Naming Convention

### Pattern

All landing page events follow this strict naming pattern:

```
landing.{section}.{action}
```

| Segment | Rules | Examples |
|---------|-------|---------|
| `landing` | Always the literal string `landing` | `landing.*` |
| `{section}` | snake_case, identifies the page section or component | `hero`, `cta`, `savings_calculator`, `comparison`, `sticky_cta`, `exit_intent`, `migration` |
| `{action}` | snake_case, describes the user action or system event | `click`, `view`, `interaction`, `shown`, `dismiss`, `email_captured`, `swipe` |

### Naming Rules

1. **Prefix is always `landing`** for all landing page events
2. **Section names** use snake_case and match the component name (e.g., `SavingsCalculator` becomes `savings_calculator`)
3. **Action names** describe what happened, not what might happen
4. **Use past tense or present state**: `click` (happened), `shown` (state), `captured` (happened)
5. **No abbreviations**: `interaction` not `intrctn`, `email_captured` not `email_cap`
6. **Compound sections** use underscore: `savings_calculator`, `sticky_cta`, `exit_intent`
7. **Dashboard events** use `dashboard.{section}.{action}` prefix (not `landing`)

## Required Event Properties

Every landing page analytics event MUST include these base properties:

```typescript
interface LandingEventBase {
  event_type: string;       // The full event name (e.g., "landing.cta_click")
  section: string;          // Section identifier (e.g., "hero", "pricing")
  device_type: string;      // "mobile" | "tablet" | "desktop"
  session_id: string;       // From useSessionId hook
  timestamp: number;        // Unix timestamp (ms)
}
```

Additional properties are specific to each event type and documented in the event catalog.

## Implementation Pattern

### Basic Event Tracking

```typescript
import { useAnalyticsTracking } from "@/hooks/analytics/useAnalyticsTracking";

function HeroSection() {
  const { trackEvent } = useAnalyticsTracking();

  const handleCtaClick = () => {
    trackEvent("landing.cta_click", {
      section: "hero",
      cta_text: "Start Deploying Free",
      cta_position: "primary",
      variant: currentVariant,  // A/B test variant if applicable
    });
  };

  return (
    <Button onClick={handleCtaClick}>
      Start Deploying Free
    </Button>
  );
}
```

### Scroll Depth Tracking

```typescript
import { useScrollDepthTracking } from "@/hooks/analytics/useScrollDepthTracking";

function LandingPage() {
  // Automatically tracks 25%, 50%, 75%, 100% milestones
  useScrollDepthTracking({
    milestones: [25, 50, 75, 100],
    eventName: "landing.scroll_depth",
  });

  return <div>{/* page content */}</div>;
}
```

### Section Viewport Tracking

```typescript
import { useRef, useEffect } from "react";
import { useAnalyticsTracking } from "@/hooks/analytics/useAnalyticsTracking";

function FeaturesSection() {
  const { trackEvent } = useAnalyticsTracking();
  const sectionRef = useRef<HTMLDivElement>(null);
  const hasTracked = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTracked.current) {
          hasTracked.current = true;
          trackEvent("landing.section_view", {
            section: "features",
            viewport_percent: Math.round(entry.intersectionRatio * 100),
          });
        }
      },
      { threshold: 0.5 }  // Fire when 50% visible
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [trackEvent]);

  return <div ref={sectionRef}>{/* section content */}</div>;
}
```

### A/B Test Variant Tracking

```typescript
// Always include variant in events when A/B testing
trackEvent("landing.cta_click", {
  section: "hero",
  variant: "b",               // "control" | "a" | "b"
  experiment_id: "hero_headline_v2",
  cta_text: buttonText,
});
```

## Process: Adding a New Analytics Event

### Step 1: Name the Event

Follow the naming convention: `landing.{section}.{action}`

Check the event catalog (see reference file) to avoid duplicates or inconsistencies.

### Step 2: Define Properties

Determine what properties this event needs beyond the base properties. Document them with types.

```typescript
// Example: New event for feature tab switching
interface FeatureTabSwitchProperties extends LandingEventBase {
  tab_name: string;       // Which tab was selected
  previous_tab: string;   // Which tab they came from
  tab_index: number;      // Numeric position (0-based)
}
```

### Step 3: Implement in Component

Use the `useAnalyticsTracking` hook. Fire the event at the appropriate moment.

### Step 4: Add to Event Catalog

Update the event catalog reference file (`references/event-catalog.md`) with the new event.

### Step 5: Verify

1. Open browser DevTools, check the analytics call fires
2. Verify all required properties are present
3. Test on mobile and desktop
4. Test with A/B test variant if applicable
5. Confirm the event appears in the analytics dashboard

## Conversion Funnel Events

### Primary Funnel

Track each step in the conversion funnel to identify drop-off points:

```
landing.section_view (hero)
  -> landing.scroll_depth (25%)
    -> landing.savings_calculator.interaction
      -> landing.cta_click (post-calculator)
        -> landing.cta_email_capture
          -> [Account creation - tracked in dashboard analytics]
```

### Funnel Analysis Rules

1. Every funnel step must have a corresponding event
2. Events must fire in sequence (no skipping steps)
3. Track time between funnel steps (time_since_previous)
4. Track device type at each step (mobile converts differently)
5. Track A/B variant at each step (variant may affect different funnel stages)

## Guidelines

- Never fire analytics events on page load for interactive elements (only for page views and section views)
- Debounce rapid-fire events (e.g., calculator slider changes) to max 1 event per 500ms
- Always include `device_type` from the device detection utility
- Use `useRef` to prevent duplicate section_view events on re-renders
- Test analytics events in all 5 supported languages (event names stay in English)
- Never include PII (email, name, IP) in analytics event properties
- Session ID must persist across page navigation but reset on new sessions

## Reference Files

- [Event Catalog](./references/event-catalog.md) - Complete catalog of all landing page analytics events with properties, firing conditions, and sections

## Troubleshooting

**Problem**: Event not appearing in analytics dashboard
**Solution**: Check browser DevTools Network tab for the analytics call. Verify the hook is imported correctly. Ensure the component is mounted when the event fires.

**Problem**: Duplicate events firing
**Solution**: Use `useRef` guard for Intersection Observer events. Check that `useEffect` dependencies do not cause re-fires. Verify `hasTracked` flag is set before async operations.

**Problem**: Missing properties in event payload
**Solution**: Check that all required base properties are included. Verify the `useSessionId` hook is providing a valid session ID. Check `deviceDetection` utility is returning correct device type.

**Problem**: Scroll depth events not firing
**Solution**: Verify `useScrollDepthTracking` is called in the page-level component (not a child that unmounts). Check that the page has enough content to reach the milestone thresholds.

**Problem**: A/B test events not distinguishing variants
**Solution**: Ensure `variant` property is passed to every event in the tested section. Check that the feature flag hook is returning the correct variant string.
