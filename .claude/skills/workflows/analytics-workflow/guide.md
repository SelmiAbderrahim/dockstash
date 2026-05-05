# Analytics Workflow - Complete Implementation Guide

## Architecture Overview

The analytics workflow consists of 6 main phases:

```
┌──────────────────────┐
│ Event Collection     │ (User actions emitted)
├──────────────────────┤
│ Data Ingestion       │ (Events validated and stored)
├──────────────────────┤
│ Aggregation          │ (Compute metrics from events)
├──────────────────────┤
│ Visualization        │ (Display in dashboards)
├──────────────────────┤
│ Reporting            │ (Generate reports)
├──────────────────────┤
│ Anomaly Detection    │ (Alert on unusual patterns)
└──────────────────────┘
```

---

## Phase 1: Event Collection

### Define Event Schema

```typescript
// Define all event types with TypeScript
export type AnalyticsEvent =
  | VideoUploadEvent
  | TranscriptionEvent
  | ChatEvent
  | UpgradeEvent
  | ErrorEvent;

export interface VideoUploadEvent {
  type: "video_upload";
  user_id: string;
  video_id: string;
  source: "youtube" | "file_upload";
  duration_seconds: number;
  file_size_mb: number;
  estimated_credits: number;
  timestamp: number;
}

export interface TranscriptionEvent {
  type: "transcription_start" | "transcription_complete";
  user_id: string;
  video_id: string;
  transcript_id: string;
  duration_seconds: number;
  credits_cost: number;
  language: string;
  error?: string;
  timestamp: number;
}

export interface ChatEvent {
  type: "chat_message";
  user_id: string;
  video_id: string;
  message_tokens: number;
  response_tokens: number;
  credits_cost: number;
  web_search_used: boolean;
  timestamp: number;
}

export interface UpgradeEvent {
  type: "plan_upgrade" | "plan_downgrade" | "plan_cancel";
  user_id: string;
  old_plan: string;
  new_plan: string;
  amount_usd: number;
  timestamp: number;
}

export interface ErrorEvent {
  type: "error";
  user_id: string;
  error_code: string;
  error_message: string;
  component: string;
  timestamp: number;
}
```

### Emit Events from Actions

```typescript
// In video upload mutation
export const uploadVideo = mutation({
  handler: async (ctx, args: {
    userId: Id<"users">;
    sourceUrl: string;
    source: "youtube" | "file_upload";
  }) => {
    // Video processing...
    const video = await ctx.db.insert("videos", {
      userId: args.userId,
      sourceUrl: args.sourceUrl,
      status: "processing"
    });

    // Emit analytics event
    await ctx.db.insert("events", {
      type: "video_upload",
      user_id: args.userId,
      video_id: video._id,
      source: args.source,
      duration_seconds: estimatedDuration,
      file_size_mb: fileSize,
      estimated_credits: estimatedCost,
      timestamp: Date.now()
    });

    return { videoId: video._id };
  }
});

// In transcription completion
export const completeTranscription = mutation({
  handler: async (ctx, args: {
    videoId: Id<"videos">;
    transcriptId: string;
    credits: number;
  }) => {
    // Save transcript...

    // Emit completion event
    await ctx.db.insert("events", {
      type: "transcription_complete",
      user_id: args.userId,
      video_id: args.videoId,
      transcript_id: args.transcriptId,
      duration_seconds: duration,
      credits_cost: args.credits,
      language: detectedLanguage,
      timestamp: Date.now()
    });

    return { success: true };
  }
});

// In chat message handling
export const sendChatMessage = mutation({
  handler: async (ctx, args: {
    videoId: Id<"videos">;
    message: string;
    useWebSearch: boolean;
  }) => {
    // Generate response...

    // Emit chat event
    await ctx.db.insert("events", {
      type: "chat_message",
      user_id: args.userId,
      video_id: args.videoId,
      message_tokens: countTokens(args.message),
      response_tokens: countTokens(response),
      credits_cost: tokenCost,
      web_search_used: args.useWebSearch,
      timestamp: Date.now()
    });

    return { response };
  }
});

// In plan upgrade
export const upgradePlan = mutation({
  handler: async (ctx, args: {
    userId: Id<"users">;
    newPlanId: string;
  }) => {
    const subscription = await getSubscription(ctx, args.userId);
    const oldPlan = subscription.planId;

    // Process upgrade...

    // Emit upgrade event
    await ctx.db.insert("events", {
      type: "plan_upgrade",
      user_id: args.userId,
      old_plan: oldPlan,
      new_plan: args.newPlanId,
      amount_usd: calculateUpgradePrice(oldPlan, args.newPlanId),
      timestamp: Date.now()
    });

    return { success: true };
  }
});
```

---

## Phase 2: Data Ingestion

### Ingest Events to ClickHouse

```typescript
export const sendEventsToClickHouse = action({
  handler: async (ctx) => {
    // Batch events for efficient transmission
    const batchSize = 1000;
    let offset = 0;
    let totalSent = 0;

    while (true) {
      // Get batch of unsent events
      const events = await ctx.db.query("events")
        .filter(e => e.eq(e.field("sentToAnalytics"), false))
        .order("desc")
        .take(batchSize);

      if (events.length === 0) break;

      // Insert into ClickHouse
      const payload = events.map(e => ({
        timestamp: new Date(e.timestamp).toISOString(),
        type: e.type,
        user_id: e.user_id,
        ...e // Spread all event fields
      }));

      try {
        // Send to ClickHouse HTTP API
        const response = await fetch("http://clickhouse:8123/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: "INSERT INTO clickhouse_events FORMAT JSONEachRow",
            data: payload
          })
        });

        if (response.ok) {
          // Mark events as sent
          const eventIds = events.map(e => e._id);
          for (const eventId of eventIds) {
            await ctx.db.patch(eventId, { sentToAnalytics: true });
          }
          totalSent += events.length;
        } else {
          console.error("ClickHouse insert failed:", response.statusText);
          break;
        }
      } catch (error) {
        console.error("Failed to send events to ClickHouse:", error);
        break;
      }
    }

    return { eventsSent: totalSent, timestamp: Date.now() };
  }
});
```

### Validate Event Schema

```typescript
export const validateEvent = (event: unknown): event is AnalyticsEvent => {
  if (!event || typeof event !== "object") return false;

  const e = event as Record<string, any>;

  // Check required fields
  if (!e.type || !e.user_id || !e.timestamp) return false;

  // Validate by type
  switch (e.type) {
    case "video_upload":
      return (
        typeof e.source === "string" &&
        typeof e.duration_seconds === "number" &&
        typeof e.file_size_mb === "number"
      );

    case "transcription_complete":
      return (
        typeof e.duration_seconds === "number" &&
        typeof e.credits_cost === "number"
      );

    case "chat_message":
      return (
        typeof e.message_tokens === "number" &&
        typeof e.response_tokens === "number"
      );

    case "plan_upgrade":
      return (
        typeof e.old_plan === "string" &&
        typeof e.new_plan === "string"
      );

    default:
      return false;
  }
};
```

---

## Phase 3: Aggregation

### Compute Daily Metrics

```typescript
export const computeDailyMetrics = action({
  handler: async (ctx, args: { date: string }) => {
    // Query ClickHouse for daily aggregates
    const metrics = await queryClickHouse(`
      SELECT
        toDate(timestamp) as date,
        type as event_type,
        COUNT(*) as event_count,
        COUNT(DISTINCT user_id) as unique_users,
        AVG(credits_cost) as avg_cost,
        SUM(credits_cost) as total_credits,
        AVG(duration_seconds) as avg_duration
      FROM clickhouse_events
      WHERE toDate(timestamp) = '${args.date}'
      GROUP BY date, type
    `);

    // Store metrics in Convex for dashboard access
    for (const row of metrics) {
      await ctx.db.insert("dailyMetrics", {
        date: args.date,
        eventType: row.event_type,
        eventCount: row.event_count,
        uniqueUsers: row.unique_users,
        avgCost: row.avg_cost,
        totalCredits: row.total_credits,
        avgDuration: row.avg_duration,
        timestamp: Date.now()
      });
    }

    return { metricsComputed: metrics.length };
  }
});
```

### Compute KPIs

```typescript
export const computeMonthlyKPIs = action({
  handler: async (ctx, args: { year: number; month: number }) => {
    const monthStart = new Date(args.year, args.month - 1, 1).toISOString().split("T")[0];
    const monthEnd = new Date(args.year, args.month, 0).toISOString().split("T")[0];

    // Revenue calculation
    const revenue = await queryClickHouse(`
      SELECT
        SUM(amount_usd) as total_revenue
      FROM clickhouse_events
      WHERE type IN ('plan_upgrade', 'plan_downgrade')
        AND toDate(timestamp) BETWEEN '${monthStart}' AND '${monthEnd}'
    `);

    // User metrics
    const users = await queryClickHouse(`
      SELECT
        COUNT(DISTINCT user_id) as total_users,
        SUM(CASE WHEN type = 'video_upload' THEN 1 ELSE 0 END) as active_users,
        SUM(CASE WHEN type = 'plan_upgrade' THEN 1 ELSE 0 END) as conversions
      FROM clickhouse_events
      WHERE toDate(timestamp) BETWEEN '${monthStart}' AND '${monthEnd}'
    `);

    // Store KPIs
    await ctx.db.insert("monthlyKPIs", {
      year: args.year,
      month: args.month,
      totalRevenue: revenue[0]?.total_revenue || 0,
      totalUsers: users[0]?.total_users || 0,
      activeUsers: users[0]?.active_users || 0,
      conversions: users[0]?.conversions || 0,
      mrr: calculateMRR(revenue[0]?.total_revenue || 0),
      churnRate: calculateChurnRate(args.year, args.month),
      timestamp: Date.now()
    });

    return { kpisComputed: true };
  }
});
```

---

## Phase 4: Visualization

### Get Metrics for Dashboard

```typescript
export const getDashboardMetrics = query({
  handler: async (ctx, args: { timeframe: "7d" | "30d" | "90d" }) => {
    const daysBack = timeframeToDate(args.timeframe);

    // Get events from ClickHouse
    const events = await queryClickHouse(`
      SELECT
        toDate(timestamp) as date,
        type as event_type,
        COUNT(*) as count,
        COUNT(DISTINCT user_id) as unique_users
      FROM clickhouse_events
      WHERE timestamp >= '${daysBack.toISOString()}'
      GROUP BY date, type
      ORDER BY date DESC
    `);

    // Get aggregated metrics
    const aggregated = events.reduce((acc, row) => {
      const date = row.date;
      if (!acc[date]) {
        acc[date] = { date, byType: {}, total: 0 };
      }
      acc[date].byType[row.event_type] = row.count;
      acc[date].total += row.count;
      return acc;
    }, {});

    // Calculate trends
    const sortedDates = Object.keys(aggregated).sort();
    const trends = {
      uploads: calculateTrend(aggregated, sortedDates, "video_upload"),
      transcriptions: calculateTrend(aggregated, sortedDates, "transcription_complete"),
      chats: calculateTrend(aggregated, sortedDates, "chat_message"),
      total: calculateTrend(aggregated, sortedDates, null)
    };

    return {
      timeframe: args.timeframe,
      events: Object.values(aggregated),
      trends,
      summary: {
        totalEvents: sortedDates.reduce((sum, d) => sum + aggregated[d].total, 0),
        avgEventsPerDay: Math.round(sortedDates.reduce((sum, d) => sum + aggregated[d].total, 0) / sortedDates.length),
        topEventType: findMostCommonEventType(aggregated)
      }
    };
  }
});

function timeframeToDate(timeframe: string): Date {
  const now = new Date();
  switch (timeframe) {
    case "7d":
      now.setDate(now.getDate() - 7);
      break;
    case "30d":
      now.setDate(now.getDate() - 30);
      break;
    case "90d":
      now.setDate(now.getDate() - 90);
      break;
  }
  return now;
}

function calculateTrend(data: any, dates: string[], eventType: string | null): number {
  if (dates.length < 2) return 0;

  const recent = eventType
    ? (data[dates[0]].byType[eventType] || 0)
    : data[dates[0]].total;

  const previous = eventType
    ? (data[dates[1]].byType[eventType] || 0)
    : data[dates[1]].total;

  if (previous === 0) return 0;
  return Math.round(((recent - previous) / previous) * 100);
}
```

### Build Dashboard Charts

```typescript
export const getChartData = query({
  handler: async (ctx, args: { metric: "revenue" | "users" | "uploads" | "credits"; timeframe: "7d" | "30d" }) => {
    const startDate = getStartDate(args.timeframe);

    const data = await queryClickHouse(`
      SELECT
        toDate(timestamp) as date,
        ${getMetricQuery(args.metric)}
      FROM clickhouse_events
      WHERE timestamp >= '${startDate.toISOString()}'
      GROUP BY date
      ORDER BY date ASC
    `);

    return {
      metric: args.metric,
      timeframe: args.timeframe,
      data: data.map(row => ({
        date: row.date,
        value: row.value,
        display: formatValue(row.value, args.metric)
      })),
      summary: {
        total: data.reduce((sum, row) => sum + row.value, 0),
        average: Math.round(data.reduce((sum, row) => sum + row.value, 0) / data.length),
        max: Math.max(...data.map(r => r.value)),
        min: Math.min(...data.map(r => r.value))
      }
    };
  }
});

function getMetricQuery(metric: string): string {
  switch (metric) {
    case "revenue":
      return "SUM(amount_usd) as value";
    case "users":
      return "COUNT(DISTINCT user_id) as value";
    case "uploads":
      return "SUM(CASE WHEN type = 'video_upload' THEN 1 ELSE 0 END) as value";
    case "credits":
      return "SUM(credits_cost) as value";
    default:
      return "COUNT(*) as value";
  }
}
```

---

## Phase 5: Reporting

### Generate Daily Report

```typescript
export const generateDailyReport = action({
  handler: async (ctx, args: { date: string }) => {
    // Fetch metrics for the day
    const metrics = await ctx.db.query("dailyMetrics")
      .filter(m => m.eq(m.field("date"), args.date))
      .collect();

    // Aggregate by event type
    const byEventType = metrics.reduce((acc, m) => {
      acc[m.eventType] = {
        count: m.eventCount,
        users: m.uniqueUsers,
        credits: m.totalCredits
      };
      return acc;
    }, {});

    // Get errors
    const errors = await queryClickHouse(`
      SELECT
        error_code,
        COUNT(*) as count
      FROM clickhouse_events
      WHERE type = 'error'
        AND toDate(timestamp) = '${args.date}'
      GROUP BY error_code
      ORDER BY count DESC
      LIMIT 10
    `);

    // Create report
    const report = {
      date: args.date,
      summary: {
        totalEvents: metrics.reduce((sum, m) => sum + m.eventCount, 0),
        uniqueUsers: metrics.reduce((sum, m) => sum + m.uniqueUsers, 0),
        totalCreditsUsed: metrics.reduce((sum, m) => sum + m.totalCredits, 0)
      },
      byEventType,
      topErrors: errors,
      generatedAt: Date.now()
    };

    // Save report
    await ctx.db.insert("reports", {
      type: "daily",
      date: args.date,
      data: JSON.stringify(report),
      timestamp: Date.now()
    });

    // Send email
    await sendEmail({
      to: "team@ireadyoutube.com",
      subject: `Daily Analytics Report - ${args.date}`,
      template: "daily_report",
      context: report
    });

    return { reportGenerated: true };
  }
});
```

### Generate Monthly Report

```typescript
export const generateMonthlyReport = action({
  handler: async (ctx, args: { year: number; month: number }) => {
    // Get monthly KPIs
    const kpis = await ctx.db.query("monthlyKPIs")
      .filter(k => k.eq(k.field("year"), args.year))
      .filter(k => k.eq(k.field("month"), args.month))
      .first();

    if (!kpis) return { error: "KPIs not computed yet" };

    // Get cohort analysis
    const cohorts = await queryClickHouse(`
      SELECT
        toYearMonth(timestamp) as month,
        plan_id,
        COUNT(DISTINCT user_id) as users,
        SUM(amount_usd) as revenue
      FROM clickhouse_events
      WHERE type = 'plan_upgrade'
      GROUP BY month, plan_id
    `);

    // Create report
    const report = {
      year: args.year,
      month: args.month,
      kpis: {
        revenue: kpis.totalRevenue,
        mrr: kpis.mrr,
        users: kpis.totalUsers,
        conversions: kpis.conversions,
        churnRate: kpis.churnRate
      },
      cohorts,
      recommendations: generateRecommendations(kpis),
      generatedAt: Date.now()
    };

    // Save and send
    await ctx.db.insert("reports", {
      type: "monthly",
      date: `${args.year}-${String(args.month).padStart(2, "0")}`,
      data: JSON.stringify(report),
      timestamp: Date.now()
    });

    return { reportGenerated: true };
  }
});
```

---

## Phase 6: Anomaly Detection

### Monitor KPIs for Anomalies

```typescript
export const detectAnomalies = action({
  handler: async (ctx) => {
    // Get recent metrics (last 7 days)
    const metrics = await ctx.db.query("dailyMetrics")
      .filter(m => m.gte(m.field("timestamp"), Date.now() - 7 * 24 * 60 * 60 * 1000))
      .order("desc")
      .collect();

    const anomalies: string[] = [];

    // Check video uploads
    const uploadCounts = metrics
      .filter(m => m.eventType === "video_upload")
      .map(m => m.eventCount);

    if (isDropped(uploadCounts, 0.5)) {
      anomalies.push("⚠️ Video uploads dropped 50% compared to average");
    }

    // Check chat messages
    const chatCounts = metrics
      .filter(m => m.eventType === "chat_message")
      .map(m => m.eventCount);

    if (isSpiked(chatCounts, 2.0)) {
      anomalies.push("📈 Chat message usage spiked 2x normal");
    }

    // Check error rate
    const errors = await queryClickHouse(`
      SELECT
        COUNT(*) as error_count
      FROM clickhouse_events
      WHERE type = 'error'
        AND timestamp >= ${Date.now() - 24 * 60 * 60 * 1000}
    `);

    const errorCount = errors[0]?.error_count || 0;
    if (errorCount > 100) {
      anomalies.push(`🔴 ${errorCount} errors in last 24 hours`);
    }

    // Alert if anomalies found
    if (anomalies.length > 0) {
      await sendSlackAlert({
        channel: "#alerts",
        message: `📊 Analytics Anomalies Detected:\n${anomalies.join("\n")}`
      });
    }

    return { anomalies, timestamp: Date.now() };
  }
});

function isDropped(values: number[], threshold: number): boolean {
  if (values.length < 2) return false;
  const recent = values[0];
  const historical = values.slice(1);
  const average = historical.reduce((sum, v) => sum + v, 0) / historical.length;
  return recent < average * (1 - threshold);
}

function isSpiked(values: number[], multiplier: number): boolean {
  if (values.length < 2) return false;
  const recent = values[0];
  const historical = values.slice(1);
  const average = historical.reduce((sum, v) => sum + v, 0) / historical.length;
  return recent > average * multiplier;
}
```

---

## ClickHouse Schema

```sql
-- Events table (raw events)
CREATE TABLE IF NOT EXISTS clickhouse_events
(
    timestamp DateTime,
    type String,
    user_id String,
    video_id Nullable(String),
    source Nullable(String),
    duration_seconds Nullable(Float32),
    file_size_mb Nullable(Float32),
    credits_cost Nullable(Float32),
    language Nullable(String),
    web_search_used Nullable(UInt8),
    error_code Nullable(String),
    error_message Nullable(String)
)
ENGINE = MergeTree()
ORDER BY (timestamp, type, user_id)
PARTITION BY toYYYYMM(timestamp);

-- Daily metrics table (pre-computed)
CREATE TABLE IF NOT EXISTS clickhouse_daily_metrics
(
    date Date,
    type String,
    event_count UInt64,
    unique_users UInt64,
    avg_cost Float32,
    total_credits Float32
)
ENGINE = MergeTree()
ORDER BY (date, type);

-- Monthly KPIs table
CREATE TABLE IF NOT EXISTS clickhouse_kpis
(
    year UInt16,
    month UInt8,
    total_revenue Float32,
    mrr Float32,
    churn_rate Float32,
    ltv Float32
)
ENGINE = MergeTree()
ORDER BY (year, month);
```
