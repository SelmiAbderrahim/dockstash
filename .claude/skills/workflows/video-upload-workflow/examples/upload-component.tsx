import React, { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle, Upload, Play } from "lucide-react";

// Constants
const ALLOWED_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm"
];

const ALLOWED_EXTENSIONS = [".mp4", ".mov", ".webm", ".avi", ".mkv"];
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB

// Types
interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
  estimatedTimeRemaining: number;
  uploadSpeed: number;
}

interface UploadState {
  videoId?: Id<"videos">;
  status: "idle" | "uploading" | "processing" | "completed" | "error";
  progress: UploadProgress | null;
  error?: string;
  fileName?: string;
}

interface VideoMetadata {
  videoId: string;
  title: string;
  duration: number;
  thumbnail: string;
}

/**
 * UploadVideoComponent
 *
 * Complete video upload component supporting:
 * - YouTube URL input with validation
 * - File upload with progress tracking
 * - Real-time status updates
 * - Error handling with user feedback
 * - Shadcn/ui design system
 * - TypeScript strict mode
 *
 * @example
 * <UploadVideoComponent />
 */
export const UploadVideoComponent: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>({
    status: "idle",
    progress: null
  });
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeMetadata, setYoutubeMetadata] = useState<VideoMetadata | null>(null);

  // Convex mutations
  const uploadVideoFromYouTube = useMutation(api.videos.uploadVideoFromYouTube);
  const createVideoRecord = useMutation(api.videos.createVideoRecord);
  const updateUploadProgress = useMutation(api.videos.updateUploadProgress);

  // Validation functions
  const extractYouTubeVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const validateVideoFile = (file: File): { valid: boolean; error?: string } => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      const maxSizeGB = Math.round(MAX_FILE_SIZE / 1024 / 1024 / 1024);
      return {
        valid: false,
        error: `File exceeds ${maxSizeGB}GB limit (your file: ${(file.size / 1024 / 1024 / 1024).toFixed(2)}GB)`
      };
    }

    // Check MIME type
    if (ALLOWED_MIME_TYPES.includes(file.type)) {
      return { valid: true };
    }

    // Fallback to extension check
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      return { valid: true };
    }

    return {
      valid: false,
      error: `Unsupported file type (${file.type || ext}). Supported: MP4, MOV, AVI, WebM, MKV`
    };
  };

  const validateYouTubeUrl = (url: string): { valid: boolean; error?: string } => {
    if (!url.trim()) {
      return { valid: false, error: "Please enter a URL" };
    }

    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      return {
        valid: false,
        error: "Invalid YouTube URL. Supported formats:\n- https://www.youtube.com/watch?v=VIDEO_ID\n- https://youtu.be/VIDEO_ID\n- VIDEO_ID"
      };
    }

    return { valid: true };
  };

  // Calculate time remaining
  const formatTimeRemaining = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`;
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    return `${(bytesPerSecond / 1024 / 1024).toFixed(2)}MB/s`;
  };

  // Handle YouTube upload
  const handleYouTubeUpload = useCallback(async () => {
    const validation = validateYouTubeUrl(youtubeUrl);
    if (!validation.valid) {
      setUploadState({
        status: "error",
        progress: null,
        error: validation.error
      });
      return;
    }

    setUploadState({
      status: "uploading",
      progress: null
    });

    try {
      const videoId = extractYouTubeVideoId(youtubeUrl)!;
      const result = await uploadVideoFromYouTube({
        url: youtubeUrl,
        title: youtubeMetadata?.title || "Untitled"
      });

      setUploadState({
        status: "processing",
        videoId: result.videoId,
        progress: { loaded: 0, total: 100, percent: 100, estimatedTimeRemaining: 0, uploadSpeed: 0 }
      });

      // Reset form
      setYoutubeUrl("");
      setYoutubeMetadata(null);

      // Redirect after a delay
      setTimeout(() => {
        window.location.href = `/videos/${result.videoId}`;
      }, 2000);
    } catch (error) {
      setUploadState({
        status: "error",
        progress: null,
        error: error instanceof Error ? error.message : "Upload failed"
      });
    }
  }, [youtubeUrl, youtubeMetadata, uploadVideoFromYouTube]);

  // Handle file upload
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    const validation = validateVideoFile(file);
    if (!validation.valid) {
      setUploadState({
        status: "error",
        progress: null,
        error: validation.error
      });
      return;
    }

    setUploadState({
      status: "uploading",
      progress: { loaded: 0, total: file.size, percent: 0, estimatedTimeRemaining: 0, uploadSpeed: 0 },
      fileName: file.name
    });

    try {
      // Create video record
      const videoRecord = await createVideoRecord({
        title: file.name.replace(/\.[^/.]+$/, ""),
        sourceType: "file_upload"
      });

      // Upload file with progress tracking
      const startTime = Date.now();
      let lastUpdateTime = startTime;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", async (e) => {
          if (!e.lengthComputable) return;

          const now = Date.now();
          const elapsed = (now - startTime) / 1000; // seconds
          const speed = e.loaded / elapsed;
          const estimatedTimeRemaining = (e.total - e.loaded) / speed;

          // Update UI every 500ms to avoid too many re-renders
          if (now - lastUpdateTime > 500) {
            setUploadState((prev) => ({
              ...prev,
              progress: {
                loaded: e.loaded,
                total: e.total,
                percent: Math.round((e.loaded / e.total) * 100),
                estimatedTimeRemaining,
                uploadSpeed: speed
              }
            }));
            lastUpdateTime = now;
          }

          // Also update backend
          if (now - (lastUpdateTime - 500) > 2000) {
            // Update every 2 seconds
            await updateUploadProgress({
              videoId: videoRecord._id,
              progress: Math.round((e.loaded / e.total) * 100),
              status: "uploading"
            }).catch(() => {
              // Silent fail - don't interrupt upload
            });
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status === 200) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("Network error during upload"));
        });

        xhr.addEventListener("abort", () => {
          reject(new Error("Upload cancelled"));
        });

        const formData = new FormData();
        formData.append("file", file);
        formData.append("videoId", videoRecord._id);

        xhr.open("POST", "/api/videos/upload");
        xhr.send(formData);
      });

      // Upload complete, now processing
      setUploadState((prev) => ({
        ...prev,
        status: "processing",
        progress: { ...prev.progress!, percent: 100 }
      }));

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // Redirect after 2 seconds
      setTimeout(() => {
        window.location.href = `/videos/${videoRecord._id}`;
      }, 2000);
    } catch (error) {
      setUploadState({
        status: "error",
        progress: null,
        error: error instanceof Error ? error.message : "Upload failed"
      });
    }
  }, [createVideoRecord, updateUploadProgress]);

  // Render progress section
  const renderProgress = () => {
    if (!uploadState.progress) return null;

    return (
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
        <CardContent className="pt-6">
          <div className="space-y-4">
            {uploadState.status === "uploading" && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Uploading... {uploadState.progress.percent}%
                  </span>
                  <span className="text-xs text-blue-700 dark:text-blue-300">
                    {formatFileSize(uploadState.progress.loaded)} / {formatFileSize(uploadState.progress.total)}
                  </span>
                </div>

                <Progress value={uploadState.progress.percent} className="h-2" />

                <div className="grid grid-cols-2 gap-4 text-xs text-blue-700 dark:text-blue-300">
                  <div>
                    <p className="font-semibold">Speed</p>
                    <p>{formatSpeed(uploadState.progress.uploadSpeed)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">Time Remaining</p>
                    <p>{formatTimeRemaining(uploadState.progress.estimatedTimeRemaining)}</p>
                  </div>
                </div>
              </>
            )}

            {uploadState.status === "processing" && (
              <div className="flex items-center justify-center space-x-2 py-4">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Processing your video...
                </span>
              </div>
            )}

            {uploadState.status === "completed" && (
              <div className="flex items-center space-x-2 text-green-700 dark:text-green-300">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm font-medium">Upload completed successfully!</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Render error section
  const renderError = () => {
    if (uploadState.status !== "error" || !uploadState.error) return null;

    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="whitespace-pre-wrap">{uploadState.error}</AlertDescription>
      </Alert>
    );
  };

  return (
    <div className="w-full max-w-2xl">
      {renderError()}

      {uploadState.status !== "uploading" && uploadState.status !== "processing" && (
        <Tabs defaultValue="url" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="url">YouTube URL</TabsTrigger>
            <TabsTrigger value="file">Upload File</TabsTrigger>
          </TabsList>

          {/* YouTube URL Tab */}
          <TabsContent value="url" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Play className="h-5 w-5" />
                  <span>Upload from YouTube</span>
                </CardTitle>
                <CardDescription>
                  Enter a YouTube video URL to transcribe it
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="youtube-url" className="text-sm font-medium">
                    YouTube URL
                  </label>
                  <Input
                    id="youtube-url"
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    disabled={uploadState.status !== "idle"}
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste a YouTube video URL or just the video ID
                  </p>
                </div>

                <Button
                  onClick={handleYouTubeUpload}
                  disabled={uploadState.status !== "idle" || !youtubeUrl}
                  className="w-full"
                >
                  Upload from YouTube
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* File Upload Tab */}
          <TabsContent value="file" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Upload className="h-5 w-5" />
                  <span>Upload Video File</span>
                </CardTitle>
                <CardDescription>
                  Choose a video file from your computer
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="file-input" className="text-sm font-medium">
                    Video File
                  </label>
                  <div
                    className={cn(
                      "flex items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors",
                      uploadState.status === "idle"
                        ? "border-muted-foreground bg-muted/50 hover:border-foreground hover:bg-muted"
                        : "border-muted bg-muted"
                    )}
                  >
                    <Input
                      ref={fileInputRef}
                      id="file-input"
                      type="file"
                      accept="video/*"
                      onChange={handleFileUpload}
                      disabled={uploadState.status !== "idle"}
                      className="hidden"
                    />
                    <label htmlFor="file-input" className="cursor-pointer text-center">
                      <p className="text-sm font-medium">
                        Click to select or drag and drop
                      </p>
                      <p className="text-xs text-muted-foreground">
                        MP4, MOV, AVI, WebM • Max 5GB
                      </p>
                    </label>
                  </div>
                </div>

                {uploadState.fileName && (
                  <div className="flex items-center space-x-2 rounded-lg bg-muted p-3">
                    <Upload className="h-4 w-4" />
                    <span className="text-sm font-medium">{uploadState.fileName}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {renderProgress()}
    </div>
  );
};

export default UploadVideoComponent;
