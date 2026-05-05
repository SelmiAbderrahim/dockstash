# Analytics Workflow Troubleshooting

## Common Issues and Solutions

### Issue 1: Events Not Appearing in ClickHouse

**Symptoms**: Events emitted but not visible in ClickHouse queries. Dashboard shows no data.

**Root Causes**:
1. ClickHouse service not running or network unreachable
2. Incorrect database/table name in query
3. Event schema mismatch (missing required fields)
4. Events not being batched/flushed
5. Authentication/permission issues

**Diagnosis**:

```bash
# Check ClickHouse connectivity
docker exec ireadyoutube-clickhouse curl -s http://localhost:8123/ping
# Expected: Ok.\n

# Check if table exists
docker exec ireadyoutube-clickhouse clickhouse-client --query "SHOW TABLES FROM default"

# Check for recent errors in logs
docker logs ireadyoutube-clickhouse | grep -i error | tail -20

# Query event count
docker exec ireadyoutube-clickhouse clickhouse-client --query "SELECT COUNT(*) FROM default.clickhouse_events"
```

**Solutions**:

1. **Verify ClickHouse is running**:
```bash
# Restart ClickHouse
docker compose -f docker/docker-compose.yml restart clickhouse

# Wait for startup (30 seconds)
sleep 30

# Verify connectivity
curl http://localhost:8123/ping
```

2. **Check schema and indexes**:
```typescript
// Create or verify table schema
export const ensureClickHouseTable = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS clickhouse_events (
      user_id String,
      action String,
      timestamp DateTime,
      metadata String,
      INDEX idx_user (user_id) TYPE set(0),
      INDEX idx_action (action) TYPE set(0),
      INDEX idx_timestamp (timestamp) TYPE minmax
    ) ENGINE = MergeTree()
    ORDER BY (user_id, timestamp)
    SETTINGS index_granularity = 8192
  `;

  const response = await fetch("http://clickhouse:8123/", {
    method: "POST",
    body: createTableQuery
  });

  if (!response.ok) {
    throw new Error(`Failed to create table: ${response.statusText}`);
  }
};
```

3. **Validate event schema before insertion**:
```typescript
// Always validate events match schema
export const validateEvent = (event: any) => {
  const requiredFields = ['user_id', 'action', 'timestamp'];
  const missing = requiredFields.filter(field => !event[field]);

  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }

  // Validate types
  if (typeof event.user_id !== 'string') {
    throw new Error('user_id must be string');
  }
  if (typeof event.timestamp !== 'number') {
    throw new Error('timestamp must be number');
  }

  return event;
};
```

4. **Ensure batching/flushing**:
```typescript
// Batch events before sending to ClickHouse
const eventBatch: any[] = [];
const BATCH_SIZE = 100;
const BATCH_TIMEOUT_MS = 5000;

export const insertEventBatch = async (event: any) => {
  eventBatch.push(validateEvent(event));

  if (eventBatch.length >= BATCH_SIZE) {
    await flushEvents();
  }
};

const flushEvents = async () => {
  if (eventBatch.length === 0) return;

  const events = eventBatch.splice(0, eventBatch.length);

  const response = await fetch("http://clickhouse:8123/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "INSERT INTO clickhouse_events FORMAT JSONEachRow",
      data: events.map(e => JSON.stringify(e)).join('\n')
    })
  });

  if (!response.ok) {
    console.error(`ClickHouse insert failed: ${response.statusText}`);
    // Put events back in queue for retry
    eventBatch.unshift(...events);
    throw new Error('Failed to insert events');
  }
};

// Auto-flush on interval
setInterval(flushEvents, BATCH_TIMEOUT_MS);
```

### Issue 2: Metrics Not Aggregating Correctly

**Symptoms**: Aggregation job completes but calculated metrics don't match raw event counts. Dashboard shows incorrect totals.

**Root Causes**:
1. Aggregation query has bugs (wrong GROUP BY, incorrect SUM/COUNT)
2. Duplicate events not deduplicated
3. Timezone mismatches in date grouping
4. Old aggregations not being replaced (upsert not working)
5. Time window boundaries incorrect

**Diagnosis**:

```bash
# Compare raw event count to aggregation
docker exec ireadyoutube-clickhouse clickhouse-client --query "
  SELECT COUNT(*) as raw_count FROM clickhouse_events WHERE toDate(timestamp) = '2024-12-05'
"

docker exec ireadyoutube-clickhouse clickhouse-client --query "
  SELECT SUM(event_count) as aggregated_count FROM clickhouse_daily_metrics WHERE date = '2024-12-05'
"

# Check for duplicate events
docker exec ireadyoutube-clickhouse clickhouse-client --query "
  SELECT user_id, action, timestamp, COUNT(*) as count
  FROM clickhouse_events
  GROUP BY user_id, action, timestamp
  HAVING count > 1
  LIMIT 10
"

# Check aggregation logic
docker exec ireadyoutube-clickhouse clickhouse-client --query "
  SELECT toDate(timestamp) as date, COUNT(*) as total, COUNT(DISTINCT user_id) as unique_users
  FROM clickhouse_events
  GROUP BY date
  ORDER BY date DESC
"
```

**Solutions**:

1. **Fix aggregation query with deduplication**:
```typescript
export const aggregateDailyMetrics = async (date: string) => {
  // Use distinct to handle duplicates, correct GROUP BY
  const aggregationQuery = `
    INSERT INTO clickhouse_daily_metrics
    SELECT
      toDate(timestamp) as date,
      action,
      COUNT(*) as event_count,
      COUNT(DISTINCT user_id) as unique_users,
      AVG(cast(metadata['duration'] as Float32)) as avg_duration,
      SUM(cast(metadata['credits'] as Int32)) as total_credits,
      MAX(timestamp) as last_timestamp
    FROM clickhouse_events
    WHERE toDate(timestamp) = '${date}'
    GROUP BY date, action
  `;

  await fetch("http://clickhouse:8123/", {
    method: "POST",
    body: aggregationQuery
  });
};
```

2. **Deduplicate events on insert**:
```typescript
// Hash events to detect duplicates
import crypto from 'crypto';

const getEventHash = (event: any) => {
  const key = `${event.user_id}:${event.action}:${event.timestamp}:${JSON.stringify(event.metadata)}`;
  return crypto.createHash('sha256').update(key).digest('hex');
};

const processedHashes = new Set<string>();

export const insertEventWithDeduplication = async (event: any) => {
  const hash = getEventHash(event);

  if (processedHashes.has(hash)) {
    console.warn('Duplicate event detected, skipping');
    return;
  }

  processedHashes.add(hash);
  await insertEventBatch(event);
};
```

3. **Use timezone-aware date grouping**:
```typescript
// Handle timezone consistently
export const aggregateWithTimezone = async (date: string, timezone: string = 'UTC') => {
  const query = `
    INSERT INTO clickhouse_daily_metrics
    SELECT
      toDate(toDateTime(timestamp, '${timezone}')) as date,
      action,
      COUNT(*) as event_count,
      COUNT(DISTINCT user_id) as unique_users
    FROM clickhouse_events
    WHERE toDate(toDateTime(timestamp, '${timezone}')) = '${date}'
    GROUP BY date, action
  `;

  await fetch("http://clickhouse:8123/", {
    method: "POST",
    body: query
  });
};
```

4. **Implement idempotent aggregation with ALTER TABLE**:
```typescript
// Always use ALTER TABLE to replace old aggregations
export const aggregateMetricsIdempotent = async (date: string) => {
  // First delete old aggregations for this date
  const deleteQuery = `ALTER TABLE clickhouse_daily_metrics DELETE WHERE date = '${date}'`;

  await fetch("http://clickhouse:8123/", {
    method: "POST",
    body: deleteQuery
  });

  // Then insert fresh aggregations
  const insertQuery = `
    INSERT INTO clickhouse_daily_metrics
    SELECT
      toDate(timestamp) as date,
      action,
      COUNT(*) as event_count,
      COUNT(DISTINCT user_id) as unique_users,
      SUM(cast(metadata['credits'] as Int32)) as total_credits
    FROM clickhouse_events
    WHERE toDate(timestamp) = '${date}'
    GROUP BY date, action
  `;

  await fetch("http://clickhouse:8123/", {
    method: "POST",
    body: insertQuery
  });
};
```

### Issue 3: Dashboard Queries Timing Out

**Symptoms**: Dashboard loads slowly or returns "Query timeout" errors. Complex visualizations hang.

**Root Causes**:
1. Missing or inefficient indexes on GROUP BY/WHERE columns
2. Query scans entire table instead of using time range
3. Too large result set (millions of rows)
4. ClickHouse resources exhausted (memory, CPU)
5. Aggregated tables not created (queries run on raw events)

**Diagnosis**:

```bash
# Check query execution time
docker exec ireadyoutube-clickhouse clickhouse-client --query "
  SELECT COUNT(*) FROM clickhouse_events EXPLAIN
"

# Check index usage
docker exec ireadyoutube-clickhouse clickhouse-client --query "
  SELECT * FROM system.tables WHERE name = 'clickhouse_events'
"

# Monitor system resources
docker exec ireadyoutube-clickhouse clickhouse-client --query "
  SELECT * FROM system.processes
"

# Check slow query log
docker logs ireadyoutube-clickhouse | grep -i "slow query" | tail -20
```

**Solutions**:

1. **Add proper indexes**:
```typescript
export const addIndexesToClickHouse = async () => {
  const indexQueries = [
    // Index on user_id for filtering
    "ALTER TABLE clickhouse_events ADD INDEX idx_user_id user_id TYPE set(0)",
    // Index on action for GROUP BY
    "ALTER TABLE clickhouse_events ADD INDEX idx_action action TYPE set(0)",
    // Index on timestamp for range queries
    "ALTER TABLE clickhouse_events ADD INDEX idx_timestamp timestamp TYPE minmax",
    // Compound index for common queries
    "ALTER TABLE clickhouse_events ADD INDEX idx_user_action (user_id, action) TYPE set(0)"
  ];

  for (const query of indexQueries) {
    try {
      await fetch("http://clickhouse:8123/", {
        method: "POST",
        body: query
      });
    } catch (e) {
      // Index may already exist
      console.log('Index creation skipped');
    }
  }
};
```

2. **Use time range in queries**:
```typescript
// Always specify date range to use partitions
export const getDashboardMetrics = async (days: number = 7) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const start = startDate.toISOString().split('T')[0];

  const query = `
    SELECT
      toDate(timestamp) as date,
      action,
      COUNT(*) as count,
      COUNT(DISTINCT user_id) as users
    FROM clickhouse_daily_metrics
    WHERE date >= '${start}'
    GROUP BY date, action
    ORDER BY date DESC
  `;

  const response = await fetch("http://clickhouse:8123/", {
    method: "POST",
    body: query,
    headers: { "Content-Type": "text/plain" }
  });

  return response.json();
};
```

3. **Limit result set size**:
```typescript
// Paginate large result sets
export const getTopMetrics = async (limit: number = 100) => {
  const query = `
    SELECT
      action,
      SUM(event_count) as total,
      SUM(unique_users) as total_users,
      AVG(avg_duration) as avg_duration
    FROM clickhouse_daily_metrics
    WHERE date >= today() - INTERVAL 7 DAY
    GROUP BY action
    ORDER BY total DESC
    LIMIT ${Math.min(limit, 1000)}
  `;

  return fetch("http://clickhouse:8123/", {
    method: "POST",
    body: query
  });
};
```

4. **Monitor resource usage**:
```bash
# Check ClickHouse memory/CPU
docker stats ireadyoutube-clickhouse

# Increase memory if needed
docker update --memory 2g ireadyoutube-clickhouse
```

### Issue 4: Alerts Never Triggering

**Symptoms**: Anomalies happen but no alerts sent. Alert configuration shows as active but never fires.

**Root Causes**:
1. Alert conditions never met (threshold too high/low)
2. Aggregation data not available when alert runs
3. Alert evaluation job crashes silently
4. Notification service (email/Slack) fails
5. Alert rule disabled or corrupted

**Diagnosis**:

```bash
# Check alert execution logs
docker logs ireadyoutube-convex | grep -i "alert" | tail -50

# Verify aggregation data exists
docker exec ireadyoutube-clickhouse clickhouse-client --query "
  SELECT date, action, SUM(event_count) as total
  FROM clickhouse_daily_metrics
  WHERE date = today()
  GROUP BY date, action
"

# Check alert configuration
docker exec ireadyoutube-clickhouse clickhouse-client --query "
  SELECT * FROM alerts_config WHERE enabled = 1
"
```

**Solutions**:

1. **Implement robust alert evaluation**:
```typescript
export const evaluateAlerts = mutation({
  handler: async (ctx, args: { date: string }) => {
    try {
      // Get current metrics
      const metrics = await ctx.analytics.query(`
        SELECT action, SUM(event_count) as total
        FROM clickhouse_daily_metrics
        WHERE date = '${args.date}'
        GROUP BY action
      `);

      // Get baseline (previous 7 days average)
      const baseline = await ctx.analytics.query(`
        SELECT action, AVG(event_count) as avg
        FROM clickhouse_daily_metrics
        WHERE date >= '${args.date}' - INTERVAL 7 DAY
        GROUP BY action
      `);

      // Check each alert
      for (const alert of await ctx.db.query('alerts_config').filter(a => a.enabled).collect()) {
        const current = metrics.find(m => m.action === alert.action_type);
        const base = baseline.find(b => b.action === alert.action_type);

        if (!current || !base) continue;

        const changePercent = ((current.total - base.avg) / base.avg) * 100;

        // Trigger if exceeds threshold
        if (Math.abs(changePercent) > alert.threshold_percent) {
          await ctx.db.insert('alerts_triggered', {
            alert_id: alert._id,
            triggered_at: Date.now(),
            current_value: current.total,
            baseline_value: base.avg,
            change_percent: changePercent,
            notified: false
          });
        }
      }

      return { checked: metrics.length, alerts_triggered: 0 };
    } catch (error) {
      logger.error('evaluateAlerts', 'Alert evaluation failed', { error, date: args.date });
      throw error;
    }
  }
});
```

2. **Verify alert thresholds are reasonable**:
```typescript
// Validate threshold before creating alert
export const validateAlertThreshold = (threshold: number, baseline: number) => {
  // Threshold should be 20-100% change
  if (threshold < 20 || threshold > 100) {
    throw new Error('Threshold must be between 20% and 100%');
  }

  // Check against recent data
  if (baseline < 10) {
    console.warn('Low baseline metric - alert may be overly sensitive');
  }
};
```

3. **Ensure aggregation runs before alerts**:
```typescript
// Schedule alert evaluation AFTER aggregation
export const scheduleAlertEvaluation = async () => {
  // Aggregation: 2:00 AM daily
  schedule('0 2 * * *', () => aggregateDailyMetrics());

  // Alert evaluation: 2:30 AM (after aggregation)
  schedule('30 2 * * *', () => evaluateAlerts());

  // Alert notification: 2:35 AM (after evaluation)
  schedule('35 2 * * *', () => sendAlertNotifications());
};
```

### Issue 5: Real-Time Metrics Dashboard Updates Lag

**Symptoms**: Dashboard shows stale data. 10+ minutes delay between event and visualization. Real-time claims but not instant.

**Root Causes**:
1. Client polling interval too long (5 minute delays)
2. ClickHouse query caching returning old results
3. Events batch timeout too long
4. Network latency between frontend/backend
5. Dashboard not using subscriptions (page refresh needed)

**Diagnosis**:

```bash
# Check event to ingestion latency
# Insert test event with timestamp, query how long it takes to appear
docker exec ireadyoutube-clickhouse clickhouse-client --query "
  SELECT COUNT(*) FROM clickhouse_events
  WHERE timestamp >= now() - INTERVAL 1 MINUTE
"

# Check client polling frequency
# Look in browser Network tab for /api/metrics requests frequency

# Check cache settings
docker exec ireadyoutube-clickhouse clickhouse-client --query "
  SELECT name, value FROM system.settings WHERE name LIKE '%cache%'
"
```

**Solutions**:

1. **Use Convex subscriptions for real-time updates**:
```typescript
// Frontend: Subscribe to real-time metrics
const metrics = useQuery(api.analytics.subscribeMetrics, {
  action: "video_upload",
  timewindow: "1hour"
});

// Auto-updates as data changes
useEffect(() => {
  if (metrics) {
    setDashboardData(metrics);
  }
}, [metrics]);
```

2. **Implement server-sent events for streaming updates**:
```typescript
// Backend: Stream metrics changes
export const streamMetrics = action({
  handler: async (ctx, args) => {
    const encoder = new TextEncoder();

    return new ReadableStream({
      async start(controller) {
        // Send initial data
        const initial = await ctx.analytics.query('SELECT * FROM metrics LIMIT 100');
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(initial)}\n\n`));

        // Subscribe to changes
        const subscription = await ctx.db.query('metrics').subscribe();

        for await (const update of subscription) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(update)}\n\n`));
        }
      }
    });
  }
});
```

3. **Reduce batching timeout for low-latency events**:
```typescript
// Lower batch timeout for real-time use cases
const BATCH_CONFIG = {
  size: 50,              // Smaller batch
  timeout_ms: 1000       // 1 second instead of 5
};

export const insertEventImmediate = async (event: any) => {
  eventBatch.push(event);

  // Flush immediately if small batch (for real-time)
  if (eventBatch.length >= 5) {
    await flushEvents();
  }
};
```

4. **Disable query result caching for dashboard**:
```typescript
// No caching for real-time dashboard
const getDashboardMetricsNoCaching = async () => {
  const query = `
    SELECT action, COUNT(*) as total
    FROM clickhouse_events
    WHERE timestamp > now() - INTERVAL 1 HOUR
    GROUP BY action
  `;

  const response = await fetch("http://clickhouse:8123/", {
    method: "POST",
    headers: {
      "X-ClickHouse-NO-COMPRESS": "1",
      "X-ClickHouse-DEFAULT-FORMAT": "JSON"
    },
    body: query
  });

  return response.json();
};
```

### Issue 6: Out of Memory Errors in ClickHouse

**Symptoms**: ClickHouse container crashes with OOM. Dashboard stops working. Events not being stored.

**Root Causes**:
1. ClickHouse memory limit too low
2. Large query materializes entire result set
3. Aggregation processes too many rows in memory
4. Memory not released after query
5. Indexes consuming too much memory

**Diagnosis**:

```bash
# Check ClickHouse memory usage
docker stats ireadyoutube-clickhouse

# Check configured memory limit
docker exec ireadyoutube-clickhouse clickhouse-client --query "
  SELECT name, value FROM system.settings WHERE name = 'max_memory_usage'
"

# Check which queries use most memory
docker exec ireadyoutube-clickhouse clickhouse-client --query "
  SELECT query, memory_usage FROM system.processes ORDER BY memory_usage DESC
"

# Check event table size
docker exec ireadyoutube-clickhouse clickhouse-client --query "
  SELECT formatReadableSize(total_bytes) FROM system.tables WHERE name = 'clickhouse_events'
"
```

**Solutions**:

1. **Increase container memory allocation**:
```bash
# Update docker-compose to allocate more memory
docker update --memory 4g --memory-swap 4g ireadyoutube-clickhouse

# Restart
docker compose -f docker/docker-compose.yml restart clickhouse

# Verify
docker stats ireadyoutube-clickhouse --no-stream
```

2. **Use sampling for large queries**:
```typescript
// Sample data for analytics queries instead of full table scan
export const getMetricsWithSampling = async (precision: number = 0.1) => {
  const query = `
    SELECT
      action,
      COUNT(*) * (1 / ${precision}) as estimated_count,
      COUNT(DISTINCT user_id) * (1 / ${precision}) as estimated_users
    FROM clickhouse_events
    SAMPLE ${precision}
    WHERE timestamp > now() - INTERVAL 7 DAY
    GROUP BY action
  `;

  return fetch("http://clickhouse:8123/", {
    method: "POST",
    body: query
  });
};
```

3. **Implement query result streaming**:
```typescript
// Stream results instead of loading all in memory
export const streamLargeQuery = async (response: Response) => {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = new TextDecoder().decode(value);
    const rows = chunk.split('\n').filter(Boolean);

    // Process rows as they arrive
    for (const row of rows) {
      yield JSON.parse(row);
    }
  }
};
```

4. **Set aggressive memory limits**:
```typescript
// Configure ClickHouse memory settings
const clickhouseConfig = {
  max_memory_usage: 2 * 1024 * 1024 * 1024,           // 2GB per query
  max_memory_usage_for_user: 4 * 1024 * 1024 * 1024,  // 4GB per user
  max_result_bytes: 100 * 1024 * 1024                 // 100MB result limit
};
```

## Prevention Checklist

Before deploying analytics to production:

- [ ] ClickHouse table schema tested with >1M events
- [ ] Indexes created and verified with EXPLAIN
- [ ] Aggregation queries tested and validated
- [ ] Alert thresholds calibrated with historical data
- [ ] Memory allocation adequate (test with max capacity)
- [ ] Event deduplication implemented
- [ ] Batch flushing configured (size + timeout)
- [ ] Real-time dashboard tested with live data
- [ ] Query timeouts configured (prevent infinite hangs)
- [ ] Monitoring/alerting on ClickHouse metrics
- [ ] Backup strategy for event data
- [ ] Disaster recovery tested

## Getting Help

**For ClickHouse Issues**:
- Official Docs: https://clickhouse.com/docs
- GitHub Issues: https://github.com/ClickHouse/ClickHouse/issues
- Performance Guide: https://clickhouse.com/docs/en/operations/performance-optimization

**For Analytics Integration**:
- See guide.md for implementation patterns
- See patterns.md for edge cases
- See examples/README.md for working code
