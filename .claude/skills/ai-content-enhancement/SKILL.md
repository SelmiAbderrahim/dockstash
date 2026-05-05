---
name: ai-content-enhancement
description: >
  AI-powered content enhancement service that provides intelligent analysis,
  summarization, and enhancement of video transcripts using GPT-4 and Claude AI models.
---

# AI Content Enhancement Skill

**Skill ID**: `ai-content-enhancement`
**Version**: 1.0.0
**Category**: Video & Content Processing
**Tags**: `ai`, `content`, `enhancement`, `transcript`, `analysis`

## 🎯 Purpose

AI-powered content enhancement service for iReadYouTube that provides intelligent analysis, summarization, and enhancement of video transcripts using GPT-4 and Claude AI models. Integrates seamlessly with the modular service layer architecture.

## 🚀 Core Capabilities

### 1. **Transcript Summarization**
- **Executive Summaries**: Generate comprehensive overviews of video content
- **Key Takeaways**: Extract actionable insights and main points
- **Chapter Detection**: Automatically segment content into logical chapters
- **Timestamped Summaries**: Create time-stamped summaries for easy navigation

### 2. **Content Analysis**
- **Sentiment Analysis**: Analyze emotional tone and sentiment patterns
- **Topic Extraction**: Identify key topics and themes discussed
- **Speaker Analysis**: Analyze speaking patterns, word usage, and expertise areas
- **Content Quality**: Assess information density, clarity, and structure

### 3. **Knowledge Enhancement**
- **Fact Verification**: Cross-reference claims with reliable sources
- **Related Content**: Suggest related videos, articles, and resources
- **Definition Expansion**: Automatically define technical terms and jargon
- **Contextual Information**: Add relevant background information

### 4. **Interactive Features**
- **Q&A Generation**: Generate relevant questions and answers from content
- **Discussion Points**: Create thought-provoking discussion topics
- **Action Items**: Extract actionable tasks and recommendations
- **Learning Resources**: Suggest further learning materials

## 🏗️ Service Integration

### Core Service Dependencies
```typescript
// Import existing modular services
import { VideoService } from '@/services/videoService';
import { TranscriptionService } from '@/services/transcriptionService';
import { useTranscript } from '@/hooks/useTranscription';

// AI Content Enhancement Service
export class AIContentEnhancementService {
  private openai: OpenAI;
  private claude: ClaudeClient;
  private cache: Map<string, EnhancedContent>;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.claude = new ClaudeClient({ apiKey: process.env.CLAUDE_API_KEY });
    this.cache = new Map();
  }
}
```

### Service Layer Integration
- **VideoService**: Access video metadata and content for analysis
- **TranscriptionService**: Work with processed transcripts and word timings
- **useTranscript Hook**: Integrate with transcript state management
- **Error Handling**: Use centralized error handling system

## 🔧 Implementation Details

### Core Service Implementation
```typescript
// src/services/aiContentEnhancementService.ts
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText, generateObject } from 'ai';
import type {
  Transcript,
  VideoMetadata,
  EnhancedContent,
  ContentSummary,
  TopicAnalysis
} from '@/types';
import { ApplicationError } from '@/errors';
import { cacheService } from '@/lib/cache';

// AI Enhancement Schemas
const aiEnhancementSchemas = {
  summary: z.object({
    overview: z.string().min(50).max(500),
    keyPoints: z.array(z.string().min(10).max(200)).max(10),
    chapters: z.array(z.object({
      title: z.string().min(5).max(100),
      startTime: z.number().min(0),
      endTime: z.number().min(0),
      summary: z.string().min(20).max(300)
    })).max(20),
    sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']),
    topics: z.array(z.string().min(3).max(50)).max(15)
  }),

  qa: z.object({
    questions: z.array(z.object({
      question: z.string().min(10).max(200),
      answer: z.string().min(20).max(500),
      timestamp: z.number().min(0).optional(),
      context: z.string().min(50).max(300).optional()
    })).max(15),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
    category: z.enum(['factual', 'conceptual', 'application', 'analysis'])
  }),

  topics: z.object({
    mainTopics: z.array(z.object({
      name: z.string().min(3).max(50),
      confidence: z.number().min(0).max(1),
      description: z.string().min(20).max(200),
      keywords: z.array(z.string().min(2).max(30)).max(10)
    })).max(10),
    subTopics: z.array(z.object({
      name: z.string().min(3).max(50),
      parentTopic: z.string(),
      relevance: z.number().min(0).max(1)
    })).max(25),
    expertise: z.enum(['beginner', 'intermediate', 'advanced', 'expert'])
  })
};

export class AIContentEnhancementService {
  private cacheKey = (videoId: string, type: string) => `ai-enhancement:${videoId}:${type}`;

  /**
   * Generate comprehensive transcript summary
   */
  static async generateSummary(
    videoId: string,
    options: {
      model?: 'gpt-4' | 'claude-3';
      style?: 'concise' | 'detailed' | 'educational';
      language?: string;
    } = {}
  ): Promise<ContentSummary> {
    try {
      const cacheKey = this.cacheKey(videoId, 'summary');
      const cached = await cacheService.get(cacheKey);
      if (cached) return cached as ContentSummary;

      // Get transcript data
      const transcript = await TranscriptionService.getTranscriptByVideoId(videoId);
      const video = await VideoService.getVideoById(videoId);

      if (!transcript?.content) {
        throw new ApplicationError(
          'CONTENT_NOT_FOUND',
          'Transcript content not found for AI enhancement'
        );
      }

      const model = options.model === 'claude-3' ? anthropic('claude-3-sonnet-20241022') : openai('gpt-4-turbo-preview');

      const result = await generateObject({
        model,
        prompt: this.buildSummaryPrompt(transcript.content, video, options),
        schema: aiEnhancementSchemas.summary,
        temperature: 0.3,
        maxTokens: 2000,
      });

      const summary: ContentSummary = {
        ...result.object,
        videoId,
        generatedAt: Date.now(),
        model: options.model || 'gpt-4',
        processingTime: Date.now()
      };

      // Cache for 24 hours
      await cacheService.set(cacheKey, summary, { ttl: 86400 });

      return summary;
    } catch (error) {
      console.error('AI Summary generation failed:', error);
      throw new ApplicationError(
        'AI_ENHANCEMENT_FAILED',
        'Failed to generate AI-powered content summary',
        { originalError: error, videoId }
      );
    }
  }

  /**
   * Extract and analyze topics from transcript
   */
  static async analyzeTopics(
    videoId: string,
    options: {
      granularity?: 'broad' | 'detailed';
      includeSentiment?: boolean;
      expertise?: string;
    } = {}
  ): Promise<TopicAnalysis> {
    try {
      const cacheKey = this.cacheKey(videoId, 'topics');
      const cached = await cacheService.get(cacheKey);
      if (cached) return cached as TopicAnalysis;

      const transcript = await TranscriptionService.getTranscriptByVideoId(videoId);

      if (!transcript?.content) {
        throw new ApplicationError(
          'CONTENT_NOT_FOUND',
          'Transcript content not found for topic analysis'
        );
      }

      const model = openai('gpt-4-turbo-preview');

      const result = await generateObject({
        model,
        prompt: this.buildTopicPrompt(transcript.content, options),
        schema: aiEnhancementSchemas.topics,
        temperature: 0.2,
        maxTokens: 1500,
      });

      const analysis: TopicAnalysis = {
        ...result.object,
        videoId,
        processedAt: Date.now(),
        confidence: this.calculateTopicConfidence(result.object.mainTopics),
        recommendations: this.generateTopicRecommendations(result.object.mainTopics)
      };

      await cacheService.set(cacheKey, analysis, { ttl: 86400 });

      return analysis;
    } catch (error) {
      console.error('Topic analysis failed:', error);
      throw new ApplicationError(
        'TOPIC_ANALYSIS_FAILED',
        'Failed to analyze topics using AI',
        { originalError: error, videoId }
      );
    }
  }

  /**
   * Generate Q&A content from transcript
   */
  static async generateQA(
    videoId: string,
    options: {
      count?: number;
      difficulty?: 'beginner' | 'intermediate' | 'advanced';
      type?: 'factual' | 'conceptual' | 'application' | 'analysis';
    } = {}
  ): Promise<GeneratedQA> {
    try {
      const cacheKey = this.cacheKey(videoId, 'qa');
      const cached = await cacheService.get(cacheKey);
      if (cached) return cached as GeneratedQA;

      const transcript = await TranscriptionService.getTranscriptByVideoId(videoId);
      const video = await VideoService.getVideoById(videoId);

      if (!transcript?.content) {
        throw new ApplicationError(
          'CONTENT_NOT_FOUND',
          'Transcript content not found for Q&A generation'
        );
      }

      const model = openai('gpt-4-turbo-preview');

      const result = await generateObject({
        model,
        prompt: this.buildQAPrompt(transcript.content, video, options),
        schema: aiEnhancementSchemas.qa,
        temperature: 0.4,
        maxTokens: 2000,
      });

      const qa: GeneratedQA = {
        ...result.object,
        videoId,
        generatedAt: Date.now(),
        totalQuestions: result.object.questions.length,
        estimatedTime: this.estimateAnswerTime(result.object.questions)
      };

      await cacheService.set(cacheKey, qa, { ttl: 86400 });

      return qa;
    } catch (error) {
      console.error('Q&A generation failed:', error);
      throw new ApplicationError(
        'QA_GENERATION_FAILED',
        'Failed to generate Q&A content using AI',
        { originalError: error, videoId }
      );
    }
  }

  /**
   * Enhance transcript with contextual information
   */
  static async enhanceTranscript(
    videoId: string,
    options: {
      addDefinitions?: boolean;
      addReferences?: boolean;
      addRelatedContent?: boolean;
    } = {}
  ): Promise<EnhancedTranscript> {
    try {
      const transcript = await TranscriptionService.getTranscriptByVideoId(videoId);

      if (!transcript?.content) {
        throw new ApplicationError(
          'CONTENT_NOT_FOUND',
          'Transcript content not found for enhancement'
        );
      }

      const enhancements = await Promise.allSettled([
        options.addDefinitions ? this.generateDefinitions(transcript.content) : null,
        options.addReferences ? this.findReferences(transcript.content) : null,
        options.addRelatedContent ? this.suggestRelatedContent(videoId) : null
      ]);

      const enhanced: EnhancedTranscript = {
        originalTranscript: transcript,
        definitions: this.extractDefinitions(enhancements[0]),
        references: this.extractReferences(enhancements[1]),
        relatedContent: this.extractRelatedContent(enhancements[2]),
        enhancedAt: Date.now(),
        videoId
      };

      return enhanced;
    } catch (error) {
      console.error('Transcript enhancement failed:', error);
      throw new ApplicationError(
        'TRANSCRIPT_ENHANCEMENT_FAILED',
        'Failed to enhance transcript with AI',
        { originalError: error, videoId }
      );
    }
  }

  /**
   * Build prompt for transcript summarization
   */
  private static buildSummaryPrompt(
    content: string,
    video: VideoMetadata,
    options: any
  ): string {
    const styleMap = {
      concise: 'Keep it brief and to the point',
      detailed: 'Provide comprehensive details and examples',
      educational: 'Focus on learning outcomes and key concepts'
    };

    return `You are an expert content analyst. Analyze this video transcript and provide a comprehensive summary.

Video Title: ${video.title}
Video Description: ${video.description || 'No description available'}
Summary Style: ${styleMap[options.style || 'detailed']}

Transcript Content:
${content}

Please provide:
1. A comprehensive overview (50-500 words)
2. 5-10 key takeaways
3. Chapter breakdown with timestamps
4. Overall sentiment analysis
5. Main topics covered

Focus on extracting the most valuable insights and making the content easily digestible.`;
  }

  /**
   * Build prompt for topic analysis
   */
  private static buildTopicPrompt(content: string, options: any): string {
    return `Analyze this transcript and extract the key topics and themes.

Transcript Content:
${content}

Granularity: ${options.granularity || 'detailed'}
Include Sentiment: ${options.includeSentiment !== false}

Please provide:
1. Main topics with confidence scores
2. Sub-topics and their relationships
3. Expertise level required
4. Keywords for each topic

Focus on identifying the core themes and how they relate to each other.`;
  }

  /**
   * Build prompt for Q&A generation
   */
  private static buildQAPrompt(
    content: string,
    video: VideoMetadata,
    options: any
  ): string {
    const difficultyMap = {
      beginner: 'Basic understanding, simple recall',
      intermediate: 'Some analysis, connecting concepts',
      advanced: 'Deep analysis, synthesis and evaluation'
    };

    return `Generate relevant questions and answers based on this video content.

Video Title: ${video.title}
Content Type: ${video.category || 'General'}
Difficulty Level: ${difficultyMap[options.difficulty || 'intermediate']}
Question Type: ${options.type || 'mixed'}
Number of Questions: ${options.count || 10}

Transcript Content:
${content}

Generate questions that:
1. Test understanding of key concepts
2. Encourage critical thinking
3. Cover different aspects of the content
4. Include timestamps when relevant

For each question, provide:
- Clear, well-formulated question
- Comprehensive answer
- Timestamp reference (if applicable)
- Context explanation

Make sure questions are appropriate for the specified difficulty level.`;
  }

  /**
   * Generate definitions for technical terms
   */
  private static async generateDefinitions(content: string): Promise<TermDefinition[]> {
    const model = openai('gpt-4-turbo-preview');

    const result = await generateText({
      model,
      prompt: `Identify technical terms, jargon, or complex concepts in this text and provide simple, clear definitions for each.

Text:
${content}

For each term, provide:
1. The term
2. A simple definition (under 50 words)
3. An example if helpful

Format as JSON array of objects with term, definition, and example fields.`,
      maxTokens: 1500,
      temperature: 0.2
    });

    try {
      return JSON.parse(result.text);
    } catch {
      return [];
    }
  }

  /**
   * Find relevant references and sources
   */
  private static async findReferences(content: string): Promise<ContentReference[]> {
    // Implementation for finding external references
    // This could integrate with academic databases, news sources, etc.
    return [];
  }

  /**
   * Suggest related content based on transcript analysis
   */
  private static async suggestRelatedContent(videoId: string): Promise<RelatedContent[]> {
    // Implementation for suggesting related videos and resources
    // This could use YouTube API, internal content database, etc.
    return [];
  }

  /**
   * Calculate confidence score for topics
   */
  private static calculateTopicConfidence(topics: any[]): number {
    if (!topics.length) return 0;
    const totalConfidence = topics.reduce((sum, topic) => sum + topic.confidence, 0);
    return totalConfidence / topics.length;
  }

  /**
   * Generate recommendations based on topics
   */
  private static generateTopicRecommendations(topics: any[]): string[] {
    // Generate learning recommendations based on topic analysis
    return [];
  }

  /**
   * Estimate time needed to answer questions
   */
  private static estimateAnswerTime(questions: any[]): number {
    // Estimate based on question complexity and length
    return questions.length * 2; // 2 minutes per question average
  }

  /**
   * Extract definitions from API result
   */
  private static extractDefinitions(result: any): TermDefinition[] {
    return result.status === 'fulfilled' ? result.value : [];
  }

  /**
   * Extract references from API result
   */
  private static extractReferences(result: any): ContentReference[] {
    return result.status === 'fulfilled' ? result.value : [];
  }

  /**
   * Extract related content from API result
   */
  private static extractRelatedContent(result: any): RelatedContent[] {
    return result.status === 'fulfilled' ? result.value : [];
  }
}
```

### React Hook Integration
```typescript
// src/hooks/useAIEnhancement.ts
import { useQuery, useMutation } from '@tanstack/react-query';
import { AIContentEnhancementService } from '@/services/aiContentEnhancementService';
import type {
  ContentSummary,
  TopicAnalysis,
  GeneratedQA,
  EnhancedTranscript
} from '@/types';

interface UseAIEnhancementOptions {
  videoId: string;
  autoGenerate?: boolean;
  cacheTime?: number;
}

export function useAIEnhancement({ videoId, autoGenerate = false, cacheTime = 86400 }: UseAIEnhancementOptions) {
  // Summary query
  const summaryQuery = useQuery({
    queryKey: ['ai-summary', videoId],
    queryFn: () => AIContentEnhancementService.generateSummary(videoId),
    enabled: !!videoId && autoGenerate,
    staleTime: cacheTime * 1000,
    retry: 2
  });

  // Topics analysis query
  const topicsQuery = useQuery({
    queryKey: ['ai-topics', videoId],
    queryFn: () => AIContentEnhancementService.analyzeTopics(videoId),
    enabled: !!videoId && autoGenerate,
    staleTime: cacheTime * 1000,
    retry: 2
  });

  // Q&A generation query
  const qaQuery = useQuery({
    queryKey: ['ai-qa', videoId],
    queryFn: () => AIContentEnhancementService.generateQA(videoId),
    enabled: !!videoId && autoGenerate,
    staleTime: cacheTime * 1000,
    retry: 2
  });

  // Enhanced transcript query
  const enhancedTranscriptQuery = useQuery({
    queryKey: ['ai-enhanced-transcript', videoId],
    queryFn: () => AIContentEnhancementService.enhanceTranscript(videoId, {
      addDefinitions: true,
      addReferences: true,
      addRelatedContent: true
    }),
    enabled: !!videoId && autoGenerate,
    staleTime: cacheTime * 1000,
    retry: 2
  });

  // Generate summary mutation
  const generateSummaryMutation = useMutation({
    mutationFn: (options?: any) => AIContentEnhancementService.generateSummary(videoId, options),
    onSuccess: (data) => {
      summaryQuery.setData(data);
    }
  });

  // Generate topics mutation
  const generateTopicsMutation = useMutation({
    mutationFn: (options?: any) => AIContentEnhancementService.analyzeTopics(videoId, options),
    onSuccess: (data) => {
      topicsQuery.setData(data);
    }
  });

  // Generate Q&A mutation
  const generateQAMutation = useMutation({
    mutationFn: (options?: any) => AIContentEnhancementService.generateQA(videoId, options),
    onSuccess: (data) => {
      qaQuery.setData(data);
    }
  });

  return {
    // Data
    summary: summaryQuery.data,
    topics: topicsQuery.data,
    qa: qaQuery.data,
    enhancedTranscript: enhancedTranscriptQuery.data,

    // Loading states
    isLoadingSummary: summaryQuery.isLoading,
    isLoadingTopics: topicsQuery.isLoading,
    isLoadingQA: qaQuery.isLoading,
    isLoadingEnhanced: enhancedTranscriptQuery.isLoading,

    // Error states
    summaryError: summaryQuery.error,
    topicsError: topicsQuery.error,
    qaError: qaQuery.error,
    enhancedError: enhancedTranscriptQuery.error,

    // Actions
    generateSummary: generateSummaryMutation.mutateAsync,
    generateTopics: generateTopicsMutation.mutateAsync,
    generateQA: generateQAMutation.mutateAsync,
    enhanceTranscript: enhancedTranscriptQuery.refetch,

    // Status
    anyLoading: summaryQuery.isLoading || topicsQuery.isLoading || qaQuery.isLoading,
    anyError: summaryQuery.error || topicsQuery.error || qaQuery.error,
    hasAnyData: !!(summaryQuery.data || topicsQuery.data || qaQuery.data)
  };
}
```

### AI Enhancement Components
```typescript
// src/components/ai/AIEnhancementPanel.tsx
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAIEnhancement } from '@/hooks/useAIEnhancement';
import { cn } from '@/lib/utils';

interface AIEnhancementPanelProps {
  videoId: string;
  autoGenerate?: boolean;
  className?: string;
}

export const AIEnhancementPanel: React.FC<AIEnhancementPanelProps> = ({
  videoId,
  autoGenerate = false,
  className
}) => {
  const {
    summary,
    topics,
    qa,
    isLoadingSummary,
    isLoadingTopics,
    isLoadingQA,
    generateSummary,
    generateTopics,
    generateQA,
    anyLoading
  } = useAIEnhancement({ videoId, autoGenerate });

  if (anyLoading) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Generating AI insights...
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-lg">🤖 AI Content Enhancement</span>
          <Badge variant="secondary">Beta</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="topics">Topics</TabsTrigger>
            <TabsTrigger value="qa">Q&A</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="mt-4">
            {summary ? (
              <SummaryContent summary={summary} />
            ) : (
              <GenerateButton
                onClick={() => generateSummary()}
                loading={isLoadingSummary}
                label="Generate Summary"
              />
            )}
          </TabsContent>

          <TabsContent value="topics" className="mt-4">
            {topics ? (
              <TopicsContent topics={topics} />
            ) : (
              <GenerateButton
                onClick={() => generateTopics()}
                loading={isLoadingTopics}
                label="Analyze Topics"
              />
            )}
          </TabsContent>

          <TabsContent value="qa" className="mt-4">
            {qa ? (
              <QAContent qa={qa} />
            ) : (
              <GenerateButton
                onClick={() => generateQA()}
                loading={isLoadingQA}
                label="Generate Q&A"
              />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

// Summary content component
const SummaryContent: React.FC<{ summary: any }> = ({ summary }) => (
  <div className="space-y-4">
    <div>
      <h4 className="font-semibold mb-2">Overview</h4>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {summary.overview}
      </p>
    </div>

    <div>
      <h4 className="font-semibold mb-2">Key Takeaways</h4>
      <ul className="space-y-1">
        {summary.keyPoints.map((point: string, index: number) => (
          <li key={index} className="text-sm flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>

    <div>
      <h4 className="font-semibold mb-2">Chapters</h4>
      <div className="space-y-2">
        {summary.chapters.map((chapter: any, index: number) => (
          <div key={index} className="flex items-center gap-3 p-2 rounded border">
            <div className="flex-1">
              <h5 className="text-sm font-medium">{chapter.title}</h5>
              <p className="text-xs text-muted-foreground">
                {new Date(chapter.startTime * 1000).toISOString().substr(14, 5)} -
                {new Date(chapter.endTime * 1000).toISOString().substr(14, 5)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Topics content component
const TopicsContent: React.FC<{ topics: any }> = ({ topics }) => (
  <div className="space-y-4">
    <div>
      <h4 className="font-semibold mb-2">Main Topics</h4>
      <div className="space-y-3">
        {topics.mainTopics.map((topic: any, index: number) => (
          <div key={index} className="p-3 border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h5 className="font-medium">{topic.name}</h5>
              <Badge variant="outline">
                {Math.round(topic.confidence * 100)}% confidence
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {topic.description}
            </p>
            <div className="flex flex-wrap gap-1">
              {topic.keywords.map((keyword: string, kidx: number) => (
                <Badge key={kidx} variant="secondary" className="text-xs">
                  {keyword}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Q&A content component
const QAContent: React.FC<{ qa: any }> = ({ qa }) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <h4 className="font-semibold">
        Questions ({qa.questions.length})
      </h4>
      <Badge variant="outline">
        {qa.difficulty} • {qa.estimatedTime}min
      </Badge>
    </div>

    <div className="space-y-4">
      {qa.questions.map((item: any, index: number) => (
        <div key={index} className="border rounded-lg p-4">
          <div className="font-medium mb-2">
            Q{index + 1}: {item.question}
          </div>
          <div className="text-sm text-muted-foreground leading-relaxed">
            <strong>A:</strong> {item.answer}
          </div>
          {item.timestamp && (
            <div className="text-xs text-muted-foreground mt-2">
              <span>📍 </span>
              {new Date(item.timestamp * 1000).toISOString().substr(14, 5)}
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
);

// Generate button component
const GenerateButton: React.FC<{
  onClick: () => void;
  loading: boolean;
  label: string;
}> = ({ onClick, loading, label }) => (
  <div className="text-center py-8">
    <Button
      onClick={onClick}
      disabled={loading}
      className="min-w-32"
    >
      {loading ? (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
          Generating...
        </>
      ) : (
        label
      )}
    </Button>
  </div>
);
```

## 📋 Type Definitions

```typescript
// src/types/aiEnhancement.ts
export interface ContentSummary {
  videoId: string;
  overview: string;
  keyPoints: string[];
  chapters: Chapter[];
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  topics: string[];
  generatedAt: number;
  model: string;
  processingTime: number;
}

export interface Chapter {
  title: string;
  startTime: number;
  endTime: number;
  summary: string;
}

export interface TopicAnalysis {
  videoId: string;
  mainTopics: Topic[];
  subTopics: SubTopic[];
  expertise: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  processedAt: number;
  confidence: number;
  recommendations: string[];
}

export interface Topic {
  name: string;
  confidence: number;
  description: string;
  keywords: string[];
}

export interface SubTopic {
  name: string;
  parentTopic: string;
  relevance: number;
}

export interface GeneratedQA {
  videoId: string;
  questions: Question[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: 'factual' | 'conceptual' | 'application' | 'analysis';
  generatedAt: number;
  totalQuestions: number;
  estimatedTime: number;
}

export interface Question {
  question: string;
  answer: string;
  timestamp?: number;
  context?: string;
}

export interface EnhancedTranscript {
  videoId: string;
  originalTranscript: Transcript;
  definitions: TermDefinition[];
  references: ContentReference[];
  relatedContent: RelatedContent[];
  enhancedAt: number;
}

export interface TermDefinition {
  term: string;
  definition: string;
  example?: string;
}

export interface ContentReference {
  title: string;
  url: string;
  type: 'article' | 'book' | 'video' | 'research' | 'documentation';
  relevance: number;
  description?: string;
}

export interface RelatedContent {
  title: string;
  url: string;
  type: 'video' | 'article' | 'course' | 'resource';
  similarity: number;
  description?: string;
}
```

## 🎯 Usage Examples

### Basic Usage
```typescript
// Generate AI summary for a video
const summary = await AIContentEnhancementService.generateSummary(videoId, {
  model: 'gpt-4',
  style: 'detailed'
});

// Analyze topics in transcript
const topics = await AIContentEnhancementService.analyzeTopics(videoId, {
  granularity: 'detailed',
  includeSentiment: true
});

// Generate Q&A content
const qa = await AIContentEnhancementService.generateQA(videoId, {
  count: 15,
  difficulty: 'intermediate',
  type: 'mixed'
});
```

### React Hook Usage
```typescript
function VideoEnhancementTab({ videoId }: { videoId: string }) {
  const {
    summary,
    topics,
    qa,
    generateSummary,
    generateTopics,
    generateQA,
    isLoadingSummary,
    anyLoading
  } = useAIEnhancement({ videoId });

  if (anyLoading) return <div>Generating AI insights...</div>;

  return (
    <AIEnhancementPanel
      videoId={videoId}
      autoGenerate={false}
    />
  );
}
```

## 🔍 Error Handling & Monitoring

### Service-Level Errors
- **AI_ENHANCEMENT_FAILED**: General AI processing failure
- **CONTENT_NOT_FOUND**: Transcript content unavailable
- **TOPIC_ANALYSIS_FAILED**: Topic analysis processing error
- **QA_GENERATION_FAILED**: Q&A generation processing error
- **TRANSCRIPT_ENHANCEMENT_FAILED**: Transcript enhancement failure

### Monitoring & Analytics
```typescript
// Track AI enhancement usage
const analytics = {
  trackEnhancementGenerated: (videoId: string, type: string, model: string) => {
    // Analytics implementation
  },
  trackEnhancementError: (videoId: string, type: string, error: string) => {
    // Error tracking implementation
  }
};
```

## 🔒 Security & Cost Management

### Security Measures
- **API Key Protection**: Secure storage and rotation
- **Input Validation**: Sanitize all transcript content
- **Output Filtering**: Remove sensitive information from AI responses
- **Rate Limiting**: Prevent abuse and control costs

### Cost Optimization
- **Smart Caching**: Cache results for 24 hours
- **Batch Processing**: Process multiple enhancements together
- **Model Selection**: Choose optimal models for each task
- **Token Optimization**: Efficient prompt engineering

## 🧪 Testing Strategy

### Unit Tests
```typescript
describe('AIContentEnhancementService', () => {
  test('should generate summary from transcript', async () => {
    const summary = await AIContentEnhancementService.generateSummary('test-video-id');
    expect(summary).toHaveProperty('overview');
    expect(summary).toHaveProperty('keyPoints');
    expect(summary).toHaveProperty('chapters');
  });

  test('should analyze topics in transcript', async () => {
    const topics = await AIContentEnhancementService.analyzeTopics('test-video-id');
    expect(topics).toHaveProperty('mainTopics');
    expect(topics).toHaveProperty('confidence');
  });
});
```

### Integration Tests
```typescript
describe('AI Enhancement Integration', () => {
  test('should integrate with video service', async () => {
    // Test integration with VideoService
  });

  test('should integrate with transcription service', async () => {
    // Test integration with TranscriptionService
  });
});
```

## 🎯 Success Metrics

### Performance Metrics
- **Generation Speed**: < 10 seconds for summary, < 15 for topics/Q&A
- **Cache Hit Rate**: > 80% for repeat requests
- **Accuracy**: > 90% user satisfaction with AI insights
- **Cost Efficiency**: < $0.50 per video for full enhancement

### Quality Metrics
- **Summary Relevance**: Accurate and comprehensive overviews
- **Topic Precision**: Relevant topic extraction with good confidence
- **Q&A Quality**: Relevant questions with accurate answers
- **User Engagement**: Increased time spent with enhanced content

---

## 📞 Support & Troubleshooting

### Common Issues
1. **API Key Errors**: Verify OpenAI/Claude API keys are configured
2. **Slow Generation**: Check transcript length and model selection
3. **Poor Quality**: Adjust prompt parameters and temperature
4. **Cache Issues**: Clear cache for fresh results

### Debug Commands
```typescript
// Clear AI enhancement cache
await cacheService.clearPattern('ai-enhancement:*');

// Test AI service connectivity
await AIContentEnhancementService.healthCheck();

// Monitor API usage
const usage = await AIContentEnhancementService.getUsageStats();
```

This AI Content Enhancement skill provides comprehensive intelligent analysis and enhancement capabilities for video transcripts, seamlessly integrating with the modular service layer architecture and following the project's strict TypeScript and design system standards.