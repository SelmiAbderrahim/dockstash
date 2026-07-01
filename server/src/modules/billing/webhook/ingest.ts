import { logger } from '../../../config/logger.js';
import { WebhookVerifyError } from '../payment-provider.js';
import type { IPaymentProvider } from '../payment-provider.js';
import { WebhookEvent } from '../webhook-event.model.js';
import { dispatchEvent, payloadHashOf } from './registry.js';

export interface IngestResult {
  statusCode: number;
  body: { status: string; eventId?: string; error?: string };
}

export interface IngestInput {
  provider: IPaymentProvider;
  rawBody: Buffer;
  headers: Record<string, string | string[] | undefined>;
}

// Duplicate-key error code across MongoDB drivers.
const DUPLICATE_KEY_ERROR = 11000;

interface DuplicateKeyError {
  code?: number;
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as DuplicateKeyError).code === DUPLICATE_KEY_ERROR
  );
}

export async function ingestWebhook(input: IngestInput): Promise<IngestResult> {
  const { provider, rawBody, headers } = input;

  // 1. Verify signature BEFORE parsing.
  try {
    provider.verifyWebhook(rawBody, headers);
  } catch (err) {
    if (err instanceof WebhookVerifyError) {
      return {
        statusCode: err.status,
        body: { status: 'invalid', error: err.message },
      };
    }
    logger.error({ err }, 'billing.webhook: unexpected verify error');
    return { statusCode: 500, body: { status: 'error', error: 'verify failed' } };
  }

  // 2. Parse event now that the buffer is verified.
  let parsed;
  try {
    parsed = provider.parseEvent(rawBody, headers);
  } catch (err) {
    if (err instanceof WebhookVerifyError) {
      return {
        statusCode: err.status,
        body: { status: 'invalid', error: err.message },
      };
    }
    throw err;
  }

  // 3. INSERT-first dedupe against the (provider, eventId) unique guard.
  const payloadHash = payloadHashOf(rawBody);
  let inserted;
  try {
    inserted = await WebhookEvent.create({
      provider: provider.name,
      eventId: parsed.eventId,
      type: parsed.type,
      status: 'pending',
      retryCount: 0,
      payloadHash,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      const existing = await WebhookEvent.findOne({
        provider: provider.name,
        eventId: parsed.eventId,
      }).lean();
      return {
        statusCode: 200,
        body: {
          status: existing?.status ?? 'duplicate',
          eventId: parsed.eventId,
        },
      };
    }
    throw err;
  }

  // 4. Dispatch to handler.
  try {
    const result = await dispatchEvent(provider.name, parsed);
    inserted.status = result.status;
    if (result.reason) inserted.error = result.reason;
    await inserted.save();
    return {
      statusCode: 200,
      body: { status: result.status, eventId: parsed.eventId },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    inserted.status = 'failed';
    inserted.retryCount = (inserted.retryCount ?? 0) + 1;
    inserted.error = message;
    await inserted.save();
    logger.error(
      { err, eventId: parsed.eventId, type: parsed.type },
      'billing.webhook: dispatch failed',
    );
    return {
      statusCode: 200,
      body: { status: 'failed', eventId: parsed.eventId, error: message },
    };
  }
}
