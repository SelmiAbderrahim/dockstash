# Video Upload Workflow - Troubleshooting Guide

## Issue 1: Upload Progress Stops at 100% but Never Completes

### Symptoms
- Progress bar reaches 100%
- Upload appears frozen
- No error message displayed
- Video remains in "uploading" status after several minutes

### Root Causes

**1. Backend Processing Delay**
- Backend transcoding takes longer than expected
- Server overloaded, slow processing
- Large file (>2GB) causing bottleneck

**2. Network Timeout**
- Server not responding after upload complete
- Connection drops after file transferred
- Proxy/CDN timeout on response

**3. Missing Completion Handler**
- Frontend doesn't call completion endpoint
- Status not updated in database
- Progress subscription not receiving final update

### Debugging Steps

```typescript
// Step 1: Check browser console for errors
console.log("Upload event timeline:", {
  uploadStarted: uploadStartTime,
  uploadCompleted: Date.now(),
  duration: Date.now() - uploadStartTime
});

// Step 2: Monitor network requests in DevTools
// Look for:
// - POST /api/videos/upload (file upload)
// - PATCH /api/videos/{id}/complete (completion)
// - Any 5xx errors or timeouts

// Step 3: Check server logs
docker logs ireadyoutube-convex-backend | grep "upload\|process"

// Step 4: Verify video record in database
// Query videos table - check status field
make client CMD="npx convex run -A convex/queries/getVideo --args '{\"videoId\": \"...\"}'"
```

### Solutions

**Short-term Fix:**
```typescript
// Add explicit timeout with user feedback
const uploadWithTimeout = async (file: File, timeout = 30000) => {
  const uploadPromise = uploadVideoFile(file);
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Upload timeout")), timeout)
  );

  try {
    await Promise.race([uploadPromise, timeoutPromise]);
  } catch (error) {
    if (error.message === "Upload timeout") {
      // Show user: "Upload complete but processing. Check status later."
      showToast("Upload processing. This may take a few minutes.");
      return { success: true, processing: true };
    }
    throw error;
  }
};
```

**Permanent Fix:**
```typescript
// 1. Increase server timeout for large files
// docker-compose.yml:
environment:
  - UPLOAD_TIMEOUT_MS=300000 # 5 minutes for 5GB files

// 2. Implement proper status polling instead of waiting
export const pollUploadStatus = async (videoId: Id<"videos">, maxAttempts = 60) => {
  let attempts = 0;
  const pollInterval = 1000; // 1 second

  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      attempts++;

      try {
        const video = await getVideoStatus(videoId);

        if (video.status === "processing") {
          showToast(`Processing video... (${video.progress}%)`);
        }

        if (video.status === "completed") {
          clearInterval(interval);
          resolve(video);
        }

        if (video.status === "failed") {
          clearInterval(interval);
          reject(new Error(video.error || "Upload failed"));
        }

        if (attempts > maxAttempts) {
          clearInterval(interval);
          reject(new Error("Status check timeout"));
        }
      } catch (error) {
        clearInterval(interval);
        reject(error);
      }
    }, pollInterval);
  });
};
```

---

## Issue 2: "File Type Not Supported" for Valid Video Files

### Symptoms
- User uploads .mp4 file
- Error: "File type video/unknown not supported"
- Same file works on another browser
- Works on desktop but not mobile

### Root Causes

**1. MIME Type Detection Fails**
- Browser doesn't recognize file's MIME type
- File extension doesn't match actual format
- Server misconfigured for MIME type detection

**2. Browser-Specific Issues**
- Safari reports different MIME type than Chrome
- Mobile browser doesn't expose MIME type
- Proxy/CDN strips MIME type header

**3. Misconfigured Validation**
- Validation too strict (exact MIME match instead of pattern)
- File extension check before MIME check
- Not handling video/* wildcard

### Debugging Steps

```typescript
// Step 1: Inspect file MIME type
const file = event.target.files[0];
console.log({
  name: file.name,
  type: file.type,
  size: file.size,
  lastModified: new Date(file.lastModified)
});

// Step 2: Test with different formats
const mimeTypes = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
  "application/octet-stream" // Fallback for unrecognized
];

// Step 3: Check magic bytes (file signature)
const buffer = await file.slice(0, 12).arrayBuffer();
const view = new Uint8Array(buffer);
const signature = Array.from(view).map(x => x.toString(16)).join(" ");
console.log("File signature:", signature);

// MP4 signatures: ... 66 74 79 70 (ftyp)
// MOV signatures: ... 6D 6F 6F 76 (moov)
// WebM signatures: 1A 45 DF A3
```

### Solutions

**Short-term Fix:**
```typescript
// Accept files by extension if MIME type fails
const validateVideoFile = (file: File) => {
  const allowedMimes = [
    "video/mp4",
    "video/quicktime",
    "video/x-msvideo",
    "video/webm",
    "application/octet-stream"
  ];

  const allowedExtensions = [".mp4", ".mov", ".avi", ".webm", ".mkv"];

  // Check MIME type
  if (allowedMimes.includes(file.type)) {
    return { valid: true };
  }

  // Fallback: check extension
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  if (allowedExtensions.includes(ext)) {
    return { valid: true };
  }

  return {
    valid: false,
    error: "Unsupported file type. Supported: MP4, MOV, AVI, WebM, MKV"
  };
};
```

**Permanent Fix:**
```typescript
// Implement magic byte detection for reliable format detection
const detectVideoFormat = async (file: File): Promise<string> => {
  const buffer = await file.slice(0, 12).arrayBuffer();
  const view = new Uint8Array(buffer);
  const signature = Array.from(view).slice(4, 8).map(x => String.fromCharCode(x)).join("");

  // MP4: ftyp signature
  if (signature === "ftyp") return "video/mp4";

  // MOV: moov signature (check wider range for QuickTime)
  if (view[4] === 0x6d && view[5] === 0x6f && view[6] === 0x6f && view[7] === 0x76) {
    return "video/quicktime";
  }

  // WebM: 1A 45 DF A3
  if (view[0] === 0x1a && view[1] === 0x45 && view[2] === 0xdf && view[3] === 0xa3) {
    return "video/webm";
  }

  // AVI: RIFF signature
  if (view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46) {
    if (view[8] === 0x41 && view[9] === 0x56 && view[10] === 0x49) {
      return "video/x-msvideo";
    }
  }

  // Fallback to file extension
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  const extMap: Record<string, string> = {
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".webm": "video/webm",
    ".mkv": "video/x-matroska"
  };

  return extMap[ext] || "video/unknown";
};
```

---

## Issue 3: Upload Speed Very Slow (<100KB/s) on Fast Connection

### Symptoms
- Internet connection is 100+ Mbps
- Upload speed is <100KB/s (0.8 Mbps)
- Same file uploads fast to other services
- Browser throttled in DevTools even though not intentional

### Root Causes

**1. Browser Throttling**
- DevTools network throttling enabled
- Browser extension limiting bandwidth
- OS-level bandwidth limit active

**2. Small Chunk Size**
- Server configured with 256KB chunks (very small)
- Each chunk has HTTP overhead
- Too many round trips

**3. Network Issues**
- Proxy/firewall rate limiting
- ISP traffic shaping
- Congested network path to server

### Debugging Steps

```typescript
// Step 1: Check browser throttling
// Chrome DevTools → Network tab → check throttling dropdown

// Step 2: Calculate theoretical max speed
const fileSize = 1024 * 1024 * 100; // 100MB
const uploadTime = 1000 * 60 * 10; // 10 minutes
const theoreticalSpeed = fileSize / (uploadTime / 1000);
console.log("Theoretical max:", theoreticalSpeed / 1024 / 1024, "MB/s");

// Step 3: Measure actual bandwidth
let lastMeasure = { time: Date.now(), bytes: 0 };
xhr.upload.addEventListener("progress", (e) => {
  const now = Date.now();
  const timeDiff = (now - lastMeasure.time) / 1000; // seconds
  const bytesDiff = e.loaded - lastMeasure.bytes;
  const currentSpeed = bytesDiff / timeDiff;

  console.log("Current speed:", currentSpeed / 1024 / 1024, "MB/s");
  lastMeasure = { time: now, bytes: e.loaded };
});

// Step 4: Check for proxy/firewall issues
curl -v https://your-server.com/api/videos/upload
# Look for "Proxy-Connection" or other proxy headers
```

### Solutions

**Short-term Fix:**
```typescript
// Disable DevTools throttling
// Chrome DevTools → Network tab → Throttling = "No throttling"

// Disable browser extensions
// Use Incognito/Private mode to test
```

**Permanent Fix:**
```typescript
// Increase chunk size based on available bandwidth
class BandwidthOptimizedUpload {
  private estimateInitialChunkSize(): number {
    // Test with 1MB chunk
    return 1024 * 1024;
  }

  async uploadWithOptimization(file: File, onProgress?: Function) {
    let chunkSize = this.estimateInitialChunkSize();
    let lastSpeed = 0;
    let consecutiveSlow = 0;

    for (let offset = 0; offset < file.size; offset += chunkSize) {
      const chunk = file.slice(offset, offset + chunkSize);
      const startTime = Date.now();

      await this.uploadChunk(chunk);

      const duration = (Date.now() - startTime) / 1000;
      const speed = chunk.size / duration;

      // If speed is consistently slow, reduce chunk size
      if (speed < lastSpeed * 0.7) {
        consecutiveSlow++;
        if (consecutiveSlow > 2) {
          chunkSize = Math.max(256 * 1024, chunkSize / 2);
          consecutiveSlow = 0;
        }
      } else {
        // If speed is good, increase chunk size
        consecutiveSlow = 0;
        if (speed > lastSpeed * 1.2) {
          chunkSize = Math.min(10 * 1024 * 1024, chunkSize * 1.5);
        }
      }

      lastSpeed = speed;

      onProgress?.({
        speed: speed / 1024 / 1024, // MB/s
        percentComplete: Math.round((offset / file.size) * 100)
      });
    }
  }
}
```

---

## Issue 4: "CORS Error" When Uploading from Different Domain

### Symptoms
- Error: "Access to XMLHttpRequest has been blocked by CORS policy"
- Request origin: https://app.example.com
- Request to: https://api.example.com
- Works in Postman, not in browser

### Root Causes

**1. CORS Headers Missing**
- Server doesn't return `Access-Control-Allow-Origin` header
- Server doesn't allow preflight OPTIONS request
- Server only allows same-origin requests

**2. CORS Configuration Incomplete**
- CORS allows GET but not POST/PUT
- CORS doesn't include `Content-Type` in allowed headers
- CORS missing `Access-Control-Allow-Credentials`

**3. Preflight Request Rejected**
- Browser sends OPTIONS request before POST
- Server doesn't handle OPTIONS
- Proxy strips CORS headers

### Debugging Steps

```typescript
// Step 1: Check CORS headers in response
// Chrome DevTools → Network → Click upload request → Headers
// Look for: Access-Control-Allow-Origin, Access-Control-Allow-Methods

// Step 2: Check preflight request
// DevTools shows OPTIONS request before POST
// Preflight should return:
// - Access-Control-Allow-Origin: https://app.example.com
// - Access-Control-Allow-Methods: POST, OPTIONS
// - Access-Control-Allow-Headers: Content-Type, X-Requested-With

// Step 3: Test with curl (no CORS restrictions)
curl -X POST https://api.example.com/upload \
  -F "file=@video.mp4" \
  -v

// Step 4: Use browser console to verify
fetch('https://api.example.com/upload', {
  method: 'POST',
  body: formData
}).catch(e => console.error('CORS Error:', e));
```

### Solutions

**Short-term Fix (for development only):**
```typescript
// Use CORS proxy (development only)
const CORS_PROXY = "https://cors-anywhere.herokuapp.com/";
const uploadUrl = CORS_PROXY + "https://api.example.com/upload";

// NOT RECOMMENDED for production - security risk!
```

**Permanent Fix:**
```typescript
// Express/Node.js backend - configure CORS properly
import cors from "cors";

app.use(cors({
  origin: [
    "https://app.example.com",
    "https://app-staging.example.com",
    "http://localhost:3000"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-Requested-With", "Authorization"],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

// Handle preflight
app.options("/api/videos/upload", cors());

// Convex - configure in convex.json
{
  "functions": {
    "httpApi": {
      "corsPolicy": {
        "allowedOrigins": ["https://app.example.com"],
        "allowedMethods": ["GET", "POST", "PUT", "DELETE"],
        "allowedHeaders": ["Content-Type", "Authorization"],
        "allowCredentials": true
      }
    }
  }
}
```

---

## Issue 5: YouTube URL Validation Accepts Invalid URLs

### Symptoms
- URL passes validation: `https://youtube.com/invalid`
- Later fails during transcription: "Video not found"
- Regex pattern too permissive
- User gets confusing error after upload

### Root Causes

**1. Incomplete Regex Pattern**
- Pattern only checks domain, not video ID format
- Pattern allows URLs without video IDs
- Doesn't validate YouTube video ID structure (11 chars)

**2. No Server-Side Verification**
- Validation only on client
- User can bypass with direct API call
- Server doesn't verify video exists on YouTube

**3. URL Format Variations**
- Short URLs (youtu.be) vs full URLs
- URLs with timestamps or playlists
- Mobile URLs (m.youtube.com)

### Debugging Steps

```typescript
// Step 1: Test URL validation
const testUrls = [
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ", // ✅ Valid
  "https://youtu.be/dQw4w9WgXcQ", // ✅ Valid
  "https://youtube.com/watch", // ❌ Invalid - no video ID
  "https://youtube.com/watch?v=short", // ❌ Invalid - ID too short
  "https://youtube.com/watch?v=dQw4w9WgXcQ&t=10s", // Should be valid with timestamp
];

testUrls.forEach(url => {
  const valid = validateYouTubeURL(url);
  console.log(url, "=>", valid);
});

// Step 2: Extract video ID
const videoId = extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
console.log("Video ID:", videoId); // Should be: dQw4w9WgXcQ
```

### Solutions

**Short-term Fix:**
```typescript
const YOUTUBE_VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

export function validateYouTubeURL(url: string): boolean {
  const patterns = [
    /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /^(https?:\/\/)?(www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];

  let videoId: string | null = null;

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      videoId = match[3] || match[1];
      break;
    }
  }

  // Validate video ID format
  return videoId ? YOUTUBE_VIDEO_ID_REGEX.test(videoId) : false;
}

export function extractYouTubeVideoId(url: string): string {
  const patterns = [
    /v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  throw new Error("Invalid YouTube URL");
}
```

**Permanent Fix (Server-Side Verification):**
```typescript
export const validateYouTubeURL = action({
  handler: async (ctx, args: { url: string }) => {
    // 1. Client-side validation
    const videoId = extractYouTubeVideoId(args.url);

    // 2. Server-side YouTube API check
    const response = await fetch(
      `https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${videoId}&format=json`
    );

    if (!response.ok) {
      throw new ConvexError({
        code: "YOUTUBE_NOT_FOUND",
        message: "Video not found on YouTube"
      });
    }

    const metadata = await response.json();
    return {
      valid: true,
      videoId,
      title: metadata.title,
      thumbnail: metadata.thumbnail_url
    };
  }
});
```

---

## Issue 6: Video Remains "Uploading" After Browser Closes

### Symptoms
- User closes browser during upload
- Reopens browser
- Video stuck in "uploading" status
- Can't resume or cancel
- Takes up storage space

### Root Causes

**1. No Session Persistence**
- Upload state not saved to database
- Browser closes, upload lost
- No way to recover upload ID

**2. No Cleanup Process**
- Orphaned uploads not cleaned up
- Server keeps marking as "uploading" forever
- No timeout to mark as failed

**3. No Resume Mechanism**
- Frontend has no way to find interrupted upload
- Upload ID not persisted in localStorage
- Can't resume from checkpoint

### Debugging Steps

```typescript
// Step 1: Check if upload was saved
const savedUploads = localStorage.getItem("pending_uploads");
console.log("Saved uploads:", JSON.parse(savedUploads || "[]"));

// Step 2: Check database
make client CMD="npx convex run -A convex/queries/getVideos --args '{\"status\": \"uploading\"}'"

// Step 3: Check if upload is >1 hour old (should be failed)
const video = await getVideo(videoId);
const age = Date.now() - video.createdAt;
console.log("Upload age:", age / 1000 / 60, "minutes");
```

### Solutions

**Short-term Fix:**
```typescript
// Save upload state to localStorage
export const useUploadPersistence = (videoId: Id<"videos">) => {
  const saveUploadState = (state: UploadState) => {
    const uploads = JSON.parse(localStorage.getItem("pending_uploads") || "[]");
    const updated = [
      ...uploads.filter((u: any) => u.videoId !== videoId),
      { videoId, ...state, timestamp: Date.now() }
    ];
    localStorage.setItem("pending_uploads", JSON.stringify(updated));
  };

  const removeUploadState = () => {
    const uploads = JSON.parse(localStorage.getItem("pending_uploads") || "[]");
    const filtered = uploads.filter((u: any) => u.videoId !== videoId);
    localStorage.setItem("pending_uploads", JSON.stringify(filtered));
  };

  // Check for interrupted uploads on app load
  useEffect(() => {
    const uploads = JSON.parse(localStorage.getItem("pending_uploads") || "[]");
    uploads.forEach((upload: any) => {
      const age = Date.now() - upload.timestamp;
      const thirtyMinutes = 30 * 60 * 1000;

      if (age > thirtyMinutes) {
        // Likely abandoned - mark as failed
        markUploadFailed(upload.videoId, "Upload interrupted");
        removeUploadState();
      } else {
        // Offer to resume
        showNotification(`Resume upload: ${upload.fileName}?`);
      }
    });
  }, []);

  return { saveUploadState, removeUploadState };
};
```

**Permanent Fix:**
```typescript
// Server-side cleanup with timeout
export const cleanupStaledUploads = action({
  handler: async (ctx) => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    const staledUploads = await ctx.db
      .query("videos")
      .filter(v => v.eq(v.field("status"), "uploading"))
      .filter(v => v.lt(v.field("createdAt"), oneHourAgo))
      .collect();

    for (const upload of staledUploads) {
      await ctx.db.patch(upload._id, {
        status: "failed",
        error: "Upload timed out - please try again"
      });
    }

    return { cleaned: staledUploads.length };
  }
});

// Run this cleanup daily
export const scheduleCleanup = async () => {
  // In your deployment/scheduling service:
  setInterval(async () => {
    await cleanupStaledUploads();
  }, 24 * 60 * 60 * 1000); // Every 24 hours
};
```

---

## Validation Checklist for Upload Troubleshooting

- ✅ Upload progress reaches 100% and completes
- ✅ File type validation works for all supported formats
- ✅ Upload speed reasonable (>1MB/s on fast connections)
- ✅ CORS headers properly configured
- ✅ YouTube URLs validated server-side
- ✅ Interrupted uploads handled gracefully
- ✅ Clear error messages for all failure scenarios
- ✅ Retry mechanism for transient failures
- ✅ Timeout handling for stalled uploads
- ✅ Progress updates from 0% to 100% continuously
