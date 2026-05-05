---
name: transcription-workflow
description: |
  Master the complete transcription pipeline from job submission through real-time status polling to transcript storage.
  Includes AssemblyAI integration, exponential backoff polling, speaker diarization, error recovery, and cost optimization.

  When to use: Implementing transcription features, submitting jobs to AssemblyAI, tracking transcription status,
  storing transcripts, handling errors and retries, detecting duplicate transcriptions, optimizing costs.

  Keywords: transcription, AssemblyAI, job submission, polling, diarization, status, error recovery, cost optimization, deduplication
---

# Transcription Workflow

## Quick Start (Layer 1-2)

The transcription workflow handles the complete lifecycle of converting video audio to text using AssemblyAI.

### Three Transcription Methods

```typescript
// 1. YouTube Video Transcription
const transcribeYouTube = async (videoId: string, url: string) => {
  const assemblyai = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });
  const transcript = await assemblyai.transcripts.submit({
    audio_url: url,
    speaker_labels: true,
    entity_detection: true
  });
  return { jobId: transcript.id, status: "processing" };
};

// 2. Uploaded File Transcription
const transcribeFile = async (filePath: string) => {
  const assemblyai = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });
  const transcript = await assemblyai.transcripts.submit({
    audio: filePath, // URL or file path
    speaker_labels: true
  });
  return { jobId: transcript.id, status: "processing" };
};

// 3. Resume Interrupted Transcription
const resumeTranscription = async (jobId: string) => {
  const assemblyai = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });
  const transcript = await assemblyai.transcripts.get(jobId);
  return { status: transcript.status, progress: transcript.completed ? 100 : 50 };
};
```

### Key Concepts

- **Job Submission**: Submit audio to AssemblyAI, get job ID back
- **Exponential Backoff Polling**: Check status with increasing delays (5s → 10s → 30s → 1m → 2m)
- **Speaker Diarization**: Identify who speaks when in conversations
- **Cost Optimization**: Cache results, avoid duplicate transcriptions
- **Error Recovery**: Retry failed jobs with exponential backoff
- **Transcript Storage**: Save full text + word-level timing data

### Most Common Use Case

```typescript
// User uploads video
1. Submit to AssemblyAI
2. Start polling status (every 5 seconds initially)
3. Show "Transcribing..." progress to user
4. Handle timeout gracefully (>30 minutes = failed)
5. Store transcript when complete
6. Display transcript in reader
```

## Key Files & References

- `/prompts/agents/specialized/transcription-pipeline-expert.md` - Detailed agent guide
- `guide.md` - Complete implementation patterns (Layer 3)
- `patterns.md` - Advanced patterns and edge cases (Layer 3)
- `troubleshooting.md` - Common issues and solutions (Layer 3)
- `examples/` - Real-world code examples (Layer 3)

## Core Workflow Steps

1. **Submission Phase**
   - Validate audio URL/file
   - Check for duplicate transcriptions
   - Submit to AssemblyAI
   - Store job ID in database

2. **Polling Phase**
   - Check status with exponential backoff
   - Update UI with progress
   - Handle timeouts gracefully
   - Retry failed polls

3. **Completion Phase**
   - Process transcript data
   - Extract word-level timing
   - Store speakers if available
   - Mark as completed

4. **Storage Phase**
   - Save full text
   - Store word array with timestamps
   - Cache speaker data
   - Calculate cost

## Essential Patterns

### Job Submission Pattern
```typescript
export const submitForTranscription = action({
  handler: async (ctx, args: { videoId: Id<"videos">; audioUrl: string }) => {
    // 1. Check for duplicate
    const existing = await findDuplicateTranscription(args.audioUrl);
    if (existing) return { jobId: existing.assemblyJobId, cached: true };

    // 2. Submit job
    const assemblyai = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });
    const transcript = await assemblyai.transcripts.submit({
      audio_url: args.audioUrl,
      speaker_labels: true,
      entity_detection: true
    });

    // 3. Store in database
    await ctx.db.insert("transcripts", {
      videoId: args.videoId,
      assemblyJobId: transcript.id,
      status: "processing",
      createdAt: Date.now()
    });

    return { jobId: transcript.id, cached: false };
  }
});
```

### Polling Pattern
```typescript
function calculateBackoff(elapsedMs: number): number {
  const elapsed = elapsedMs / 1000 / 60; // Convert to minutes
  if (elapsed < 1) return 5000; // 5s
  if (elapsed < 5) return 10000; // 10s
  if (elapsed < 30) return 30000; // 30s
  if (elapsed < 120) return 60000; // 1m
  return 120000; // 2m max
}
```

### Error Handling Pattern
```typescript
try {
  const transcript = await submitForTranscription(videoId, audioUrl);
  console.log("Job submitted:", transcript.jobId);
} catch (error) {
  if (error.code === "DUPLICATE_TRANSCRIPTION") {
    // Reuse existing transcript
    await reuseTranscript(existingId);
  } else if (error.code === "INVALID_AUDIO") {
    // Show user: "Invalid audio file"
    showError("Unable to process audio file");
  } else {
    // Show user: "Service unavailable"
    showError("Transcription service temporarily unavailable");
  }
}
```

## What You'll Learn

In this skill, you'll understand:
- How to submit audio to AssemblyAI
- How to implement efficient polling with exponential backoff
- How to handle speaker identification and diarization
- How to detect and handle duplicate transcriptions
- How to store transcripts with word-level timing
- How to handle timeouts and failures gracefully
- How to optimize costs through deduplication
- How to integrate with the video upload workflow

## Next Steps

1. **For Implementation**: See `guide.md` for complete patterns
2. **For Advanced Patterns**: See `patterns.md` for edge cases
3. **For Troubleshooting**: See `troubleshooting.md` for common issues
4. **For Code Examples**: See `examples/` directory
5. **For Related Workflows**: See `video-upload-workflow/` or `ai-chat-workflow/` skills
