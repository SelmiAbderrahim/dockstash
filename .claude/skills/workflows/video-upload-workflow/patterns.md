# Video Upload Workflow - Advanced Patterns

## Pattern 1: Multi-File Concurrent Uploads

### Challenge
Users want to upload multiple videos simultaneously without blocking the UI or overwhelming the server.

### Solution: Queue-Based Concurrent Upload Manager

```typescript
interface UploadQueue {
  queue: UploadTask[];
  maxConcurrent: number;
  activeCount: number;
  paused: boolean;
}

interface UploadTask {
  id: string;
  file: File;
  videoId: Id<"videos">;
  status: "pending" | "uploading" | "completed" | "failed";
  progress: number;
  error?: string;
  retryCount: number;
}

class ConcurrentUploadManager {
  private queue: UploadTask[] = [];
  private activeUploads = new Map<string, XMLHttpRequest>();
  private maxConcurrent = 3;

  async addToQueue(file: File, onProgress?: (task: UploadTask) => void): Promise<string> {
    const taskId = generateId();
    const videoId = await createVideoRecord(file);

    const task: UploadTask = {
      id: taskId,
      file,
      videoId,
      status: "pending",
      progress: 0,
      retryCount: 0
    };

    this.queue.push(task);
    this.processQueue(onProgress);

    return taskId;
  }

  private async processQueue(onProgress?: (task: UploadTask) => void) {
    while (this.activeUploads.size < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.find(t => t.status === "pending");
      if (!task) break;

      task.status = "uploading";
      onProgress?.(task);

      this.uploadTask(task, onProgress)
        .then(() => {
          task.status = "completed";
          this.activeUploads.delete(task.id);
          onProgress?.(task);
          this.processQueue(onProgress);
        })
        .catch((error) => {
          if (task.retryCount < 3) {
            task.retryCount++;
            task.status = "pending";
            // Exponential backoff before retry
            const delay = Math.pow(2, task.retryCount) * 1000;
            setTimeout(() => this.processQueue(onProgress), delay);
          } else {
            task.status = "failed";
            task.error = error.message;
            this.activeUploads.delete(task.id);
            onProgress?.(task);
            this.processQueue(onProgress);
          }
        });
    }
  }

  private async uploadTask(task: UploadTask, onProgress?: (task: UploadTask) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      this.activeUploads.set(task.id, xhr);

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          task.progress = Math.round((e.loaded / e.total) * 100);
          onProgress?.(task);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status === 200) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener("error", () => reject(new Error("Network error")));
      xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

      const formData = new FormData();
      formData.append("file", task.file);
      formData.append("videoId", task.videoId);

      xhr.open("POST", "/api/videos/upload");
      xhr.send(formData);
    });
  }

  pauseQueue() {
    this.queue.forEach(task => {
      if (task.status === "uploading") {
        this.activeUploads.get(task.id)?.abort();
        task.status = "pending";
      }
    });
  }

  resumeQueue(onProgress?: (task: UploadTask) => void) {
    this.processQueue(onProgress);
  }

  cancelTask(taskId: string) {
    const task = this.queue.find(t => t.id === taskId);
    if (task) {
      if (task.status === "uploading") {
        this.activeUploads.get(taskId)?.abort();
      }
      this.queue = this.queue.filter(t => t.id !== taskId);
    }
  }

  getQueueStatus() {
    return {
      total: this.queue.length,
      pending: this.queue.filter(t => t.status === "pending").length,
      uploading: this.queue.filter(t => t.status === "uploading").length,
      completed: this.queue.filter(t => t.status === "completed").length,
      failed: this.queue.filter(t => t.status === "failed").length
    };
  }
}
```

### Usage
```typescript
const uploadManager = new ConcurrentUploadManager();

// Add multiple files
for (const file of selectedFiles) {
  await uploadManager.addToQueue(file, (task) => {
    console.log(`${task.id}: ${task.progress}%`);
  });
}

// Monitor queue
const status = uploadManager.getQueueStatus();
console.log(`Uploading: ${status.uploading}, Pending: ${status.pending}`);

// Pause/Resume all uploads
uploadManager.pauseQueue();
uploadManager.resumeQueue();

// Cancel specific upload
uploadManager.cancelTask(taskId);
```

---

## Pattern 2: Resumable Upload (Chunked Upload)

### Challenge
Large files (5GB) may fail midway. Users should be able to resume from where they left off.

### Solution: Chunked Upload with Resume Capability

```typescript
interface UploadChunk {
  index: number;
  offset: number;
  size: number;
  hash: string;
  completed: boolean;
}

interface ResumableUpload {
  uploadId: string;
  videoId: Id<"videos">;
  fileName: string;
  fileSize: number;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: Set<number>;
  lastModified: number;
}

class ResumableUploadManager {
  private uploads = new Map<string, ResumableUpload>();
  private chunkSize = 5 * 1024 * 1024; // 5MB chunks

  async initiateUpload(file: File): Promise<string> {
    const uploadId = generateId();
    const totalChunks = Math.ceil(file.size / this.chunkSize);
    const videoId = await createVideoRecord(file);

    const upload: ResumableUpload = {
      uploadId,
      videoId,
      fileName: file.name,
      fileSize: file.size,
      chunkSize: this.chunkSize,
      totalChunks,
      uploadedChunks: new Set(),
      lastModified: file.lastModified
    };

    this.uploads.set(uploadId, upload);

    // Store in localStorage for persistence
    localStorage.setItem(`upload_${uploadId}`, JSON.stringify({
      ...upload,
      uploadedChunks: Array.from(upload.uploadedChunks)
    }));

    return uploadId;
  }

  async resumeUpload(uploadId: string, file: File, onProgress?: (progress: number) => void): Promise<void> {
    const upload = this.uploads.get(uploadId);
    if (!upload) throw new Error("Upload not found");

    // Verify file hasn't changed
    if (file.lastModified !== upload.lastModified || file.size !== upload.fileSize) {
      throw new Error("File has changed. Please restart upload.");
    }

    // Get list of already-uploaded chunks from server
    const response = await fetch(`/api/uploads/${uploadId}/status`);
    const { uploadedChunks } = await response.json();
    upload.uploadedChunks = new Set(uploadedChunks);

    // Upload remaining chunks
    for (let i = 0; i < upload.totalChunks; i++) {
      if (upload.uploadedChunks.has(i)) continue;

      const offset = i * this.chunkSize;
      const chunk = file.slice(offset, offset + this.chunkSize);
      const hash = await this.hashChunk(chunk);

      await this.uploadChunk(uploadId, i, chunk, hash);
      upload.uploadedChunks.add(i);

      const progress = (upload.uploadedChunks.size / upload.totalChunks) * 100;
      onProgress?.(progress);

      // Update localStorage
      localStorage.setItem(`upload_${uploadId}`, JSON.stringify({
        ...upload,
        uploadedChunks: Array.from(upload.uploadedChunks)
      }));
    }

    // Finalize upload
    await fetch(`/api/uploads/${uploadId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: upload.videoId })
    });

    this.uploads.delete(uploadId);
    localStorage.removeItem(`upload_${uploadId}`);
  }

  private async uploadChunk(uploadId: string, chunkIndex: number, chunk: Blob, hash: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.addEventListener("load", () => {
        if (xhr.status === 200) resolve();
        else reject(new Error(`Chunk upload failed: ${xhr.status}`));
      });

      xhr.addEventListener("error", () => reject(new Error("Network error")));

      const formData = new FormData();
      formData.append("uploadId", uploadId);
      formData.append("chunkIndex", chunkIndex.toString());
      formData.append("hash", hash);
      formData.append("chunk", chunk);

      xhr.open("POST", "/api/uploads/chunk");
      xhr.send(formData);
    });
  }

  private async hashChunk(chunk: Blob): Promise<string> {
    const buffer = await chunk.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  }

  async getUploadProgress(uploadId: string): Promise<number> {
    const upload = this.uploads.get(uploadId);
    if (!upload) throw new Error("Upload not found");
    return (upload.uploadedChunks.size / upload.totalChunks) * 100;
  }

  async cancelUpload(uploadId: string): Promise<void> {
    await fetch(`/api/uploads/${uploadId}`, { method: "DELETE" });
    this.uploads.delete(uploadId);
    localStorage.removeItem(`upload_${uploadId}`);
  }
}
```

### Usage
```typescript
const resumableManager = new ResumableUploadManager();

// Start upload
const uploadId = await resumableManager.initiateUpload(file);

// If interrupted, resume later
const savedUpload = localStorage.getItem(`upload_${uploadId}`);
if (savedUpload) {
  await resumableManager.resumeUpload(uploadId, file, (progress) => {
    console.log(`Upload progress: ${progress}%`);
  });
}
```

---

## Pattern 3: Optimistic UI Updates

### Challenge
Users see "uploading..." but don't know if the backend will accept the video. Provide immediate feedback.

### Solution: Optimistic Status Updates with Rollback

```typescript
export const useOptimisticUpload = (videoId: Id<"videos">) => {
  const [optimisticStatus, setOptimisticStatus] = useState<"uploading" | "processing" | null>(null);
  const actualVideo = useQuery(api.videos.getVideo, { videoId });

  // Show optimistic status while actual updates in background
  const status = optimisticStatus || actualVideo?.status || "pending";

  const handleUploadStart = useCallback(async (file: File) => {
    // Immediately show "uploading" in UI
    setOptimisticStatus("uploading");

    try {
      // Upload file
      await uploadVideoFile(file, videoId, (progress) => {
        // Update backend
        await updateUploadProgress({
          videoId,
          progress: progress.percent,
          status: "uploading"
        });
      });

      // Once upload completes, show "processing"
      setOptimisticStatus("processing");

      // Call backend to start transcription
      await startTranscription({ videoId });

      // Clear optimistic state - let actual state take over
      setOptimisticStatus(null);
    } catch (error) {
      // Rollback on error
      setOptimisticStatus(null);
      throw error;
    }
  }, [videoId]);

  return { status, handleUploadStart };
};
```

---

## Pattern 4: Bandwidth-Aware Upload Speed

### Challenge
Optimize upload speed based on available bandwidth. Adjust chunk size dynamically.

### Solution: Adaptive Chunk Sizing

```typescript
class AdaptiveUploadManager {
  private bandwidthSamples: number[] = [];
  private chunkSize = 1024 * 1024; // Start with 1MB
  private minChunkSize = 256 * 1024; // 256KB minimum
  private maxChunkSize = 10 * 1024 * 1024; // 10MB maximum
  private sampleWindow = 5; // Samples to maintain

  async uploadWithAdaptiveSpeed(
    file: File,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<void> {
    let totalUploaded = 0;
    const startTime = Date.now();

    while (totalUploaded < file.size) {
      const chunkStart = totalUploaded;
      const chunkEnd = Math.min(totalUploaded + this.chunkSize, file.size);
      const chunk = file.slice(chunkStart, chunkEnd);

      const chunkStartTime = Date.now();

      try {
        await this.uploadChunk(chunk, chunkStart, chunkEnd);
      } catch (error) {
        // On error, reduce chunk size for better reliability
        this.chunkSize = Math.max(this.minChunkSize, this.chunkSize / 2);
        throw error;
      }

      const chunkTime = (Date.now() - chunkStartTime) / 1000; // seconds
      const chunkSize = chunkEnd - chunkStart;
      const bandwidth = chunkSize / chunkTime; // bytes/second

      this.bandwidthSamples.push(bandwidth);
      if (this.bandwidthSamples.length > this.sampleWindow) {
        this.bandwidthSamples.shift();
      }

      // Adjust chunk size based on average bandwidth
      const avgBandwidth = this.bandwidthSamples.reduce((a, b) => a + b, 0) / this.bandwidthSamples.length;
      const targetChunkTime = 2000; // Aim for 2-second chunks
      const newChunkSize = Math.round(avgBandwidth * (targetChunkTime / 1000));

      this.chunkSize = Math.max(
        this.minChunkSize,
        Math.min(this.maxChunkSize, newChunkSize)
      );

      totalUploaded = chunkEnd;

      onProgress?.({
        loaded: totalUploaded,
        total: file.size,
        percent: Math.round((totalUploaded / file.size) * 100),
        uploadSpeed: avgBandwidth,
        estimatedTimeRemaining: (file.size - totalUploaded) / avgBandwidth
      });
    }
  }

  private async uploadChunk(chunk: Blob, start: number, end: number): Promise<void> {
    const formData = new FormData();
    formData.append("chunk", chunk);
    formData.append("start", start.toString());
    formData.append("end", end.toString());

    const response = await fetch("/api/videos/upload-chunk", {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Chunk upload failed: ${response.statusText}`);
    }
  }
}
```

---

## Pattern 5: Browser-Specific Compatibility

### Challenge
Different browsers handle file uploads differently. Ensure consistent behavior.

### Solution: Browser Detection and Fallback Strategies

```typescript
class BrowserCompatibleUploadManager {
  static detectBrowser(): "chrome" | "firefox" | "safari" | "edge" | "unknown" {
    const ua = navigator.userAgent;
    if (ua.includes("Edg/")) return "edge";
    if (ua.includes("Chrome/")) return "chrome";
    if (ua.includes("Firefox/")) return "firefox";
    if (ua.includes("Safari/") && !ua.includes("Chrome/")) return "safari";
    return "unknown";
  }

  static supportsFormData(): boolean {
    return typeof FormData !== "undefined";
  }

  static supportsXHR(): boolean {
    return typeof XMLHttpRequest !== "undefined" && "upload" in new XMLHttpRequest();
  }

  static supportsFetch(): boolean {
    return typeof fetch !== "undefined";
  }

  static shouldUseChunkedUpload(): boolean {
    // Safari has issues with large file uploads
    if (this.detectBrowser() === "safari") return true;
    // Mobile browsers should use chunked uploads
    if (/mobile|android|iphone/i.test(navigator.userAgent)) return true;
    return false;
  }

  async upload(
    file: File,
    videoId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<void> {
    const browser = BrowserCompatibleUploadManager.detectBrowser();
    const shouldChunk = BrowserCompatibleUploadManager.shouldUseChunkedUpload();

    if (shouldChunk) {
      // Use chunked upload for better compatibility
      return this.chunkedUpload(file, videoId, onProgress);
    }

    if (this.supportsXHR() && this.supportsFormData()) {
      // Standard approach for modern browsers
      return this.xhrUpload(file, videoId, onProgress);
    }

    if (this.supportsFetch()) {
      // Fallback to Fetch API
      return this.fetchUpload(file, videoId, onProgress);
    }

    throw new Error("Browser does not support file uploads");
  }

  private async xhrUpload(
    file: File,
    videoId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const startTime = Date.now();

      // Timeout handling
      const timeout = setTimeout(() => {
        xhr.abort();
        reject(new Error("Upload timeout (5 minutes exceeded)"));
      }, 5 * 60 * 1000);

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = e.loaded / elapsed;

          onProgress?.({
            loaded: e.loaded,
            total: e.total,
            percent: Math.round((e.loaded / e.total) * 100),
            uploadSpeed: speed,
            estimatedTimeRemaining: (e.total - e.loaded) / speed
          });
        }
      });

      xhr.addEventListener("load", () => {
        clearTimeout(timeout);
        if (xhr.status === 200) {
          resolve();
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      });

      xhr.addEventListener("error", () => {
        clearTimeout(timeout);
        reject(new Error("Network error"));
      });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("videoId", videoId);

      xhr.open("POST", "/api/videos/upload");
      xhr.send(formData);
    });
  }

  private async chunkedUpload(
    file: File,
    videoId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<void> {
    // Implementation using chunked upload pattern above
    const manager = new AdaptiveUploadManager();
    await manager.uploadWithAdaptiveSpeed(file, onProgress);
  }

  private async fetchUpload(
    file: File,
    videoId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<void> {
    const reader = new FileReader();
    const chunks: Uint8Array[] = [];

    return new Promise((resolve, reject) => {
      reader.addEventListener("load", async () => {
        try {
          const response = await fetch("/api/videos/upload", {
            method: "POST",
            body: file
          });

          if (response.ok) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${response.statusText}`));
          }
        } catch (error) {
          reject(error);
        }
      });

      reader.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          onProgress?.({
            loaded: e.loaded,
            total: e.total,
            percent: Math.round((e.loaded / e.total) * 100),
            uploadSpeed: 0,
            estimatedTimeRemaining: 0
          });
        }
      });

      reader.addEventListener("error", () => {
        reject(new Error("File read error"));
      });

      reader.readAsArrayBuffer(file);
    });
  }
}
```

---

## Pattern 6: Caching Upload History

### Challenge
Users should see their recent uploads and resume failed ones.

### Solution: Local Cache with IndexedDB

```typescript
class UploadHistoryManager {
  private dbName = "videoUploadDB";
  private storeName = "uploads";
  private db: IDBDatabase | null = null;

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        db.createObjectStore(this.storeName, { keyPath: "id" });
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
    });
  }

  async saveUpload(upload: {
    id: string;
    fileName: string;
    fileSize: number;
    uploadId: string;
    videoId: Id<"videos">;
    status: "pending" | "completed" | "failed";
    progress: number;
    timestamp: number;
  }): Promise<void> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.put(upload);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getRecentUploads(limit: number = 10): Promise<any[]> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const uploads = (request.result as any[]).sort((a, b) => b.timestamp - a.timestamp);
        resolve(uploads.slice(0, limit));
      };
    });
  }

  async getFailedUploads(): Promise<any[]> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const uploads = (request.result as any[]).filter(u => u.status === "failed");
        resolve(uploads);
      };
    });
  }

  async deleteUpload(uploadId: string): Promise<void> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(uploadId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}
```

---

## Summary of Advanced Patterns

| Pattern | Problem Solved | Use Case |
|---------|----------------|----------|
| **Concurrent Upload Manager** | Upload multiple files without blocking | Batch uploads, user uploads many videos |
| **Resumable Upload** | Resume interrupted large file uploads | 5GB files, unreliable connections |
| **Optimistic UI Updates** | Show feedback before server confirms | Real-time user experience |
| **Adaptive Speed Control** | Optimize for available bandwidth | Slow/fast networks, mobile devices |
| **Browser Compatibility** | Handle browser-specific issues | Cross-browser support (Safari, mobile) |
| **Upload History Cache** | Persist upload state locally | Resume failed uploads, recent uploads list |
