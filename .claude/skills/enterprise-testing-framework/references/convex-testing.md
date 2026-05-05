# Convex Testing Guide for Self-Hosted Deployment

## Overview

This guide provides comprehensive testing strategies for Convex backend functions and schemas in the iReadYouTube project, specifically tailored for self-hosted Convex deployments.

## Table of Contents

1. [Self-Hosted Convex Testing Setup](#self-hosted-convex-testing-setup)
2. [Database Schema Testing](#database-schema-testing)
3. [Function Testing Patterns](#function-testing-patterns)
4. [Authentication and Authorization Testing](#authentication-and-authorization-testing)
5. [Reactive Data Testing](#reactive-data-testing)
6. [Cron Job and Scheduler Testing](#cron-job-and-scheduler-testing)
7. [Migration and Schema Evolution Testing](#migration-and-schema-evolution-testing)
8. [Performance and Load Testing](#performance-and-load-testing)

---

## Self-Hosted Convex Testing Setup

### 1. Test Environment Configuration

```typescript
// convex/test-setup.ts
import { convexTest } from 'convex-test';
import schema from '../schema';

// Test context factory for self-hosted Convex
export const createTestContext = (overrides = {}) => {
  return convexTest(schema, {
    // Configure test environment for self-hosted setup
    auth: {
      userId: 'test-user-id',
      subjectId: 'test-user-id',
      tokenIdentifier: 'test@example.com',
      ...overrides.auth
    },
    // Mock external services
    services: {
      assemblyai: {
        transcribe: jest.fn(),
        get: jest.fn()
      },
      email: {
        send: jest.fn()
      },
      storage: {
        upload: jest.fn(),
        getUrl: jest.fn()
      },
      ...overrides.services
    },
    ...overrides
  });
};

// Reusable test context instances
export const testCtx = createTestContext();
export const adminCtx = createTestContext({
  auth: {
    userId: 'admin-user-id',
    subjectId: 'admin-user-id',
    role: 'admin'
  }
});
export const anonymousCtx = createTestContext({
  auth: null
});
```

### 2. Self-Hosted Convex Connection Testing

```typescript
// convex/tests/self-hosted-connection.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConvexHttpClient } from 'convex/browser';
import schema from '../../schema';

describe('Self-Hosted Convex Connection', () => {
  let client: ConvexHttpClient;

  beforeEach(async () => {
    // Connect to self-hosted Convex instance
    client = new ConvexHttpClient(process.env.CONVEX_URL || 'http://localhost:3210');
  });

  afterEach(async () => {
    // Cleanup test data
    if (client) {
      // Clean up any test data created during tests
      await client.mutation(api.test.cleanup);
    }
  });

  it('connects to self-hosted Convex instance', async () => {
    // Test basic connection
    const result = await client.query(api.system.health);
    expect(result.status).toBe('healthy');
    expect(result.deployment).toBe('self-hosted');
  });

  it('validates schema integrity', async () => {
    // Test that schema matches expected structure
    const schemaValidation = await client.query(api.system.validateSchema);
    expect(schemaValidation.valid).toBe(true);
    expect(schemaValidation.tables).toContain('videos');
    expect(schemaValidation.tables).toContain('transcripts');
    expect(schemaValidation.tables).toContain('users');
  });

  it('handles authentication properly', async () => {
    // Test unauthenticated requests
    await expect(client.query(api.videos.list)).rejects.toThrow('Unauthorized');

    // Test authenticated requests
    client.setAuth('test-token');
    const videos = await client.query(api.videos.list);
    expect(Array.isArray(videos)).toBe(true);
  });
});
```

---

## Database Schema Testing

### 1. Schema Validation Testing

```typescript
// convex/tests/schema-validation.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { defineTable, v } from 'convex/server';
import { testCtx } from '../test-setup';

describe('Database Schema Validation', () => {
  beforeEach(async () => {
    // Clear test data
    await testCtx.run(async (ctx) => {
      const videos = await ctx.db.query('videos').collect();
      for (const video of videos) {
        await ctx.db.delete(video._id);
      }

      const users = await ctx.db.query('users').collect();
      for (const user of users) {
        await ctx.db.delete(user._id);
      }
    });
  });

  it('validates video table schema constraints', async () => {
    // Test valid video creation
    await testCtx.run(async (ctx) => {
      const validVideo = await ctx.db.insert('videos', {
        userId: 'test-user-id',
        title: 'Test Video',
        youtubeUrl: 'https://youtube.com/watch?v=test',
        description: 'Test description',
        status: 'processing',
        createdAt: Date.now()
      });

      expect(validVideo).toBeDefined();
      const video = await ctx.db.get(validVideo);
      expect(video?.title).toBe('Test Video');
    });
  });

  it('enforces required field validation', async () => {
    // Test missing required fields
    await expect(
      testCtx.run(async (ctx) => {
        return ctx.db.insert('videos', {
          userId: 'test-user-id',
          // Missing title, youtubeUrl, status, createdAt
        });
      })
    ).rejects.toThrow();

    await expect(
      testCtx.run(async (ctx) => {
        return ctx.db.insert('videos', {
          userId: 'test-user-id',
          title: '', // Empty title
          youtubeUrl: 'https://youtube.com/watch?v=test',
          status: 'processing',
          createdAt: Date.now()
        });
      })
    ).rejects.toThrow();
  });

  it('validates URL format for YouTube URLs', async () => {
    // Test invalid URL formats
    const invalidUrls = [
      'invalid-url',
      'https://example.com',
      'not-a-url',
      '',
      'youtube.com/watch' // missing video ID
    ];

    for (const invalidUrl of invalidUrls) {
      await expect(
        testCtx.run(async (ctx) => {
          return ctx.db.insert('videos', {
            userId: 'test-user-id',
            title: 'Test Video',
            youtubeUrl: invalidUrl,
            status: 'processing',
            createdAt: Date.now()
          });
        })
      ).rejects.toThrow();
    }

    // Test valid URL formats
    const validUrls = [
      'https://youtube.com/watch?v=test123',
      'https://youtu.be/test123',
      'https://www.youtube.com/embed/test123'
    ];

    for (const validUrl of validUrls) {
      const videoId = await testCtx.run(async (ctx) => {
        return ctx.db.insert('videos', {
          userId: 'test-user-id',
          title: 'Test Video',
          youtubeUrl: validUrl,
          status: 'processing',
          createdAt: Date.now()
        });
      });

      expect(videoId).toBeDefined();
    }
  });

  it('enforces status enum constraints', async () => {
    // Test invalid status values
    const invalidStatuses = [
      'invalid',
      'PROCESSING', // uppercase
      'completed ',
      'processing!'
    ];

    for (const invalidStatus of invalidStatuses) {
      await expect(
        testCtx.run(async (ctx) => {
          return ctx.db.insert('videos', {
            userId: 'test-user-id',
            title: 'Test Video',
            youtubeUrl: 'https://youtube.com/watch?v=test',
            status: invalidStatus as any,
            createdAt: Date.now()
          });
        })
      ).rejects.toThrow();
    }

    // Test valid status values
    const validStatuses = ['processing', 'completed', 'failed'] as const;

    for (const validStatus of validStatuses) {
      const videoId = await testCtx.run(async (ctx) => {
        return ctx.db.insert('videos', {
          userId: 'test-user-id',
          title: 'Test Video',
          youtubeUrl: 'https://youtube.com/watch?v=test',
          status: validStatus,
          createdAt: Date.now()
        });
      });

      expect(videoId).toBeDefined();
    }
  });
});
```

### 2. Index and Query Performance Testing

```typescript
// convex/tests/index-performance.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { testCtx } from '../test-setup';

describe('Database Index Performance', () => {
  beforeEach(async () => {
    // Insert test data with different user IDs
    await testCtx.run(async (ctx) => {
      const userIds = ['user1', 'user2', 'user3'];
      const videoCount = 100;

      for (const userId of userIds) {
        for (let i = 0; i < videoCount; i++) {
          await ctx.db.insert('videos', {
            userId,
            title: `Video ${i} for ${userId}`,
            youtubeUrl: `https://youtube.com/watch?v=test${userId}${i}`,
            status: i % 3 === 0 ? 'processing' : i % 3 === 1 ? 'completed' : 'failed',
            createdAt: Date.now() - (i * 1000) // Different timestamps
          });
        }
      }
    });
  });

  it('efficiently queries videos by user ID using index', async () => {
    const startTime = performance.now();

    const userVideos = await testCtx.run(async (ctx) => {
      return await ctx.db.query('videos')
        .withIndex('by_user', q => q.eq('userId', 'user1'))
        .collect();
    });

    const endTime = performance.now();
    const queryTime = endTime - startTime;

    expect(userVideos).toHaveLength(100);
    expect(userVideos.every(video => video.userId === 'user1')).toBe(true);

    // Query should be fast due to index (under 50ms for 100 records)
    expect(queryTime).toBeLessThan(50);
  });

  it('efficiently queries videos by status using index', async () => {
    const startTime = performance.now();

    const completedVideos = await testCtx.run(async (ctx) => {
      return await ctx.db.query('videos')
        .withIndex('by_status', q => q.eq('status', 'completed'))
        .collect();
    });

    const endTime = performance.now();
    const queryTime = endTime - startTime;

    expect(completedVideos.length).toBeGreaterThan(0);
    expect(completedVideos.every(video => video.status === 'completed')).toBe(true);

    // Query should be fast due to index
    expect(queryTime).toBeLessThan(50);
  });

  it('handles complex queries efficiently', async () => {
    const startTime = performance.now();

    const userCompletedVideos = await testCtx.run(async (ctx) => {
      // This query should use indexes effectively
      const userVideos = await ctx.db.query('videos')
        .withIndex('by_user', q => q.eq('userId', 'user2'))
        .collect();

      return userVideos.filter(video => video.status === 'completed');
    });

    const endTime = performance.now();
    const queryTime = endTime - startTime;

    expect(userCompletedVideos.length).toBeGreaterThan(0);
    expect(userCompletedVideos.every(video =>
      video.userId === 'user2' && video.status === 'completed'
    )).toBe(true);

    // Even filtered query should be reasonably fast
    expect(queryTime).toBeLessThan(100);
  });
});
```

---

## Function Testing Patterns

### 1. Mutation Testing

```typescript
// convex/tests/mutations.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testCtx } from '../test-setup';
import { api } from '../_generated/api';

// Mock external dependencies
vi.mock('../lib/assemblyai', () => ({
  transcribeAudio: vi.fn(),
  getTranscriptResult: vi.fn()
}));

vi.mock('../lib/storage', () => ({
  uploadFile: vi.fn(),
  getDownloadUrl: vi.fn()
}));

describe('Video Mutations', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Clean up test data
    await testCtx.run(async (ctx) => {
      const videos = await ctx.db.query('videos').collect();
      for (const video of videos) {
        await ctx.db.delete(video._id);
      }
    });
  });

  it('creates video with YouTube URL successfully', async () => {
    const videoData = {
      title: 'Test YouTube Video',
      youtubeUrl: 'https://youtube.com/watch?v=test123',
      description: 'Test description'
    };

    const videoId = await testCtx.run(async (ctx) => {
      return await ctx.runMutation(api.videos.createVideo, videoData);
    });

    expect(videoId).toBeDefined();

    // Verify video was created correctly
    const video = await testCtx.run(async (ctx) => {
      return await ctx.runQuery(api.videos.getVideo, { videoId });
    });

    expect(video).toEqual(
      expect.objectContaining({
        _id: videoId,
        userId: 'test-user-id',
        title: videoData.title,
        youtubeUrl: videoData.youtubeUrl,
        description: videoData.description,
        status: 'processing',
        createdAt: expect.any(Number)
      })
    );
  });

  it('validates YouTube URL format', async () => {
    const invalidVideoData = {
      title: 'Invalid URL Video',
      youtubeUrl: 'invalid-url',
      description: 'Test description'
    };

    await expect(
      testCtx.run(async (ctx) => {
        return await ctx.runMutation(api.videos.createVideo, invalidVideoData);
      })
    ).rejects.toThrow('Invalid YouTube URL format');
  });

  it('enforces title length constraints', async () => {
    const longTitle = 'a'.repeat(501); // Exceed 500 character limit

    const invalidVideoData = {
      title: longTitle,
      youtubeUrl: 'https://youtube.com/watch?v=test123',
      description: 'Test description'
    };

    await expect(
      testCtx.run(async (ctx) => {
        return await ctx.runMutation(api.videos.createVideo, invalidVideoData);
      })
    ).rejects.toThrow('Title too long');
  });

  it('handles file upload video creation', async () => {
    // Mock file upload
    const { uploadFile } = await import('../lib/storage');
    vi.mocked(uploadFile).mockResolvedValue('test-file-id');

    const fileData = {
      title: 'File Upload Video',
      description: 'Test file upload',
      file: {
        name: 'test-video.mp4',
        size: 1024 * 1024 * 10, // 10MB
        type: 'video/mp4'
      }
    };

    const videoId = await testCtx.run(async (ctx) => {
      return await ctx.runMutation(api.videos.createVideoFromFile, fileData);
    });

    expect(videoId).toBeDefined();
    expect(uploadFile).toHaveBeenCalledWith(expect.any(Object));

    // Verify video was created with file URL
    const video = await testCtx.run(async (ctx) => {
      return await ctx.runQuery(api.videos.getVideo, { videoId });
    });

    expect(video?.fileUrl).toBe('test-file-id');
  });

  it('updates video status correctly', async () => {
    // Create a video first
    const videoId = await testCtx.run(async (ctx) => {
      return await ctx.db.insert('videos', {
        userId: 'test-user-id',
        title: 'Test Video',
        youtubeUrl: 'https://youtube.com/watch?v=test',
        status: 'processing',
        createdAt: Date.now()
      });
    });

    // Update status to completed
    await testCtx.run(async (ctx) => {
      return await ctx.runMutation(api.videos.updateVideoStatus, {
        videoId,
        status: 'completed',
        transcriptId: 'test-transcript-id'
      });
    });

    // Verify status was updated
    const video = await testCtx.run(async (ctx) => {
      return await ctx.db.get(videoId);
    });

    expect(video?.status).toBe('completed');
    expect(video?.transcriptId).toBe('test-transcript-id');
    expect(video?.updatedAt).toBeDefined();
  });

  it('enforces video ownership permissions', async () => {
    // Create video as test user
    const videoId = await testCtx.run(async (ctx) => {
      return await ctx.db.insert('videos', {
        userId: 'test-user-id',
        title: 'Test Video',
        youtubeUrl: 'https://youtube.com/watch?v=test',
        status: 'processing',
        createdAt: Date.now()
      });
    });

    // Try to update as different user
    const otherUserCtx = createTestContext({
      auth: {
        userId: 'other-user-id',
        subjectId: 'other-user-id'
      }
    });

    await expect(
      otherUserCtx.run(async (ctx) => {
        return await ctx.runMutation(api.videos.updateVideoStatus, {
          videoId,
          status: 'completed'
        });
      })
    ).rejects.toThrow('Unauthorized');
  });
});
```

### 2. Query Testing

```typescript
// convex/tests/queries.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { testCtx } from '../test-setup';
import { api } from '../_generated/api';

describe('Video Queries', () => {
  beforeEach(async () => {
    // Set up test data
    await testCtx.run(async (ctx) => {
      // Create test videos for different users and statuses
      const testVideos = [
        {
          userId: 'test-user-id',
          title: 'User 1 - Processing',
          youtubeUrl: 'https://youtube.com/watch?v=test1',
          status: 'processing' as const,
          createdAt: Date.now() - 5000
        },
        {
          userId: 'test-user-id',
          title: 'User 1 - Completed',
          youtubeUrl: 'https://youtube.com/watch?v=test2',
          status: 'completed' as const,
          createdAt: Date.now() - 3000
        },
        {
          userId: 'test-user-id',
          title: 'User 1 - Failed',
          youtubeUrl: 'https://youtube.com/watch?v=test3',
          status: 'failed' as const,
          createdAt: Date.now() - 1000
        },
        {
          userId: 'other-user-id',
          title: 'Other User - Completed',
          youtubeUrl: 'https://youtube.com/watch?v=test4',
          status: 'completed' as const,
          createdAt: Date.now() - 2000
        }
      ];

      for (const video of testVideos) {
        await ctx.db.insert('videos', video);
      }
    });
  });

  it('returns only user\'s videos', async () => {
    const userVideos = await testCtx.run(async (ctx) => {
      return await ctx.runQuery(api.videos.getUserVideos);
    });

    expect(userVideos).toHaveLength(3);
    expect(userVideos.every(video => video.userId === 'test-user-id')).toBe(true);
    expect(userVideos.map(v => v.title)).toEqual([
      'User 1 - Failed', // Most recent first
      'User 1 - Completed',
      'User 1 - Processing'
    ]);
  });

  it('filters videos by status', async () => {
    const completedVideos = await testCtx.run(async (ctx) => {
      return await ctx.runQuery(api.videos.getUserVideosByStatus, {
        status: 'completed'
      });
    });

    expect(completedVideos).toHaveLength(1);
    expect(completedVideos[0].title).toBe('User 1 - Completed');
    expect(completedVideos[0].status).toBe('completed');
  });

  it('supports pagination', async () => {
    // Add more videos for pagination testing
    await testCtx.run(async (ctx) => {
      for (let i = 5; i <= 15; i++) {
        await ctx.db.insert('videos', {
          userId: 'test-user-id',
          title: `Video ${i}`,
          youtubeUrl: `https://youtube.com/watch?v=test${i}`,
          status: 'completed',
          createdAt: Date.now() - (i * 1000)
        });
      }
    });

    // Test first page
    const firstPage = await testCtx.run(async (ctx) => {
      return await ctx.runQuery(api.videos.getUserVideos, {
        pagination: { limit: 5 }
      });
    });

    expect(firstPage).toHaveLength(5);

    // Test second page
    const secondPage = await testCtx.run(async (ctx) => {
      return await ctx.runQuery(api.videos.getUserVideos, {
        pagination: {
          limit: 5,
          cursor: firstPage[firstPage.length - 1]._creationTime
        }
      });
    });

    expect(secondPage).toHaveLength(5);
    expect(secondPage[0]._creationTime).toBeLessThan(firstPage[firstPage.length - 1]._creationTime);
  });

  it('searches videos by title', async () => {
    const searchResults = await testCtx.run(async (ctx) => {
      return await ctx.runQuery(api.videos.searchVideos, {
        query: 'Completed'
      });
    });

    expect(searchResults).toHaveLength(1);
    expect(searchResults[0].title).toBe('User 1 - Completed');
  });

  it('returns empty results for non-existent videos', async () => {
    const video = await testCtx.run(async (ctx) => {
      return await ctx.runQuery(api.videos.getVideo, {
        videoId: 'non-existent-id'
      });
    });

    expect(video).toBeNull();
  });

  it('handles transcript queries efficiently', async () => {
    // Create a video with transcript
    const videoId = await testCtx.run(async (ctx) => {
      return await ctx.db.insert('videos', {
        userId: 'test-user-id',
        title: 'Video with Transcript',
        youtubeUrl: 'https://youtube.com/watch?v=transcript',
        status: 'completed',
        transcriptId: 'test-transcript-id',
        createdAt: Date.now()
      });
    });

    // Create transcript
    await testCtx.run(async (ctx) => {
      await ctx.db.insert('transcripts', {
        videoId,
        text: 'This is a test transcript with searchable content',
        words: [
          { text: 'This', start: 0, end: 300 },
          { text: 'is', start: 400, end: 600 },
          { text: 'a', start: 700, end: 850 },
          { text: 'test', start: 950, end: 1300 },
          { text: 'transcript', start: 1400, end: 2100 }
        ],
        createdAt: Date.now()
      });
    });

    // Query transcript
    const transcript = await testCtx.run(async (ctx) => {
      return await ctx.runQuery(api.transcripts.getTranscript, { videoId });
    });

    expect(transcript).toBeDefined();
    expect(transcript?.text).toBe('This is a test transcript with searchable content');
    expect(transcript?.words).toHaveLength(5);
  });
});
```

---

## Authentication and Authorization Testing

### 1. Authentication Flow Testing

```typescript
// convex/tests/authentication.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { testCtx, adminCtx, anonymousCtx } from '../test-setup';
import { api } from '../_generated/api';

describe('Authentication and Authorization', () => {
  it('allows authenticated users to create videos', async () => {
    const videoData = {
      title: 'Authenticated User Video',
      youtubeUrl: 'https://youtube.com/watch?v=auth-test'
    };

    const videoId = await testCtx.run(async (ctx) => {
      return await ctx.runMutation(api.videos.createVideo, videoData);
    });

    expect(videoId).toBeDefined();
  });

  it('rejects unauthenticated requests', async () => {
    const videoData = {
      title: 'Anonymous User Video',
      youtubeUrl: 'https://youtube.com/watch?v=anon-test'
    };

    await expect(
      anonymousCtx.run(async (ctx) => {
        return await ctx.runMutation(api.videos.createVideo, videoData);
      })
    ).rejects.toThrow('Unauthenticated');
  });

  it('enforces user ownership permissions', async () => {
    // Create video as test user
    const videoId = await testCtx.run(async (ctx) => {
      return await ctx.db.insert('videos', {
        userId: 'test-user-id',
        title: 'Test User Video',
        youtubeUrl: 'https://youtube.com/watch?v=ownership-test',
        status: 'processing',
        createdAt: Date.now()
      });
    });

    // Test user can access their own video
    const video = await testCtx.run(async (ctx) => {
      return await ctx.runQuery(api.videos.getVideo, { videoId });
    });

    expect(video).toBeDefined();
    expect(video?.userId).toBe('test-user-id');

    // Other user cannot access the video
    const otherUserCtx = createTestContext({
      auth: {
        userId: 'other-user-id',
        subjectId: 'other-user-id'
      }
    });

    const otherUserVideo = await otherUserCtx.run(async (ctx) => {
      return await ctx.runQuery(api.videos.getVideo, { videoId });
    });

    expect(otherUserVideo).toBeNull();

    // Other user cannot update the video
    await expect(
      otherUserCtx.run(async (ctx) => {
        return await ctx.runMutation(api.videos.updateVideoStatus, {
          videoId,
          status: 'completed'
        });
      })
    ).rejects.toThrow('Unauthorized');

    // Other user cannot delete the video
    await expect(
      otherUserCtx.run(async (ctx) => {
        return await ctx.runMutation(api.videos.deleteVideo, { videoId });
      })
    ).rejects.toThrow('Unauthorized');
  });

  it('allows admin users to access all videos', async () => {
    // Create video as regular user
    const videoId = await testCtx.run(async (ctx) => {
      return await ctx.db.insert('videos', {
        userId: 'test-user-id',
        title: 'Regular User Video',
        youtubeUrl: 'https://youtube.com/watch?v=admin-test',
        status: 'processing',
        createdAt: Date.now()
      });
    });

    // Admin can access the video
    const adminVideo = await adminCtx.run(async (ctx) => {
      return await ctx.runQuery(api.videos.getVideo, { videoId });
    });

    expect(adminVideo).toBeDefined();
    expect(adminVideo?.userId).toBe('test-user-id');

    // Admin can update the video
    await adminCtx.run(async (ctx) => {
      return await ctx.runMutation(api.videos.updateVideoStatus, {
        videoId,
        status: 'completed'
      });
    });

    // Verify update
    const updatedVideo = await adminCtx.run(async (ctx) => {
      return await ctx.runQuery(api.videos.getVideo, { videoId });
    });

    expect(updatedVideo?.status).toBe('completed');
  });

  it('validates user permissions for sensitive operations', async () => {
    // Test bulk operations require admin permissions
    await expect(
      testCtx.run(async (ctx) => {
        return await ctx.runMutation(api.admin.bulkUpdateVideos, {
          videoIds: ['test-id-1', 'test-id-2'],
          updates: { status: 'completed' }
        });
      })
    ).rejects.toThrow('Admin access required');

    // Admin can perform bulk operations
    const result = await adminCtx.run(async (ctx) => {
      return await ctx.runMutation(api.admin.bulkUpdateVideos, {
        videoIds: ['test-id-1', 'test-id-2'],
        updates: { status: 'completed' }
      });
    });

    expect(result).toBeDefined();
  });
});
```

### 2. Role-Based Access Control Testing

```typescript
// convex/tests/rbac.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestContext } from '../test-setup';
import { api } from '../_generated/api';

describe('Role-Based Access Control', () => {
  let userCtx: any;
  let moderatorCtx: any;
  let adminCtx: any;

  beforeEach(() => {
    userCtx = createTestContext({
      auth: {
        userId: 'user-id',
        subjectId: 'user-id',
        role: 'user'
      }
    });

    moderatorCtx = createTestContext({
      auth: {
        userId: 'moderator-id',
        subjectId: 'moderator-id',
        role: 'moderator'
      }
    });

    adminCtx = createTestContext({
      auth: {
        userId: 'admin-id',
        subjectId: 'admin-id',
        role: 'admin'
      }
    });
  });

  it('restricts user operations appropriately', async () => {
    // Regular users can only CRUD their own resources
    const userOperations = [
      { fn: api.videos.createVideo, allowed: true },
      { fn: api.videos.getUserVideos, allowed: true },
      { fn: api.admin.getSystemStats, allowed: false },
      { fn: api.admin.deleteUser, allowed: false },
      { fn: api.system.maintenance, allowed: false }
    ];

    for (const operation of userOperations) {
      if (operation.allowed) {
        // Should succeed or fail based on business logic, not permissions
        await expect(
          userCtx.run(async (ctx) => {
            return ctx.runMutation(operation.fn, {});
          })
        ).resolves.toBeDefined();
      } else {
        // Should fail due to insufficient permissions
        await expect(
          userCtx.run(async (ctx) => {
            return ctx.runMutation(operation.fn, {});
          })
        ).rejects.toThrow(/unauthorized|admin|permission/i);
      }
    }
  });

  it('provides moderator access to moderation features', async () => {
    // Moderators can access content moderation features
    await expect(
      moderatorCtx.run(async (ctx) => {
        return await ctx.runQuery(api.moderation.getFlaggedContent);
      })
    ).resolves.toBeDefined();

    await expect(
      moderatorCtx.run(async (ctx) => {
        return await ctx.runMutation(api.moderation.flagContent, {
          videoId: 'test-video-id',
          reason: 'inappropriate'
        });
      })
    ).resolves.toBeDefined();

    // But moderators cannot access admin-only features
    await expect(
      moderatorCtx.run(async (ctx) => {
        return await ctx.runMutation(api.system.maintenance, {});
      })
    ).rejects.toThrow(/admin|permission/i);
  });

  it('grants full admin access', async () => {
    // Admins can access all operations
    const adminOperations = [
      api.videos.createVideo,
      api.admin.getSystemStats,
      api.admin.deleteUser,
      api.system.maintenance,
      api.moderation.getFlaggedContent
    ];

    for (const operation of adminOperations) {
      await expect(
        adminCtx.run(async (ctx) => {
          return ctx.runMutation(operation, {});
        })
      ).resolves.toBeDefined();
    }
  });
});
```

---

## Reactive Data Testing

### 1. Real-time Updates Testing

```typescript
// convex/tests/reactive-data.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { testCtx } from '../test-setup';
import { api } from '../_generated/api';

describe('Reactive Data Updates', () => {
  it('updates clients when video status changes', async () => {
    // Create a video
    const videoId = await testCtx.run(async (ctx) => {
      return await ctx.db.insert('videos', {
        userId: 'test-user-id',
        title: 'Reactive Test Video',
        youtubeUrl: 'https://youtube.com/watch?v=reactive',
        status: 'processing',
        createdAt: Date.now()
      });
    });

    // Set up a query to watch the video
    const initialVideo = await testCtx.run(async (ctx) => {
      return await ctx.runQuery(api.videos.getVideo, { videoId });
    });

    expect(initialVideo?.status).toBe('processing');

    // Simulate external status update (e.g., from AssemblyAI webhook)
    await testCtx.run(async (ctx) => {
      await ctx.db.patch(videoId, {
        status: 'completed',
        transcriptId: 'test-transcript-id',
        updatedAt: Date.now()
      });
    });

    // Query should return updated data
    const updatedVideo = await testCtx.run(async (ctx) => {
      return await ctx.runQuery(api.videos.getVideo, { videoId });
    });

    expect(updatedVideo?.status).toBe('completed');
    expect(updatedVideo?.transcriptId).toBe('test-transcript-id');
    expect(updatedVideo?.updatedAt).toBeDefined();
  });

  it('handles concurrent updates correctly', async () => {
    const videoId = await testCtx.run(async (ctx) => {
      return await ctx.db.insert('videos', {
        userId: 'test-user-id',
        title: 'Concurrency Test Video',
        youtubeUrl: 'https://youtube.com/watch?v=concurrent',
        status: 'processing',
        createdAt: Date.now()
      });
    });

    // Simulate concurrent updates
    const updates = [
      { status: 'completed', transcriptId: 'transcript-1' },
      { status: 'processing', transcriptId: 'transcript-2' }, // This should be rejected
      { title: 'Updated Title' }
    ];

    for (const update of updates) {
      try {
        await testCtx.run(async (ctx) => {
          await ctx.db.patch(videoId, {
            ...update,
            updatedAt: Date.now()
          });
        });
      } catch (error) {
        // Some updates might fail due to validation rules
      }
    }

    // Final state should be consistent
    const finalVideo = await testCtx.run(async (ctx) => {
      return await ctx.runQuery(api.videos.getVideo, { videoId });
    });

    expect(finalVideo).toBeDefined();
    // Should have at least some of the updates applied
    expect(finalVideo?.title).toBe('Updated Title');
  });

  it('validates reactive query optimization', async () => {
    // Create multiple videos
    const videoIds = await testCtx.run(async (ctx) => {
      const ids = [];
      for (let i = 0; i < 10; i++) {
        const id = await ctx.db.insert('videos', {
          userId: 'test-user-id',
          title: `Video ${i}`,
          youtubeUrl: `https://youtube.com/watch?v=test${i}`,
          status: i % 2 === 0 ? 'completed' : 'processing',
          createdAt: Date.now() - (i * 1000)
        });
        ids.push(id);
      }
      return ids;
    });

    // Query should efficiently filter results
    const startTime = performance.now();
    const completedVideos = await testCtx.run(async (ctx) => {
      return await ctx.runQuery(api.videos.getUserVideosByStatus, {
        status: 'completed'
      });
    });
    const endTime = performance.now();

    expect(completedVideos).toHaveLength(5);
    expect(completedVideos.every(v => v.status === 'completed')).toBe(true);

    // Query should be fast (using indexes)
    expect(endTime - startTime).toBeLessThan(50);

    // Update one video's status
    await testCtx.run(async (ctx) => {
      await ctx.db.patch(videoIds[0], {
        status: 'failed',
        updatedAt: Date.now()
      });
    });

    // Query results should reflect the change
    const updatedCompletedVideos = await testCtx.run(async (ctx) => {
      return await ctx.runQuery(api.videos.getUserVideosByStatus, {
        status: 'completed'
      });
    });

    expect(updatedCompletedVideos).toHaveLength(4);
  });
});
```

---

## Cron Job and Scheduler Testing

### 1. Scheduled Task Testing

```typescript
// convex/tests/cron-jobs.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testCtx } from '../test-setup';
import { api } from '../_generated/api';

// Mock external services
vi.mock('../lib/assemblyai', () => ({
  getTranscriptResult: vi.fn(),
  retryTranscription: vi.fn()
}));

vi.mock('../lib/email', () => ({
  sendNotificationEmail: vi.fn()
}));

describe('Cron Jobs and Scheduled Tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes pending transcription jobs', async () => {
    // Create video with pending transcription
    const videoId = await testCtx.run(async (ctx) => {
      return await ctx.db.insert('videos', {
        userId: 'test-user-id',
        title: 'Pending Transcription',
        youtubeUrl: 'https://youtube.com/watch?v=pending',
        status: 'processing',
        transcriptId: 'pending-transcript-id',
        createdAt: Date.now() - 60000 // Created 1 minute ago
      });
    });

    // Mock AssemblyAI response
    const { getTranscriptResult } = await import('../lib/assemblyai');
    vi.mocked(getTranscriptResult).mockResolvedValue({
      id: 'pending-transcript-id',
      status: 'completed',
      text: 'Transcription completed successfully',
      words: [
        { text: 'Transcription', start: 0, end: 1000 },
        { text: 'completed', start: 1100, end: 2000 },
        { text: 'successfully', start: 2100, end: 3000 }
      ]
    });

    // Run the cron job
    await testCtx.run(async (ctx) => {
      return await ctx.runAction(api.cron.processPendingTranscriptions);
    });

    // Verify video status was updated
    const video = await testCtx.run(async (ctx) => {
      return await ctx.db.get(videoId);
    });

    expect(video?.status).toBe('completed');
    expect(video?.transcriptId).toBe('pending-transcript-id');

    // Verify transcript was created
    const transcript = await testCtx.run(async (ctx) => {
      return await ctx.runQuery(api.transcripts.getTranscript, { videoId });
    });

    expect(transcript).toBeDefined();
    expect(transcript?.text).toBe('Transcription completed successfully');
  });

  it('handles transcription failures with retry logic', async () => {
    const videoId = await testCtx.run(async (ctx) => {
      return await ctx.db.insert('videos', {
        userId: 'test-user-id',
        title: 'Failed Transcription',
        youtubeUrl: 'https://youtube.com/watch?v=failed',
        status: 'processing',
        transcriptId: 'failed-transcript-id',
        retryCount: 2,
        createdAt: Date.now() - 300000 // Created 5 minutes ago
      });
    });

    // Mock failed transcription
    const { getTranscriptResult, retryTranscription } = await import('../lib/assemblyai');
    vi.mocked(getTranscriptResult).mockResolvedValue({
      id: 'failed-transcript-id',
      status: 'failed',
      error: 'Audio processing failed'
    });

    vi.mocked(retryTranscription).mockResolvedValue('new-transcript-id');

    // Run the cron job
    await testCtx.run(async (ctx) => {
      return await ctx.runAction(api.cron.processFailedTranscriptions);
    });

    // Verify retry was attempted
    expect(retryTranscription).toHaveBeenCalledWith('failed-transcript-id');

    // Verify video was updated with new transcript ID
    const video = await testCtx.run(async (ctx) => {
      return await ctx.db.get(videoId);
    });

    expect(video?.transcriptId).toBe('new-transcript-id');
    expect(video?.retryCount).toBe(3);
  });

  it('marks videos as failed after max retries', async () => {
    const videoId = await testCtx.run(async (ctx) => {
      return await ctx.db.insert('videos', {
        userId: 'test-user-id',
        title: 'Max Retry Video',
        youtubeUrl: 'https://youtube.com/watch?v=maxretry',
        status: 'processing',
        transcriptId: 'max-retry-transcript',
        retryCount: 5, // Max retries reached
        createdAt: Date.now() - 600000 // Created 10 minutes ago
      });
    });

    // Mock failed transcription
    const { getTranscriptResult } = await import('../lib/assemblyai');
    vi.mocked(getTranscriptResult).mockResolvedValue({
      id: 'max-retry-transcript',
      status: 'failed',
      error: 'Permanent failure'
    });

    // Run the cron job
    await testCtx.run(async (ctx) => {
      return await ctx.runAction(api.cron.processFailedTranscriptions);
    });

    // Verify video was marked as failed
    const video = await testCtx.run(async (ctx) => {
      return await ctx.db.get(videoId);
    });

    expect(video?.status).toBe('failed');
    expect(video?.retryCount).toBe(5); // Should not increment beyond max

    // Verify notification email was sent
    const { sendNotificationEmail } = await import('../lib/email');
    expect(sendNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'transcription_failed',
        videoId
      })
    );
  });

  it('cleans up old temporary data', async () => {
    // Create old temporary data
    await testCtx.run(async (ctx) => {
      // Create old temporary files
      for (let i = 0; i < 5; i++) {
        await ctx.db.insert('temporaryFiles', {
          filename: `temp-file-${i}.mp4`,
          path: `/tmp/temp-file-${i}.mp4`,
          createdAt: Date.now() - 86400000, // 1 day old
          expiresAt: Date.now() - 3600000   // Expired 1 hour ago
        });
      }

      // Create recent temporary files (should not be deleted)
      for (let i = 5; i < 8; i++) {
        await ctx.db.insert('temporaryFiles', {
          filename: `recent-file-${i}.mp4`,
          path: `/tmp/recent-file-${i}.mp4`,
          createdAt: Date.now() - 1800000, // 30 minutes old
          expiresAt: Date.now() + 3600000   // Expires in 1 hour
        });
      }
    });

    // Run cleanup cron job
    const deletedCount = await testCtx.run(async (ctx) => {
      return await ctx.runAction(api.cron.cleanupTemporaryData);
    });

    expect(deletedCount).toBe(5);

    // Verify only recent files remain
    const remainingFiles = await testCtx.run(async (ctx) => {
      return await ctx.db.query('temporaryFiles').collect();
    });

    expect(remainingFiles).toHaveLength(3);
    expect(remainingFiles.every(f => f.filename.startsWith('recent-file-'))).toBe(true);
  });
});
```

---

## Migration and Schema Evolution Testing

### 1. Database Migration Testing

```typescript
// convex/tests/migrations.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { testCtx } from '../test-setup';
import { api } from '../_generated/api';

describe('Database Migrations', () => {
  it('handles schema version migrations correctly', async () => {
    // Simulate old schema data
    const oldVideoData = {
      userId: 'test-user-id',
      title: 'Legacy Video',
      youtubeUrl: 'https://youtube.com/watch?v=legacy',
      status: 'completed',
      createdAt: Date.now()
      // Missing new fields like updatedAt, transcriptId, etc.
    };

    // Insert using legacy schema
    const videoId = await testCtx.run(async (ctx) => {
      return await ctx.db.insert('videos', oldVideoData);
    });

    // Run migration
    await testCtx.run(async (ctx) => {
      return await ctx.runAction(api.migrations.addMissingFields);
    });

    // Verify migration added default values
    const migratedVideo = await testCtx.run(async (ctx) => {
      return await ctx.db.get(videoId);
    });

    expect(migratedVideo).toEqual(
      expect.objectContaining({
        ...oldVideoData,
        _id: videoId,
        updatedAt: null, // Should be null for legacy records
        transcriptId: null, // Should be null for videos without transcripts
        processingStartedAt: null,
        processingCompletedAt: null
      })
    );
  });

  it('creates new indexes for performance', async () => {
    // Create test data
    const videoIds = await testCtx.run(async (ctx) => {
      const ids = [];
      for (let i = 0; i < 100; i++) {
        const id = await ctx.db.insert('videos', {
          userId: `user-${i % 10}`, // 10 different users
          title: `Video ${i}`,
          youtubeUrl: `https://youtube.com/watch?v=test${i}`,
          status: ['processing', 'completed', 'failed'][i % 3] as any,
          createdAt: Date.now() - (i * 1000),
          duration: 60 + (i * 10) // Different durations
        });
        ids.push(id);
      }
      return ids;
    });

    // Test query performance before index creation
    const startTime = performance.now();
    const userVideos = await testCtx.run(async (ctx) => {
      return await ctx.db.query('videos')
        .filter(q => q.eq(q.field('userId'), 'user-1'))
        .collect();
    });
    const queryTimeBefore = performance.now() - startTime;

    // Run migration to create new index
    await testCtx.run(async (ctx) => {
      return await ctx.runAction(api.migrations.createDurationIndex);
    });

    // Test query performance after index creation
    const startTimeAfter = performance.now();
    const userVideosAfter = await testCtx.run(async (ctx) => {
      return await ctx.db.query('videos')
        .withIndex('by_user_duration', q => q.eq('userId', 'user-1'))
        .collect();
    });
    const queryTimeAfter = performance.now() - startTimeAfter;

    // Both queries should return same results
    expect(userVideos).toEqual(userVideosAfter);

    // Indexed query should be faster
    expect(queryTimeAfter).toBeLessThan(queryTimeBefore);
  });

  it('handles data format migrations', async () => {
    // Create data with old format
    const oldTranscriptData = {
      videoId: 'test-video-id',
      text: 'Old format transcript with different word structure',
      // Old format: flat array of words with simple objects
      words: [
        'Old', 'format', 'transcript', 'with', 'different', 'word', 'structure'
      ] as any, // Old format: just strings
      createdAt: Date.now()
    };

    const transcriptId = await testCtx.run(async (ctx) => {
      return await ctx.db.insert('transcripts', oldTranscriptData);
    });

    // Run migration to convert to new format
    await testCtx.run(async (ctx) => {
      return await ctx.runAction(api.migrations.migrateTranscriptFormat);
    });

    // Verify migration converted to new format
    const migratedTranscript = await testCtx.run(async (ctx) => {
      return await ctx.db.get(transcriptId);
    });

    expect(migratedTranscript?.words).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: expect.any(String),
          start: expect.any(Number),
          end: expect.any(Number)
        })
      ])
    );

    // Verify timestamps were generated
    expect(migratedTranscript?.words[0]).toHaveProperty('start');
    expect(migratedTranscript?.words[0]).toHaveProperty('end');
    expect(migratedTranscript?.words[0].start).toBeLessThan(
      migratedTranscript?.words[0].end
    );
  });
});
```

---

## Performance and Load Testing

### 1. Convex Function Performance Testing

```typescript
// convex/tests/performance.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { testCtx } from '../test-setup';
import { api } from '../_generated/api';

describe('Convex Function Performance', () => {
  beforeEach(async () => {
    // Create performance test data
    await testCtx.run(async (ctx) => {
      const videoCount = 1000;
      const userCount = 50;

      for (let i = 0; i < videoCount; i++) {
        await ctx.db.insert('videos', {
          userId: `user-${i % userCount}`,
          title: `Performance Test Video ${i}`,
          youtubeUrl: `https://youtube.com/watch?v=perf${i}`,
          status: ['processing', 'completed', 'failed'][i % 3] as any,
          createdAt: Date.now() - (i * 1000),
          duration: 60 + (i % 600), // 1-10 minutes
          fileSize: 1024 * 1024 * (10 + (i % 100)) // 10-110MB
        });
      }

      for (let i = 0; i < userCount; i++) {
        await ctx.db.insert('users', {
          clerkId: `user-${i}`,
          email: `user${i}@test.com`,
          createdAt: Date.now() - (i * 10000)
        });
      }
    });
  });

  it('handles large dataset queries efficiently', async () => {
    // Test query performance with large dataset
    const startTime = performance.now();

    const videos = await testCtx.run(async (ctx) => {
      return await ctx.runQuery(api.videos.getUserVideos, {
        pagination: { limit: 100 }
      });
    });

    const endTime = performance.now();
    const queryTime = endTime - startTime;

    expect(videos).toHaveLength(100);
    expect(queryTime).toBeLessThan(100); // Should complete within 100ms
  });

  it('performs indexed queries under load', async () => {
    const queryTimes: number[] = [];

    // Run multiple queries to test consistency
    for (let i = 0; i < 10; i++) {
      const startTime = performance.now();

      const completedVideos = await testCtx.run(async (ctx) => {
        return await ctx.runQuery(api.videos.getUserVideosByStatus, {
          status: 'completed',
          pagination: { limit: 50 }
        });
      });

      const endTime = performance.now();
      queryTimes.push(endTime - startTime);

      expect(completedVideos.length).toBeGreaterThan(0);
    }

    // Calculate average query time
    const avgQueryTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
    const maxQueryTime = Math.max(...queryTimes);

    expect(avgQueryTime).toBeLessThan(50); // Average under 50ms
    expect(maxQueryTime).toBeLessThan(100); // Max under 100ms
  });

  it('handles concurrent operations without conflicts', async () => {
    const concurrentOperations = 20;
    const results = [];

    // Run concurrent video creations
    const promises = Array.from({ length: concurrentOperations }, async (_, i) => {
      const startTime = performance.now();

      const videoId = await testCtx.run(async (ctx) => {
        return await ctx.runMutation(api.videos.createVideo, {
          title: `Concurrent Video ${i}`,
          youtubeUrl: `https://youtube.com/watch?v=concurrent${i}`,
          description: `Concurrent test video ${i}`
        });
      });

      const endTime = performance.now();
      const operationTime = endTime - startTime;

      return { videoId, operationTime };
    });

    const concurrentResults = await Promise.all(promises);

    // Verify all operations succeeded
    expect(concurrentResults).toHaveLength(concurrentOperations);
    expect(concurrentResults.every(r => r.videoId)).toBe(true);

    // Verify operation times are reasonable
    const operationTimes = concurrentResults.map(r => r.operationTime);
    const avgOperationTime = operationTimes.reduce((a, b) => a + b, 0) / operationTimes.length;

    expect(avgOperationTime).toBeLessThan(200); // Average under 200ms

    // Verify videos were created correctly
    const createdVideos = await testCtx.run(async (ctx) => {
      return await ctx.db.query('videos')
        .withIndex('by_user', q => q.eq('userId', 'test-user-id'))
        .filter(q =>
          q.contains(q.field('title'), 'Concurrent Video')
        )
        .collect();
    });

    expect(createdVideos).toHaveLength(concurrentOperations);
  });

  it('manages memory usage during large operations', async () => {
    // Test memory usage during bulk operations
    const initialMemory = process.memoryUsage().heapUsed;

    // Perform large number of operations
    for (let i = 0; i < 100; i++) {
      await testCtx.run(async (ctx) => {
        // Create video
        const videoId = await ctx.db.insert('videos', {
          userId: 'test-user-id',
          title: `Memory Test Video ${i}`,
          youtubeUrl: `https://youtube.com/watch?v=memory${i}`,
          status: 'processing',
          createdAt: Date.now()
        });

        // Create transcript
        await ctx.db.insert('transcripts', {
          videoId,
          text: `Memory test transcript ${i} with some content to simulate real data`,
          words: Array.from({ length: 50 }, (_, j) => ({
            text: `word${j}`,
            start: j * 100,
            end: (j + 1) * 100
          })),
          createdAt: Date.now()
        });

        // Update video status
        await ctx.db.patch(videoId, {
          status: 'completed',
          updatedAt: Date.now()
        });
      });
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    // Memory increase should be reasonable (less than 50MB)
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);

    // Verify all data was created correctly
    const videoCount = await testCtx.run(async (ctx) => {
      return await ctx.db.query('videos')
        .filter(q => q.contains(q.field('title'), 'Memory Test Video'))
        .count();
    });

    expect(videoCount).toBe(100);
  });

  it('optimizes complex query performance', async () => {
    // Test complex search query with multiple filters
    const startTime = performance.now();

    const searchResults = await testCtx.run(async (ctx) => {
      return await ctx.runQuery(api.videos.searchVideos, {
        query: 'Test',
        filters: {
          status: 'completed',
          durationRange: { min: 60, max: 300 }, // 1-5 minutes
          dateRange: {
            start: Date.now() - 86400000, // Last 24 hours
            end: Date.now()
          }
        },
        pagination: { limit: 20 }
      });
    });

    const endTime = performance.now();
    const queryTime = endTime - startTime;

    expect(searchResults).toBeDefined();
    expect(Array.isArray(searchResults)).toBe(true);
    expect(queryTime).toBeLessThan(150); // Complex query should still be fast

    // Test search performance with different query sizes
    const queryLengths = [1, 5, 10, 20, 50];
    const searchTimes: number[] = [];

    for (const length of queryLengths) {
      const query = 'a'.repeat(length);
      const searchStart = performance.now();

      const results = await testCtx.run(async (ctx) => {
        return await ctx.runQuery(api.videos.searchVideos, {
          query,
          pagination: { limit: 10 }
        });
      });

      const searchEnd = performance.now();
      searchTimes.push(searchEnd - searchStart);
    }

    // Search time should not increase dramatically with query length
    const maxSearchTime = Math.max(...searchTimes);
    expect(maxSearchTime).toBeLessThan(100); // Even long queries should be fast
  });
});
```

This comprehensive Convex testing guide provides enterprise-grade testing patterns specifically designed for self-hosted Convex deployments, ensuring database integrity, function reliability, and optimal performance for the iReadYouTube application.