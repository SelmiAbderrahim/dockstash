# Transcription Workflow - Complete Implementation Guide

## Architecture Overview

The transcription workflow consists of 4 main phases:

```
┌─────────────────────┐
│ Audio Submission    │ (YouTube or uploaded file)
├─────────────────────┤
│ Job Creation        │ (AssemblyAI job queued)
├─────────────────────┤
│ Status Polling      │ (Exponential backoff)
├─────────────────────┤
│ Completion & Storage│ (Save transcript with timing)
└─────────────────────┘
```

## Phase 1: Audio Source Validation

### YouTube Audio URL Extraction

```typescript
import { AssemblyAI } from "assemblyai";

export function getAudioUrlFromYouTube(videoId: string): string {
  // Method 1: Direct YouTube video URL (AssemblyAI can fetch audio)
  return `https://www.youtube.com/watch?v=${videoId}`;
}

// Usage
const audioUrl = getAudioUrlFromYouTube("dQw4w9WgXcQ");
// Returns: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

### Uploaded File URL

```typescript
export async function getUploadedFileUrl(videoId: Id<"videos">): Promise<string> {
  const video = await ctx.db.get(videoId);
  if (!video?.fileMetadata?.storageUrl) {
    throw new Error("Video file not found in storage");
  }
  return video.fileMetadata.storageUrl;
}
```

### Duplicate Detection

```typescript
export const checkDuplicateTranscription = query({
  handler: async (ctx, args: { audioHash: string }) => {
    // Check if we've already transcribed this audio
    const existing = await ctx.db
      .query("transcripts")
      .filter(t => t.eq(t.field("audioHash"), args.audioHash))
      .filter(t => t.eq(t.field("status"), "completed"))
      .first();

    if (existing) {
      return {
        isDuplicate: true,
        existingTranscript: existing,
        savedCost: calculateCost(existing.metadata.duration)
      };
    }
    return { isDuplicate: false };
  }
});
```

---

## Phase 2: Job Submission to AssemblyAI

### Submit Transcription Job

```typescript
export const submitForTranscription = action({
  handler: async (ctx, args: {
    videoId: Id<"videos">;
    audioUrl: string;
    title: string;
  }) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");

    try {
      // 1. Check for duplicate transcription
      const duplicate = await checkDuplicateTranscription(args.audioUrl);
      if (duplicate.isDuplicate) {
        // Create reference to existing transcript
        return {
          success: true,
          jobId: duplicate.existingTranscript.assemblyJobId,
          cached: true,
          costSaved: duplicate.savedCost
        };
      }

      // 2. Validate subscription allows transcription
      const subscription = await getSubscription(user.subject);
      const monthlyMinutes = subscription.plan.transcriptionMinutesPerMonth;
      const usedMinutes = await getUsedTranscriptionMinutes(user.subject);

      if (usedMinutes >= monthlyMinutes) {
        throw new ConvexError({
          code: "TRANSCRIPTION_LIMIT_EXCEEDED",
          message: `Monthly limit of ${monthlyMinutes} minutes reached`
        });
      }

      // 3. Initialize AssemblyAI client
      const assemblyai = new AssemblyAI({
        apiKey: process.env.ASSEMBLYAI_API_KEY
      });

      // 4. Submit job to AssemblyAI
      const transcript = await assemblyai.transcripts.submit({
        audio_url: args.audioUrl,
        speaker_labels: true, // Identify different speakers
        entity_detection: true, // Extract entities (names, companies, etc)
        auto_highlights: true, // Highlight key topics
        sentiment_analysis: true, // Analyze sentiment
        language_code: "en" // Can be auto-detected
      });

      // 5. Store job in database
      const transcriptId = await ctx.db.insert("transcripts", {
        videoId: args.videoId,
        userId: user.subject,
        assemblyJobId: transcript.id,
        status: "processing",
        audioUrl: args.audioUrl,
        audioHash: await hashAudioUrl(args.audioUrl),
        metadata: {
          duration: 0, // Will be updated when complete
          language: "en",
          confidence: 0,
          costCredits: 0
        },
        createdAt: Date.now(),
        estimatedCompletionTime: calculateEstimatedTime(100) // 100 minutes default
      });

      // 6. Schedule polling job
      schedulePollingJob(transcriptId, transcript.id);

      return {
        success: true,
        jobId: transcript.id,
        transcriptId,
        cached: false
      };

    } catch (error) {
      // Store error in database for debugging
      await ctx.db.insert("transcriptionErrors", {
        videoId: args.videoId,
        userId: user.subject,
        error: String(error),
        audioUrl: args.audioUrl,
        timestamp: Date.now()
      });

      throw new ConvexError({
        code: "TRANSCRIPTION_SUBMISSION_ERROR",
        message: error instanceof Error ? error.message : "Failed to submit transcription"
      });
    }
  }
});
```

### Cost Calculation

```typescript
// AssemblyAI pricing: $0.000012 per minute of audio ($0.72 per hour)
const COST_PER_MINUTE = 0.000012;

export function estimateCost(durationMinutes: number): number {
  return durationMinutes * COST_PER_MINUTE;
}

export function calculateEstimatedTime(audioMinutes: number): number {
  // Most transcriptions complete in 0.5x to 2x real-time
  // For 100 minutes: typically 1-3 minutes
  const processingSpeedMultiplier = 0.05; // 5% = 5 minutes for 100 minutes of audio
  return audioMinutes * processingSpeedMultiplier;
}
```

---

## Phase 3: Status Polling with Exponential Backoff

### Backoff Calculation

```typescript
interface PollConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  maxTotalDuration: number; // 30 minutes
}

const DEFAULT_POLL_CONFIG: PollConfig = {
  maxAttempts: 100,
  initialDelayMs: 5000, // 5 seconds
  maxDelayMs: 120000, // 2 minutes max
  maxTotalDuration: 30 * 60 * 1000 // 30 minutes
};

function calculateBackoff(
  attempt: number,
  elapsedMs: number,
  config: PollConfig
): number {
  // Stop if timeout exceeded
  if (elapsedMs > config.maxTotalDuration) {
    return -1; // Stop polling
  }

  // Exponential backoff with jitter
  const exponentialDelay = Math.min(
    config.initialDelayMs * Math.pow(1.5, attempt),
    config.maxDelayMs
  );

  // Add jitter to prevent thundering herd
  const jitter = exponentialDelay * 0.1 * Math.random();

  return exponentialDelay + jitter;
}

// Backoff schedule:
// Attempt 1: 5s
// Attempt 2: 7.5s
// Attempt 3: 11.25s
// Attempt 4: 16.87s
// Attempt 5: 25.3s
// Attempt 6-N: 120s (capped)
```

### Polling Implementation

```typescript
export const pollTranscriptionStatus = action({
  handler: async (ctx, args: {
    transcriptId: Id<"transcripts">;
    jobId: string;
  }) => {
    const transcript = await ctx.db.get(args.transcriptId);
    if (!transcript) throw new Error("Transcript not found");

    try {
      const assemblyai = new AssemblyAI({
        apiKey: process.env.ASSEMBLYAI_API_KEY
      });

      // Check current status
      const job = await assemblyai.transcripts.get(args.jobId);

      // Update database with current status
      await ctx.db.patch(args.transcriptId, {
        status: job.status as "completed" | "processing" | "error",
        lastPolledAt: Date.now()
      });

      // If processing, schedule next poll
      if (job.status === "processing") {
        const elapsedMs = Date.now() - transcript.createdAt;
        const nextDelay = calculateBackoff(
          Math.floor(elapsedMs / 5000),
          elapsedMs,
          DEFAULT_POLL_CONFIG
        );

        if (nextDelay > 0) {
          // Schedule next poll
          schedulePollingJob(args.transcriptId, args.jobId, nextDelay);
          return {
            status: "processing",
            nextPollIn: nextDelay
          };
        } else {
          // Timeout exceeded
          await ctx.db.patch(args.transcriptId, {
            status: "failed",
            error: "Transcription timeout (30 minutes exceeded)"
          });
          return { status: "timeout" };
        }
      }

      // If completed, process transcript
      if (job.status === "completed") {
        return await processCompletedTranscript(ctx, args.transcriptId, job);
      }

      // If error
      if (job.status === "error") {
        await ctx.db.patch(args.transcriptId, {
          status: "failed",
          error: job.error
        });
        return { status: "error", error: job.error };
      }

      return { status: job.status };

    } catch (error) {
      // Increment retry count and try again
      const attempts = (transcript.pollAttempts || 0) + 1;
      if (attempts < DEFAULT_POLL_CONFIG.maxAttempts) {
        const nextDelay = calculateBackoff(attempts, Date.now() - transcript.createdAt, DEFAULT_POLL_CONFIG);
        schedulePollingJob(args.transcriptId, args.jobId, nextDelay);

        await ctx.db.patch(args.transcriptId, {
          pollAttempts: attempts,
          lastError: String(error)
        });
      } else {
        await ctx.db.patch(args.transcriptId, {
          status: "failed",
          error: "Maximum polling attempts exceeded"
        });
      }

      return { status: "error", error: String(error) };
    }
  }
});
```

---

## Phase 4: Completion and Storage

### Process Completed Transcript

```typescript
async function processCompletedTranscript(
  ctx: any,
  transcriptId: Id<"transcripts">,
  job: any // AssemblyAI transcript object
): Promise<void> {
  // 1. Extract word-level timing data
  const words = job.words.map((word: any) => ({
    word: word.text,
    start: word.start / 1000, // Convert ms to seconds
    end: word.end / 1000,
    confidence: word.confidence
  }));

  // 2. Process speaker labels
  const speakers = job.speakers ? processSpeakers(job.speakers) : [];

  // 3. Calculate cost
  const durationMinutes = (job.duration || 0) / 60;
  const costCredits = estimateCost(durationMinutes);

  // 4. Extract entities and highlights
  const entities = job.entities || [];
  const highlights = job.auto_highlights?.results || [];

  // 5. Store complete transcript
  await ctx.db.patch(transcriptId, {
    status: "completed",
    fullText: job.text,
    words,
    speakers,
    entities,
    highlights,
    metadata: {
      duration: durationMinutes,
      language: job.language_code || "en",
      confidence: calculateConfidence(words),
      costCredits
    },
    completedAt: Date.now(),
    pollAttempts: undefined // Clean up
  });

  // 6. Update user's transcription usage
  const transcript = await ctx.db.get(transcriptId);
  await ctx.db.patch(
    (await ctx.db.query("subscriptionUsage")
      .filter(u => u.eq(u.field("userId"), transcript.userId))
      .first())?._id,
    {
      transcriptionMinutesUsed: (prev: number) => prev + durationMinutes,
      creditsUsed: (prev: number) => prev + costCredits,
      updatedAt: Date.now()
    }
  );
}

function processSpeakers(speakers: any[]): Array<{
  id: number;
  name: string;
  segments: Array<{ start: number; end: number; text: string }>;
}> {
  return speakers.map((speaker: any) => ({
    id: speaker.speaker,
    name: `Speaker ${speaker.speaker}`,
    segments: speaker.words.map((word: any) => ({
      start: word.start / 1000,
      end: word.end / 1000,
      text: word.text
    }))
  }));
}

function calculateConfidence(words: Array<{ confidence: number }>): number {
  if (words.length === 0) return 0;
  const total = words.reduce((sum, w) => sum + w.confidence, 0);
  return total / words.length;
}
```

### Retrieve and Display Transcript

```typescript
export const getTranscript = query({
  handler: async (ctx, args: { videoId: Id<"videos"> }) => {
    const video = await ctx.db.get(args.videoId);
    if (!video) throw new Error("Video not found");

    // If video is a clone, get transcript from master
    let videoId = args.videoId;
    if (video.masterVideoId) {
      const master = await ctx.db.get(video.masterVideoId);
      videoId = master._id;
    }

    const transcript = await ctx.db
      .query("transcripts")
      .filter(t => t.eq(t.field("videoId"), videoId))
      .first();

    if (!transcript) {
      return null; // Not transcribed yet
    }

    return {
      id: transcript._id,
      status: transcript.status,
      fullText: transcript.fullText,
      words: transcript.words,
      speakers: transcript.speakers,
      entities: transcript.entities,
      highlights: transcript.highlights,
      metadata: transcript.metadata,
      completedAt: transcript.completedAt
    };
  }
});
```

---

## Integration with Video Upload

```typescript
// After video upload completes, start transcription
export const onVideoUploadComplete = action({
  handler: async (ctx, args: { videoId: Id<"videos">; audioUrl: string }) => {
    // 1. Get video metadata
    const video = await ctx.db.get(args.videoId);

    // 2. Submit for transcription
    const result = await ctx.runAction(internal.transcription.submitForTranscription, {
      videoId: args.videoId,
      audioUrl: args.audioUrl,
      title: video.title
    });

    // 3. Update video with transcription job ID
    await ctx.db.patch(args.videoId, {
      status: "processing",
      transcriptionJobId: result.jobId
    });

    return result;
  }
});
```

---

## Error Handling & Recovery

### Comprehensive Error Handling

```typescript
export const handleTranscriptionError = mutation({
  handler: async (ctx, args: {
    transcriptId: Id<"transcripts">;
    error: TranscriptionError;
  }) => {
    const transcript = await ctx.db.get(args.transcriptId);
    if (!transcript) return;

    let message = "Transcription failed";
    let canRetry = false;

    // Classify error type
    if (args.error.code === "INVALID_AUDIO") {
      message = "Invalid audio file. Please check the file and try again.";
      canRetry = false;
    } else if (args.error.code === "AUDIO_TOO_LONG") {
      message = "Audio longer than 24 hours. Contact support for large files.";
      canRetry = false;
    } else if (args.error.code === "UNKNOWN") {
      message = "Transcription service error. Will retry automatically.";
      canRetry = true;
    } else if (args.error.code === "NETWORK_ERROR") {
      message = "Network error. Retrying...";
      canRetry = true;
    }

    await ctx.db.patch(args.transcriptId, {
      status: "failed",
      error: message,
      canRetry,
      lastError: args.error.details
    });

    return { canRetry };
  }
});
```

### Retry Mechanism

```typescript
export const retryTranscription = action({
  handler: async (ctx, args: { transcriptId: Id<"transcripts"> }) => {
    const transcript = await ctx.db.get(args.transcriptId);
    if (!transcript) throw new Error("Transcript not found");

    if (!transcript.canRetry) {
      throw new Error("This transcription cannot be retried");
    }

    // Reset status and try again
    const result = await ctx.runAction(internal.transcription.submitForTranscription, {
      videoId: transcript.videoId,
      audioUrl: transcript.audioUrl,
      title: "Retry: " + transcript.fullText?.substring(0, 50)
    });

    return result;
  }
});
```

---

## Key Concepts Summary

| Concept | Purpose | Example |
|---------|---------|---------|
| **Job Submission** | Submit audio to AssemblyAI | POST with audio_url + speaker_labels |
| **Polling** | Check job status periodically | Check every 5-120s with exponential backoff |
| **Speaker Labels** | Identify different speakers | "Speaker 0: 10.5s-15.3s, Speaker 1: 15.5s-20.2s" |
| **Cost Optimization** | Avoid duplicate transcriptions | Cache and reuse existing transcripts |
| **Error Recovery** | Graceful failure handling | Retry network errors, fail permanently for invalid audio |
| **Timeout Handling** | Prevent infinite polling | Give up after 30 minutes |
| **Integration** | Connect to video workflow | Start transcription after upload completes |

## Performance Checklist

- ✅ Job submission <1s (AssemblyAI API call)
- ✅ First poll within 5 seconds of submission
- ✅ Status updates every 5-120s (exponential backoff)
- ✅ Polling timeout <30 minutes
- ✅ Duplicate detection <100ms
- ✅ Transcript storage <500ms
- ✅ UI updates responsive (<100ms)
- ✅ Handles audio up to 24 hours
