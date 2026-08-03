import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

mongoose.set('strictQuery', true);

export async function connectDb(): Promise<typeof mongoose> {
  const maxAttempts = 5;
  let attempt = 0;
  let lastError: unknown;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const conn = await mongoose.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5_000,
      });
      logger.info({ host: conn.connection.host, db: conn.connection.name }, 'mongo connected');
      return conn;
    } catch (err) {
      lastError = err;
      const backoff = Math.min(1_000 * 2 ** (attempt - 1), 10_000);
      logger.warn({ err, attempt, backoff }, 'mongo connection failed, retrying');
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  logger.error({ err: lastError }, 'mongo connection failed after retries');
  throw lastError;
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
