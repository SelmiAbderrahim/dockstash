import { ApiError } from '@shared/api/client';

export const messageFromError = (err: unknown, fallback: string): string => {
  if (err instanceof ApiError) {
    if (typeof err.data === 'string') return err.data;
    if (err.data && typeof err.data === 'object' && 'error' in err.data) {
      const value = (err.data as { error: unknown }).error;
      if (typeof value === 'string') return value;
      // The server error handler emits `{ error: { message, details } }`, so
      // unwrap the nested message rather than falling back to the generic
      // "Request to … failed with status N" ApiError text.
      if (value && typeof value === 'object' && 'message' in value) {
        const message = (value as { message: unknown }).message;
        if (typeof message === 'string') return message;
      }
    }
  }
  if (err instanceof Error) return err.message;
  return fallback;
};
