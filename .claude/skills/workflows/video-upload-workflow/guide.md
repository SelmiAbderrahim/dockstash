# Video Upload Workflow - Complete Implementation Guide

## Architecture Overview

The video upload workflow consists of 4 main phases:

```
┌─────────────────┐
│  User Selection │ (YouTube URL or File)
├─────────────────┤
│  Validation     │ (Check URL/file size)
├─────────────────┤
│  Upload Process │ (Stream to storage)
├─────────────────┤
│  Status Update  │ (Mark as processing)
└─────────────────┘
```

## Phase 1: URL & File Validation

### YouTube URL Validation

```typescript
import { z } from "zod";

// Regex patterns for YouTube URLs
const YouTubeURLPatterns = {
  standard: /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
  short: /^(https?:\/\/)?(www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
  videoIdOnly: /^([a-zA-Z0-9_-]{11})$/
};

// Validate and extract video ID
export function extractYouTubeVideoId(url: string): string {
  for (const pattern of Object.values(YouTubeURLPatterns)) {
    const match = url.match(pattern);
    if (match) return match[3] || match[1];
  }
  throw new Error("Invalid YouTube URL");
}

// Validate with Zod schema
const YouTubeURLSchema = z.string()
  .refine(
    (url) => YouTubeURLPatterns.standard.test(url) ||
             YouTubeURLPatterns.short.test(url) ||
             YouTubeURLPatterns.videoIdOnly.test(url),
    { message: "Invalid YouTube URL format" }
  );

// Usage
try {
  const videoId = extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  // videoId = "dQw4w9WgXcQ"
} catch (error) {
  console.error("Invalid URL:", error.message);
}
```

### File Size & Format Validation

```typescript
interface FileValidationOptions {
  maxSizeBytes: number; // Default: 5GB
  allowedMimeTypes: string[];
  allowedExtensions: string[];
}

const defaultOptions: FileValidationOptions = {
  maxSizeBytes: 5 * 1024 * 1024 * 1024, // 5GB
  allowedMimeTypes: [
    "video/mp4",
    "video/quicktime", // .mov
    "video/x-msvideo", // .avi
    "video/webm"
  ],
  allowedExtensions: [".mp4", ".mov", ".webm", ".avi", ".mkv"]
};

export function validateVideoFile(
  file: File,
  options = defaultOptions
): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > options.maxSizeBytes) {
    const maxSizeMB = Math.round(options.maxSizeBytes / 1024 / 1024 / 1024);
    return {
      valid: false,
      error: `File exceeds ${maxSizeMB}GB limit`
    };
  }

  // Check MIME type
  if (!options.allowedMimeTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} not supported`
    };
  }

  // Check extension
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  if (!options.allowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `File extension ${ext} not allowed`
    };
  }

  return { valid: true };
}
```

## Phase 2: Upload Process

### YouTube URL Upload

```typescript
// Convex mutation for YouTube URL upload
export const uploadVideoFromYouTube = mutation({
  handler: async (ctx, args: {
    url: string;
    title: string;
  }) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");

    try {
      // 1. Validate URL
      const videoId = extractYouTubeVideoId(args.url);

      // 2. Create video record
      const videoRecord = await ctx.db.insert("videos", {
        userId: user.subject,
        title: args.title || "Untitled",
        sourceType: "youtube",
        sourceUrl: args.url,
        youtubeMetadata: {
          videoId,
          duration: 0, // Will be fetched from metadata
          thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
        },
        status: "pending",
        progress: 0,
        createdAt: Date.now()
      });

      // 3. Queue transcription job in background
      scheduleTranscriptionJob(videoRecord._id, args.url);

      return {
        success: true,
        videoId: videoRecord._id,
        status: "pending"
      };

    } catch (error) {
      throw new ConvexError({
        code: "YOUTUBE_UPLOAD_ERROR",
        message: error.message
      });
    }
  }
});
```

### File Upload with Progress

```typescript
export const uploadVideoFile = async (
  file: File,
  videoId: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  // 1. Validate file
  const validation = validateVideoFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 2. Create FormData with metadata
  const formData = new FormData();
  formData.append("file", file);
  formData.append("videoId", videoId);
  formData.append("fileName", file.name);

  // 3. Setup XMLHttpRequest for progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Track upload progress
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        const estimatedTimeRemaining = calculateETA(
          event.loaded,
          event.total,
          startTime
        );

        onProgress?.({
          loaded: event.loaded,
          total: event.total,
          percent: percentComplete,
          estimatedTimeRemaining,
          uploadSpeed: calculateSpeed(event.loaded, startTime)
        });
      }
    });

    // Handle completion
    xhr.addEventListener("load", () => {
      if (xhr.status === 200) {
        const result = JSON.parse(xhr.responseText);
        resolve(result);
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    // Handle errors
    xhr.addEventListener("error", () => {
      reject(new Error("Upload failed due to network error"));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload cancelled"));
    });

    // Start upload
    const startTime = Date.now();
    xhr.open("POST", "/api/videos/upload");
    xhr.send(formData);
  });
};

// Helper functions
function calculateETA(loaded: number, total: number, startTime: number): number {
  const elapsed = (Date.now() - startTime) / 1000;
  const speed = loaded / elapsed;
  return (total - loaded) / speed;
}

function calculateSpeed(loaded: number, startTime: number): number {
  const elapsed = (Date.now() - startTime) / 1000;
  return loaded / elapsed; // bytes per second
}
```

## Phase 3: Progress Tracking

### Real-Time Status Updates

```typescript
// Frontend subscription for progress updates
export const useUploadProgress = (videoId: Id<"videos">) => {
  const uploadProgress = useSubscription(
    internal.videos.watchVideoProgress,
    { videoId }
  );

  return uploadProgress;
};

// Backend: Watch video progress
export const watchVideoProgress = subscription(async (ctx, args: {
  videoId: Id<"videos">;
}) => {
  const video = await ctx.db.get(args.videoId);
  if (!video) return;

  return video; // Return current state
});

// Update progress from upload handler
export const updateUploadProgress = mutation({
  handler: async (ctx, args: {
    videoId: Id<"videos">;
    progress: number; // 0-100
    status: "uploading" | "processing";
  }) => {
    const video = await ctx.db.get(args.videoId);
    if (!video) throw new Error("Video not found");

    await ctx.db.patch(args.videoId, {
      status: args.status,
      progress: args.progress,
      startedAt: args.status === "uploading" ? Date.now() : video.startedAt
    });

    return { success: true };
  }
});
```

## Phase 4: Integration with Transcription

```typescript
// After upload completes, queue transcription
export const startTranscription = action({
  handler: async (ctx, args: { videoId: Id<"videos"> }) => {
    const video = await ctx.runQuery(internal.videos.getVideo, { videoId: args.videoId });

    if (!video) throw new Error("Video not found");

    // Update status to transcribing
    await ctx.runMutation(internal.videos.updateStatus, {
      videoId: args.videoId,
      status: "processing"
    });

    // Get audio URL (YouTube or storage URL)
    const audioUrl = video.sourceType === "youtube"
      ? `https://www.youtube.com/watch?v=${video.youtubeMetadata.videoId}`
      : video.fileMetadata.storageUrl;

    // Submit to AssemblyAI
    const assemblyai = new AssemblyAI({
      apiKey: process.env.ASSEMBLYAI_API_KEY
    });

    const transcript = await assemblyai.transcripts.submit({
      audio_url: audioUrl,
      speaker_labels: true,
      entity_detection: true
    });

    // Store transcript job ID
    await ctx.runMutation(internal.videos.updateTranscriptJob, {
      videoId: args.videoId,
      transcriptId: transcript.id
    });

    return { success: true, transcriptId: transcript.id };
  }
});
```

## Error Handling & Recovery

```typescript
// Comprehensive error handling
export const handleUploadError = mutation({
  handler: async (ctx, args: {
    videoId: Id<"videos">;
    error: UploadError;
  }) => {
    const video = await ctx.db.get(args.videoId);
    if (!video) return;

    // Classify error
    let message = "Upload failed";
    let canRetry = true;

    if (args.error.code === "FILE_TOO_LARGE") {
      message = "File exceeds 5GB limit";
      canRetry = false;
    } else if (args.error.code === "NETWORK_ERROR") {
      message = "Network connection lost. Please retry.";
      canRetry = true;
    } else if (args.error.code === "UNSUPPORTED_FORMAT") {
      message = "File format not supported";
      canRetry = false;
    }

    // Update video status
    await ctx.db.patch(args.videoId, {
      status: "failed",
      error: message
    });

    return { success: true, canRetry };
  }
});

// Automatic retry with exponential backoff
export const retryUpload = async (
  videoId: Id<"videos">,
  file: File,
  maxRetries: number = 3
) => {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await uploadVideoFile(file, videoId);
      return { success: true };
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        // Calculate exponential backoff: 1s, 2s, 4s
        const backoffMs = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw new Error(`Upload failed after ${maxRetries} attempts: ${lastError?.message}`);
};
```

## Key Concepts Summary

| Concept | Purpose | Example |
|---------|---------|---------|
| **URL Validation** | Ensure valid YouTube URLs | Check regex patterns |
| **File Validation** | Check size, type, format | <5GB, video/mp4 |
| **Progress Tracking** | Real-time feedback | Update UI every 100ms |
| **Status Transitions** | Track upload lifecycle | pending → uploading → processing |
| **Error Handling** | Graceful failure recovery | Auto-retry network errors |
| **Integration** | Connect to transcription | Pass to AssemblyAI after upload |

## Performance Checklist

- ✅ File upload streams to prevent memory exhaustion
- ✅ Progress updates every 100-500ms
- ✅ Validation completes <100ms
- ✅ Status updates <500ms
- ✅ Error messages user-friendly
- ✅ Retry works for transient errors
- ✅ Large files (5GB) handled efficiently
