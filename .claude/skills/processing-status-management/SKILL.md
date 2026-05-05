---
name: processing-status-management
description: >
  Processing status management system that provides real-time monitoring, progress tracking,
  and status updates for video upload, transcription, and AI enhancement processes.
---

# Processing Status Management Skill

**Skill ID**: `processing-status-management`
**Version**: 1.0.0
**Category**: System & Infrastructure
**Tags**: `processing`, `status`, `realtime`, `monitoring`, `convex`

## 🎯 Purpose

Comprehensive processing status management system for iReadYouTube that provides real-time monitoring, progress tracking, and status updates for video upload, transcription, and AI enhancement processes. Seamlessly integrates with Convex's real-time capabilities and the modular service layer architecture.

## 🚀 Core Capabilities

### 1. **Real-Time Status Tracking**
- **Live Progress Updates**: Real-time progress updates via Convex subscriptions
- **Status Broadcasting**: Broadcast status changes to connected clients
- **WebSocket Integration**: Efficient real-time communication
- **Status History**: Complete audit trail of status changes and events

### 2. **Processing Pipeline Management**
- **Pipeline Orchestration**: Coordinate multi-step processing workflows
- **Dependency Management**: Handle task dependencies and execution order
- **Error Recovery**: Automatic retry and fallback mechanisms
- **Resource Management**: Optimize resource allocation and prevent bottlenecks

### 3. **Monitoring & Analytics**
- **Performance Metrics**: Track processing times, success rates, and bottlenecks
- **Health Monitoring**: System health checks and alerting
- **Usage Analytics**: Monitor usage patterns and system load
- **Error Tracking**: Comprehensive error logging and analysis

### 4. **User Experience**
- **Progress Visualization**: Interactive progress bars and status indicators
- **ETA Calculations**: Estimated completion times based on historical data
- **Notification System**: Email and in-app notifications for status changes
- **Status Persistence**: Maintain status across page refreshes and sessions

## 🏗️ Service Integration

### Core Service Dependencies
```typescript
// Import existing modular services
import { VideoService } from '@/services/videoService';
import { UploadService } from '@/services/uploadService';
import { TranscriptionService } from '@/services/transcriptionService';
import { AIContentEnhancementService } from '@/services/aiContentEnhancementService';

// Processing Status Management Service
export class ProcessingStatusService {
  private convex: ConvexClient;
  private statusEmitter: EventEmitter;
  private metrics: MetricsCollector;

  constructor() {
    this.convex = new ConvexClient();
    this.statusEmitter = new EventEmitter();
    this.metrics = new MetricsCollector();
  }
}
```

### Service Layer Integration
- **VideoService**: Access video metadata and update processing status
- **UploadService**: Monitor upload progress and status changes
- **TranscriptionService**: Track transcription processing and completion
- **AIContentEnhancementService**: Monitor AI enhancement processing
- **Convex Backend**: Real-time status synchronization and persistence

## 🔧 Implementation Details

### Core Service Implementation
```typescript
// src/services/processingStatusService.ts
import { z } from 'zod';
import type {
  ProcessingJob,
  ProcessingStatus,
  ProcessingStep,
  ProcessingMetrics,
  StatusUpdate,
  ProcessingEvent
} from '@/types';
import { ApplicationError } from '@/errors';
import { convexClient } from '@/lib/convex';
import { metricsCollector } from '@/lib/metrics';

// Processing Status Schemas
const processingSchemas = {
  job: z.object({
    id: z.string(),
    type: z.enum(['upload', 'transcription', 'ai_enhancement', 'full_pipeline']),
    videoId: z.string(),
    userId: z.string(),
    status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']),
    progress: z.number().min(0).max(100),
    currentStep: z.string().optional(),
    totalSteps: z.number().min(1),
    completedSteps: z.number().min(0),
    startedAt: z.number().optional(),
    completedAt: z.number().optional(),
    error: z.string().optional(),
    metadata: z.record(z.any()).optional()
  }),

  step: z.object({
    id: z.string(),
    jobId: z.string(),
    name: z.string(),
    type: z.enum(['validation', 'upload', 'transcription', 'ai_processing', 'cleanup']),
    status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']),
    progress: z.number().min(0).max(100),
    startedAt: z.number().optional(),
    completedAt: z.number().optional(),
    duration: z.number().optional(),
    error: z.string().optional(),
    metadata: z.record(z.any()).optional()
  }),

  metrics: z.object({
    jobId: z.string(),
    type: z.enum(['performance', 'error', 'usage']),
    timestamp: z.number(),
    value: z.number(),
    unit: z.string(),
    metadata: z.record(z.any()).optional()
  })
});

export class ProcessingStatusService {
  private static readonly STATUS_EVENTS = {
    JOB_CREATED: 'job:created',
    JOB_STARTED: 'job:started',
    JOB_COMPLETED: 'job:completed',
    JOB_FAILED: 'job:failed',
    STEP_STARTED: 'step:started',
    STEP_COMPLETED: 'step:completed',
    STEP_FAILED: 'step:failed',
    PROGRESS_UPDATE: 'progress:update'
  };

  /**
   * Create new processing job
   */
  static async createJob(
    type: ProcessingJob['type'],
    videoId: string,
    userId: string,
    options: {
      totalSteps?: number;
      metadata?: Record<string, any>;
      priority?: 'low' | 'normal' | 'high';
    } = {}
  ): Promise<ProcessingJob> {
    try {
      const job: ProcessingJob = {
        id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        videoId,
        userId,
        status: 'pending',
        progress: 0,
        currentStep: undefined,
        totalSteps: options.totalSteps || this.getDefaultStepCount(type),
        completedSteps: 0,
        startedAt: undefined,
        completedAt: undefined,
        error: undefined,
        metadata: {
          ...options.metadata,
          priority: options.priority || 'normal',
          createdAt: Date.now()
        }
      };

      // Save to Convex
      await convexClient.mutation('processing/createJob', { job });

      // Track metrics
      metricsCollector.track('job_created', {
        type,
        userId,
        videoId,
        priority: options.priority || 'normal'
      });

      // Emit event
      this.emitStatusEvent(this.STATUS_EVENTS.JOB_CREATED, job);

      return job;
    } catch (error) {
      console.error('Job creation failed:', error);
      throw new ApplicationError(
        'JOB_CREATION_FAILED',
        'Failed to create processing job',
        { originalError: error, type, videoId, userId }
      );
    }
  }

  /**
   * Start processing job
   */
  static async startJob(jobId: string): Promise<void> {
    try {
      const update = {
        status: 'running' as const,
        startedAt: Date.now(),
        progress: 0
      };

      await convexClient.mutation('processing/updateJob', {
        jobId,
        update,
        timestamp: Date.now()
      });

      const job = await this.getJob(jobId);
      if (job) {
        metricsCollector.track('job_started', {
          type: job.type,
          userId: job.userId,
          videoId: job.videoId
        });

        this.emitStatusEvent(this.STATUS_EVENTS.JOB_STARTED, job);
      }
    } catch (error) {
      console.error('Job start failed:', error);
      throw new ApplicationError(
        'JOB_START_FAILED',
        'Failed to start processing job',
        { originalError: error, jobId }
      );
    }
  }

  /**
   * Add processing step to job
   */
  static async addStep(
    jobId: string,
    stepData: {
      name: string;
      type: ProcessingStep['type'];
      metadata?: Record<string, any>;
    }
  ): Promise<ProcessingStep> {
    try {
      const step: ProcessingStep = {
        id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        jobId,
        name: stepData.name,
        type: stepData.type,
        status: 'pending',
        progress: 0,
        startedAt: undefined,
        completedAt: undefined,
        duration: undefined,
        error: undefined,
        metadata: stepData.metadata
      };

      // Save step to Convex
      await convexClient.mutation('processing/createStep', { step });

      return step;
    } catch (error) {
      console.error('Step creation failed:', error);
      throw new ApplicationError(
        'STEP_CREATION_FAILED',
        'Failed to create processing step',
        { originalError: error, jobId, stepData }
      );
    }
  }

  /**
   * Start processing step
   */
  static async startStep(stepId: string): Promise<void> {
    try {
      const update = {
        status: 'running' as const,
        startedAt: Date.now(),
        progress: 0
      };

      await convexClient.mutation('processing/updateStep', {
        stepId,
        update,
        timestamp: Date.now()
      });

      const step = await this.getStep(stepId);
      if (step) {
        metricsCollector.track('step_started', {
          type: step.type,
          jobId: step.jobId
        });

        this.emitStatusEvent(this.STATUS_EVENTS.STEP_STARTED, step);
      }
    } catch (error) {
      console.error('Step start failed:', error);
      throw new ApplicationError(
        'STEP_START_FAILED',
        'Failed to start processing step',
        { originalError: error, stepId }
      );
    }
  }

  /**
   * Update step progress
   */
  static async updateStepProgress(
    stepId: string,
    progress: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const update = {
        progress: Math.max(0, Math.min(100, progress)),
        metadata: metadata || {}
      };

      await convexClient.mutation('processing/updateStep', {
        stepId,
        update,
        timestamp: Date.now()
      });

      // Update overall job progress
      await this.updateJobProgress(stepId);

      this.emitStatusEvent(this.STATUS_EVENTS.PROGRESS_UPDATE, {
        stepId,
        progress,
        metadata
      });
    } catch (error) {
      console.error('Step progress update failed:', error);
      throw new ApplicationError(
        'STEP_PROGRESS_UPDATE_FAILED',
        'Failed to update step progress',
        { originalError: error, stepId, progress }
      );
    }
  }

  /**
   * Complete processing step
   */
  static async completeStep(
    stepId: string,
    result?: Record<string, any>
  ): Promise<void> {
    try {
      const step = await this.getStep(stepId);
      if (!step) {
        throw new ApplicationError('STEP_NOT_FOUND', 'Processing step not found');
      }

      const duration = step.startedAt ? Date.now() - step.startedAt : undefined;

      const update = {
        status: 'completed' as const,
        progress: 100,
        completedAt: Date.now(),
        duration,
        metadata: {
          ...step.metadata,
          result
        }
      };

      await convexClient.mutation('processing/updateStep', {
        stepId,
        update,
        timestamp: Date.now()
      });

      // Update job status
      await this.updateJobProgress(stepId);

      metricsCollector.track('step_completed', {
        type: step.type,
        jobId: step.jobId,
        duration: duration || 0
      });

      this.emitStatusEvent(this.STATUS_EVENTS.STEP_COMPLETED, step);
    } catch (error) {
      console.error('Step completion failed:', error);
      throw new ApplicationError(
        'STEP_COMPLETION_FAILED',
        'Failed to complete processing step',
        { originalError: error, stepId, result }
      );
    }
  }

  /**
   * Fail processing step
   */
  static async failStep(
    stepId: string,
    error: Error | string,
    retryable: boolean = true
  ): Promise<void> {
    try {
      const step = await this.getStep(stepId);
      if (!step) {
        throw new ApplicationError('STEP_NOT_FOUND', 'Processing step not found');
      }

      const duration = step.startedAt ? Date.now() - step.startedAt : undefined;

      const update = {
        status: 'failed' as const,
        progress: step.progress,
        completedAt: Date.now(),
        duration,
        error: typeof error === 'string' ? error : error.message,
        metadata: {
          ...step.metadata,
          retryable,
          errorType: error instanceof Error ? error.constructor.name : 'Unknown'
        }
      };

      await convexClient.mutation('processing/updateStep', {
        stepId,
        update,
        timestamp: Date.now()
      });

      // Mark job as failed if not retryable
      if (!retryable) {
        await this.failJob(step.jobId, error as string);
      }

      metricsCollector.track('step_failed', {
        type: step.type,
        jobId: step.jobId,
        duration: duration || 0,
        retryable
      });

      this.emitStatusEvent(this.STATUS_EVENTS.STEP_FAILED, step);
    } catch (processingError) {
      console.error('Step failure handling failed:', processingError);
      throw new ApplicationError(
        'STEP_FAILURE_HANDLING_FAILED',
        'Failed to handle step failure',
        { originalError: processingError, stepId, error }
      );
    }
  }

  /**
   * Complete processing job
   */
  static async completeJob(
    jobId: string,
    result?: Record<string, any>
  ): Promise<void> {
    try {
      const job = await this.getJob(jobId);
      if (!job) {
        throw new ApplicationError('JOB_NOT_FOUND', 'Processing job not found');
      }

      const duration = job.startedAt ? Date.now() - job.startedAt : undefined;

      const update = {
        status: 'completed' as const,
        progress: 100,
        completedAt: Date.now(),
        currentStep: 'Completed',
        completedSteps: job.totalSteps,
        metadata: {
          ...job.metadata,
          result,
          duration
        }
      };

      await convexClient.mutation('processing/updateJob', {
        jobId,
        update,
        timestamp: Date.now()
      });

      metricsCollector.track('job_completed', {
        type: job.type,
        userId: job.userId,
        videoId: job.videoId,
        duration: duration || 0
      });

      this.emitStatusEvent(this.STATUS_EVENTS.JOB_COMPLETED, job);
    } catch (error) {
      console.error('Job completion failed:', error);
      throw new ApplicationError(
        'JOB_COMPLETION_FAILED',
        'Failed to complete processing job',
        { originalError: error, jobId, result }
      );
    }
  }

  /**
   * Fail processing job
   */
  static async failJob(jobId: string, error: string | Error): Promise<void> {
    try {
      const job = await this.getJob(jobId);
      if (!job) {
        throw new ApplicationError('JOB_NOT_FOUND', 'Processing job not found');
      }

      const duration = job.startedAt ? Date.now() - job.startedAt : undefined;

      const update = {
        status: 'failed' as const,
        progress: job.progress,
        completedAt: Date.now(),
        error: typeof error === 'string' ? error : error.message,
        metadata: {
          ...job.metadata,
          duration,
          errorType: error instanceof Error ? error.constructor.name : 'Unknown'
        }
      };

      await convexClient.mutation('processing/updateJob', {
        jobId,
        update,
        timestamp: Date.now()
      });

      metricsCollector.track('job_failed', {
        type: job.type,
        userId: job.userId,
        videoId: job.videoId,
        duration: duration || 0
      });

      this.emitStatusEvent(this.STATUS_EVENTS.JOB_FAILED, job);
    } catch (processingError) {
      console.error('Job failure handling failed:', processingError);
      throw new ApplicationError(
        'JOB_FAILURE_HANDLING_FAILED',
        'Failed to handle job failure',
        { originalError: processingError, jobId, error }
      );
    }
  }

  /**
   * Cancel processing job
   */
  static async cancelJob(jobId: string, reason?: string): Promise<void> {
    try {
      const job = await this.getJob(jobId);
      if (!job) {
        throw new ApplicationError('JOB_NOT_FOUND', 'Processing job not found');
      }

      if (job.status === 'completed') {
        throw new ApplicationError(
          'JOB_ALREADY_COMPLETED',
          'Cannot cancel a completed job'
        );
      }

      const duration = job.startedAt ? Date.now() - job.startedAt : undefined;

      const update = {
        status: 'cancelled' as const,
        completedAt: Date.now(),
        error: reason || 'Job cancelled by user',
        metadata: {
          ...job.metadata,
          duration,
          cancelledAt: Date.now()
        }
      };

      await convexClient.mutation('processing/updateJob', {
        jobId,
        update,
        timestamp: Date.now()
      });

      // Cancel all running steps
      await this.cancelJobSteps(jobId);

      metricsCollector.track('job_cancelled', {
        type: job.type,
        userId: job.userId,
        videoId: job.videoId,
        duration: duration || 0,
        reason
      });
    } catch (error) {
      console.error('Job cancellation failed:', error);
      throw new ApplicationError(
        'JOB_CANCELLATION_FAILED',
        'Failed to cancel processing job',
        { originalError: error, jobId, reason }
      );
    }
  }

  /**
   * Get processing job by ID
   */
  static async getJob(jobId: string): Promise<ProcessingJob | null> {
    try {
      return await convexClient.query('processing/getJob', { jobId });
    } catch (error) {
      console.error('Job retrieval failed:', error);
      return null;
    }
  }

  /**
   * Get processing step by ID
   */
  static async getStep(stepId: string): Promise<ProcessingStep | null> {
    try {
      return await convexClient.query('processing/getStep', { stepId });
    } catch (error) {
      console.error('Step retrieval failed:', error);
      return null;
    }
  }

  /**
   * Get jobs for user
   */
  static async getUserJobs(
    userId: string,
    options: {
      status?: ProcessingJob['status'];
      type?: ProcessingJob['type'];
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<ProcessingJob[]> {
    try {
      return await convexClient.query('processing/getUserJobs', {
        userId,
        filters: {
          status: options.status,
          type: options.type
        },
        pagination: {
          limit: options.limit || 50,
          offset: options.offset || 0
        }
      });
    } catch (error) {
      console.error('User jobs retrieval failed:', error);
      return [];
    }
  }

  /**
   * Get jobs for video
   */
  static async getVideoJobs(videoId: string): Promise<ProcessingJob[]> {
    try {
      return await convexClient.query('processing/getVideoJobs', { videoId });
    } catch (error) {
      console.error('Video jobs retrieval failed:', error);
      return [];
    }
  }

  /**
   * Get job metrics
   */
  static async getJobMetrics(
    jobId: string,
    timeRange?: { start: number; end: number }
  ): Promise<ProcessingMetrics[]> {
    try {
      return await convexClient.query('processing/getJobMetrics', {
        jobId,
        timeRange
      });
    } catch (error) {
      console.error('Job metrics retrieval failed:', error);
      return [];
    }
  }

  /**
   * Subscribe to job status updates
   */
  static subscribeToJob(
    jobId: string,
    callback: (job: ProcessingJob) => void
  ): () => void {
    return convexClient.subscribe(
      'processing/onJobUpdate',
      { jobId },
      callback
    );
  }

  /**
   * Subscribe to user's jobs
   */
  static subscribeToUserJobs(
    userId: string,
    callback: (jobs: ProcessingJob[]) => void
  ): () => void {
    return convexClient.subscribe(
      'processing/onUserJobsUpdate',
      { userId },
      callback
    );
  }

  /**
   * Get system health status
   */
  static async getSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    activeJobs: number;
    completedJobsLastHour: number;
    failedJobsLastHour: number;
    averageProcessingTime: number;
    errorRate: number;
  }> {
    try {
      const health = await convexClient.query('processing/getSystemHealth');

      return {
        status: health.status,
        activeJobs: health.activeJobs,
        completedJobsLastHour: health.completedJobsLastHour,
        failedJobsLastHour: health.failedJobsLastHour,
        averageProcessingTime: health.averageProcessingTime,
        errorRate: health.errorRate
      };
    } catch (error) {
      console.error('System health check failed:', error);
      return {
        status: 'unhealthy',
        activeJobs: 0,
        completedJobsLastHour: 0,
        failedJobsLastHour: 0,
        averageProcessingTime: 0,
        errorRate: 1
      };
    }
  }

  /**
   * Clean up old completed jobs
   */
  static async cleanupOldJobs(daysOld: number = 30): Promise<number> {
    try {
      const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);

      const deletedCount = await convexClient.mutation('processing/cleanupOldJobs', {
        cutoffTime,
        statuses: ['completed', 'failed', 'cancelled']
      });

      metricsCollector.track('jobs_cleaned_up', { deletedCount, daysOld });

      return deletedCount;
    } catch (error) {
      console.error('Job cleanup failed:', error);
      throw new ApplicationError(
        'JOB_CLEANUP_FAILED',
        'Failed to cleanup old jobs',
        { originalError: error, daysOld }
      );
    }
  }

  /**
   * Get default step count for job type
   */
  private static getDefaultStepCount(type: ProcessingJob['type']): number {
    const stepCounts = {
      upload: 3, // validation, upload, processing
      transcription: 4, // validation, transcription, processing, completion
      ai_enhancement: 3, // analysis, enhancement, completion
      full_pipeline: 8 // complete pipeline steps
    };

    return stepCounts[type] || 1;
  }

  /**
   * Update job progress based on step progress
   */
  private static async updateJobProgress(stepId: string): Promise<void> {
    try {
      const step = await this.getStep(stepId);
      if (!step) return;

      const job = await this.getJob(step.jobId);
      if (!job) return;

      // Get all steps for the job
      const steps = await convexClient.query('processing/getJobSteps', {
        jobId: step.jobId
      });

      // Calculate overall progress
      const completedSteps = steps.filter(s => s.status === 'completed').length;
      const totalSteps = steps.length;
      const stepProgress = steps.reduce((sum, s) => sum + s.progress, 0);
      const overallProgress = totalSteps > 0 ? stepProgress / totalSteps : 0;

      // Find current running step
      const currentStep = steps.find(s => s.status === 'running');

      await convexClient.mutation('processing/updateJob', {
        jobId: step.jobId,
        update: {
          progress: Math.round(overallProgress),
          completedSteps,
          currentStep: currentStep?.name || job.currentStep
        },
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Job progress update failed:', error);
    }
  }

  /**
   * Cancel all running steps for a job
   */
  private static async cancelJobSteps(jobId: string): Promise<void> {
    try {
      const steps = await convexClient.query('processing/getJobSteps', { jobId });
      const runningSteps = steps.filter(step => step.status === 'running');

      for (const step of runningSteps) {
        await convexClient.mutation('processing/updateStep', {
          stepId: step.id,
          update: {
            status: 'cancelled',
            completedAt: Date.now(),
            error: 'Job cancelled'
          },
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Job steps cancellation failed:', error);
    }
  }

  /**
   * Emit status event
   */
  private static emitStatusEvent(
    eventType: string,
    data: ProcessingJob | ProcessingStep | Record<string, any>
  ): void {
    // This would integrate with your event system
    // For now, we'll just log the event
    console.log(`Processing Status Event: ${eventType}`, data);

    // You could also emit to WebSocket clients, send notifications, etc.
    // eventEmitter.emit(eventType, data);
  }
}
```

### React Hook Integration
```typescript
// src/hooks/useProcessingStatus.ts
import { useQuery, useMutation, useSubscription } from '@tanstack/react-query';
import { ProcessingStatusService } from '@/services/processingStatusService';
import type { ProcessingJob, ProcessingStep } from '@/types';

export function useProcessingJob(jobId: string) {
  // Job query
  const jobQuery = useQuery({
    queryKey: ['processing-job', jobId],
    queryFn: () => ProcessingStatusService.getJob(jobId),
    enabled: !!jobId,
    refetchInterval: (data) => {
      // Refetch more frequently for active jobs
      if (!data) return false;
      return data.status === 'running' ? 2000 : false; // Every 2 seconds for running jobs
    }
  });

  // Real-time subscription
  const subscription = useSubscription({
    queryKey: ['processing-job-sub', jobId],
    queryFn: () => ({
      subscribe: (callback: (job: ProcessingJob) => void) =>
        ProcessingStatusService.subscribeToJob(jobId, callback)
    }),
    enabled: !!jobId
  });

  // Cancel job mutation
  const cancelJobMutation = useMutation({
    mutationFn: (reason?: string) => ProcessingStatusService.cancelJob(jobId, reason),
    onSuccess: () => {
      jobQuery.refetch();
    }
  });

  return {
    job: jobQuery.data,
    isLoading: jobQuery.isLoading,
    error: jobQuery.error,
    cancelJob: cancelJobMutation.mutateAsync,
    isCancelling: cancelJobMutation.isPending,
    refetch: jobQuery.refetch,
    // Subscription data (real-time updates)
    realtimeJob: subscription.data
  };
}

export function useUserJobs(userId: string, options?: {
  status?: ProcessingJob['status'];
  type?: ProcessingJob['type'];
}) {
  return useQuery({
    queryKey: ['user-jobs', userId, options],
    queryFn: () => ProcessingStatusService.getUserJobs(userId, {
      ...options,
      limit: 20
    }),
    enabled: !!userId,
    refetchInterval: 30000 // Refresh every 30 seconds
  });
}

export function useVideoJobs(videoId: string) {
  return useQuery({
    queryKey: ['video-jobs', videoId],
    queryFn: () => ProcessingStatusService.getVideoJobs(videoId),
    enabled: !!videoId
  });
}

export function useSystemHealth() {
  return useQuery({
    queryKey: ['system-health'],
    queryFn: () => ProcessingStatusService.getSystemHealth(),
    refetchInterval: 60000 // Check health every minute
  });
}
```

### Status Management Components
```typescript
// src/components/processing/ProcessingStatus.tsx
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useProcessingJob } from '@/hooks/useProcessingStatus';
import { cn } from '@/lib/utils';
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  Pause
} from 'lucide-react';

interface ProcessingStatusProps {
  jobId: string;
  className?: string;
  showDetails?: boolean;
  onCancel?: () => void;
}

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({
  jobId,
  className,
  showDetails = false,
  onCancel
}) => {
  const {
    job,
    isLoading,
    error,
    cancelJob,
    isCancelling
  } = useProcessingJob(jobId);

  if (isLoading) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !job) {
    return (
      <Card className={cn("w-full border-red-200", className)}>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load processing status
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = (status: ProcessingJob['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'running':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case 'cancelled':
        return <Pause className="h-5 w-5 text-gray-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: ProcessingJob['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'running':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '0s';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatETA = (job: ProcessingJob) => {
    if (job.status !== 'running' || !job.startedAt) return 'Calculating...';

    const elapsed = Date.now() - job.startedAt;
    const rate = job.progress / elapsed;
    const remaining = rate > 0 ? (100 - job.progress) / rate : 0;

    return formatDuration(remaining);
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            {getStatusIcon(job.status)}
            Processing Status
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(job.status)}>
              {job.status}
            </Badge>
            {job.status === 'running' && (
              <Badge variant="outline">
                {job.completedSteps}/{job.totalSteps} steps
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{job.progress}%</span>
          </div>
          <Progress value={job.progress} className="h-2" />
          {job.currentStep && (
            <p className="text-sm text-muted-foreground">
              Current: {job.currentStep}
            </p>
          )}
        </div>

        {/* Error Message */}
        {job.error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{job.error}</AlertDescription>
          </Alert>
        )}

        {/* Job Details */}
        {showDetails && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Job ID:</span>
              <p className="text-muted-foreground font-mono text-xs">
                {job.id}
              </p>
            </div>
            <div>
              <span className="font-medium">Type:</span>
              <p className="text-muted-foreground capitalize">
                {job.type.replace('_', ' ')}
              </p>
            </div>
            <div>
              <span className="font-medium">Started:</span>
              <p className="text-muted-foreground">
                {job.startedAt
                  ? new Date(job.startedAt).toLocaleString()
                  : 'Not started'
                }
              </p>
            </div>
            <div>
              <span className="font-medium">Duration:</span>
              <p className="text-muted-foreground">
                {formatDuration(
                  job.completedAt && job.startedAt
                    ? job.completedAt - job.startedAt
                    : job.startedAt
                    ? Date.now() - job.startedAt
                    : undefined
                )}
              </p>
            </div>
          </div>
        )}

        {/* ETA and Actions */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {job.status === 'running' && (
              <span>ETA: {formatETA(job)}</span>
            )}
          </div>

          <div className="flex gap-2">
            {job.status === 'running' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => cancelJob?.() || cancelJob('Cancelled by user')}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  'Cancel'
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Completion Message */}
        {job.status === 'completed' && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Processing completed successfully!
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

// Processing queue component
export const ProcessingQueue: React.FC<{
  userId: string;
  className?: string;
}> = ({ userId, className }) => {
  const { data: jobs, isLoading } = useUserJobs(userId);

  if (isLoading) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading jobs...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeJobs = jobs?.filter(job =>
    ['pending', 'running'].includes(job.status)
  ) || [];

  if (!activeJobs.length) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">No active processing jobs</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Processing Queue</span>
          <Badge variant="secondary">{activeJobs.length} active</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeJobs.map(job => (
          <ProcessingStatus
            key={job.id}
            jobId={job.id}
            showDetails={false}
          />
        ))}
      </CardContent>
    </Card>
  );
};
```

## 📋 Type Definitions

```typescript
// src/types/processing.ts
export type ProcessingJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ProcessingJobType = 'upload' | 'transcription' | 'ai_enhancement' | 'full_pipeline';
export type ProcessingStepType = 'validation' | 'upload' | 'transcription' | 'ai_processing' | 'cleanup';

export interface ProcessingJob {
  id: string;
  type: ProcessingJobType;
  videoId: string;
  userId: string;
  status: ProcessingJobStatus;
  progress: number; // 0-100
  currentStep?: string;
  totalSteps: number;
  completedSteps: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ProcessingStep {
  id: string;
  jobId: string;
  name: string;
  type: ProcessingStepType;
  status: ProcessingJobStatus;
  progress: number; // 0-100
  startedAt?: number;
  completedAt?: number;
  duration?: number; // milliseconds
  error?: string;
  metadata?: Record<string, any>;
}

export interface ProcessingMetrics {
  jobId: string;
  type: 'performance' | 'error' | 'usage';
  timestamp: number;
  value: number;
  unit: string;
  metadata?: Record<string, any>;
}

export interface StatusUpdate {
  jobId?: string;
  stepId?: string;
  status: ProcessingJobStatus;
  progress?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ProcessingEvent {
  type: string;
  jobId?: string;
  stepId?: string;
  timestamp: number;
  data: Record<string, any>;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  activeJobs: number;
  completedJobsLastHour: number;
  failedJobsLastHour: number;
  averageProcessingTime: number;
  errorRate: number;
}
```

## 🎯 Usage Examples

### Basic Usage
```typescript
// Create and manage processing job
const job = await ProcessingStatusService.createJob(
  'transcription',
  videoId,
  userId,
  { totalSteps: 4, priority: 'normal' }
);

await ProcessingStatusService.startJob(job.id);

const validationStep = await ProcessingStatusService.addStep(job.id, {
  name: 'Video validation',
  type: 'validation'
});

await ProcessingStatusService.startStep(validationStep.id);
await ProcessingStatusService.updateStepProgress(validationStep.id, 50);
await ProcessingStatusService.completeStep(validationStep.id);

// Complete the entire job
await ProcessingStatusService.completeJob(job.id, {
  transcriptUrl: 'https://example.com/transcript.json'
});
```

### React Hook Usage
```typescript
function VideoProcessingStatus({ videoId }: { videoId: string }) {
  const { data: jobs } = useVideoJobs(videoId);
  const activeJob = jobs?.find(job => ['pending', 'running'].includes(job.status));

  if (!activeJob) return null;

  return (
    <ProcessingStatus
      jobId={activeJob.id}
      showDetails={true}
      onCancel={() => console.log('Cancelled')}
    />
  );
}
```

## 🔍 Error Handling & Monitoring

### Service-Level Errors
- **JOB_CREATION_FAILED**: Processing job creation error
- **JOB_START_FAILED**: Job initiation failure
- **STEP_CREATION_FAILED**: Step creation error
- **STEP_PROGRESS_UPDATE_FAILED**: Progress update failure
- **JOB_COMPLETION_FAILED**: Job completion error
- **JOB_CANCELLATION_FAILED**: Job cancellation error

### Monitoring Integration
```typescript
// Processing metrics collection
const processingMetrics = {
  trackJobCreated: (job: ProcessingJob) => {
    // Analytics implementation
  },
  trackStepCompleted: (step: ProcessingStep, duration: number) => {
    // Performance tracking
  },
  trackErrorRate: (jobType: string, errorRate: number) => {
    // Error rate monitoring
  }
};
```

## 🧪 Testing Strategy

### Unit Tests
```typescript
describe('ProcessingStatusService', () => {
  test('should create processing job', async () => {
    const job = await ProcessingStatusService.createJob(
      'upload',
      'video-id',
      'user-id'
    );
    expect(job.type).toBe('upload');
    expect(job.status).toBe('pending');
  });

  test('should update job progress', async () => {
    // Test progress updates
  });
});
```

### Integration Tests
```typescript
describe('Processing Integration', () => {
  test('should integrate with upload service', async () => {
    // Test upload service integration
  });

  test('should integrate with transcription service', async () => {
    // Test transcription service integration
  });
});
```

## 🎯 Success Metrics

### Performance Metrics
- **Processing Speed**: Average time for each job type
- **Success Rate**: Percentage of jobs completed successfully
- **Error Rate**: Percentage of jobs that fail
- **Queue Time**: Average time jobs spend in queue

### User Experience Metrics
- **Status Visibility**: Users can easily track processing progress
- **ETA Accuracy**: Estimated completion times are accurate
- **Error Clarity**: Clear error messages and recovery options
- **Cancellation Response**: Jobs can be cancelled quickly

---

## 📞 Support & Troubleshooting

### Common Issues
1. **Stuck Jobs**: Jobs that remain in 'running' state too long
2. **Progress Updates**: Missing or delayed progress updates
3. **Error Recovery**: Proper handling of transient failures
4. **Resource Leaks**: Clean up completed jobs and resources

### Debug Commands
```typescript
// Get system health
const health = await ProcessingStatusService.getSystemHealth();

// Check stuck jobs
const stuckJobs = await ProcessingStatusService.findStuckJobs(300000); // 5 minutes

// Cleanup old jobs
const cleanedCount = await ProcessingStatusService.cleanupOldJobs(7); // 7 days
```

This Processing Status Management skill provides comprehensive real-time monitoring and status tracking for all video processing operations, ensuring users have clear visibility into the processing pipeline while integrating seamlessly with the modular service layer architecture and Convex real-time capabilities.