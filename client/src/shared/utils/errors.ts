import { ApiError } from '@shared/api/client';

export const messageFromError = (err: unknown, fallback: string): string => {
  if (err instanceof ApiError) {
    if (typeof err.data === 'string') return err.data;
    if (err.data && typeof err.data === 'object' && 'error' in err.data) {
      const value = (err.data as { error: unknown }).error;
      if (typeof value === 'string') return value;
    }
  }
  if (err instanceof Error) return err.message;
  return fallback;
};
