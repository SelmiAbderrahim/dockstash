---
name: video-upload-workflow
description: |
  Master the complete video upload workflow from URL validation through real-time progress tracking.
  Includes YouTube URL validation, file upload handling, progress reporting, and error recovery.

  When to use: Building video upload features, validating URLs, handling file uploads, tracking progress,
  managing upload status transitions, integrating with transcription pipeline.

  Keywords: upload, URL validation, file upload, YouTube, progress, streaming, pipeline
---

# Video Upload Workflow

## Quick Start (Layer 1-2)

The video upload workflow handles the complete lifecycle of getting a video into iReadYouTube.

### Three Upload Methods

```typescript
// 1. YouTube URL
const uploadYouTubeVideo = async (url: string) => {
  const videoId = extractVideoId(url);
  const metadata = await fetchYouTubeMetadata(videoId);
  return { videoId, metadata };
};

// 2. File Upload (client → server → storage)
const uploadVideoFile = async (file: File, onProgress: (percent: number) => void) => {
  const formData = new FormData();
  formData.append('file', file);

  const xhr = new XMLHttpRequest();
  xhr.upload.addEventListener('progress', (e) => {
    onProgress(Math.round((e.loaded / e.total) * 100));
  });
  xhr.send(formData);
};

// 3. Resume Broken Uploads
const resumeUpload = async (uploadId: string, offset: number) => {
  // Continue from where it left off
  const blob = file.slice(offset);
  return uploadChunk(blob, offset);
};
```

### Key Concepts

- **URL Validation**: Verify YouTube URLs before processing
- **Progress Tracking**: Real-time feedback to users
- **Error Recovery**: Automatic retry with backoff
- **Status Transitions**: pending → uploading → processing → completed/failed
- **Cost Tracking**: Monitor transcription costs

### Most Common Use Case

```typescript
// User uploads a video
1. Select YouTube URL or file
2. Validate URL or check file size
3. Submit with real-time progress
4. Display "Processing" status
5. Notify user when transcription starts
```

## Key Files & References

- `/prompts/agents/specialized/video-processing-specialist.md` - Detailed agent guide
- `guide.md` - Complete implementation patterns (Layer 3)
- `patterns.md` - Advanced patterns and edge cases (Layer 3)
- `troubleshooting.md` - Common issues and solutions (Layer 3)
- `examples/` - Real-world code examples (Layer 3)

## Core Workflow Steps

1. **Validation Phase**
   - Check YouTube URL format or file size
   - Extract metadata if applicable
   - Verify user quotas

2. **Upload Phase**
   - Stream file to storage (if file upload)
   - Create video record in database
   - Initialize progress tracking

3. **Processing Phase**
   - Queue for transcription
   - Update status to "processing"
   - Monitor transcription job

4. **Completion Phase**
   - Mark as completed
   - Make transcript available
   - Update user quota usage

## Essential Patterns

### URL Validation Pattern
```typescript
function validateYouTubeURL(url: string): boolean {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/ // Just video ID
  ];
  return patterns.some(p => p.test(url));
}
```

### Progress Tracking Pattern
```typescript
// Frontend receives real-time updates
const uploadProgress = await useUploadProgress(videoId);
// Updates as: 0% → 25% → 50% → 75% → 100% → Processing
```

### Error Handling Pattern
```typescript
try {
  await uploadVideo(file);
  showSuccess("Upload complete!");
} catch (error) {
  if (error.code === "FILE_TOO_LARGE") {
    showError("File exceeds 5GB limit");
  } else if (error.code === "NETWORK_ERROR") {
    showRetryButton(); // Allow user to retry
  }
}
```

## What You'll Learn

In this skill, you'll understand:
- How to validate YouTube URLs safely
- How to handle large file uploads efficiently
- How to provide real-time progress feedback
- How to handle network interruptions
- How to integrate with the transcription pipeline
- How to manage upload states and transitions
- How to optimize for user experience

## Next Steps

1. **For Implementation**: See `guide.md` for complete patterns
2. **For Advanced Patterns**: See `patterns.md` for edge cases
3. **For Troubleshooting**: See `troubleshooting.md` for common issues
4. **For Code Examples**: See `examples/` directory
5. **For Related Workflows**: See `transcription-workflow/` skill
