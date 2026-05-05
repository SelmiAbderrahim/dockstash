# Video Upload Workflow - Working Examples

This directory contains production-ready code examples for implementing the video upload workflow in iReadYouTube.

## Files

### 1. `upload-component.tsx`
Complete React component with:
- YouTube URL and file upload input
- Real-time progress tracking with visual feedback
- Error handling with user-friendly messages
- Status updates (uploading → processing → completed)
- Typescript strict mode compliance
- Shadcn/ui design system integration

**Use when:**
- Building the main video upload interface
- Need a complete, working upload component
- Want to understand the full React integration

**Key features:**
```typescript
<UploadVideoComponent
  onUploadStart={(videoId) => console.log("Starting upload:", videoId)}
  onUploadProgress={(progress) => updateProgressBar(progress)}
  onUploadComplete={(videoId) => redirectToDashboard(videoId)}
  onError={(error) => showErrorMessage(error)}
/>
```

### 2. `validation.test.ts`
Comprehensive test suite covering:
- YouTube URL validation (all formats)
- File validation (size, type, extension)
- Edge cases and error conditions
- 90%+ test coverage

**Use when:**
- Setting up testing infrastructure
- Need validation test patterns
- Want to ensure validation reliability

**Coverage:**
- YouTube URL patterns (full, short, ID only)
- File size limits (edge cases)
- MIME type detection
- Extension validation
- Browser-specific MIME types

### 3. `server.ts`
Backend Convex implementation:
- Create video record
- Handle file upload
- Update progress
- Manage transcription queue

**Use when:**
- Implementing backend mutations
- Need Convex integration patterns
- Setting up database schema

## Quick Start

### 1. Copy the component
```bash
cp examples/upload-component.tsx src/components/videos/UploadVideoComponent.tsx
```

### 2. Update imports
```typescript
// Change relative paths to absolute imports:
// FROM: import { useUploadProgress } from "../hooks/useUploadProgress"
// TO:   import { useUploadProgress } from "@/hooks/useUploadProgress"
```

### 3. Run tests
```bash
npm test -- validation.test.ts
# Should pass all tests with >90% coverage
```

### 4. Integrate into your page
```typescript
import { UploadVideoComponent } from "@/components/videos/UploadVideoComponent";

export default function UploadPage() {
  return (
    <div className="container mx-auto">
      <h1 className="text-3xl font-bold mb-6">Upload Video</h1>
      <UploadVideoComponent />
    </div>
  );
}
```

## Integration Checklist

Before using in production:

- [ ] Copy component to `src/components/videos/UploadVideoComponent.tsx`
- [ ] Copy tests to `src/components/videos/__tests__/UploadVideoComponent.test.ts`
- [ ] Update all import paths to absolute imports
- [ ] Run full test suite: `npm test -- UploadVideoComponent`
- [ ] Run type check: `npm run type-check`
- [ ] Test in browser with real files
- [ ] Test with slow network (DevTools throttling)
- [ ] Test with large files (>1GB)
- [ ] Test error scenarios (invalid URL, network error, etc.)
- [ ] Verify Shadcn/ui styling matches design system
- [ ] Add to component documentation

## Common Customizations

### Change allowed file types
```typescript
// In UploadVideoComponent.tsx, update:
const ALLOWED_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm"
  // Add more as needed
];
```

### Adjust file size limit
```typescript
// In UploadVideoComponent.tsx, update:
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB
// OR
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
```

### Customize progress update interval
```typescript
// In UploadVideoComponent.tsx, update:
const PROGRESS_UPDATE_INTERVAL = 500; // milliseconds
```

### Change redirect URL after upload
```typescript
// In UploadVideoComponent.tsx, update:
const onComplete = (videoId) => {
  navigate(`/videos/${videoId}`);
  // OR
  navigate("/dashboard");
  // OR
  window.location.href = `/videos/${videoId}`;
};
```

## Performance Notes

**Expected upload times (typical network):**
- 100MB file: ~30 seconds
- 500MB file: ~2.5 minutes
- 1GB file: ~5 minutes
- 5GB file: ~25 minutes

**Performance metrics:**
- First render: <500ms
- File validation: <100ms
- Progress updates: every 100-500ms
- Error display: immediate (<50ms)

## Troubleshooting

**See `troubleshooting.md` for common issues:**
- Upload progress stuck at 100%
- File type validation rejecting valid files
- Very slow upload speed
- CORS errors
- YouTube URL validation issues
- Uploads remaining in "uploading" status

## Related Documentation

- `guide.md` - Complete implementation guide
- `patterns.md` - Advanced patterns for specific use cases
- `troubleshooting.md` - Common issues and solutions
- `SKILL.md` - Quick reference guide
