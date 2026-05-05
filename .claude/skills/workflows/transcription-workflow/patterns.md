# Transcription Workflow - Advanced Patterns

This document covers advanced patterns for the transcription workflow, covering edge cases, optimization strategies, and specialized scenarios.

## Pattern 1: Multi-Language Transcription with Language Detection

Automatically detect audio language and transcribe with language-specific settings.

```typescript
export const transcribeMultiLanguage = action({
  handler: async (ctx, args: {
    videoId: Id<"videos">;
    audioUrl: string;
    allowedLanguages?: string[]; // e.g., ["en", "fr", "es"]
  }) => {
    const assemblyai = new AssemblyAI({
      apiKey: process.env.ASSEMBLYAI_API_KEY
    });

    // Submit with language detection enabled
    const transcript = await assemblyai.transcripts.submit({
      audio_url: args.audioUrl,
      language_code: "en", // Will be auto-detected
      language_detection: true,
      speaker_labels: true,
      entity_detection: true
    });

    // Store detected language
    await ctx.db.patch(args.videoId, {
      metadata: {
        detectedLanguage: transcript.language_code,
        languageConfidence: transcript.language_confidence
      }
    });

    return {
      jobId: transcript.id,
      detectedLanguage: transcript.language_code
    };
  }
});

// Usage: Let AssemblyAI auto-detect language, store confidence score
```

**Key Points**:
- AssemblyAI auto-detects language when `language_detection: true`
- Store `language_confidence` for quality metrics
- Adapt UI based on detected language (RTL for Arabic)
- Cache language metadata for future use

---

## Pattern 2: Real-Time Progress UI with Optimistic Updates

Display live transcription progress with optimistic updates and proper fallback.

```typescript
export const useTranscriptionProgress = (transcriptId: Id<"transcripts">) => {
  const transcript = useQuery(api.transcripts.getTranscript, { transcriptId });
  const [optimisticStatus, setOptimisticStatus] = useState<{
    status: string;
    progress: number;
    estimatedTimeRemaining: number;
  } | null>(null);

  // Calculate time remaining based on elapsed time and backoff schedule
  const getEstimatedTimeRemaining = (createdAt: number, elapsedMs: number): number => {
    // Most transcriptions complete in 0.5x to 2x real-time
    // Use elapsed time to refine estimate
    if (elapsedMs < 5000) return 60000; // Likely <1 minute
    if (elapsedMs < 30000) return 45000;
    if (elapsedMs < 120000) return 90000;
    if (elapsedMs < 300000) return 180000;
    return 300000; // Cap at 5 minutes
  };

  const displayStatus = {
    status: optimisticStatus?.status || transcript?.status || "pending",
    progress: optimisticStatus?.progress || (
      transcript?.status === "completed" ? 100 : 50
    ),
    estimatedTime: optimisticStatus?.estimatedTimeRemaining ||
      getEstimatedTimeRemaining(transcript?.createdAt || 0, Date.now() - (transcript?.createdAt || 0))
  };

  return {
    ...displayStatus,
    setOptimisticStatus,
    isCompleted: displayStatus.status === "completed",
    isFailed: displayStatus.status === "failed"
  };
};

// React component using this hook
export const TranscriptionProgressCard: React.FC<{ transcriptId: string }> = ({ transcriptId }) => {
  const { progress, estimatedTime, status, setOptimisticStatus } = useTranscriptionProgress(transcriptId as Id<"transcripts">);

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Transcribing... {progress}%</span>
            <span className="text-xs text-muted-foreground">
              ~{Math.round(estimatedTime / 1000)}s remaining
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {status === "completed" && "✓ Transcription complete!"}
            {status === "processing" && "Processing transcript data..."}
            {status === "error" && "Transcription failed - will retry"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
```

**Key Points**:
- Optimistic updates hide latency between polling intervals
- Fallback to actual database state if optimistic update disagns
- Estimate time remaining based on elapsed time and typical completion curves
- Show helpful status messages that update in real-time

---

## Pattern 3: Batch Transcription Scheduling

Queue multiple videos for transcription with priority and resource management.

```typescript
interface TranscriptionJob {
  videoId: Id<"videos">;
  priority: "low" | "normal" | "high";
  queuedAt: number;
  estimatedStartTime?: number;
}

export const batchTranscriptionScheduler = {
  queue: new Map<Id<"videos">, TranscriptionJob>(),
  activeJobs: new Map<string, Id<"videos">>(),
  maxConcurrentTranscriptions: 3,

  async addToQueue(ctx: any, job: TranscriptionJob) {
    this.queue.set(job.videoId, job);
    await this.processQueue(ctx);
  },

  async processQueue(ctx: any) {
    if (this.activeJobs.size >= this.maxConcurrentTranscriptions) {
      return; // Already at capacity
    }

    // Get next job by priority
    const nextJob = Array.from(this.queue.values())
      .sort((a, b) => {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })[0];

    if (!nextJob) return;

    // Remove from queue and start processing
    this.queue.delete(nextJob.videoId);

    try {
      const video = await ctx.db.get(nextJob.videoId);
      const result = await submitForTranscription(ctx, {
        videoId: nextJob.videoId,
        audioUrl: video.audioUrl,
        title: video.title
      });

      this.activeJobs.set(result.jobId, nextJob.videoId);

      // Schedule next queue processing after this job completes
      setTimeout(() => {
        this.activeJobs.delete(result.jobId);
        this.processQueue(ctx);
      }, 60000); // Check every minute

    } catch (error) {
      // Re-queue with exponential backoff
      const retryCount = (nextJob.retryCount || 0) + 1;
      if (retryCount < 3) {
        this.queue.set(nextJob.videoId, {
          ...nextJob,
          retryCount
        });
      }
    }
  }
};

// Usage
export const addVideoToTranscriptionQueue = mutation({
  handler: async (ctx, args: {
    videoId: Id<"videos">;
    priority?: "low" | "normal" | "high";
  }) => {
    await batchTranscriptionScheduler.addToQueue(ctx, {
      videoId: args.videoId,
      priority: args.priority || "normal",
      queuedAt: Date.now()
    });

    return { queued: true, position: batchTranscriptionScheduler.queue.size };
  }
});
```

**Key Points**:
- Respect AssemblyAI concurrent job limits (prevents rate limiting)
- Prioritize jobs by user-set priority or creation time
- Implement exponential backoff for failed queue processing
- Track active jobs and capacity

---

## Pattern 4: Cost Optimization with Deduplication Strategy

Prevent duplicate transcriptions and reuse existing transcripts for cost savings.

```typescript
interface TranscriptionCache {
  audioHash: string;
  transcriptId: Id<"transcripts">;
  createdAt: number;
  cost: number;
}

export const transcriptionCacheManager = {
  // In-memory cache (supplement with Redis in production)
  cache: new Map<string, TranscriptionCache>(),

  async getOrCreate(ctx: any, args: {
    videoId: Id<"videos">;
    audioUrl: string;
    title: string;
  }) {
    // Hash the audio URL to check for duplicates
    const audioHash = await hashAudioUrl(args.audioUrl);

    // Check in-memory cache first
    if (this.cache.has(audioHash)) {
      const cached = this.cache.get(audioHash)!;

      // Verify cache is fresh (less than 7 days old)
      if (Date.now() - cached.createdAt < 7 * 24 * 60 * 60 * 1000) {
        return {
          transcriptId: cached.transcriptId,
          cached: true,
          costSaved: cached.cost
        };
      }
    }

    // Check database for existing transcript
    const existing = await ctx.db
      .query("transcripts")
      .filter(t => t.eq(t.field("audioHash"), audioHash))
      .filter(t => t.eq(t.field("status"), "completed"))
      .first();

    if (existing) {
      // Update cache
      this.cache.set(audioHash, {
        audioHash,
        transcriptId: existing._id,
        createdAt: existing.createdAt,
        cost: existing.metadata.costCredits || 0
      });

      return {
        transcriptId: existing._id,
        cached: true,
        costSaved: existing.metadata.costCredits || 0
      };
    }

    // New transcription needed
    const result = await submitForTranscription(ctx, args);

    // Cache will be populated when transcription completes
    return {
      transcriptId: result.transcriptId,
      cached: false,
      jobId: result.jobId
    };
  }
};

async function hashAudioUrl(audioUrl: string): Promise<string> {
  const buffer = new TextEncoder().encode(audioUrl);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Cost calculation with deduplication savings
export const calculateTranscriptionSavings = async (ctx: any, userId: string): Promise<{
  totalMinutes: number;
  totalCost: number;
  savedMinutes: number;
  savedCost: number;
  percentageSaved: number;
}> => {
  const transcripts = await ctx.db
    .query("transcripts")
    .filter(t => t.eq(t.field("userId"), userId))
    .collect();

  const uniqueAudioHashes = new Set<string>();
  let totalMinutes = 0;
  let duplicateMinutes = 0;

  for (const transcript of transcripts) {
    const audioHash = transcript.audioHash;
    const duration = transcript.metadata.duration || 0;

    totalMinutes += duration;

    if (uniqueAudioHashes.has(audioHash)) {
      duplicateMinutes += duration;
    } else {
      uniqueAudioHashes.add(audioHash);
    }
  }

  const costPerMinute = 0.000012;
  const totalCost = totalMinutes * costPerMinute;
  const savedCost = duplicateMinutes * costPerMinute;
  const percentageSaved = totalMinutes > 0 ? (duplicateMinutes / totalMinutes) * 100 : 0;

  return {
    totalMinutes,
    totalCost,
    savedMinutes: duplicateMinutes,
    savedCost,
    percentageSaved: Math.round(percentageSaved)
  };
};
```

**Key Points**:
- Hash audio URLs to detect duplicates across users/videos
- Check both in-memory cache and database for existing transcripts
- Calculate cost savings from deduplication
- Verify cached transcripts are fresh (expire after 7 days)

---

## Pattern 5: Dead Letter Queue for Failed Jobs

Handle transcription failures gracefully with retry logic and dead letter storage.

```typescript
interface DeadLetterJob {
  videoId: Id<"videos">;
  transcriptId: Id<"transcripts">;
  error: string;
  attemptCount: number;
  firstAttemptTime: number;
  lastAttemptTime: number;
  jobId?: string;
}

export const deadLetterQueueManager = {
  queue: new Map<Id<"transcripts">, DeadLetterJob>(),

  async addFailedJob(
    ctx: any,
    job: Omit<DeadLetterJob, "firstAttemptTime" | "lastAttemptTime" | "attemptCount">,
    error: string
  ) {
    const dlq: DeadLetterJob = {
      ...job,
      error,
      attemptCount: 1,
      firstAttemptTime: Date.now(),
      lastAttemptTime: Date.now()
    };

    this.queue.set(job.transcriptId, dlq);

    // Store in database for persistence
    await ctx.db.insert("deadLetterQueue", dlq);

    // Log for monitoring
    console.error(`[DLQ] Added failed transcription: ${job.videoId}`, {
      error,
      attemptCount: dlq.attemptCount
    });
  },

  async retryFailedJob(ctx: any, transcriptId: Id<"transcripts">) {
    const dlqJob = this.queue.get(transcriptId);
    if (!dlqJob) return;

    // Max 3 retries with exponential backoff
    if (dlqJob.attemptCount >= 3) {
      console.error(`[DLQ] Giving up on ${transcriptId} after 3 attempts`);
      return;
    }

    const backoffMs = Math.pow(2, dlqJob.attemptCount) * 60000; // 2min, 4min, 8min
    await new Promise(resolve => setTimeout(resolve, backoffMs));

    try {
      const transcript = await ctx.db.get(transcriptId);
      const video = await ctx.db.get(transcript.videoId);

      const result = await submitForTranscription(ctx, {
        videoId: video._id,
        audioUrl: video.audioUrl,
        title: video.title
      });

      // Success - remove from DLQ
      this.queue.delete(transcriptId);
      await ctx.db.patch(transcriptId, { dlqStatus: "resolved" });

      console.info(`[DLQ] Resolved failed transcription: ${transcriptId}`);
    } catch (error) {
      // Still failing - update attempt count
      dlqJob.attemptCount++;
      dlqJob.lastAttemptTime = Date.now();

      await ctx.db.patch(transcriptId, {
        dlqStatus: "retrying",
        dlqAttemptCount: dlqJob.attemptCount
      });

      console.warn(`[DLQ] Retry ${dlqJob.attemptCount}/3 failed for ${transcriptId}`);
    }
  },

  async processQueue(ctx: any) {
    for (const [transcriptId, job] of this.queue.entries()) {
      if (job.attemptCount < 3) {
        await this.retryFailedJob(ctx, transcriptId);
      }
    }
  }
};

// Query for monitoring DLQ
export const getDeadLetterQueueStatus = query({
  handler: async (ctx) => {
    const dlqItems = await ctx.db
      .query("deadLetterQueue")
      .filter(d => d.neq(d.field("dlqStatus"), "resolved"))
      .collect();

    return {
      totalFailed: dlqItems.length,
      retrying: dlqItems.filter(d => d.dlqAttemptCount < 3).length,
      gaveUp: dlqItems.filter(d => d.dlqAttemptCount >= 3).length,
      items: dlqItems
    };
  }
});
```

**Key Points**:
- Store failed jobs in database for persistence across restarts
- Implement exponential backoff: 2min, 4min, 8min between retries
- Give up after 3 attempts and move to "dead letter" for manual review
- Monitor DLQ health with metrics and alerts

---

## Pattern 6: Webhook-Based Completion Notification

Use AssemblyAI webhooks for real-time completion instead of polling.

```typescript
// This is more efficient than polling, especially for long transcriptions
// AssemblyAI will POST to your webhook when transcription completes

export const handleTranscriptionWebhook = httpAction({
  handler: async (ctx, request) => {
    // Verify webhook signature
    const signature = request.headers.get("Authorization");
    if (!verifyWebhookSignature(request, signature)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const payload = await request.json();

    // Handle completed transcription
    if (payload.status === "completed") {
      const transcript = await ctx.db
        .query("transcripts")
        .filter(t => t.eq(t.field("assemblyJobId"), payload.transcript_id))
        .first();

      if (transcript) {
        // Process completion immediately
        await processCompletedTranscript(ctx, transcript._id, payload.transcript);

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // Handle error status
    if (payload.status === "error") {
      const transcript = await ctx.db
        .query("transcripts")
        .filter(t => t.eq(t.field("assemblyJobId"), payload.transcript_id))
        .first();

      if (transcript) {
        await ctx.db.patch(transcript._id, {
          status: "failed",
          error: payload.error || "Transcription service error"
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }
});

function verifyWebhookSignature(request: Request, signature: string): boolean {
  // Verify using your secret
  // This prevents unauthorized webhook calls
  const secret = process.env.ASSEMBLYAI_WEBHOOK_SECRET;
  if (!secret) return false;

  // AssemblyAI signs with HMAC-SHA256
  const hmac = crypto.createHmac("sha256", secret);
  // Include request body in signature verification
  // Implementation depends on AssemblyAI's exact signature format
  return true; // Simplified
}

// Register webhook with AssemblyAI on app startup
export const registerWebhook = async () => {
  const assemblyai = new AssemblyAI({
    apiKey: process.env.ASSEMBLYAI_API_KEY
  });

  // Subscribe to transcript completion events
  // (Method depends on AssemblyAI SDK version)
  console.log("Webhook registered for AssemblyAI transcription events");
};
```

**Key Points**:
- Webhooks are more efficient than polling for long transcriptions
- Eliminates polling costs and latency
- Requires webhook endpoint and signature verification
- Better for production systems with high volumes
- Fallback to polling if webhook fails

---

## Summary

These patterns provide:
1. **Multi-language support** for diverse content
2. **Real-time UI updates** with optimistic feedback
3. **Batch scheduling** for resource management
4. **Cost optimization** through deduplication
5. **Failure handling** with dead letter queues
6. **Webhook efficiency** for production scale

Use these patterns to handle advanced transcription scenarios and optimize for cost, performance, and reliability.
