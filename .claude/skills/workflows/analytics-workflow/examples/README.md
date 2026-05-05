# Analytics Workflow - Working Examples

This directory contains production-ready code examples for implementing the analytics workflow in iReadYouTube.

## Files

### 1. `event-emitter.ts`

Core utility for emitting events to ClickHouse:

**Features:**
- Type-safe event emission
- Automatic batching and deduplication
- Retry logic with exponential backoff
- Event validation before insertion
- Correlation ID tracking for tracing

**Use when:**
- Tracking user actions (uploads, transcriptions, chats)
- Emitting business events (signups, upgrades, cancellations)
- Needing reliable event delivery with guaranteed ingestion
- Building event-driven analytics pipeline

**Key Pattern:**
```typescript
import { eventEmitter } from "@/lib/analytics/eventEmitter";

// Emit video upload event
await eventEmitter.emit({
  type: "video_upload",
  userId: user._id,
  videoId: video._id,
  source: "youtube",
  durationSeconds: 1234,
  fileSizeMB: 456
});

// Emit transcription completion event
await eventEmitter.emit({
  type: "transcription_complete",
  userId: user._id,
  videoId: video._id,
  transcriptId: transcript._id,
  duration_minutes: 20
});

// Emit chat message event
await eventEmitter.emit({
  type: "chat_message",
  userId: user._id,
  videoId: video._id,
  messageTokens: 150,
  responseTokens: 300,
  webSearchUsed: true
});
```

**Performance:**
- Event emission: <10ms (batched)
- Batch flush: <500ms (network dependent)
- Memory per 1000 events: <2MB
- Auto-retry on failure

### 2. `clickhouse-client.ts`

ClickHouse client for queries and aggregation:

**Features:**
- Connection pooling
- Query batching and caching
- Error handling with retries
- Result streaming for large datasets
- Prepared statements for injection prevention

**Use when:**
- Querying ClickHouse for metrics
- Running aggregation jobs
- Building dashboard queries
- Exporting analytics data

**Key Pattern:**
```typescript
import { clickhouseClient } from "@/lib/analytics/clickhouseClient";

// Query daily metrics
const metrics = await clickhouseClient.query(`
  SELECT
    toDate(timestamp) as date,
    action,
    COUNT(*) as total_events,
    COUNT(DISTINCT user_id) as unique_users,
    AVG(CAST(duration_seconds AS Float32)) as avg_duration
  FROM clickhouse_events
  WHERE toDate(timestamp) = toDate(now())
  GROUP BY date, action
  ORDER BY total_events DESC
`);

// Stream results for large queries
const stream = clickhouseClient.stream(`
  SELECT user_id, action, COUNT(*) as count
  FROM clickhouse_events
  GROUP BY user_id, action
  LIMIT 100000
`);

for await (const row of stream) {
  processRow(row);
}
```

**Performance:**
- Query execution: <500ms (with indexes)
- Result streaming: <1s for 100k rows
- Connection pool: 5 connections by default
- Query cache: 1 hour TTL

### 3. `metrics-aggregator.ts`

Daily/hourly aggregation from raw events:

**Features:**
- Idempotent aggregation (can rerun safely)
- Deduplication handling
- Timezone-aware date grouping
- Custom metric calculations
- Error recovery and retry

**Use when:**
- Computing daily metrics for dashboard
- Calculating KPIs and business metrics
- Pre-aggregating data for performance
- Running scheduled background jobs

**Key Pattern:**
```typescript
import { metricsAggregator } from "@/lib/analytics/metricsAggregator";

// Run daily aggregation for specific date
const result = await metricsAggregator.aggregate({
  date: "2024-12-05",
  metrics: [
    "video_uploads",
    "transcription_completions",
    "chat_messages",
    "credit_usage"
  ]
});

// Auto-run daily at 2:00 AM
metricsAggregator.scheduleDaily({
  hour: 2,
  minute: 0,
  timezone: "UTC"
});
```

**Performance:**
- Daily aggregation: <5 seconds
- Handles 1M+ events efficiently
- Deduplication: <2 seconds for 10k duplicates
- Recoverable on failure

### 4. `dashboard-queries.ts`

Pre-built dashboard queries with caching:

**Features:**
- Multiple timeframe options (7d, 30d, 90d)
- Auto-caching with TTL
- Filter by plan/user segment
- Real-time updates for key metrics
- Pagination for large result sets

**Use when:**
- Building admin analytics dashboard
- Showing usage metrics to users
- Generating reports
- Monitoring system health

**Key Queries:**
```typescript
import { dashboardQueries } from "@/lib/analytics/dashboardQueries";

// Get page view trend (7 days)
const viewTrend = await dashboardQueries.getPageViewTrend({
  days: 7,
  granularity: "day"  // or "hour", "week"
});

// Get error breakdown by status code
const errorStats = await dashboardQueries.getErrorStats({
  days: 7,
  top_n: 10  // top 10 error codes
});

// Get user acquisition/retention
const userStats = await dashboardQueries.getUserStats({
  cohort_start: "2024-11-01",
  cohort_end: "2024-12-01"
});

// Get revenue metrics
const revenue = await dashboardQueries.getRevenueMetrics({
  days: 30,
  by_plan: true  // breakdown by plan tier
});
```

**Performance:**
- Dashboard load: <300ms (cached)
- Cache refresh: hourly for 7-day views
- Real-time: <500ms for key metrics
- Pagination: <100ms per page

### 5. `alert-evaluator.ts`

Anomaly detection and alerting:

**Features:**
- Configurable alert rules
- Baseline comparison (7-day rolling average)
- Statistical significance testing
- Alert suppression (prevent alert fatigue)
- Notification routing

**Use when:**
- Monitoring for unusual patterns
- Alerting on metrics threshold breaches
- Detecting anomalies in user behavior
- Implementing on-call notifications

**Key Pattern:**
```typescript
import { alertEvaluator } from "@/lib/analytics/alertEvaluator";

// Create alert rule
await alertEvaluator.createAlert({
  name: "Video uploads drop",
  metric: "video_uploads_daily",
  condition: "drop",
  threshold_percent: 50,      // Alert if uploads drop >50%
  comparison: "7day_baseline", // Compare to 7-day average
  enabled: true
});

// Evaluate all alerts (runs daily at 2:30 AM)
const triggered = await alertEvaluator.evaluateAll();
// Returns: [{ alert_id, current_value, baseline_value, change_percent }]

// Send notifications
await alertEvaluator.sendNotifications(triggered, {
  channels: ["email", "slack"],
  recipients: ["team@ireadyoutube.com"]
});
```

**Performance:**
- Alert evaluation: <2 seconds for 100 alerts
- Baseline calculation: <1 second
- Notification sending: <5 seconds
- Daily check: <10 seconds total

### 6. `cohort-analyzer.ts`

User cohort analysis for retention tracking:

**Features:**
- Cohort creation by signup date/week/month
- Retention calculation (day 1, 7, 30, 90)
- Churn rate tracking
- Segment comparisons
- Export to CSV/JSON

**Use when:**
- Analyzing user retention curves
- Measuring cohort quality
- Comparing signup sources
- Understanding churn patterns

**Key Pattern:**
```typescript
import { cohortAnalyzer } from "@/lib/analytics/cohortAnalyzer";

// Create cohort for users signed up in Dec 2024
const cohort = await cohortAnalyzer.createCohort({
  name: "Dec 2024 Signups",
  condition: { signup_date: { gte: "2024-12-01", lt: "2025-01-01" } }
});

// Get retention metrics
const retention = await cohortAnalyzer.getRetention(cohort._id, {
  metric: "active_users",
  days: [1, 7, 30, 90]
});

// Result:
// {
//   cohort_size: 500,
//   day_1: { users: 450, retention: 90% },
//   day_7: { users: 380, retention: 76% },
//   day_30: { users: 250, retention: 50% },
//   day_90: { users: 100, retention: 20% }
// }

// Compare cohorts
const comparison = await cohortAnalyzer.compareCohorts({
  cohorts: ["Nov 2024", "Dec 2024", "Jan 2025"],
  metric: "day_30_retention"
});
```

**Performance:**
- Cohort creation: <2 seconds
- Retention calculation: <5 seconds for 10k users
- Comparison: <10 seconds for 3 cohorts

### 7. `funnel-analyzer.ts`

Conversion funnel analysis:

**Features:**
- Multi-step funnel tracking
- Conversion rate at each step
- Drop-off analysis
- Segment-based funnels
- Time-window configuration

**Use when:**
- Analyzing signup/upgrade conversion
- Measuring feature adoption
- Identifying bottlenecks in user journey
- A/B testing funnel changes

**Key Pattern:**
```typescript
import { funnelAnalyzer } from "@/lib/analytics/funnelAnalyzer";

// Define video processing funnel
const funnel = await funnelAnalyzer.createFunnel({
  name: "Video Processing Funnel",
  steps: [
    { step: 1, event: "video_upload_start", name: "Upload Started" },
    { step: 2, event: "video_upload_complete", name: "Upload Complete" },
    { step: 3, event: "transcription_start", name: "Transcription Started" },
    { step: 4, event: "transcription_complete", name: "Transcription Done" },
    { step: 5, event: "transcript_view", name: "Viewed Transcript" }
  ],
  timeout_hours: 24  // Abandon if not completed in 24 hours
});

// Analyze conversion
const analysis = await funnelAnalyzer.analyze(funnel._id, {
  date_range: { start: "2024-12-01", end: "2024-12-31" }
});

// Result:
// {
//   total_entrants: 1000,
//   step_1: { users: 1000, conversion: 100% },
//   step_2: { users: 950, conversion: 95%, dropoff: 5% },
//   step_3: { users: 900, conversion: 90%, dropoff: 5% },
//   step_4: { users: 850, conversion: 85%, dropoff: 5% },
//   step_5: { users: 800, conversion: 80%, dropoff: 5% }
// }

// Analyze by segment
const byPlan = await funnelAnalyzer.analyzeBySegment(funnel._id, {
  segment_by: "plan_id",
  date_range: { start: "2024-12-01", end: "2024-12-31" }
});
```

**Performance:**
- Funnel creation: <1 second
- Conversion analysis: <5 seconds for 100k events
- Segment analysis: <10 seconds for 5 segments

## Integration Checklist

Before using in production:

- [ ] ClickHouse service running and accessible
- [ ] Event table schema created with indexes
- [ ] Event emitter tested with sample events
- [ ] Aggregation jobs scheduled (daily, hourly)
- [ ] Dashboard queries tested with real data
- [ ] Alert rules configured and tested
- [ ] Cohort analysis validated against expected numbers
- [ ] Funnel analysis tested with sample conversions
- [ ] Real-time subscription working (for streaming updates)
- [ ] Metrics exported and reviewed for correctness
- [ ] Performance benchmarked and within targets
- [ ] Error handling tested (ClickHouse down, network issues)
- [ ] Monitoring setup for analytics service
- [ ] Data retention policy defined (30/90/365 days)
- [ ] Backup strategy implemented

## Quick Start

### 1. Initialize Analytics

```typescript
import { eventEmitter } from "@/lib/analytics/eventEmitter";
import { clickhouseClient } from "@/lib/analytics/clickhouseClient";
import { metricsAggregator } from "@/lib/analytics/metricsAggregator";

// Initialize clients
await eventEmitter.init();
await clickhouseClient.connect();
await metricsAggregator.init();
```

### 2. Emit Events

```typescript
// In your Convex functions, emit events on important actions
export const uploadVideo = mutation({
  handler: async (ctx, args) => {
    // ... upload logic ...

    // Emit event
    await eventEmitter.emit({
      type: "video_upload",
      userId: args.userId,
      videoId: video._id,
      source: args.source,
      durationSeconds: duration,
      fileSizeMB: fileSize
    });

    return video;
  }
});
```

### 3. Setup Aggregation

```bash
# Schedule daily aggregation at 2:00 AM UTC
npx convex deploy

# Verify in Convex dashboard that cron job is running
```

### 4. Query Metrics

```typescript
// In your React components
const metrics = useQuery(api.analytics.getDashboardMetrics, {
  timeframe: "7d"
});

// Or in your backend
const result = await dashboardQueries.getPageViewTrend({ days: 7 });
```

## Common Customizations

### Change Event Schema

```typescript
// In event-emitter.ts
export interface CustomEvent {
  type: string;
  userId: string;
  timestamp: number;
  // Add custom fields
  sessionId?: string;
  deviceType?: "web" | "mobile" | "desktop";
  customMetric?: number;
}
```

### Adjust Aggregation Schedule

```typescript
// Run hourly instead of daily
metricsAggregator.scheduleHourly({
  minute: 5  // Run at :05 of each hour
});

// Run multiple times daily
metricsAggregator.schedule([
  { hour: 2, minute: 0 },   // 2:00 AM
  { hour: 14, minute: 0 }   // 2:00 PM
]);
```

### Add Custom Metrics

```typescript
// Extend dashboard queries
export const getCustomMetric = async (metric_name: string) => {
  return clickhouseClient.query(`
    SELECT
      toDate(timestamp) as date,
      SUM(CAST(metadata['${metric_name}'] AS Float32)) as total
    FROM clickhouse_events
    GROUP BY date
  `);
};
```

### Change Alert Sensitivity

```typescript
// Lower threshold for high-impact events
await alertEvaluator.createAlert({
  name: "Critical Error Rate",
  metric: "error_count",
  threshold_percent: 20,    // Alert on 20% increase
  comparison: "1hour_baseline"  // Use 1-hour baseline (more sensitive)
});

// Higher threshold for less critical events
await alertEvaluator.createAlert({
  name: "Slight Traffic Dip",
  metric: "page_views",
  threshold_percent: 50,    // Alert on 50% decrease
  comparison: "30day_baseline"  // Use 30-day baseline (less sensitive)
});
```

## Performance Notes

**Expected analytics times:**
- Event emission: <10ms
- Daily aggregation: <5 seconds
- Dashboard load: <300ms (cached)
- Real-time metrics: <500ms
- Alert evaluation: <2 seconds
- Cohort analysis: <5 seconds
- Funnel analysis: <5 seconds

**Performance optimization tips:**
- Use aggregated tables for dashboard (never query raw events)
- Implement caching (1 hour for 7d views, 1 day for 30d)
- Batch event emission (flush every 50 events or 1 second)
- Use sampling for large data exploration
- Index on user_id and timestamp at minimum
- Monitor ClickHouse memory usage

## Troubleshooting

**See troubleshooting.md for:**
- Events not appearing in ClickHouse
- Metrics not aggregating correctly
- Dashboard queries timing out
- Alerts never triggering
- Real-time updates lagging
- Out of memory errors

## Related Documentation

- `SKILL.md` - Quick reference guide
- `guide.md` - Complete implementation guide
- `patterns.md` - Advanced patterns and optimizations
- `troubleshooting.md` - Common issues and solutions

## Support & Resources

- **ClickHouse Docs**: https://clickhouse.com/docs
- **Analytics Best Practices**: https://mixpanel.com/blog/analytics-101/
- **Funnel Analysis Guide**: https://www.reforge.com/learn/analytics-for-non-analysts
- **Cohort Analysis**: https://en.wikipedia.org/wiki/Cohort_analysis
