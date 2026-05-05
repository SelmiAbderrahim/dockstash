---
name: analytics-workflow
description: |
  Master real-time analytics implementation including ClickHouse integration, data collection, dashboard visualization, user behavior tracking, and performance reporting.

  When to use: Building analytics dashboards, tracking user metrics, implementing real-time data aggregation, analyzing usage patterns, generating performance reports, measuring business KPIs, optimizing conversion funnels.

  Keywords: Analytics, ClickHouse, dashboards, metrics, KPIs, reporting, user behavior, performance, data visualization, aggregation, real-time, events
---

# Analytics Workflow

## Quick Start (Layer 1-2)

The analytics workflow handles complete analytics pipeline from data collection to visualization, using ClickHouse for real-time aggregation.

### Three Analytics Patterns

```typescript
// 1. Real-Time Event Tracking - Capture individual events
const eventTracking = {
  events: "user_action",
  examples: [
    { user_id, action: "video_upload", video_id, duration_seconds, file_size_mb },
    { user_id, action: "transcription_start", video_id, estimated_cost },
    { user_id, action: "chat_message", video_id, message_tokens, web_search_used },
    { user_id, action: "upgrade", from_plan, to_plan, amount_usd }
  ],
  storage: "ClickHouse (clickhouse_events)",
  delay: "Real-time (push immediately)"
};

// 2. Aggregated Metrics - Pre-computed summaries
const aggregatedMetrics = {
  metrics: "daily_summaries",
  examples: [
    { date, plan_id, total_users, active_users, new_signups },
    { date, plan_id, total_credits_used, average_per_user },
    { date, action_type, event_count, total_duration }
  ],
  storage: "ClickHouse (clickhouse_daily_metrics)",
  delay: "1 hour behind (batch aggregation)"
};

// 3. Business KPIs - Key performance indicators
const businessKPIs = {
  metrics: "monthly_kpis",
  examples: [
    { month, total_revenue, mrr, churn_rate, ltv },
    { month, free_to_pro_conversion, retention_rate_30d, nps_score },
    { month, avg_session_duration, videos_per_user, chat_messages_per_user }
  ],
  storage: "ClickHouse (clickhouse_kpis)",
  delay: "Daily (computed at EOD)"
};
```

### Key Concepts

- **Event Collection**: Capture user actions (uploads, transcriptions, chats)
- **Real-Time Aggregation**: ClickHouse aggregates data instantly
- **Visualization**: Dashboard displays metrics with charts and tables
- **Performance Tracking**: Monitor system health and user experience
- **User Behavior Analysis**: Understand conversion funnels and retention
- **Usage Reporting**: Track API usage, credits, and billing metrics
- **Anomaly Detection**: Alert on unusual patterns

### Most Common Use Case

```typescript
// Analytics data flow
1. User uploads video -> emit "video_upload" event -> ClickHouse
2. Background job aggregates -> "video_upload_daily" metric
3. Admin dashboard queries ClickHouse -> shows chart
4. Alert checks for anomalies -> if uploads drop 50%, notify team
5. Monthly report generates -> revenue, churn, LTV calculations
```

## Key Files & References

- `/prompts/agents/specialized/analytics-dashboard-builder.md` - Specialized agent guide
- `guide.md` - Complete implementation patterns (Layer 3)
- `patterns.md` - Advanced patterns and edge cases (Layer 3)
- `troubleshooting.md` - Common issues and solutions (Layer 3)
- `examples/` - Real-world code examples (Layer 3)

## Core Workflow Steps

1. **Event Collection Phase**
   - Define event schema with required fields
   - Emit events from all user-facing actions
   - Batch events for efficient transmission
   - Handle offline/failed event delivery

2. **Data Ingestion Phase**
   - Receive events via API endpoint
   - Validate event schema
   - Insert into ClickHouse with timestamps
   - Handle duplicates and ordering

3. **Aggregation Phase**
   - Run periodic aggregation jobs (daily, hourly)
   - Compute metrics from raw events
   - Calculate KPIs and business metrics
   - Cache results for dashboard performance

4. **Visualization Phase**
   - Query ClickHouse for metrics
   - Display charts and tables
   - Provide drill-down capabilities
   - Update in real-time

5. **Reporting Phase**
   - Generate daily/weekly/monthly reports
   - Email reports to stakeholders
   - Archive reports for audit trail
   - Track trend analysis

6. **Anomaly Detection Phase**
   - Monitor KPIs for unusual changes
   - Trigger alerts on thresholds
   - Notify team of issues
   - Log anomalies for investigation

## Essential Patterns

### Event Emission Pattern
```typescript
export const trackEvent = mutation({
  handler: async (ctx, args: {
    userId: Id<"users">;
    actionType: string;
    metadata: Record<string, any>;
  }) => {
    // 1. Emit to ClickHouse
    await ctx.analytics.insertEvent({
      user_id: args.userId,
      action: args.actionType,
      timestamp: Date.now(),
      ...args.metadata
    });

    // 2. Return immediately (no wait)
    return { tracked: true };
  }
});
```

### Real-Time Metrics Pattern
```typescript
export const getDailyMetrics = query({
  handler: async (ctx, args: { date: string; planId?: string }) => {
    // Query ClickHouse for aggregated data
    const result = await ctx.analytics.query(`
      SELECT
        plan_id,
        COUNT(*) as total_events,
        COUNT(DISTINCT user_id) as unique_users,
        SUM(credits_used) as total_credits
      FROM clickhouse_events
      WHERE toDate(timestamp) = '${args.date}'
      ${args.planId ? `AND plan_id = '${args.planId}'` : ""}
      GROUP BY plan_id
    `);

    return result;
  }
});
```

### Dashboard Query Pattern
```typescript
export const getDashboardData = query({
  handler: async (ctx, args: { timeframe: "7d" | "30d" | "90d" }) => {
    // Fetch multiple metrics for dashboard
    const [revenue, users, churn, uploads] = await Promise.all([
      getRevenueByDay(args.timeframe),
      getNewUsersByDay(args.timeframe),
      getChurnRate(args.timeframe),
      getUploadsByDay(args.timeframe)
    ]);

    return { revenue, users, churn, uploads };
  }
});
```

## What You'll Learn

In this skill, you'll understand:
- How to design event schemas for analytics
- How to implement ClickHouse integration
- How to aggregate raw events into metrics
- How to build real-time dashboards
- How to track user behavior and conversion
- How to calculate business KPIs
- How to generate reports and alerts
- How to detect and respond to anomalies
- How to optimize analytics queries
- How to maintain data quality

## Next Steps

1. **For Implementation**: See `guide.md` for complete patterns
2. **For Advanced Patterns**: See `patterns.md` for edge cases
3. **For Troubleshooting**: See `troubleshooting.md` for common issues
4. **For Code Examples**: See `examples/` directory
5. **For Related Workflows**: See `video-upload-workflow/`, `transcription-workflow/`, or `ai-chat-workflow/`
