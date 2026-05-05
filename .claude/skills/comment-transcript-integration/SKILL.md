---
name: comment-transcript-integration
description: >
  Comment-transcript integration service that bridges YouTube comments with video transcripts,
  enabling contextual discussions, timestamped comments, and community-driven transcript enhancement.
---

# Comment-Transcript Integration Skill

**Skill ID**: `comment-transcript-integration`
**Version**: 1.0.0
**Category**: Social & Community Features
**Tags**: `comments`, `transcript`, `social`, `engagement`, `youtube`

## 🎯 Purpose

Comprehensive comment-transcript integration service for iReadYouTube that bridges YouTube comments with video transcripts, enabling contextual discussions, timestamped comments, and community-driven transcript enhancement. Seamlessly integrates with the modular service layer architecture.

## 🚀 Core Capabilities

### 1. **YouTube Comments Integration**
- **Comment Fetching**: Retrieve comments from YouTube videos via Data API v3
- **Timestamp Extraction**: Identify timestamps mentioned in comments
- **Comment Analysis**: Analyze sentiment, topics, and engagement patterns
- **Thread Management**: Handle comment replies and nested discussions

### 2. **Transcript-Linked Comments**
- **Timestamp Mapping**: Map comments to specific transcript segments
- **Contextual Display**: Show relevant comments when users view transcript sections
- **Comment Annotations**: Add comment insights directly to transcript viewer
- **Community Timestamps**: Allow users to add verified timestamps from comments

### 3. **Interactive Features**
- **Comment Threads**: Display comment discussions alongside transcript sections
- **User Annotations**: Enable user-added comments and notes on transcript
- **Community Corrections**: Allow community to suggest transcript improvements
- **Discussion Prompts**: Generate discussion questions based on content and comments

### 4. **Social Engagement**
- **Comment Analytics**: Track engagement patterns and popular discussion topics
- **Community Insights**: Identify key discussion points and questions
- **Trending Topics**: Extract trending topics from comment discussions
- **Sentiment Tracking**: Monitor audience sentiment throughout the video

## 🏗️ Service Integration

### Core Service Dependencies
```typescript
// Import existing modular services
import { VideoService } from '@/services/videoService';
import { TranscriptionService } from '@/services/transcriptionService';
import { YouTubeAPIService } from '@/services/youtubeAPIService';

// Comment-Transcript Integration Service
export class CommentTranscriptService {
  private youtubeAPI: YouTubeAPIService;
  private cache: Map<string, CommentData>;
  private sentimentAnalyzer: SentimentAnalyzer;

  constructor() {
    this.youtubeAPI = new YouTubeAPIService();
    this.cache = new Map();
    this.sentimentAnalyzer = new SentimentAnalyzer();
  }
}
```

### Service Layer Integration
- **VideoService**: Access video metadata and YouTube video IDs
- **TranscriptionService**: Work with transcripts and word timings for timestamp mapping
- **YouTubeAPIService**: Fetch comments and YouTube data
- **Error Handling**: Use centralized error handling system
- **Caching**: Implement intelligent caching for comment data

## 🔧 Implementation Details

### Core Service Implementation
```typescript
// src/services/commentTranscriptService.ts
import { z } from 'zod';
import type {
  Video,
  Transcript,
  Comment,
  CommentThread,
  TranscriptComment,
  CommentAnalytics,
  SentimentAnalysis,
  UserAnnotation
} from '@/types';
import { ApplicationError } from '@/errors';
import { cacheService } from '@/lib/cache';
import { YouTubeAPIService } from '@/services/youtubeAPIService';

// Comment Integration Schemas
const commentSchemas = {
  youtubeComment: z.object({
    id: z.string(),
    textDisplay: z.string(),
    textOriginal: z.string(),
    authorDisplayName: z.string(),
    authorProfileImageUrl: z.string().url(),
    authorChannelUrl: z.string().url().optional(),
    likeCount: z.number().min(0),
    publishedAt: z.string().datetime(),
    updatedAt: z.string().datetime().optional(),
    replies: z.array(z.any()).optional(),
    canReply: z.boolean()
  }),

  transcriptComment: z.object({
    id: z.string(),
    videoId: z.string(),
    transcriptId: z.string(),
    userId: z.string(),
    content: z.string().min(1).max(2000),
    timestamp: z.number().min(0),
    endTime: z.number().min(0).optional(),
    type: z.enum(['comment', 'question', 'correction', 'annotation']),
    likes: z.number().min(0).default(0),
    replies: z.number().min(0).default(0),
    isPublic: z.boolean().default(true),
    createdAt: z.number(),
    updatedAt: z.number().optional()
  }),

  commentAnalytics: z.object({
    videoId: z.string(),
    totalComments: z.number().min(0),
    totalLikes: z.number().min(0),
    averageSentiment: z.number().min(-1).max(1),
    topTopics: z.array(z.string()).max(10),
    engagementRate: z.number().min(0),
    commentDensity: z.array(z.object({
      timestamp: z.number(),
      commentCount: z.number(),
      averageSentiment: z.number()
    })).max(100),
    popularTimeRanges: z.array(z.object({
      startTime: z.number(),
      endTime: z.number(),
      commentCount: z.number(),
      engagement: z.number()
    })).max(10)
  })
};

export class CommentTranscriptService {
  private cacheKey = (videoId: string, type: string) => `comments:${videoId}:${type}`;
  private readonly YOUTUBE_COMMENT_PAGE_SIZE = 100;

  /**
   * Fetch YouTube comments for a video
   */
  static async fetchYouTubeComments(
    videoId: string,
    options: {
      maxResults?: number;
      sortBy?: 'relevance' | 'time' | 'likes';
      includeReplies?: boolean;
    } = {}
  ): Promise<CommentThread[]> {
    try {
      const cacheKey = this.cacheKey(videoId, 'youtube');
      const cached = await cacheService.get(cacheKey);
      if (cached && !options.maxResults) return cached as CommentThread[];

      const video = await VideoService.getVideoById(videoId);
      if (!video?.youtubeVideoId) {
        throw new ApplicationError(
          'VIDEO_NOT_FOUND',
          'YouTube video ID not found for comment fetching'
        );
      }

      const youtubeService = new YouTubeAPIService();
      const comments = await youtubeService.getVideoComments(video.youtubeVideoId, {
        maxResults: options.maxResults || 500,
        order: options.sortBy || 'relevance',
        includeReplies: options.includeReplies !== false
      });

      // Process and enhance comments
      const enhancedComments = await Promise.all(
        comments.map(comment => this.enhanceYouTubeComment(comment, videoId))
      );

      // Cache for 1 hour (comments change frequently)
      await cacheService.set(cacheKey, enhancedComments, { ttl: 3600 });

      return enhancedComments;
    } catch (error) {
      console.error('YouTube comments fetch failed:', error);
      throw new ApplicationError(
        'COMMENTS_FETCH_FAILED',
        'Failed to fetch YouTube comments',
        { originalError: error, videoId }
      );
    }
  }

  /**
   * Map YouTube comments to transcript timestamps
   */
  static async mapCommentsToTranscript(
    videoId: string,
    transcriptId: string
  ): Promise<TranscriptComment[]> {
    try {
      const cacheKey = this.cacheKey(videoId, 'mapped');
      const cached = await cacheService.get(cacheKey);
      if (cached) return cached as TranscriptComment[];

      // Get both comments and transcript data
      const [comments, transcript] = await Promise.all([
        this.fetchYouTubeComments(videoId),
        TranscriptionService.getTranscriptById(transcriptId)
      ]);

      if (!transcript?.wordTimings?.length) {
        throw new ApplicationError(
          'TRANSCRIPT_NOT_FOUND',
          'Transcript with word timings not found for comment mapping'
        );
      }

      // Extract timestamps from comments and map to transcript
      const mappedComments: TranscriptComment[] = [];

      for (const commentThread of comments) {
        const timestamps = this.extractTimestamps(commentThread.topComment.text);

        for (const timestamp of timestamps) {
          // Find closest word timing
          const wordTiming = this.findClosestWordTiming(timestamp, transcript.wordTimings);

          if (wordTiming) {
            mappedComments.push({
              id: `yt-${commentThread.topComment.id}-${timestamp}`,
              videoId,
              transcriptId,
              userId: `youtube-${commentThread.topComment.author}`,
              content: commentThread.topComment.text,
              timestamp: wordTiming.startTime,
              endTime: wordTiming.endTime,
              type: 'comment',
              likes: commentThread.topComment.likeCount,
              replies: commentThread.replies?.length || 0,
              isPublic: true,
              createdAt: new Date(commentThread.topComment.publishedAt).getTime(),
              metadata: {
                source: 'youtube',
                author: commentThread.topComment.authorDisplayName,
                authorUrl: commentThread.topComment.authorProfileImageUrl,
                originalCommentId: commentThread.topComment.id,
                threadId: commentThread.id
              }
            });
          }
        }

        // Also map reply comments
        if (commentThread.replies) {
          for (const reply of commentThread.replies) {
            const replyTimestamps = this.extractTimestamps(reply.text);

            for (const timestamp of replyTimestamps) {
              const wordTiming = this.findClosestWordTiming(timestamp, transcript.wordTimings);

              if (wordTiming) {
                mappedComments.push({
                  id: `yt-reply-${reply.id}-${timestamp}`,
                  videoId,
                  transcriptId,
                  userId: `youtube-${reply.author}`,
                  content: reply.text,
                  timestamp: wordTiming.startTime,
                  endTime: wordTiming.endTime,
                  type: 'comment',
                  likes: reply.likeCount,
                  replies: 0,
                  isPublic: true,
                  createdAt: new Date(reply.publishedAt).getTime(),
                  metadata: {
                    source: 'youtube',
                    author: reply.authorDisplayName,
                    authorUrl: reply.authorProfileImageUrl,
                    originalCommentId: reply.id,
                    threadId: commentThread.id,
                    isReply: true
                  }
                });
              }
            }
          }
        }
      }

      // Sort by timestamp
      mappedComments.sort((a, b) => a.timestamp - b.timestamp);

      // Cache for 30 minutes
      await cacheService.set(cacheKey, mappedComments, { ttl: 1800 });

      return mappedComments;
    } catch (error) {
      console.error('Comment mapping failed:', error);
      throw new ApplicationError(
        'COMMENT_MAPPING_FAILED',
        'Failed to map comments to transcript timestamps',
        { originalError: error, videoId, transcriptId }
      );
    }
  }

  /**
   * Add user annotation to transcript
   */
  static async addTranscriptAnnotation(
    data: {
      videoId: string;
      transcriptId: string;
      userId: string;
      content: string;
      timestamp: number;
      endTime?: number;
      type: 'comment' | 'question' | 'correction' | 'annotation';
      isPublic?: boolean;
    }
  ): Promise<TranscriptComment> {
    try {
      // Validate timestamp exists in transcript
      const transcript = await TranscriptionService.getTranscriptById(data.transcriptId);
      if (!transcript?.wordTimings?.length) {
        throw new ApplicationError(
          'TRANSCRIPT_NOT_FOUND',
          'Transcript not found for annotation'
        );
      }

      // Verify timestamp is within transcript bounds
      const maxTime = Math.max(...transcript.wordTimings.map(w => w.endTime || w.startTime));
      if (data.timestamp > maxTime) {
        throw new ApplicationError(
          'INVALID_TIMESTAMP',
          'Timestamp is outside transcript bounds'
        );
      }

      const annotation: TranscriptComment = {
        id: `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        videoId: data.videoId,
        transcriptId: data.transcriptId,
        userId: data.userId,
        content: data.content,
        timestamp: data.timestamp,
        endTime: data.endTime,
        type: data.type,
        likes: 0,
        replies: 0,
        isPublic: data.isPublic !== false,
        createdAt: Date.now(),
        metadata: {
          source: 'user',
          verified: false
        }
      };

      // Save to database (implementation depends on your setup)
      await this.saveTranscriptComment(annotation);

      // Clear relevant cache
      await cacheService.delete(this.cacheKey(data.videoId, 'mapped'));
      await cacheService.delete(this.cacheKey(data.transcriptId, 'annotations'));

      return annotation;
    } catch (error) {
      console.error('Annotation creation failed:', error);
      throw new ApplicationError(
        'ANNOTATION_CREATION_FAILED',
        'Failed to create transcript annotation',
        { originalError: error, data }
      );
    }
  }

  /**
   * Generate comment analytics for a video
   */
  static async generateCommentAnalytics(
    videoId: string
  ): Promise<CommentAnalytics> {
    try {
      const cacheKey = this.cacheKey(videoId, 'analytics');
      const cached = await cacheService.get(cacheKey);
      if (cached) return cached as CommentAnalytics;

      const [comments, mappedComments] = await Promise.all([
        this.fetchYouTubeComments(videoId),
        this.mapCommentsToTranscript(videoId, (await VideoService.getVideoById(videoId))?.transcriptId)
      ]);

      // Calculate basic metrics
      const totalComments = comments.length;
      const totalLikes = comments.reduce((sum, thread) =>
        sum + thread.topComment.likeCount +
        (thread.replies?.reduce((replySum, reply) => replySum + reply.likeCount, 0) || 0), 0
      );

      // Extract timestamps and sentiment
      const commentTimestamps = mappedComments.map(comment => comment.timestamp);
      const sentiments = await this.analyzeSentiments(mappedComments.map(c => c.content));
      const averageSentiment = sentiments.reduce((sum, sentiment) => sum + sentiment, 0) / sentiments.length;

      // Extract topics
      const topics = await this.extractTopics(mappedComments.map(c => c.content));

      // Generate comment density over time
      const commentDensity = this.calculateCommentDensity(mappedComments);

      // Find popular time ranges
      const popularTimeRanges = this.findPopularTimeRanges(mappedComments, commentDensity);

      // Calculate engagement rate
      const video = await VideoService.getVideoById(videoId);
      const engagementRate = video?.viewCount ? (totalComments / video.viewCount) * 100 : 0;

      const analytics: CommentAnalytics = {
        videoId,
        totalComments,
        totalLikes,
        averageSentiment,
        topTopics: topics,
        engagementRate,
        commentDensity,
        popularTimeRanges,
        generatedAt: Date.now()
      };

      // Cache for 6 hours
      await cacheService.set(cacheKey, analytics, { ttl: 21600 });

      return analytics;
    } catch (error) {
      console.error('Comment analytics generation failed:', error);
      throw new ApplicationError(
        'COMMENT_ANALYTICS_FAILED',
        'Failed to generate comment analytics',
        { originalError: error, videoId }
      );
    }
  }

  /**
   * Get comments for specific transcript section
   */
  static async getCommentsForSection(
    videoId: string,
    transcriptId: string,
    startTime: number,
    endTime: number,
    options: {
      includeYouTube?: boolean;
      includeUserAnnotations?: boolean;
      limit?: number;
    } = {}
  ): Promise<TranscriptComment[]> {
    try {
      const mappedComments = await this.mapCommentsToTranscript(videoId, transcriptId);

      // Filter comments within time range
      const sectionComments = mappedComments.filter(comment => {
        const commentTime = comment.timestamp;
        const commentEndTime = comment.endTime || comment.timestamp;

        // Check if comment overlaps with the requested time range
        return (
          (commentTime >= startTime && commentTime <= endTime) ||
          (commentEndTime >= startTime && commentEndTime <= endTime) ||
          (commentTime <= startTime && commentEndTime >= endTime)
        );
      });

      // Apply filters
      let filteredComments = sectionComments;

      if (!options.includeYouTube) {
        filteredComments = filteredComments.filter(c => c.metadata?.source !== 'youtube');
      }

      if (!options.includeUserAnnotations) {
        filteredComments = filteredComments.filter(c => c.metadata?.source !== 'user');
      }

      // Sort by timestamp and limit
      filteredComments.sort((a, b) => a.timestamp - b.timestamp);

      if (options.limit) {
        filteredComments = filteredComments.slice(0, options.limit);
      }

      return filteredComments;
    } catch (error) {
      console.error('Section comments fetch failed:', error);
      throw new ApplicationError(
        'SECTION_COMMENTS_FAILED',
        'Failed to fetch comments for transcript section',
        { originalError: error, videoId, startTime, endTime }
      );
    }
  }

  /**
   * Extract timestamps from comment text
   */
  private static extractTimestamps(text: string): number[] {
    const timestamps: number[] = [];

    // Match various timestamp formats
    const patterns = [
      /(\d{1,2}):(\d{2})(?::(\d{2}))?/g, // MM:SS or HH:MM:SS
      /(\d+)s\b/g, // Xs (seconds)
      /(\d+)m\b/g, // Xm (minutes)
      /(\d+)min\b/gi, // Xmin
      /timestamp[:\s]*(\d{1,2}):(\d{2})/gi // timestamp: MM:SS
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match[0].includes(':')) {
          // Format: MM:SS or HH:MM:SS
          const hours = match[3] ? parseInt(match[1]) : 0;
          const minutes = match[3] ? parseInt(match[2]) : parseInt(match[1]);
          const seconds = match[3] ? parseInt(match[3]) : parseInt(match[2]);
          timestamps.push(hours * 3600 + minutes * 60 + seconds);
        } else {
          // Format: Xs or Xm
          const value = parseInt(match[1]);
          if (match[0].includes('m') || match[0].includes('min')) {
            timestamps.push(value * 60);
          } else {
            timestamps.push(value);
          }
        }
      }
    }

    return timestamps.filter(t => t >= 0 && t < 7200); // Filter reasonable range (0-2 hours)
  }

  /**
   * Find closest word timing for a timestamp
   */
  private static findClosestWordTiming(
    timestamp: number,
    wordTimings: { startTime: number; endTime?: number; word: string }[]
  ): { startTime: number; endTime: number; word: string } | null {
    if (!wordTimings.length) return null;

    // Find exact match first
    const exactMatch = wordTimings.find(w =>
      w.startTime <= timestamp && (w.endTime || w.startTime) >= timestamp
    );

    if (exactMatch) return exactMatch;

    // Find closest before timestamp
    const closestBefore = wordTimings
      .filter(w => w.startTime < timestamp)
      .sort((a, b) => b.startTime - a.startTime)[0];

    if (closestBefore) return closestBefore;

    // Find closest after timestamp
    return wordTimings
      .filter(w => w.startTime > timestamp)
      .sort((a, b) => a.startTime - b.startTime)[0] || null;
  }

  /**
   * Enhance YouTube comment with additional metadata
   */
  private static async enhanceYouTubeComment(
    comment: any,
    videoId: string
  ): Promise<CommentThread> {
    return {
      id: comment.id,
      topComment: {
        id: comment.id,
        text: comment.textDisplay,
        originalText: comment.textOriginal,
        author: comment.authorDisplayName,
        authorUrl: comment.authorProfileImageUrl,
        authorChannelUrl: comment.authorChannelUrl,
        likeCount: comment.likeCount,
        publishedAt: comment.publishedAt,
        updatedAt: comment.updatedAt,
        canReply: comment.canReply,
        metadata: {
          videoId,
          source: 'youtube'
        }
      },
      replies: comment.replies || [],
      totalReplyCount: comment.totalReplyCount || 0
    };
  }

  /**
   * Analyze sentiment of comments
   */
  private static async analyzeSentiments(comments: string[]): Promise<number[]> {
    // Simple sentiment analysis (can be enhanced with AI service)
    return comments.map(comment => {
      // Very basic sentiment analysis
      const positiveWords = ['good', 'great', 'excellent', 'amazing', 'love', 'perfect'];
      const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'disappointing'];

      const words = comment.toLowerCase().split(/\s+/);
      const positiveCount = words.filter(word => positiveWords.includes(word)).length;
      const negativeCount = words.filter(word => negativeWords.includes(word)).length;

      if (positiveCount > negativeCount) return 0.5;
      if (negativeCount > positiveCount) return -0.5;
      return 0;
    });
  }

  /**
   * Extract topics from comments
   */
  private static async extractTopics(comments: string[]): Promise<string[]> {
    // Simple topic extraction (can be enhanced with AI/NLP)
    const commonWords = comments.join(' ').toLowerCase().split(/\s+/);
    const wordFreq = new Map<string, number>();

    commonWords.forEach(word => {
      if (word.length > 4 && !['this', 'that', 'with', 'from', 'they', 'have', 'been'].includes(word)) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }
    });

    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Calculate comment density over time
   */
  private static calculateCommentDensity(
    comments: TranscriptComment[]
  ): Array<{ timestamp: number; commentCount: number; averageSentiment: number }> {
    if (!comments.length) return [];

    // Create time buckets (every 30 seconds)
    const bucketSize = 30;
    const maxTime = Math.max(...comments.map(c => c.timestamp));
    const buckets = new Map<number, { count: number; sentiments: number[] }>();

    for (let time = 0; time <= maxTime; time += bucketSize) {
      buckets.set(time, { count: 0, sentiments: [] });
    }

    // Count comments in each bucket
    comments.forEach(comment => {
      const bucketTime = Math.floor(comment.timestamp / bucketSize) * bucketSize;
      const bucket = buckets.get(bucketTime);
      if (bucket) {
        bucket.count++;
        // Add placeholder sentiment for now
        bucket.sentiments.push(0);
      }
    });

    // Convert to density array
    return Array.from(buckets.entries()).map(([timestamp, bucket]) => ({
      timestamp,
      commentCount: bucket.count,
      averageSentiment: bucket.sentiments.length > 0
        ? bucket.sentiments.reduce((sum, s) => sum + s, 0) / bucket.sentiments.length
        : 0
    }));
  }

  /**
   * Find popular time ranges with high comment density
   */
  private static findPopularTimeRanges(
    comments: TranscriptComment[],
    density: Array<{ timestamp: number; commentCount: number }>
  ): Array<{ startTime: number; endTime: number; commentCount: number; engagement: number }> {
    const ranges: Array<{
      startTime: number;
      endTime: number;
      commentCount: number;
      engagement: number
    }> = [];

    // Find peaks in comment density
    const threshold = Math.max(...density.map(d => d.commentCount)) * 0.5;
    let currentRange: { startTime: number; endTime: number; commentCount: number } | null = null;

    density.forEach((point, index) => {
      if (point.commentCount >= threshold) {
        if (!currentRange) {
          currentRange = { startTime: point.timestamp, endTime: point.timestamp, commentCount: 0 };
        }
        currentRange.endTime = point.timestamp + 30; // Add bucket size
        currentRange.commentCount += point.commentCount;
      } else if (currentRange) {
        // Calculate engagement (comments per minute)
        const duration = (currentRange.endTime - currentRange.startTime) / 60;
        const engagement = duration > 0 ? currentRange.commentCount / duration : 0;

        ranges.push({
          ...currentRange,
          engagement
        });

        currentRange = null;
      }
    });

    // Handle case where video ends during a peak
    if (currentRange) {
      const duration = (currentRange.endTime - currentRange.startTime) / 60;
      const engagement = duration > 0 ? currentRange.commentCount / duration : 0;

      ranges.push({
        ...currentRange,
        engagement
      });
    }

    // Sort by engagement and return top 10
    return ranges
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 10);
  }

  /**
   * Save transcript comment to database
   */
  private static async saveTranscriptComment(comment: TranscriptComment): Promise<void> {
    // Implementation depends on your database setup
    // This would typically save to Convex or another database
    console.log('Saving transcript comment:', comment);
  }
}
```

### React Hook Integration
```typescript
// src/hooks/useComments.ts
import { useQuery, useMutation, useInfiniteQuery } from '@tanstack/react-query';
import { CommentTranscriptService } from '@/services/commentTranscriptService';
import type {
  CommentThread,
  TranscriptComment,
  CommentAnalytics
} from '@/types';

interface UseCommentsOptions {
  videoId: string;
  transcriptId?: string;
  includeReplies?: boolean;
  sortBy?: 'relevance' | 'time' | 'likes';
}

export function useComments({ videoId, transcriptId, includeReplies, sortBy }: UseCommentsOptions) {
  // YouTube comments query
  const youtubeCommentsQuery = useQuery({
    queryKey: ['youtube-comments', videoId, { includeReplies, sortBy }],
    queryFn: () => CommentTranscriptService.fetchYouTubeComments(videoId, {
      includeReplies,
      sortBy
    }),
    staleTime: 300000, // 5 minutes
    retry: 2
  });

  // Mapped comments query (requires transcriptId)
  const mappedCommentsQuery = useQuery({
    queryKey: ['mapped-comments', videoId, transcriptId],
    queryFn: () => transcriptId
      ? CommentTranscriptService.mapCommentsToTranscript(videoId, transcriptId)
      : Promise.resolve([]),
    enabled: !!transcriptId,
    staleTime: 900000, // 15 minutes
    retry: 2
  });

  // Comment analytics query
  const analyticsQuery = useQuery({
    queryKey: ['comment-analytics', videoId],
    queryFn: () => CommentTranscriptService.generateCommentAnalytics(videoId),
    staleTime: 1800000, // 30 minutes
    retry: 2
  });

  // Add annotation mutation
  const addAnnotationMutation = useMutation({
    mutationFn: (data: {
      content: string;
      timestamp: number;
      endTime?: number;
      type: 'comment' | 'question' | 'correction' | 'annotation';
      isPublic?: boolean;
    }) => CommentTranscriptService.addTranscriptAnnotation({
      videoId,
      transcriptId: transcriptId!,
      userId: 'current-user', // Get from auth context
      ...data
    }),
    onSuccess: () => {
      mappedCommentsQuery.refetch();
      analyticsQuery.refetch();
    }
  });

  return {
    // Data
    youtubeComments: youtubeCommentsQuery.data || [],
    mappedComments: mappedCommentsQuery.data || [],
    analytics: analyticsQuery.data,

    // Loading states
    isLoadingYouTube: youtubeCommentsQuery.isLoading,
    isLoadingMapped: mappedCommentsQuery.isLoading,
    isLoadingAnalytics: analyticsQuery.isLoading,

    // Error states
    youtubeError: youtubeCommentsQuery.error,
    mappedError: mappedCommentsQuery.error,
    analyticsError: analyticsQueryQuery.error,

    // Actions
    addAnnotation: addAnnotationMutation.mutateAsync,
    refetchYouTube: youtubeCommentsQuery.refetch,
    refetchMapped: mappedCommentsQuery.refetch,
    refetchAnalytics: analyticsQuery.refetch,

    // Status
    anyLoading: youtubeCommentsQuery.isLoading || mappedCommentsQuery.isLoading || analyticsQueryQuery.isLoading,
    hasComments: (youtubeCommentsQuery.data?.length || 0) > 0 || (mappedCommentsQuery.data?.length || 0) > 0
  };
}

// Hook for comments in specific time range
export function useSectionComments(
  videoId: string,
  transcriptId: string,
  startTime: number,
  endTime: number
) {
  return useQuery({
    queryKey: ['section-comments', videoId, transcriptId, startTime, endTime],
    queryFn: () => CommentTranscriptService.getCommentsForSection(
      videoId,
      transcriptId,
      startTime,
      endTime,
      { includeYouTube: true, includeUserAnnotations: true, limit: 50 }
    ),
    enabled: !!videoId && !!transcriptId,
    staleTime: 300000,
    retry: 1
  });
}
```

### Comment Integration Components
```typescript
// src/components/comments/CommentPanel.tsx
import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useComments } from '@/hooks/useComments';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface CommentPanelProps {
  videoId: string;
  transcriptId?: string;
  currentTime?: number;
  className?: string;
}

export const CommentPanel: React.FC<CommentPanelProps> = ({
  videoId,
  transcriptId,
  currentTime,
  className
}) => {
  const [activeTab, setActiveTab] = useState('youtube');
  const {
    youtubeComments,
    mappedComments,
    analytics,
    isLoadingYouTube,
    isLoadingMapped,
    addAnnotation
  } = useComments({ videoId, transcriptId });

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>💬 Comments & Discussion</span>
          <div className="flex items-center gap-2">
            {analytics && (
              <Badge variant="secondary">
                {analytics.totalComments} comments
              </Badge>
            )}
            {analytics && (
              <Badge variant="outline">
                {Math.round(analytics.engagementRate * 100) / 100}% engagement
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="youtube">YouTube Comments</TabsTrigger>
            <TabsTrigger value="transcript">Transcript Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="youtube" className="mt-4">
            {isLoadingYouTube ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading comments...</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {youtubeComments.map((thread) => (
                  <CommentThread key={thread.id} thread={thread} />
                ))}
                {youtubeComments.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No comments found for this video
                  </p>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="transcript" className="mt-4">
            <div className="space-y-4">
              <AnnotationForm
                onSubmit={async (data) => {
                  await addAnnotation(data);
                }}
                currentTime={currentTime}
              />

              {isLoadingMapped ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Loading transcript notes...</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {mappedComments
                    .filter(comment => comment.metadata?.source === 'user')
                    .map((comment) => (
                      <TranscriptComment key={comment.id} comment={comment} />
                    ))}
                  {mappedComments.filter(c => c.metadata?.source === 'user').length === 0 && (
                    <p className="text-center text-muted-foreground py-4">
                      No transcript annotations yet. Add one above!
                    </p>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

// Comment thread component
const CommentThread: React.FC<{ thread: any }> = ({ thread }) => (
  <div className="border rounded-lg p-4">
    <div className="flex items-start gap-3">
      <Avatar className="h-8 w-8">
        <AvatarImage src={thread.topComment.authorUrl} />
        <AvatarFallback>
          {thread.topComment.author.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">
            {thread.topComment.author}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(thread.topComment.publishedAt), { addSuffix: true })}
          </span>
          {thread.topComment.likeCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              👍 {thread.topComment.likeCount}
            </Badge>
          )}
        </div>

        <p className="text-sm leading-relaxed">
          {thread.topComment.text}
        </p>

        {thread.replies && thread.replies.length > 0 && (
          <div className="ml-4 space-y-2 pt-2 border-l-2 border-muted">
            {thread.replies.slice(0, 3).map((reply: any) => (
              <div key={reply.id} className="flex items-start gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={reply.authorProfileImageUrl} />
                  <AvatarFallback className="text-xs">
                    {reply.authorDisplayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-xs">
                      {reply.authorDisplayName}
                    </span>
                    {reply.likeCount > 0 && (
                      <Badge variant="outline" className="text-xs">
                        👍 {reply.likeCount}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed mt-1">
                    {reply.text}
                  </p>
                </div>
              </div>
            ))}
            {thread.replies.length > 3 && (
              <p className="text-xs text-muted-foreground ml-8">
                +{thread.replies.length - 3} more replies
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  </div>
);

// Transcript comment component
const TranscriptComment: React.FC<{ comment: any }> = ({ comment }) => (
  <div className={cn(
    "border rounded-lg p-3",
    comment.type === 'question' && "border-blue-200 bg-blue-50",
    comment.type === 'correction' && "border-yellow-200 bg-yellow-50",
    comment.type === 'annotation' && "border-green-200 bg-green-50"
  )}>
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          {comment.type}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {new Date(comment.timestamp * 1000).toISOString().substr(14, 5)}
        </span>
      </div>
      {comment.likes > 0 && (
        <Badge variant="secondary" className="text-xs">
          👍 {comment.likes}
        </Badge>
      )}
    </div>

    <p className="text-sm leading-relaxed">
      {comment.content}
    </p>

    <div className="flex items-center gap-2 mt-2">
      <Button variant="ghost" size="sm" className="h-6 text-xs">
        👍 Like
      </Button>
      <Button variant="ghost" size="sm" className="h-6 text-xs">
        💬 Reply
      </Button>
    </div>
  </div>
);

// Annotation form component
const AnnotationForm: React.FC<{
  onSubmit: (data: any) => Promise<void>;
  currentTime?: number;
}> = ({ onSubmit, currentTime }) => {
  const [content, setContent] = useState('');
  const [type, setType] = useState<'comment' | 'question' | 'correction' | 'annotation'>('comment');
  const [timestamp, setTimestamp] = useState(currentTime || 0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        content: content.trim(),
        timestamp,
        type,
        isPublic: true
      });
      setContent('');
    } catch (error) {
      console.error('Failed to add annotation:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as any)}
          className="text-xs border rounded px-2 py-1"
        >
          <option value="comment">Comment</option>
          <option value="question">Question</option>
          <option value="correction">Correction</option>
          <option value="annotation">Note</option>
        </select>

        <div className="flex items-center gap-1">
          <label className="text-xs">At:</label>
          <Input
            type="number"
            value={timestamp}
            onChange={(e) => setTimestamp(Number(e.target.value))}
            className="w-20 h-6 text-xs"
            step="1"
            min="0"
          />
          <span className="text-xs text-muted-foreground">seconds</span>
        </div>
      </div>

      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Add your comment, question, or note..."
        className="text-sm min-h-20 resize-none"
        disabled={isSubmitting}
      />

      <Button
        type="submit"
        disabled={!content.trim() || isSubmitting}
        className="w-full"
      >
        {isSubmitting ? 'Adding...' : 'Add Annotation'}
      </Button>
    </form>
  );
};
```

## 📋 Type Definitions

```typescript
// src/types/comments.ts
export interface CommentThread {
  id: string;
  topComment: Comment;
  replies?: Comment[];
  totalReplyCount?: number;
}

export interface Comment {
  id: string;
  text: string;
  originalText: string;
  author: string;
  authorUrl: string;
  authorChannelUrl?: string;
  likeCount: number;
  publishedAt: string;
  updatedAt?: string;
  canReply: boolean;
  metadata?: {
    videoId?: string;
    source: 'youtube' | 'user';
  };
}

export interface TranscriptComment {
  id: string;
  videoId: string;
  transcriptId: string;
  userId: string;
  content: string;
  timestamp: number;
  endTime?: number;
  type: 'comment' | 'question' | 'correction' | 'annotation';
  likes: number;
  replies: number;
  isPublic: boolean;
  createdAt: number;
  updatedAt?: number;
  metadata?: {
    source: 'youtube' | 'user';
    author?: string;
    authorUrl?: string;
    originalCommentId?: string;
    threadId?: string;
    isReply?: boolean;
    verified?: boolean;
  };
}

export interface CommentAnalytics {
  videoId: string;
  totalComments: number;
  totalLikes: number;
  averageSentiment: number;
  topTopics: string[];
  engagementRate: number;
  commentDensity: Array<{
    timestamp: number;
    commentCount: number;
    averageSentiment: number;
  }>;
  popularTimeRanges: Array<{
    startTime: number;
    endTime: number;
    commentCount: number;
    engagement: number;
  }>;
  generatedAt: number;
}

export interface UserAnnotation {
  id: string;
  userId: string;
  videoId: string;
  content: string;
  timestamp: number;
  endTime?: number;
  type: 'comment' | 'question' | 'correction' | 'annotation';
  isPublic: boolean;
  likes: number;
  createdAt: number;
  updatedAt?: number;
}

export interface SentimentAnalysis {
  score: number;
  confidence: number;
  label: 'positive' | 'negative' | 'neutral';
}
```

## 🎯 Usage Examples

### Basic Usage
```typescript
// Fetch YouTube comments
const comments = await CommentTranscriptService.fetchYouTubeComments(videoId, {
  maxResults: 100,
  sortBy: 'relevance',
  includeReplies: true
});

// Map comments to transcript
const mappedComments = await CommentTranscriptService.mapCommentsToTranscript(
  videoId,
  transcriptId
);

// Generate analytics
const analytics = await CommentTranscriptService.generateCommentAnalytics(videoId);

// Get comments for specific section
const sectionComments = await CommentTranscriptService.getCommentsForSection(
  videoId,
  transcriptId,
  120, // 2 minutes
  240  // 4 minutes
);
```

### React Hook Usage
```typescript
function VideoComments({ videoId, transcriptId }: { videoId: string; transcriptId: string }) {
  const {
    youtubeComments,
    mappedComments,
    analytics,
    addAnnotation,
    isLoadingYouTube,
    isLoadingMapped
  } = useComments({ videoId, transcriptId });

  if (isLoadingYouTube || isLoadingMapped) return <div>Loading comments...</div>;

  return (
    <CommentPanel
      videoId={videoId}
      transcriptId={transcriptId}
      currentTime={120}
    />
  );
}
```

## 🔍 Error Handling & Monitoring

### Service-Level Errors
- **COMMENTS_FETCH_FAILED**: YouTube comment retrieval failure
- **COMMENT_MAPPING_FAILED**: Timestamp mapping processing error
- **ANNOTATION_CREATION_FAILED**: User annotation creation error
- **COMMENT_ANALYTICS_FAILED**: Analytics generation failure
- **SECTION_COMMENTS_FAILED**: Section-specific comment retrieval error

### Performance Monitoring
```typescript
// Track comment integration performance
const commentMetrics = {
  trackCommentFetch: (videoId: string, commentCount: number, duration: number) => {
    // Performance tracking implementation
  },
  trackAnnotationCreated: (videoId: string, userId: string, type: string) => {
    // User engagement tracking
  },
  trackErrorRate: (operation: string, success: boolean) => {
    // Error rate monitoring
  }
};
```

## 🔒 Security & Privacy

### Security Measures
- **Input Validation**: Sanitize all user-generated content
- **Rate Limiting**: Prevent spam and abuse
- **Content Filtering**: Filter inappropriate content
- **Privacy Controls**: Respect user privacy settings

### Privacy Considerations
- **Data Minimization**: Only collect necessary comment data
- **User Consent**: Obtain consent for using user comments
- **Data Retention**: Implement appropriate data retention policies
- **GDPR Compliance**: Handle user data according to privacy regulations

## 🧪 Testing Strategy

### Unit Tests
```typescript
describe('CommentTranscriptService', () => {
  test('should extract timestamps from comment text', () => {
    const text = "Great explanation at 2:30! Also check 5:45 for more details.";
    const timestamps = CommentTranscriptService.extractTimestamps(text);
    expect(timestamps).toContain(150); // 2:30
    expect(timestamps).toContain(345); // 5:45
  });

  test('should map comments to transcript timestamps', async () => {
    const mappedComments = await CommentTranscriptService.mapCommentsToTranscript(
      'video-id',
      'transcript-id'
    );
    expect(Array.isArray(mappedComments)).toBe(true);
  });
});
```

### Integration Tests
```typescript
describe('Comment Integration', () => {
  test('should integrate with YouTube API service', async () => {
    // Test YouTube API integration
  });

  test('should integrate with transcription service', async () => {
    // Test transcript service integration
  });
});
```

## 🎯 Success Metrics

### Engagement Metrics
- **Comment View Rate**: Percentage of users who view comments
- **Annotation Creation**: Number of user-created annotations per video
- **Comment Interaction**: Likes, replies, and engagement with comments
- **Time Spent**: Average time users spend with comment features

### Quality Metrics
- **Relevant Comments**: Percentage of comments that are contextually relevant
- **Timestamp Accuracy**: Accuracy of comment-to-timestamp mapping
- **User Satisfaction**: User ratings of comment features
- **Community Health**: Ratio of constructive to non-constructive comments

---

## 📞 Support & Troubleshooting

### Common Issues
1. **YouTube API Quotas**: Monitor API usage and implement caching
2. **Timestamp Accuracy**: Improve timestamp extraction algorithms
3. **Performance**: Optimize comment loading and mapping performance
4. **Content Moderation**: Implement effective content filtering

### Debug Commands
```typescript
// Clear comment cache
await cacheService.clearPattern('comments:*');

// Test YouTube API connectivity
const testComments = await CommentTranscriptService.fetchYouTubeComments('test-video-id', { maxResults: 1 });

// Check comment mapping accuracy
const mappingStats = await CommentTranscriptService.analyzeMappingAccuracy(videoId, transcriptId);
```

This Comment-Transcript Integration skill provides comprehensive social and community features that bridge YouTube comments with video transcripts, enabling rich contextual discussions and user engagement while seamlessly integrating with the modular service layer architecture.