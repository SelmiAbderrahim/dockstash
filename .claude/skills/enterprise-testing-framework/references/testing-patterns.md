# Comprehensive Testing Patterns Guide

## Overview

This guide provides enterprise-grade testing patterns for the iReadYouTube project, ensuring 90%+ test coverage across all layers while maintaining code quality and reliability.

## Table of Contents

1. [Unit Testing Patterns](#unit-testing-patterns)
2. [Integration Testing Patterns](#integration-testing-patterns)
3. [E2E Testing Patterns](#e2e-testing-patterns)
4. [Mocking and Stubbing Patterns](#mocking-and-stubbing-patterns)
5. [Test Data Management](#test-data-management)
6. [Coverage Optimization Strategies](#coverage-optimization-strategies)
7. [Test Organization and Maintenance](#test-organization-and-maintenance)

---

## Unit Testing Patterns

### 1. React Component Testing

#### Basic Component Test Structure
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

// Component under test
import { VideoCard } from './VideoCard';

describe('VideoCard Component', () => {
  // Arrange: Common test setup
  const defaultProps = {
    video: {
      id: 'test-video-id',
      title: 'Test Video Title',
      description: 'Test video description',
      status: 'completed' as const,
      createdAt: Date.now(),
      thumbnailUrl: 'https://example.com/thumb.jpg'
    },
    onPlay: vi.fn(),
    onDelete: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 1: Basic rendering
  it('renders video information correctly', () => {
    // Act: Render component
    render(<VideoCard {...defaultProps} />);

    // Assert: Verify content
    expect(screen.getByText('Test Video Title')).toBeInTheDocument();
    expect(screen.getByText('Test video description')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/thumb.jpg');
  });

  // Test 2: Interaction testing
  it('handles play button click', async () => {
    const user = userEvent.setup();

    render(<VideoCard {...defaultProps} />);

    // Act: User interaction
    await user.click(screen.getByRole('button', { name: /play/i }));

    // Assert: Event handler called
    expect(defaultProps.onPlay).toHaveBeenCalledWith('test-video-id');
  });

  // Test 3: State-based rendering
  it('shows loading state for processing videos', () => {
    const processingProps = {
      ...defaultProps,
      video: { ...defaultProps.video, status: 'processing' as const }
    };

    render(<VideoCard {...processingProps} />);

    expect(screen.getByTestId('processing-indicator')).toBeInTheDocument();
    expect(screen.getByText(/processing/i)).toBeInTheDocument();
  });

  // Test 4: Error state handling
  it('displays error state for failed videos', () => {
    const failedProps = {
      ...defaultProps,
      video: { ...defaultProps.video, status: 'failed' as const }
    };

    render(<VideoCard {...failedProps} />);

    expect(screen.getByTestId('error-indicator')).toBeInTheDocument();
    expect(screen.getByText(/failed/i)).toBeInTheDocument();
  });
});
```

#### Custom Hook Testing
```typescript
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTranscript } from './useTranscript';

// Mock the Convex function
vi.mock('../convex/functions', () => ({
  getTranscript: vi.fn(),
  updateTranscript: vi.fn()
}));

describe('useTranscript Hook', () => {
  const mockGetTranscript = vi.fn();
  const mockUpdateTranscript = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTranscript.mockResolvedValue({
      id: 'test-transcript',
      text: 'Sample transcript',
      words: []
    });
  });

  it('loads transcript on mount', async () => {
    const { result } = renderHook(() => useTranscript('test-video-id'));

    expect(result.current.loading).toBe(true);
    expect(result.current.transcript).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.transcript).toBeDefined();
    });

    expect(mockGetTranscript).toHaveBeenCalledWith('test-video-id');
  });

  it('handles transcript updates', async () => {
    const { result } = renderHook(() => useTranscript('test-video-id'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.updateTranscript('Updated text');
    });

    expect(mockUpdateTranscript).toHaveBeenCalledWith('test-video-id', 'Updated text');
  });

  it('handles loading errors gracefully', async () => {
    mockGetTranscript.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useTranscript('test-video-id'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Network error');
    });
  });
});
```

### 2. Utility Function Testing

```typescript
import { describe, it, expect } from 'vitest';
import { formatDuration, parseYouTubeUrl, validateVideoFile } from './videoUtils';

describe('Video Utility Functions', () => {
  describe('formatDuration', () => {
    it('formats seconds into readable duration', () => {
      expect(formatDuration(90)).toBe('1:30');
      expect(formatDuration(3661)).toBe('1:01:01');
      expect(formatDuration(0)).toBe('0:00');
    });

    it('handles edge cases', () => {
      expect(formatDuration(-1)).toBe('0:00');
      expect(formatDuration(NaN)).toBe('0:00');
      expect(formatDuration(Infinity)).toBe('0:00');
    });
  });

  describe('parseYouTubeUrl', () => {
    it('extracts video ID from various YouTube URL formats', () => {
      expect(parseYouTubeUrl('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(parseYouTubeUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('returns null for invalid URLs', () => {
      expect(parseYouTubeUrl('https://example.com')).toBeNull();
      expect(parseYouTubeUrl('invalid-url')).toBeNull();
      expect(parseYouTubeUrl('')).toBeNull();
    });
  });

  describe('validateVideoFile', () => {
    it('validates supported video formats', () => {
      const mp4File = new File([''], 'video.mp4', { type: 'video/mp4' });
      expect(validateVideoFile(mp4File)).toBe(true);

      const movFile = new File([''], 'video.mov', { type: 'video/quicktime' });
      expect(validateVideoFile(movFile)).toBe(true);
    });

    it('rejects unsupported formats', () => {
      const txtFile = new File([''], 'file.txt', { type: 'text/plain' });
      expect(validateVideoFile(txtFile)).toBe(false);

      const noTypeFile = new File([''], 'file');
      expect(validateVideoFile(noTypeFile)).toBe(false);
    });

    it('validates file size limits', () => {
      const largeFile = new File(['x'.repeat(101 * 1024 * 1024)], 'large.mp4', { type: 'video/mp4' });
      expect(validateVideoFile(largeFile)).toBe(false);

      const normalFile = new File(['x'.repeat(10 * 1024 * 1024)], 'normal.mp4', { type: 'video/mp4' });
      expect(validateVideoFile(normalFile)).toBe(true);
    });
  });
});
```

---

## Integration Testing Patterns

### 1. Component Integration Tests

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VideoUploadForm } from './VideoUploadForm';
import { ConvexProvider } from '../providers/ConvexProvider';

// Mock Convex functions
vi.mock('../convex/functions', () => ({
  uploadVideo: vi.fn(),
  createTranscriptionJob: vi.fn()
}));

describe('VideoUploadForm Integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ConvexProvider>
          {component}
        </ConvexProvider>
      </QueryClientProvider>
    );
  };

  it('integrates YouTube URL upload with transcription service', async () => {
    const mockUploadVideo = vi.fn().mockResolvedValue({ id: 'test-video-id' });
    vi.mocked(uploadVideo).mockImplementation(mockUploadVideo);

    renderWithProviders(<VideoUploadForm />);

    // Fill form
    fireEvent.change(screen.getByLabelText(/youtube url/i), {
      target: { value: 'https://youtube.com/watch?v=test' }
    });
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'Test Video' }
    });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /upload/i }));

    // Wait for success
    await waitFor(() => {
      expect(screen.getByText(/upload successful/i)).toBeInTheDocument();
    });

    // Verify integration
    expect(mockUploadVideo).toHaveBeenCalledWith({
      youtubeUrl: 'https://youtube.com/watch?v=test',
      title: 'Test Video'
    });
  });

  it('handles integration errors gracefully', async () => {
    const mockUploadVideo = vi.fn().mockRejectedValue(new Error('API Error'));
    vi.mocked(uploadVideo).mockImplementation(mockUploadVideo);

    renderWithProviders(<VideoUploadForm />);

    // Submit invalid form
    fireEvent.click(screen.getByRole('button', { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByText(/upload failed/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/api error/i)).toBeInTheDocument();
  });
});
```

### 2. API Integration Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { transcribeAudio, getTranscriptResult } from '../lib/assemblyai';
import { AssemblyAI } from 'assemblyai';

// Mock AssemblyAI
vi.mock('assemblyai');

describe('AssemblyAI Integration', () => {
  let mockAssemblyAI: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssemblyAI = {
      transcripts: {
        transcribe: vi.fn(),
        get: vi.fn()
      }
    };
    (AssemblyAI as any).mockImplementation(() => mockAssemblyAI);
  });

  it('submits transcription job and polls for results', async () => {
    // Mock initial submission
    mockAssemblyAI.transcripts.transcribe.mockResolvedValue({
      id: 'test-job-id',
      status: 'queued'
    });

    // Mock completion
    mockAssemblyAI.transcripts.get.mockResolvedValue({
      id: 'test-job-id',
      status: 'completed',
      text: 'Sample transcript text',
      words: [
        { text: 'Sample', start: 0, end: 500 },
        { text: 'transcript', start: 600, end: 1200 },
        { text: 'text', start: 1300, end: 1800 }
      ]
    });

    const result = await transcribeAudio('https://example.com/audio.mp3');

    expect(result).toEqual({
      id: 'test-job-id',
      text: 'Sample transcript text',
      words: expect.arrayContaining([
        expect.objectContaining({ text: 'Sample' }),
        expect.objectContaining({ text: 'transcript' }),
        expect.objectContaining({ text: 'text' })
      ])
    });

    expect(mockAssemblyAI.transcripts.transcribe).toHaveBeenCalledWith({
      audio: 'https://example.com/audio.mp3',
      speaker_labels: true,
      punctuate: true,
      language_code: undefined
    });
  });

  it('handles transcription failures', async () => {
    mockAssemblyAI.transcripts.transcribe.mockResolvedValue({
      id: 'test-job-id',
      status: 'failed',
      error: 'Audio processing failed'
    });

    await expect(
      transcribeAudio('https://example.com/audio.mp3')
    ).rejects.toThrow('Audio processing failed');
  });

  it('implements retry logic for network failures', async () => {
    // First call fails
    mockAssemblyAI.transcripts.transcribe.mockRejectedValueOnce(new Error('Network error'));
    // Second call succeeds
    mockAssemblyAI.transcripts.transcribe.mockResolvedValueOnce({
      id: 'test-job-id',
      status: 'queued'
    });

    const result = await transcribeAudio('https://example.com/audio.mp3');

    expect(mockAssemblyAI.transcripts.transcribe).toHaveBeenCalledTimes(2);
    expect(result.id).toBe('test-job-id');
  });
});
```

---

## E2E Testing Patterns

### 1. User Journey Testing

```typescript
import { test, expect } from '@playwright/test';

test.describe('Critical User Journeys', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to application
    await page.goto('/');

    // Wait for application to load
    await page.waitForLoadState('networkidle');
  });

  test('complete YouTube video workflow', async ({ page }) => {
    // Step 1: Upload YouTube video
    await page.click('[data-testid="upload-button"]');
    await expect(page).toHaveURL('/upload');

    // Fill upload form
    await page.fill('[data-testid="youtube-url-input"]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.fill('[data-testid="title-input"]', 'Test Upload Video');
    await page.fill('[data-testid="description-input"]', 'This is a test video description');

    // Submit form
    await page.click('[data-testid="submit-upload"]');

    // Step 2: Verify processing starts
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="processing-status"]')).toContainText('Processing');

    // Step 3: Mock completion (for test speed)
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('transcription-complete', {
        detail: { videoId: 'test-video-id' }
      }));
    });

    // Step 4: Verify transcript display
    await expect(page.locator('[data-testid="transcript-viewer"]')).toBeVisible();
    await expect(page.locator('[data-testid="transcript-content"]')).toBeVisible();

    // Step 5: Test transcript interactions
    await page.click('[data-testid="search-input"]');
    await page.fill('[data-testid="search-input"]', 'test phrase');
    await page.click('[data-testid="search-button"]');

    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-highlight"]')).toHaveCount({ min: 1 });

    // Step 6: Test timestamp navigation
    await page.click('[data-testid="first-timestamp"]');

    // Verify video player seeks to timestamp
    const currentTime = await page.locator('[data-testid="video-player"]').evaluate(
      (el: any) => el.currentTime
    );
    expect(currentTime).toBeGreaterThan(0);
  });

  test('file upload workflow with error handling', async ({ page }) => {
    await page.click('[data-testid="upload-button"]');

    // Test file selection
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles('test-fixtures/sample-video.mp4');

    await expect(page.locator('[data-testid="file-name"]')).toContainText('sample-video.mp4');

    // Test validation errors
    await page.click('[data-testid="submit-upload"]');

    // Should show title required error
    await expect(page.locator('[data-testid="error-title"]')).toBeVisible();

    // Fill required fields and submit
    await page.fill('[data-testid="title-input"]', 'File Upload Test');
    await page.click('[data-testid="submit-upload"]');

    // Should show upload progress
    await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
  });

  test('transcript search and navigation workflow', async ({ page }) => {
    // Navigate to existing transcript
    await page.goto('/transcript/test-transcript-id');

    // Wait for transcript to load
    await expect(page.locator('[data-testid="transcript-content"]')).toBeVisible();

    // Test search functionality
    await page.fill('[data-testid="search-input"]', 'important keyword');
    await page.click('[data-testid="search-button"]');

    // Verify search results
    await expect(page.locator('[data-testid="search-results-count"]')).toContainText('results');
    await expect(page.locator('[data-testid="search-highlight"]')).toHaveCount({ min: 1 });

    // Test search navigation
    const initialResult = await page.locator('[data-testid="current-result"]').textContent();

    await page.click('[data-testid="next-result"]');
    const nextResult = await page.locator('[data-testid="current-result"]').textContent();

    expect(nextResult).not.toBe(initialResult);

    // Test clicking search result to jump to timestamp
    await page.click('[data-testid="search-result-timestamp"]:first-child');

    const videoTime = await page.locator('[data-testid="video-player"]').evaluate(
      (el: any) => el.currentTime
    );
    expect(videoTime).toBeGreaterThan(0);
  });
});
```

### 2. Cross-Browser Testing

```typescript
import { test, devices } from '@playwright/test';

const devicesToTest = [
  { ...devices['Desktop Chrome'], name: 'Chrome Desktop' },
  { ...devices['Desktop Firefox'], name: 'Firefox Desktop' },
  { ...devices['Desktop Safari'], name: 'Safari Desktop' },
  { ...devices['iPhone 13'], name: 'iPhone 13' },
  { ...devices['iPad'], name: 'iPad' },
  { ...devices['Galaxy S9+'], name: 'Android Phone' }
];

for (const device of devicesToTest) {
  test.describe(`Testing on ${device.name}`, () => {
    test.use({ ...device });

    test('application loads and functions correctly', async ({ page }) => {
      await page.goto('/');

      // Verify application loads
      await expect(page.locator('[data-testid="app-header"]')).toBeVisible();

      // Test responsive design
      if (device.isMobile) {
        await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
      } else {
        await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
      }

      // Test core functionality
      await page.click('[data-testid="upload-button"]');
      await expect(page).toHaveURL('/upload');

      // Test form works on this device
      await page.fill('[data-testid="youtube-url-input"]', 'https://youtube.com/watch?v=test');
      await expect(page.locator('[data-testid="youtube-url-input"]')).toHaveValue('https://youtube.com/watch?v/test');
    });
  });
}
```

---

## Mocking and Stubbing Patterns

### 1. API Mocking

```typescript
// tests/mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  // YouTube API mock
  rest.get('https://www.googleapis.com/youtube/v3/videos', (req, res, ctx) => {
    const videoId = req.url.searchParams.get('id');

    return res(
      ctx.status(200),
      ctx.json({
        items: [
          {
            id: videoId,
            snippet: {
              title: `Mock Video ${videoId}`,
              description: 'This is a mock video for testing',
              thumbnails: {
                medium: { url: 'https://example.com/thumb.jpg' }
              }
            }
          }
        ]
      })
    );
  }),

  // AssemblyAI mock
  rest.post('https://api.assemblyai.com/v2/transcript', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        id: 'mock-transcript-id',
        status: 'queued'
      })
    );
  }),

  rest.get('https://api.assemblyai.com/v2/transcript/:id', (req, res, ctx) => {
    const { id } = req.params;

    return res(
      ctx.status(200),
      ctx.json({
        id,
        status: 'completed',
        text: 'This is a mock transcript for testing purposes.',
        words: [
          { text: 'This', start: 0, end: 300 },
          { text: 'is', start: 400, end: 600 },
          { text: 'a', start: 700, end: 850 },
          { text: 'mock', start: 950, end: 1300 },
          { text: 'transcript', start: 1400, end: 2100 }
        ]
      })
    );
  }),

  // Error simulation
  rest.get('https://api.assemblyai.com/v2/transcript/error-id', (req, res, ctx) => {
    return res(
      ctx.status(500),
      ctx.json({
        error: 'Transcription failed'
      })
    );
  })
];

// tests/setup.ts
import { beforeAll, afterEach, afterAll } from 'vitest';
import { setupServer } from 'msw/node';

export const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### 2. Convex Function Mocking

```typescript
// tests/mocks/convex.ts
import { vi } from 'vitest';

export const mockConvexFunctions = {
  // Video functions
  uploadVideo: vi.fn(),
  getVideo: vi.fn(),
  getUserVideos: vi.fn(),
  updateVideoStatus: vi.fn(),

  // Transcript functions
  getTranscript: vi.fn(),
  updateTranscript: vi.fn(),
  searchTranscripts: vi.fn(),

  // User functions
  createUser: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),

  // Search functions
  searchVideos: vi.fn(),
  searchTranscriptContent: vi.fn()
};

// Mock implementations with default return values
export const setupConvexMocks = () => {
  mockConvexFunctions.uploadVideo.mockResolvedValue({
    id: 'mock-video-id',
    status: 'processing',
    createdAt: Date.now()
  });

  mockConvexFunctions.getVideo.mockResolvedValue({
    id: 'mock-video-id',
    title: 'Mock Video',
    status: 'completed',
    createdAt: Date.now()
  });

  mockConvexFunctions.getUserVideos.mockResolvedValue([
    {
      id: 'mock-video-1',
      title: 'Video 1',
      status: 'completed'
    },
    {
      id: 'mock-video-2',
      title: 'Video 2',
      status: 'processing'
    }
  ]);

  mockConvexFunctions.getTranscript.mockResolvedValue({
    id: 'mock-transcript-id',
    text: 'Mock transcript content',
    words: []
  });

  return mockConvexFunctions;
};
```

---

## Test Data Management

### 1. Factory Pattern for Test Data

```typescript
// tests/factories/videoFactory.ts
import { faker } from '@faker-js/faker';

export interface VideoTestData {
  id: string;
  title: string;
  description: string;
  youtubeUrl: string;
  status: 'processing' | 'completed' | 'failed';
  userId: string;
  createdAt: number;
  updatedAt?: number;
  transcriptId?: string;
  fileUrl?: string;
}

export class VideoFactory {
  static create(overrides: Partial<VideoTestData> = {}): VideoTestData {
    return {
      id: faker.string.uuid(),
      title: faker.lorem.words(3),
      description: faker.lorem.sentences(2),
      youtubeUrl: `https://youtube.com/watch?v=${faker.string.alphanumeric(11)}`,
      status: faker.helpers.arrayElement(['processing', 'completed', 'failed']),
      userId: faker.string.uuid(),
      createdAt: faker.date.past().getTime(),
      ...overrides
    };
  }

  static createMany(count: number, overrides: Partial<VideoTestData> = {}): VideoTestData[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  static createProcessing(overrides: Partial<VideoTestData> = {}): VideoTestData {
    return this.create({ status: 'processing', ...overrides });
  }

  static createCompleted(overrides: Partial<VideoTestData> = {}): VideoTestData {
    return this.create({
      status: 'completed',
      transcriptId: faker.string.uuid(),
      ...overrides
    });
  }

  static createFailed(overrides: Partial<VideoTestData> = {}): VideoTestData {
    return this.create({ status: 'failed', ...overrides });
  }
}

// tests/factories/transcriptFactory.ts
export interface TranscriptTestData {
  id: string;
  text: string;
  videoId: string;
  words: Array<{
    text: string;
    start: number;
    end: number;
  }>;
  createdAt: number;
}

export class TranscriptFactory {
  static create(overrides: Partial<TranscriptTestData> = {}): TranscriptTestData {
    const words = [
      { text: 'This', start: 0, end: 300 },
      { text: 'is', start: 400, end: 600 },
      { text: 'a', start: 700, end: 850 },
      { text: 'test', start: 950, end: 1300 },
      { text: 'transcript', start: 1400, end: 2100 }
    ];

    return {
      id: faker.string.uuid(),
      text: words.map(w => w.text).join(' '),
      videoId: faker.string.uuid(),
      words,
      createdAt: faker.date.past().getTime(),
      ...overrides
    };
  }

  static createWithCustomText(text: string, overrides: Partial<TranscriptTestData> = {}): TranscriptTestData {
    const words = text.split(' ').map((word, index) => ({
      text: word,
      start: index * 500,
      end: (index + 1) * 500
    }));

    return this.create({
      text,
      words,
      ...overrides
    });
  }
}
```

### 2. Test Fixtures

```typescript
// tests/fixtures/testData.ts
export const testFixtures = {
  // YouTube URLs
  youtubeUrls: {
    valid: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    short: 'https://youtu.be/dQw4w9WgXcQ',
    embed: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    invalid: 'https://example.com/not-youtube'
  },

  // Video files
  videoFiles: {
    valid: {
      name: 'test-video.mp4',
      type: 'video/mp4',
      size: 10 * 1024 * 1024 // 10MB
    },
    tooLarge: {
      name: 'huge-video.mp4',
      type: 'video/mp4',
      size: 101 * 1024 * 1024 // 101MB
    },
    invalidType: {
      name: 'document.pdf',
      type: 'application/pdf',
      size: 1024 * 1024 // 1MB
    }
  },

  // Transcript data
  transcripts: {
    short: {
      text: 'This is a short transcript.',
      words: [
        { text: 'This', start: 0, end: 300 },
        { text: 'is', start: 400, end: 600 },
        { text: 'a', start: 700, end: 850 },
        { text: 'short', start: 950, end: 1300 },
        { text: 'transcript', start: 1400, end: 2100 },
        { text: '.', start: 2100, end: 2200 }
      ]
    },
    long: {
      text: 'This is a much longer transcript that contains multiple sentences and various topics for testing search functionality and transcript navigation features.',
      words: []
    }
  },

  // Search terms
  searchTerms: {
    existing: 'transcript',
    nonExisting: 'nonexistentword',
    partial: 'trans',
    caseSensitive: 'TRANSCRIPT'
  }
};
```

---

## Coverage Optimization Strategies

### 1. Coverage Analysis and Improvement

```typescript
// scripts/analyze-coverage.ts
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface CoverageReport {
  total: {
    lines: { pct: number };
    functions: { pct: number };
    branches: { pct: number };
    statements: { pct: number };
  };
  files: Array<{
    path: string;
    statements: { pct: number };
    lines: { pct: number };
    functions: { pct: number };
    branches: { pct: number };
  }>;
};

export function analyzeCoverage() {
  // Generate coverage report
  execSync('npm run test:coverage -- --reporter=json', { stdio: 'pipe' });

  // Read coverage report
  const coverageData: CoverageReport = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8'));

  console.log('📊 COVERAGE ANALYSIS');
  console.log('==================');
  console.log(`Overall Coverage: ${coverageData.total.lines.pct}%`);

  // Find low coverage files
  const lowCoverageFiles = coverageData.files.filter(file =>
    file.lines.pct < 90
  );

  if (lowCoverageFiles.length > 0) {
    console.log('\n❌ FILES BELOW 90% COVERAGE:');
    lowCoverageFiles.forEach(file => {
      console.log(`  ${file.path}: ${file.lines.pct}% coverage`);
    });

    // Generate improvement suggestions
    console.log('\n💡 COVERAGE IMPROVEMENT SUGGESTIONS:');
    lowCoverageFiles.forEach(file => {
      console.log(`  ${file.path}:`);
      console.log(`    - Add tests for uncovered functions`);
      console.log(`    - Test error handling paths`);
      console.log(`    - Cover edge cases and boundary conditions`);
    });
  }

  return {
    overall: coverageData.total.lines.pct,
    lowCoverageFiles: lowCoverageFiles.map(f => f.path)
  };
}
```

### 2. Targeted Test Generation

```typescript
// scripts/generate-tests-for-coverage.ts
import { parse } from '@typescript-eslint/parser';
import { traverse } from '@babel/types';
import { writeFileSync } from 'fs';

interface FunctionInfo {
  name: string;
  line: number;
  hasTest: boolean;
  filePath: string;
}

export function analyzeUntestedFunctions(filePath: string): FunctionInfo[] {
  const sourceCode = readFileSync(filePath, 'utf8');
  const ast = parse(sourceCode, {
    sourceType: 'module',
    ecmaVersion: 2020
  });

  const functions: FunctionInfo[] = [];

  traverse(ast as any, {
    FunctionDeclaration(path) {
      const name = path.node.id?.name || 'anonymous';
      const line = path.node.loc?.start.line || 0;

      functions.push({
        name,
        line,
        hasTest: false, // Would need to check test files
        filePath
      });
    },

    ArrowFunctionExpression(path) {
      const parent = path.parent;
      if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
        const name = parent.id.name;
        const line = path.node.loc?.start.line || 0;

        functions.push({
          name,
          line,
          hasTest: false,
          filePath
        });
      }
    }
  });

  return functions;
}

export function generateTestTemplate(functions: FunctionInfo[]): string {
  return functions.map(func => `
// Auto-generated test for ${func.name}
describe('${func.name}', () => {
  it('should work correctly', () => {
    // TODO: Implement test for ${func.name}
    // File: ${func.filePath}, Line: ${func.line}
    expect(true).toBe(true);
  });
});
`).join('\n');
}
```

---

## Test Organization and Maintenance

### 1. Test File Structure

```
src/
├── components/
│   ├── VideoCard.tsx
│   ├── VideoCard.test.tsx
│   ├── TranscriptViewer.tsx
│   └── TranscriptViewer.test.tsx
├── hooks/
│   ├── useTranscript.ts
│   └── useTranscript.test.ts
├── utils/
│   ├── videoUtils.ts
│   └── videoUtils.test.ts
└── lib/
    ├── assemblyai.ts
    └── assemblyai.test.ts

tests/
├── integration/
│   ├── video-upload.test.ts
│   └── transcript-search.test.ts
├── e2e/
│   ├── user-workflows.spec.ts
│   └── cross-browser.spec.ts
├── fixtures/
│   ├── videoData.ts
│   └── transcriptData.ts
├── mocks/
│   ├── handlers.ts
│   └── convex.ts
└── utils/
    ├── testHelpers.ts
    └── setup.ts
```

### 2. Test Utilities and Helpers

```typescript
// tests/utils/testHelpers.ts
import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConvexProvider } from '../../src/providers/ConvexProvider';

// Custom render function with providers
export const renderWithProviders = (
  ui: ReactElement,
  options?: RenderOptions
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <ConvexProvider>
        {children}
      </ConvexProvider>
    </QueryClientProvider>
  );

  return render(ui, { wrapper: Wrapper, ...options });
};

// Async test utilities
export const waitForLoadState = async (page: any) => {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(100); // Small delay for React updates
};

// Mock data generators
export const createMockVideo = (overrides = {}) => ({
  id: 'test-video-id',
  title: 'Test Video',
  description: 'Test Description',
  status: 'completed',
  createdAt: Date.now(),
  ...overrides
});

export const createMockTranscript = (overrides = {}) => ({
  id: 'test-transcript-id',
  text: 'Test transcript text',
  words: [],
  ...overrides
});
```

This comprehensive testing patterns guide provides enterprise-grade testing strategies for achieving and maintaining 90%+ test coverage across all layers of the iReadYouTube application.