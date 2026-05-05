# Transcription Workflow - Troubleshooting Guide

Common issues and solutions for AssemblyAI transcription integration.

## Issue 1: Audio File Not Found / Invalid URL Error

**Symptom**: "audio_url is invalid or inaccessible" error from AssemblyAI

**Root Causes**:
1. URL is not publicly accessible (requires authentication)
2. URL has expired (file was deleted or presigned URL expired)
3. URL is malformed or contains invalid characters
4. Server returning 403/404 for the URL

**Debugging Steps**:

```typescript
// 1. Test URL accessibility before submission
async function validateAudioUrl(audioUrl: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch(audioUrl, { method: "HEAD" });

    if (!response.ok) {
      return {
        valid: false,
        error: `URL returned ${response.status}: ${response.statusText}`
      };
    }

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("audio") && !contentType?.includes("video")) {
      return {
        valid: false,
        error: `Wrong content type: ${contentType}`
      };
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 500 * 1024 * 1024) {
      return {
        valid: false,
        error: "File too large (>500MB)"
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to access URL: ${String(error)}`
    };
  }
}

// 2. Check if URL requires authentication
function getAudioUrl(videoId: string, storageUrl: string): string {
  // For uploaded files: ensure presigned URL is still valid
  if (storageUrl.includes("?")) {
    const url = new URL(storageUrl);
    const expiresAt = url.searchParams.get("expires");

    if (expiresAt && new Date(expiresAt) < new Date()) {
      throw new Error("Presigned URL has expired");
    }
  }

  return storageUrl;
}

// 3. Log the actual URL being submitted (for debugging)
console.log("[TRANSCRIPTION] Submitting URL for transcription:", {
  videoId,
  urlLength: audioUrl.length,
  urlDomain: new URL(audioUrl).hostname,
  // Don't log full URL in production (may contain secrets)
});
```

**Solutions**:

```typescript
// ✅ Solution 1: Use presigned URLs that don't expire during transcription
export const submitForTranscription = action({
  handler: async (ctx, args: {
    videoId: Id<"videos">;
    audioUrl: string;
  }) => {
    // Validate URL before submission
    const validation = await validateAudioUrl(args.audioUrl);
    if (!validation.valid) {
      throw new ConvexError({
        code: "INVALID_AUDIO_URL",
        message: validation.error || "Audio URL is not accessible"
      });
    }

    // Rest of submission...
  }
});

// ✅ Solution 2: If using file upload, generate long-lived presigned URLs
async function generatePresignedUrl(
  fileKey: string,
  expirationSeconds: number = 86400 * 7 // 7 days
): Promise<string> {
  // Use your storage provider's API
  // Example: AWS S3
  const url = await s3.getSignedUrl("getObject", {
    Bucket: "your-bucket",
    Key: fileKey,
    Expires: expirationSeconds
  });

  return url;
}

// ✅ Solution 3: Download and re-host if URL is unstable
async function getStableAudioUrl(
  ctx: any,
  originalUrl: string,
  videoId: Id<"videos">
): Promise<string> {
  // If URL looks unstable, download and cache
  if (originalUrl.includes("youtube.com")) {
    // For YouTube: AssemblyAI can access directly
    return originalUrl;
  }

  // For other URLs: verify accessibility
  const response = await fetch(originalUrl);
  if (!response.ok) {
    throw new Error(`Cannot access audio URL: ${response.status}`);
  }

  return originalUrl;
}
```

---

## Issue 2: Polling Timeout - Transcription Takes >30 Minutes

**Symptom**: "Transcription timeout (30 minutes exceeded)" error

**Root Causes**:
1. Audio file is very long (>8 hours)
2. Audio quality is poor (noisy background, heavy accents)
3. Multiple speakers with complex speech patterns
4. Polling timed out before completion

**Debugging Steps**:

```typescript
// 1. Check actual transcription duration
async function getTranscriptionDuration(jobId: string): Promise<number> {
  const assemblyai = new AssemblyAI({
    apiKey: process.env.ASSEMBLYAI_API_KEY
  });

  const transcript = await assemblyai.transcripts.get(jobId);

  console.log("[TRANSCRIPTION] Job status check:", {
    jobId,
    status: transcript.status,
    duration: transcript.duration, // Duration of audio in seconds
    processingTime: transcript.created ? Date.now() - new Date(transcript.created).getTime() : null
  });

  return transcript.duration || 0;
}

// 2. Estimate processing time based on audio duration
function estimateProcessingTime(audioLengthSeconds: number): {
  minSeconds: number;
  maxSeconds: number;
  typical: number;
} {
  // AssemblyAI typically processes at 0.5-2x real-time
  // Longer files tend to process closer to real-time
  const speedMultiplier = audioLengthSeconds > 3600 ? 1 : 0.3; // 30% for normal, 100% for long

  return {
    minSeconds: audioLengthSeconds * 0.3, // 30% of audio length
    maxSeconds: audioLengthSeconds * 1.5, // 150% of audio length
    typical: audioLengthSeconds * speedMultiplier
  };
}

// 3. Monitor polling progress
async function monitorPollingProgress(
  jobId: string,
  startTime: number = Date.now(),
  maxWaitMs: number = 30 * 60 * 1000
) {
  const assemblyai = new AssemblyAI({
    apiKey: process.env.ASSEMBLYAI_API_KEY
  });

  while (true) {
    const elapsed = Date.now() - startTime;

    if (elapsed > maxWaitMs) {
      console.warn("[TRANSCRIPTION] Timeout after 30 minutes", { jobId, elapsedSeconds: elapsed / 1000 });
      return { status: "timeout" };
    }

    const transcript = await assemblyai.transcripts.get(jobId);

    console.log("[TRANSCRIPTION] Polling progress:", {
      jobId,
      status: transcript.status,
      elapsedSeconds: Math.round(elapsed / 1000),
      estimatedRemaining: transcript.duration ?
        Math.round((transcript.duration * 0.5 - elapsed / 1000)) : null
    });

    if (transcript.status === "completed") {
      return { status: "completed", transcript };
    }

    if (transcript.status === "error") {
      return { status: "error", error: transcript.error };
    }

    // Wait before next poll (exponential backoff)
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}
```

**Solutions**:

```typescript
// ✅ Solution 1: Extend timeout for long audio files
export const submitForTranscription = action({
  handler: async (ctx, args: {
    videoId: Id<"videos">;
    audioUrl: string;
    estimatedDurationSeconds?: number;
  }) => {
    // Determine timeout based on audio length
    let maxTimeoutMs = 30 * 60 * 1000; // Default 30 minutes

    if (args.estimatedDurationSeconds && args.estimatedDurationSeconds > 14400) {
      // For audio >4 hours, allow up to 2 hours timeout
      maxTimeoutMs = Math.min(
        args.estimatedDurationSeconds * 1.5 * 1000,
        2 * 60 * 60 * 1000
      );
    }

    // Submit with adjusted timeout config
    const transcript = await assemblyai.transcripts.submit({
      audio_url: args.audioUrl,
      speaker_labels: true
    });

    await ctx.db.insert("transcripts", {
      videoId: args.videoId,
      assemblyJobId: transcript.id,
      status: "processing",
      maxTimeoutMs, // Store timeout for polling
      createdAt: Date.now()
    });

    return { jobId: transcript.id };
  }
});

// ✅ Solution 2: Use webhooks for long transcriptions instead of polling
// Register webhook once, then AssemblyAI will POST when complete
// Eliminates timeout issues entirely

// ✅ Solution 3: Split very long audio into chunks
async function transcribeLongAudio(
  ctx: any,
  videoId: Id<"videos">,
  audioUrl: string,
  durationSeconds: number
) {
  if (durationSeconds > 18000) { // >5 hours
    // Split into 2-hour chunks and transcribe separately
    const chunkDurationSeconds = 7200;
    const chunks = Math.ceil(durationSeconds / chunkDurationSeconds);

    const jobs = [];
    for (let i = 0; i < chunks; i++) {
      const startTime = i * chunkDurationSeconds;
      const endTime = Math.min((i + 1) * chunkDurationSeconds, durationSeconds);

      // Create clip URL or download chunk
      const chunkUrl = await createAudioChunk(audioUrl, startTime, endTime);

      const job = await submitForTranscription(ctx, {
        videoId,
        audioUrl: chunkUrl,
        chunkIndex: i,
        totalChunks: chunks
      });

      jobs.push(job);
    }

    return { method: "chunked", jobs };
  } else {
    // Normal submission for shorter audio
    return await submitForTranscription(ctx, { videoId, audioUrl });
  }
}
```

---

## Issue 3: Speaker Diarization Not Working / Wrong Speaker Assignment

**Symptom**: Multiple speakers detected as one speaker, or vice versa

**Root Causes**:
1. Audio quality too poor (background noise, overlapping speech)
2. Speakers too similar (same gender, similar voice)
3. Continuous speech without natural pauses
4. AssemblyAI confidence threshold issue

**Debugging Steps**:

```typescript
// 1. Check speaker diarization results
async function validateSpeakerDiarization(
  transcript: any
): Promise<{ valid: boolean; confidence: number; issues: string[] }> {
  const issues: string[] = [];
  let totalConfidence = 0;

  if (!transcript.speakers || transcript.speakers.length === 0) {
    issues.push("No speakers detected");
  }

  // Check confidence levels
  const words = transcript.words || [];
  const speakerWords = new Map<number, number>();
  let totalWordsWithSpeaker = 0;

  for (const word of words) {
    if (word.speaker !== undefined) {
      speakerWords.set(word.speaker, (speakerWords.get(word.speaker) || 0) + 1);
      totalWordsWithSpeaker++;
    }
  }

  // Check for unbalanced speaker ratios
  for (const [speaker, count] of speakerWords.entries()) {
    const ratio = count / totalWordsWithSpeaker;
    if (ratio < 0.05) {
      issues.push(`Speaker ${speaker} has <5% of words (may be false positive)`);
    }
    if (ratio > 0.95) {
      issues.push(`Speaker ${speaker} has >95% of words (may be missing speaker)`);
    }
  }

  const confidence = totalWordsWithSpeaker / (words.length || 1);

  console.log("[TRANSCRIPTION] Speaker diarization analysis:", {
    speakersDetected: transcript.speakers?.length || 0,
    speakerConfidence: (confidence * 100).toFixed(1) + "%",
    issues
  });

  return {
    valid: issues.length === 0,
    confidence,
    issues
  };
}

// 2. Check audio quality
async function analyzeAudioQuality(audioUrl: string): Promise<{
  quality: "good" | "fair" | "poor";
  issues: string[];
}> {
  const issues: string[] = [];

  // Download sample and analyze
  const response = await fetch(audioUrl);
  const buffer = await response.arrayBuffer();

  // Basic checks (simplified)
  const view = new Uint8Array(buffer);

  // Check for silent sections
  let silentFrames = 0;
  for (let i = 0; i < Math.min(view.length, 10000); i++) {
    if (view[i] < 5) silentFrames++;
  }

  if (silentFrames > view.length * 0.3) {
    issues.push("Significant silent sections detected");
  }

  // Determine quality
  const quality = issues.length === 0 ? "good" : issues.length === 1 ? "fair" : "poor";

  return { quality, issues };
}
```

**Solutions**:

```typescript
// ✅ Solution 1: Request speaker labels with confidence thresholds
export const submitForTranscription = action({
  handler: async (ctx, args: {
    videoId: Id<"videos">;
    audioUrl: string;
  }) => {
    const audioQuality = await analyzeAudioQuality(args.audioUrl);

    const transcript = await assemblyai.transcripts.submit({
      audio_url: args.audioUrl,
      speaker_labels: true,
      // Adjust speaker detection sensitivity based on quality
      speaker_labels_confidence: audioQuality.quality === "poor" ? 0.5 : 0.8
    });

    // Log quality assessment for debugging
    if (audioQuality.quality !== "good") {
      console.warn("[TRANSCRIPTION] Poor audio quality detected", {
        videoId: args.videoId,
        quality: audioQuality.quality,
        issues: audioQuality.issues
      });
    }

    return { jobId: transcript.id };
  }
});

// ✅ Solution 2: Manual speaker identification for critical content
async function processCompletedTranscriptWithManualCorrection(
  ctx: any,
  transcriptId: Id<"transcripts">,
  job: any
) {
  const diarization = await validateSpeakerDiarization(job);

  // If confidence is low, flag for manual review
  if (diarization.confidence < 0.7) {
    await ctx.db.patch(transcriptId, {
      status: "needs_manual_review",
      diarizationQuality: "low",
      originalSpeakers: job.speakers,
      notes: diarization.issues.join("; ")
    });

    return { status: "needs_manual_review", issues: diarization.issues };
  }

  // Proceed with normal processing
  await processCompletedTranscript(ctx, transcriptId, job);
}

// ✅ Solution 3: Provide UI for manual speaker correction
export const correctSpeakerAssignment = mutation({
  handler: async (ctx, args: {
    transcriptId: Id<"transcripts">;
    wordIndices: number[]; // Words to correct
    newSpeaker: number; // New speaker ID
  }) => {
    const transcript = await ctx.db.get(args.transcriptId);
    const words = transcript.words || [];

    // Update speaker assignment for selected words
    const correctedWords = words.map((word, idx) => {
      if (args.wordIndices.includes(idx)) {
        return { ...word, speaker: args.newSpeaker, manuallyCorrect: true };
      }
      return word;
    });

    await ctx.db.patch(args.transcriptId, {
      words: correctedWords,
      diarizationQuality: "manually_corrected"
    });

    return { success: true };
  }
});
```

---

## Issue 4: AssemblyAI API Rate Limiting

**Symptom**: "Rate limit exceeded" or "429" errors

**Root Causes**:
1. Too many concurrent transcription jobs (>50 simultaneously)
2. Polling too frequently (>every 5 seconds)
3. No backoff strategy implemented
4. Batch submissions without throttling

**Debugging Steps**:

```typescript
// 1. Check current rate limit status
async function checkRateLimitStatus(): Promise<{
  requestsRemaining: number;
  resetTime: Date;
  estimatedWaitTime: number;
}> {
  // Track requests manually (AssemblyAI doesn't expose rate limit headers)
  const now = Date.now();
  const requests = requestLog.filter(t => now - t < 60000); // Last 60 seconds

  console.log("[RATE_LIMIT] Requests in last 60s:", {
    count: requests.length,
    limit: 500, // Typical AssemblyAI limit per minute
  });

  return {
    requestsRemaining: Math.max(0, 500 - requests.length),
    resetTime: new Date(now + 60000),
    estimatedWaitTime: requests.length > 450 ? 60000 : 0
  };
}

// 2. Monitor concurrent jobs
function monitorConcurrentJobs(ctx: any): Map<string, number> {
  const concurrentByStatus = new Map<string, number>();
  concurrentByStatus.set("processing", 0);
  concurrentByStatus.set("pending", 0);

  // Query active transcriptions
  return concurrentByStatus;
}

// 3. Implement request queuing
class RateLimitedTranscriptionQueue {
  private requestsInLastMinute: number[] = [];
  private readonly MAX_REQUESTS_PER_MINUTE = 500;

  async submitWithRateLimit(
    submitter: () => Promise<any>
  ): Promise<any> {
    const now = Date.now();

    // Remove old requests outside 60-second window
    this.requestsInLastMinute = this.requestsInLastMinute.filter(
      t => now - t < 60000
    );

    // Wait if we're approaching the limit
    if (this.requestsInLastMinute.length >= this.MAX_REQUESTS_PER_MINUTE) {
      const oldestRequest = Math.min(...this.requestsInLastMinute);
      const waitTime = 60000 - (now - oldestRequest);

      console.warn(`[RATE_LIMIT] Waiting ${waitTime}ms before next request`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Submit request
    const result = await submitter();
    this.requestsInLastMinute.push(Date.now());

    return result;
  }
}
```

**Solutions**:

```typescript
// ✅ Solution 1: Implement request queue with backoff
const transcriptionQueue = new RateLimitedTranscriptionQueue();

export const submitForTranscriptionWithRateLimit = action({
  handler: async (ctx, args: {
    videoId: Id<"videos">;
    audioUrl: string;
  }) => {
    return await transcriptionQueue.submitWithRateLimit(async () => {
      return await submitForTranscription(ctx, args);
    });
  }
});

// ✅ Solution 2: Batch submissions with throttling
export const batchSubmitForTranscription = action({
  handler: async (ctx, args: {
    videoIds: Id<"videos">[];
    audioUrls: string[];
  }) => {
    const results = [];

    for (let i = 0; i < args.videoIds.length; i++) {
      // Throttle: wait 1 second between submissions
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const result = await submitForTranscription(ctx, {
        videoId: args.videoIds[i],
        audioUrl: args.audioUrls[i]
      });

      results.push(result);
    }

    return { success: true, results };
  }
});

// ✅ Solution 3: Limit concurrent transcriptions
export const addVideoToTranscriptionQueue = mutation({
  handler: async (ctx, args: {
    videoId: Id<"videos">;
  }) => {
    // Check concurrent job count
    const activeTranscriptions = await ctx.db
      .query("transcripts")
      .filter(t => t.eq(t.field("status"), "processing"))
      .collect();

    if (activeTranscriptions.length >= 50) {
      // Queue for later
      await ctx.db.patch(args.videoId, {
        transcriptionStatus: "queued",
        queuedAt: Date.now()
      });

      return { status: "queued", position: activeTranscriptions.length };
    }

    // Submit immediately
    return { status: "submitted" };
  }
});
```

---

## Issue 5: Duplicate Transcriptions Being Created

**Symptom**: Same video transcribed multiple times, wasting credits

**Root Causes**:
1. Audio hash calculation differs (different URL parameters)
2. Concurrent requests both pass duplicate check
3. Database query returning incorrect results
4. Cache invalidation issues

**Debugging Steps**:

```typescript
// 1. Verify hash calculation consistency
async function debugAudioHashConsistency(
  audioUrl1: string,
  audioUrl2: string
): Promise<boolean> {
  const hash1 = await hashAudioUrl(audioUrl1);
  const hash2 = await hashAudioUrl(audioUrl2);

  const match = hash1 === hash2;

  console.log("[DEDUP] Audio hash comparison:", {
    url1: audioUrl1.substring(0, 50) + "...",
    url2: audioUrl2.substring(0, 50) + "...",
    hash1,
    hash2,
    match
  });

  return match;
}

// 2. Check for race condition
async function checkDuplicateDetectionRaceCondition(
  ctx: any,
  audioHash: string,
  videoId: Id<"videos">
) {
  // Query for existing transcript
  const existing = await ctx.db
    .query("transcripts")
    .filter(t => t.eq(t.field("audioHash"), audioHash))
    .first();

  console.log("[DEDUP] Race condition check:", {
    videoId,
    audioHash: audioHash.substring(0, 16) + "...",
    existingTranscriptFound: !!existing,
    timestamp: new Date().toISOString()
  });

  return existing;
}

// 3. Verify cache state
async function debugCache(videoId: Id<"videos">): Promise<void> {
  const cacheKey = `transcript:${videoId}`;
  const cachedValue = await redis.get(cacheKey);

  console.log("[DEDUP] Cache state:", {
    videoId,
    cached: !!cachedValue,
    cacheValue: cachedValue ? "exists" : "miss",
    cacheSize: await redis.dbSize()
  });
}
```

**Solutions**:

```typescript
// ✅ Solution 1: Normalize URLs before hashing
async function normalizeAudioUrl(audioUrl: string): Promise<string> {
  // Remove query parameters and fragments
  const url = new URL(audioUrl);
  url.search = "";
  url.hash = "";

  // Remove tracking parameters
  const cleanUrl = url.toString();

  return cleanUrl;
}

async function hashAudioUrl(audioUrl: string): Promise<string> {
  // Normalize before hashing
  const normalized = await normalizeAudioUrl(audioUrl);

  const buffer = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// ✅ Solution 2: Use database transaction to prevent race condition
export const submitForTranscription = action({
  handler: async (ctx, args: {
    videoId: Id<"videos">;
    audioUrl: string;
  }) => {
    const audioHash = await hashAudioUrl(args.audioUrl);

    // Check for existing AND create atomically
    const existing = await ctx.db
      .query("transcripts")
      .filter(t => t.eq(t.field("audioHash"), audioHash))
      .filter(t => t.eq(t.field("status"), "completed"))
      .first();

    if (existing) {
      return {
        jobId: existing.assemblyJobId,
        cached: true,
        transcriptId: existing._id
      };
    }

    // If no existing transcript, this is the first to claim the audio
    // Additional concurrent requests will create separate jobs
    const transcript = await assemblyai.transcripts.submit({...});

    const transcriptId = await ctx.db.insert("transcripts", {
      videoId: args.videoId,
      assemblyJobId: transcript.id,
      audioHash,
      status: "processing"
    });

    return { jobId: transcript.id, cached: false, transcriptId };
  }
});

// ✅ Solution 3: Implement cross-request deduplication with Redis
async function checkDuplicateWithRedis(
  audioHash: string,
  videoId: Id<"videos">
): Promise<{ isDuplicate: boolean; transcriptId?: string }> {
  const lockKey = `transcribe:lock:${audioHash}`;
  const resultKey = `transcribe:result:${audioHash}`;

  // Try to acquire lock
  const lockAcquired = await redis.set(lockKey, videoId, "NX", "EX", 300); // 5 min lock

  if (!lockAcquired) {
    // Another request is processing this audio
    // Wait for result
    const result = await redis.get(resultKey);
    if (result) {
      return { isDuplicate: true, transcriptId: result };
    }
    // Still processing, wait a bit and retry
    await new Promise(resolve => setTimeout(resolve, 1000));
    return checkDuplicateWithRedis(audioHash, videoId);
  }

  // We have the lock, proceed with submission
  return { isDuplicate: false };
}
```

---

## Issue 6: Transcript Not Updating After Completion

**Symptom**: Transcript status stays "processing" even after completion, UI doesn't update

**Root Causes**:
1. Polling stopped prematurely
2. Database patch failed silently
3. Convex subscription not updating UI
4. Error in processCompletedTranscript function

**Debugging Steps**:

```typescript
// 1. Verify polling is running
async function debugPollingStatus(transcriptId: Id<"transcripts">) {
  const transcript = await ctx.db.get(transcriptId);

  console.log("[POLLING] Status check:", {
    transcriptId,
    status: transcript.status,
    createdAt: new Date(transcript.createdAt).toISOString(),
    lastPolledAt: transcript.lastPolledAt ? new Date(transcript.lastPolledAt).toISOString() : "never",
    elapsedSeconds: (Date.now() - transcript.createdAt) / 1000,
    pollAttempts: transcript.pollAttempts || 0
  });

  // If lastPolledAt is more than 5 minutes ago, polling stopped
  if (transcript.lastPolledAt && Date.now() - transcript.lastPolledAt > 300000) {
    console.error("[POLLING] Polling appears to have stopped!");
    return false;
  }

  return true;
}

// 2. Check AssemblyAI job status directly
async function checkAssemblyAIStatus(jobId: string) {
  const assemblyai = new AssemblyAI({
    apiKey: process.env.ASSEMBLYAI_API_KEY
  });

  const job = await assemblyai.transcripts.get(jobId);

  console.log("[ASSEMBLYAI] Job status:", {
    jobId,
    status: job.status,
    completed: job.completed,
    error: job.error,
    duration: job.duration
  });

  return job;
}

// 3. Check database patch results
async function debugDatabasePatch(transcriptId: Id<"transcripts">) {
  const before = await ctx.db.get(transcriptId);

  await ctx.db.patch(transcriptId, {
    status: "completed",
    testTimestamp: Date.now()
  });

  const after = await ctx.db.get(transcriptId);

  console.log("[DATABASE] Patch verification:", {
    transcriptId,
    before: { status: before.status, testTimestamp: before.testTimestamp },
    after: { status: after.status, testTimestamp: after.testTimestamp },
    patched: before.status !== after.status
  });
}
```

**Solutions**:

```typescript
// ✅ Solution 1: Verify polling is scheduled and running
export const pollTranscriptionStatus = action({
  handler: async (ctx, args: {
    transcriptId: Id<"transcripts">;
    jobId: string;
  }) => {
    const transcript = await ctx.db.get(args.transcriptId);

    // Always log when polling
    console.log(`[POLLING] Starting poll for ${args.jobId}`);

    try {
      const assemblyai = new AssemblyAI({
        apiKey: process.env.ASSEMBLYAI_API_KEY
      });

      const job = await assemblyai.transcripts.get(args.jobId);

      // ALWAYS update lastPolledAt
      await ctx.db.patch(args.transcriptId, {
        lastPolledAt: Date.now(),
        status: job.status as any
      });

      if (job.status === "completed") {
        console.log(`[POLLING] Job ${args.jobId} completed`);
        return await processCompletedTranscript(ctx, args.transcriptId, job);
      }

      if (job.status === "processing") {
        // Schedule next poll
        const nextDelay = calculateBackoff(/*...*/);
        schedulePollingJob(args.transcriptId, args.jobId, nextDelay);

        console.log(`[POLLING] Job ${args.jobId} still processing, next poll in ${nextDelay}ms`);
        return { status: "processing", nextPoll: nextDelay };
      }

      // Handle errors
      if (job.status === "error") {
        console.error(`[POLLING] Job ${args.jobId} failed:`, job.error);
        await ctx.db.patch(args.transcriptId, {
          status: "failed",
          error: job.error
        });
        return { status: "error", error: job.error };
      }
    } catch (error) {
      console.error(`[POLLING] Poll failed for ${args.jobId}:`, error);

      // Reschedule poll even on error
      schedulePollingJob(args.transcriptId, args.jobId, 10000);

      throw error;
    }
  }
});

// ✅ Solution 2: Wrap processCompletedTranscript in try-catch
async function processCompletedTranscript(
  ctx: any,
  transcriptId: Id<"transcripts">,
  job: any
): Promise<void> {
  try {
    // Extract and validate data
    if (!job.words || job.words.length === 0) {
      throw new Error("No words in transcript");
    }

    const words = job.words.map(/*...*/);
    const speakers = job.speakers ? processSpeakers(job.speakers) : [];
    const durationMinutes = (job.duration || 0) / 60;

    // Perform patch
    const patchResult = await ctx.db.patch(transcriptId, {
      status: "completed",
      fullText: job.text,
      words,
      speakers,
      metadata: {
        duration: durationMinutes,
        confidence: calculateConfidence(words),
        costCredits: estimateCost(durationMinutes)
      },
      completedAt: Date.now()
    });

    console.log(`[COMPLETION] Successfully completed transcript ${transcriptId}`);
    return patchResult;

  } catch (error) {
    console.error(`[COMPLETION] Failed to process completed transcript ${transcriptId}:`, error);

    // Mark as failed
    await ctx.db.patch(transcriptId, {
      status: "failed",
      error: String(error)
    });

    throw error;
  }
}

// ✅ Solution 3: Ensure Convex subscription is listening
export const TranscriptStatusSubscription = () => {
  const transcript = useQuery(api.transcripts.getTranscript, { transcriptId });

  useEffect(() => {
    // This subscription will auto-update when database changes
    if (transcript?.status === "completed") {
      console.log("[UI] Transcript completed, updating display");
      // UI will automatically re-render
    }
  }, [transcript?.status]);

  return <TranscriptDisplay status={transcript?.status} />;
};
```

---

## Summary

These troubleshooting patterns cover:

1. **Audio URL issues** - Validation, presigned URLs, accessibility checks
2. **Long transcriptions** - Timeout handling, chunking, webhooks
3. **Speaker diarization** - Quality assessment, confidence thresholds, manual correction
4. **Rate limiting** - Request queuing, backoff, concurrent job management
5. **Duplicate prevention** - Hash normalization, atomic operations, Redis locking
6. **Status updates** - Polling verification, database patches, subscription monitoring

Use these patterns to diagnose and resolve transcription workflow issues quickly.
