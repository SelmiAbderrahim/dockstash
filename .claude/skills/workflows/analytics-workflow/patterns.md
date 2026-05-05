# Analytics Workflow - Advanced Patterns

## Pattern 1: Funnel Analysis for Conversion Optimization

Track user progression through conversion funnel and identify drop-off points:

```typescript
export const analyzeFunnel = query({
  handler: async (ctx, args: {
    timeframe: "7d" | "30d" | "90d";
    funnel: "signup_to_pro" | "upload_to_transcription" | "transcription_to_chat";
  }) => {
    const startDate = getStartDate(args.timeframe);

    // Define funnel steps
    const FUNNELS = {
      signup_to_pro: [
        { step: 1, name: "Signup", event: "user_signup" },
        { step: 2, name: "Upload Video", event: "video_upload" },
        { step: 3, name: "Upgrade to Pro", event: "plan_upgrade", plan: "pro" }
      ],
      upload_to_transcription: [
        { step: 1, name: "Upload", event: "video_upload" },
        { step: 2, name: "Transcription Start", event: "transcription_start" },
        { step: 3, name: "Transcription Complete", event: "transcription_complete" }
      ],
      transcription_to_chat: [
        { step: 1, name: "Transcription Complete", event: "transcription_complete" },
        { step: 2, name: "Open Chat", event: "chat_opened" },
        { step: 3, name: "Send Message", event: "chat_message" }
      ]
    };

    const funnel = FUNNELS[args.funnel];
    const steps = [];

    for (const step of funnel) {
      // Count users completing this step
      const users = await queryClickHouse(`
        SELECT
          COUNT(DISTINCT user_id) as users
        FROM clickhouse_events
        WHERE type = '${step.event}'
          AND timestamp >= '${startDate.toISOString()}'
          ${step.plan ? `AND new_plan = '${step.plan}'` : ""}
      `);

      steps.push({
        step: step.step,
        name: step.name,
        users: users[0]?.users || 0,
        conversionRate: steps.length > 0
          ? Math.round((users[0]?.users || 0) / steps[0].users * 100)
          : 100,
        dropoff: steps.length > 0
          ? steps[steps.length - 1].users - (users[0]?.users || 0)
          : 0
      });
    }

    // Calculate metrics
    const totalUsers = steps[0]?.users || 0;
    const completedUsers = steps[steps.length - 1]?.users || 0;
    const overallConversion = totalUsers > 0
      ? Math.round((completedUsers / totalUsers) * 100)
      : 0;

    return {
      funnel: args.funnel,
      timeframe: args.timeframe,
      steps,
      overallConversion,
      recommendations: generateFunnelRecommendations(steps)
    };
  }
});

function generateFunnelRecommendations(steps: any[]): string[] {
  const recommendations = [];

  // Find biggest drop-off
  const maxDropoff = Math.max(...steps.map(s => s.dropoff));
  const maxDropoffStep = steps.find(s => s.dropoff === maxDropoff);

  if (maxDropoff > 0) {
    recommendations.push(
      `⚠️ Biggest drop-off at step "${maxDropoffStep.name}" (${maxDropoff} users)`
    );
  }

  // Alert if conversion below 20%
  if (steps[steps.length - 1]?.conversionRate < 20) {
    recommendations.push(
      "🔴 Overall conversion is below 20% - investigate friction in funnel"
    );
  }

  return recommendations;
}
```

---

## Pattern 2: Cohort Analysis for Retention Tracking

Analyze user cohorts by signup date to understand retention and lifecycle:

```typescript
export const analyzeCohorts = query({
  handler: async (ctx, args: {
    groupBy: "week" | "month";
    metric: "retention" | "revenue" | "engagement";
  }) => {
    // Get user cohorts (grouped by signup week/month)
    const cohorts = await queryClickHouse(`
      SELECT
        toStartOf${args.groupBy === "month" ? "Month" : "Week"}(signup_date) as cohort_date,
        COUNT(DISTINCT user_id) as cohort_size,
        SUM(CASE WHEN action = 'churn' THEN 1 ELSE 0 END) as churn_count,
        SUM(revenue) as revenue,
        AVG(events_count) as avg_engagement
      FROM clickhouse_users
      GROUP BY cohort_date
      ORDER BY cohort_date DESC
    `);

    // For each cohort, calculate retention over time
    const cohortRetention = [];

    for (const cohort of cohorts) {
      const cohortSize = cohort.cohort_size;
      const retention = [];

      // Check retention at 1 week, 1 month, 3 months, 6 months
      const periods = [
        { days: 7, label: "1w" },
        { days: 30, label: "1m" },
        { days: 90, label: "3m" },
        { days: 180, label: "6m" }
      ];

      for (const period of periods) {
        const retainedUsers = await queryClickHouse(`
          SELECT COUNT(DISTINCT user_id) as retained
          FROM clickhouse_events
          WHERE cohort_date = '${cohort.cohort_date.toISOString()}'
            AND timestamp >= '${new Date(cohort.cohort_date.getTime() + period.days * 24 * 60 * 60 * 1000).toISOString()}'
        `);

        retention.push({
          period: period.label,
          retained: retainedUsers[0]?.retained || 0,
          retentionRate: cohortSize > 0
            ? Math.round(((retainedUsers[0]?.retained || 0) / cohortSize) * 100)
            : 0
        });
      }

      cohortRetention.push({
        cohort: cohort.cohort_date,
        size: cohortSize,
        retention,
        churnRate: cohortSize > 0
          ? Math.round((cohort.churn_count / cohortSize) * 100)
          : 0,
        revenue: cohort.revenue,
        avgEngagement: Math.round(cohort.avg_engagement)
      });
    }

    return {
      groupBy: args.groupBy,
      metric: args.metric,
      cohorts: cohortRetention,
      trends: identifyCohortTrends(cohortRetention)
    };
  }
});

function identifyCohortTrends(cohorts: any[]): string[] {
  const trends = [];

  // Check if newer cohorts have better retention
  if (cohorts.length >= 2) {
    const newestRetention = cohorts[0].retention[0]?.retentionRate || 0;
    const oldestRetention = cohorts[cohorts.length - 1]?.retention[0]?.retentionRate || 0;

    if (newestRetention > oldestRetention + 10) {
      trends.push("📈 Retention improving in newer cohorts");
    } else if (newestRetention < oldestRetention - 10) {
      trends.push("📉 Retention declining - investigate recent changes");
    }
  }

  // Check for declining revenue per cohort
  const avgRevenue = cohorts.reduce((sum, c) => sum + c.revenue, 0) / cohorts.length;
  const recentAvgRevenue = cohorts.slice(0, 3).reduce((sum, c) => sum + c.revenue, 0) / Math.min(3, cohorts.length);

  if (recentAvgRevenue < avgRevenue * 0.8) {
    trends.push("💰 Revenue per cohort declining - check monetization");
  }

  return trends;
}
```

---

## Pattern 3: Real-Time Alerting on Key Metrics

Monitor key metrics and trigger alerts when thresholds are exceeded:

```typescript
export const setupMetricAlert = mutation({
  handler: async (ctx, args: {
    metric: "daily_revenue" | "active_users" | "error_rate" | "transcription_failures";
    operator: ">" | "<" | "==";
    threshold: number;
    window: "1h" | "24h" | "7d";
    action: "email" | "slack" | "both";
  }) => {
    // Store alert configuration
    const alert = await ctx.db.insert("metricAlerts", {
      metric: args.metric,
      operator: args.operator,
      threshold: args.threshold,
      window: args.window,
      action: args.action,
      createdAt: Date.now(),
      active: true
    });

    return { alertId: alert._id };
  }
});

export const checkMetricAlerts = action({
  handler: async (ctx) => {
    // Get all active alerts
    const alerts = await ctx.db.query("metricAlerts")
      .filter(a => a.eq(a.field("active"), true))
      .collect();

    const triggeredAlerts = [];

    for (const alert of alerts) {
      // Get current metric value
      const value = await getMetricValue(alert.metric, alert.window);

      // Check if threshold breached
      let breached = false;
      switch (alert.operator) {
        case ">":
          breached = value > alert.threshold;
          break;
        case "<":
          breached = value < alert.threshold;
          break;
        case "==":
          breached = value === alert.threshold;
          break;
      }

      if (breached) {
        triggeredAlerts.push({
          alert,
          value,
          message: `${alert.metric} is ${alert.operator} ${alert.threshold} (actual: ${value})`
        });

        // Send notification
        if (alert.action === "email" || alert.action === "both") {
          await sendEmail({
            to: "team@ireadyoutube.com",
            subject: `⚠️ Alert: ${alert.metric}`,
            template: "metric_alert",
            context: { metric: alert.metric, value, threshold: alert.threshold }
          });
        }

        if (alert.action === "slack" || alert.action === "both") {
          await sendSlackAlert({
            channel: "#alerts",
            message: `🚨 ${triggeredAlerts[0]?.message}`
          });
        }

        // Log alert trigger
        await ctx.db.insert("alertLogs", {
          alertId: alert._id,
          value,
          triggeredAt: Date.now()
        });
      }
    }

    return { triggeredAlerts: triggeredAlerts.length };
  }
});

async function getMetricValue(metric: string, window: string): Promise<number> {
  const startDate = new Date();
  switch (window) {
    case "1h":
      startDate.setHours(startDate.getHours() - 1);
      break;
    case "24h":
      startDate.setDate(startDate.getDate() - 1);
      break;
    case "7d":
      startDate.setDate(startDate.getDate() - 7);
      break;
  }

  const result = await queryClickHouse(`
    SELECT
      ${
        metric === "daily_revenue"
          ? "SUM(amount_usd)"
          : metric === "active_users"
            ? "COUNT(DISTINCT user_id)"
            : metric === "error_rate"
              ? "SUM(CASE WHEN type = 'error' THEN 1 ELSE 0 END) / COUNT(*) * 100"
              : "SUM(CASE WHEN type = 'transcription_start' AND error_code IS NOT NULL THEN 1 ELSE 0 END)"
      } as value
    FROM clickhouse_events
    WHERE timestamp >= '${startDate.toISOString()}'
  `);

  return result[0]?.value || 0;
}
```

---

## Pattern 4: Segmentation and A/B Testing Analytics

Track and analyze metrics across user segments and A/B test variants:

```typescript
export const getSegmentMetrics = query({
  handler: async (ctx, args: {
    segmentBy: "plan" | "signup_source" | "country" | "cohort";
    metric: "revenue" | "retention" | "engagement" | "churn";
    timeframe: "7d" | "30d" | "90d";
  }) => {
    const startDate = getStartDate(args.timeframe);

    // Get metric by segment
    const segments = await queryClickHouse(`
      SELECT
        ${getSegmentField(args.segmentBy)} as segment,
        COUNT(*) as event_count,
        COUNT(DISTINCT user_id) as user_count,
        ${getMetricField(args.metric)} as value
      FROM clickhouse_events
      WHERE timestamp >= '${startDate.toISOString()}'
      GROUP BY segment
      ORDER BY value DESC
    `);

    // Calculate segment comparisons
    const totalValue = segments.reduce((sum, s) => sum + s.value, 0);
    const avgValue = totalValue / segments.length;

    const segmentData = segments.map(segment => ({
      segment: segment.segment,
      value: segment.value,
      percentage: Math.round((segment.value / totalValue) * 100),
      performance: segment.value > avgValue
        ? `+${Math.round(((segment.value / avgValue) - 1) * 100)}%`
        : `-${Math.round((1 - (segment.value / avgValue)) * 100)}%`,
      userCount: segment.user_count
    }));

    return {
      segmentBy: args.segmentBy,
      metric: args.metric,
      timeframe: args.timeframe,
      segments: segmentData,
      topPerformer: segmentData[0],
      bottomPerformer: segmentData[segmentData.length - 1],
      variance: calculateVariance(segmentData.map(s => s.value))
    };
  }
});

export const trackABTestVariant = mutation({
  handler: async (ctx, args: {
    testId: string;
    userId: Id<"users">;
    variant: "control" | "test_a" | "test_b";
    metric: string;
    value: number;
  }) => {
    // Track A/B test event
    await ctx.db.insert("abTestEvents", {
      testId: args.testId,
      userId: args.userId,
      variant: args.variant,
      metric: args.metric,
      value: args.value,
      timestamp: Date.now()
    });

    return { tracked: true };
  }
});

export const analyzeABTestResults = query({
  handler: async (ctx, args: { testId: string; confidence?: number }) => {
    const confidence = args.confidence || 0.95;

    // Get results by variant
    const variants = ["control", "test_a", "test_b"];
    const results = [];

    for (const variant of variants) {
      const events = await ctx.db.query("abTestEvents")
        .filter(e => e.eq(e.field("testId"), args.testId))
        .filter(e => e.eq(e.field("variant"), variant))
        .collect();

      const values = events.map(e => e.value);
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const stdDev = calculateStdDev(values, mean);

      results.push({
        variant,
        count: values.length,
        mean,
        stdDev,
        min: Math.min(...values),
        max: Math.max(...values)
      });
    }

    // Calculate statistical significance
    const controlResult = results.find(r => r.variant === "control");
    const testResults = results.filter(r => r.variant !== "control");

    const significance = testResults.map(test => ({
      variant: test.variant,
      improvement: Math.round(((test.mean / controlResult.mean) - 1) * 100),
      pValue: calculatePValue(controlResult, test),
      significant: calculatePValue(controlResult, test) < (1 - confidence)
    }));

    return {
      testId: args.testId,
      confidence,
      results,
      significance,
      recommendation: generateABTestRecommendation(significance)
    };
  }
});

function generateABTestRecommendation(significance: any[]): string {
  const winners = significance.filter(s => s.significant && s.improvement > 0);

  if (winners.length === 0) {
    return "No statistically significant winners. Continue test.";
  } else if (winners.length === 1) {
    return `✅ ${winners[0].variant} wins with ${winners[0].improvement}% improvement`;
  } else {
    return `📊 Multiple winners detected. Investigate or combine variants.`;
  }
}

function calculateVariance(values: number[]): number {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function calculateStdDev(values: number[], mean: number): number {
  return Math.sqrt(
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  );
}

function calculatePValue(control: any, test: any): number {
  // Simplified t-test calculation
  const pooledStdDev = Math.sqrt(
    (Math.pow(control.stdDev, 2) + Math.pow(test.stdDev, 2)) / 2
  );
  const tScore = (test.mean - control.mean) / (pooledStdDev * Math.sqrt(2 / test.count));
  // Simplified p-value (in real implementation use t-distribution)
  return 1 / (1 + Math.abs(tScore));
}
```

---

## Pattern 5: Custom Event Properties and Enrichment

Extend events with custom properties and enrich with additional context:

```typescript
export const trackEnrichedEvent = mutation({
  handler: async (ctx, args: {
    userId: Id<"users">;
    eventType: string;
    properties: Record<string, any>;
    enrichment?: {
      plan?: string;
      country?: string;
      device?: string;
      campaign?: string;
    };
  }) => {
    // Get user context for enrichment
    const user = await ctx.db.get(args.userId);
    const subscription = await getSubscription(ctx, args.userId);

    const enrichedEvent = {
      type: args.eventType,
      user_id: args.userId,
      timestamp: Date.now(),
      ...args.properties,
      // Enriched fields
      plan_id: args.enrichment?.plan || subscription?.planId || "free",
      country: args.enrichment?.country || user.country,
      device: args.enrichment?.device || "unknown",
      campaign: args.enrichment?.campaign,
      user_lifecycle_stage: calculateLifecycleStage(user),
      cohort_date: user.createdAt,
      ltv_segment: calculateLTVSegment(user, subscription)
    };

    // Store enriched event
    await ctx.db.insert("events", enrichedEvent);

    return { eventId: enrichedEvent._id };
  }
});

function calculateLifecycleStage(user: any): string {
  const daysSinceSignup = (Date.now() - user.createdAt) / (24 * 60 * 60 * 1000);

  if (daysSinceSignup < 7) return "new";
  if (daysSinceSignup < 30) return "active";
  if (daysSinceSignup < 90) return "established";
  return "long_term";
}

function calculateLTVSegment(user: any, subscription: any): string {
  const revenue = subscription?.totalRevenue || 0;

  if (revenue > 500) return "high_value";
  if (revenue > 100) return "medium_value";
  if (revenue > 0) return "paying";
  return "free";
}
```

---

## Pattern 6: Real-Time Dashboard Updates with Streaming

Stream metrics to dashboard for real-time updates without polling:

```typescript
export const streamDashboardMetrics = action({
  handler: async (ctx, args: { clientId: string }) => {
    // Establish streaming connection
    const stream = ctx.streaming.create({
      channel: `dashboard-${args.clientId}`,
      maxConnections: 1
    });

    // Emit metrics every 30 seconds
    const interval = setInterval(async () => {
      const metrics = await queryClickHouse(`
        SELECT
          COUNT(*) as events,
          COUNT(DISTINCT user_id) as users,
          SUM(credits_cost) as credits,
          SUM(amount_usd) as revenue
        FROM clickhouse_events
        WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
      `);

      stream.emit("metrics", {
        timestamp: Date.now(),
        events: metrics[0]?.events || 0,
        users: metrics[0]?.users || 0,
        credits: metrics[0]?.credits || 0,
        revenue: metrics[0]?.revenue || 0
      });
    }, 30 * 1000);

    stream.onClose(() => clearInterval(interval));

    return { streaming: true };
  }
});
```

---

## Summary of Patterns

| Pattern | Use Case | Complexity |
|---------|----------|-----------|
| **Funnel Analysis** | Conversion optimization | High |
| **Cohort Analysis** | Retention tracking | High |
| **Real-Time Alerts** | KPI monitoring | Medium |
| **Segmentation** | A/B testing and insights | Medium |
| **Event Enrichment** | Context-aware analytics | Medium |
| **Streaming Updates** | Real-time dashboards | High |
