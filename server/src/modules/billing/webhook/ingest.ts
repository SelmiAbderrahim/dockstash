import { logger } from '../../../config/logger.js';
import { WebhookVerifyError } from '../payment-provider.js';
import type { IPaymentProvider, ParsedEvent } from '../payment-provider.js';
import { WebhookEvent, type WebhookEventHydrated } from '../webhook-event.model.js';
import { dispatchEvent, payloadHashOf } from './registry.js';

export interface IngestResult {
  statusCode: number;
  body: { status: string; eventId?: string; error?: string };
}

/**
 * Give up re-processing a failing event after this many attempts (the poison
 * pill case). Beyond the cap we ack with 200 so the provider stops retrying;
 * the reconciliation cron is the safety net for the lost state transition.
 */
export const MAX_WEBHOOK_RETRIES = 5;

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
      });
      // Re-dispatch a previously failed delivery (the provider is retrying
      // because we returned 5xx) until the retry cap. `pending` means a
      // concurrent worker owns the event — never double-dispatch.
      if (
        existing &&
        existing.status === 'failed' &&
        existing.retryCount < MAX_WEBHOOK_RETRIES
      ) {
        return runDispatch(provider.name, parsed, existing);
      }
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
  return runDispatch(provider.name, parsed, inserted);
}

/**
 * Run the handler for an event row and persist the outcome. On failure the
 * row is marked `failed` and we return 500 (so the provider retries) until
 * `MAX_WEBHOOK_RETRIES` is reached, after which we ack with 200 to stop the
 * retry storm.
 */
async function runDispatch(
  providerName: IPaymentProvider['name'],
  parsed: ParsedEvent,
  row: WebhookEventHydrated,
): Promise<IngestResult> {
  try {
    const result = await dispatchEvent(providerName, parsed);
    row.status = result.status;
    row.error = result.reason ?? null;
    await row.save();
    return {
      statusCode: 200,
      body: { status: result.status, eventId: parsed.eventId },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    row.status = 'failed';
    row.retryCount = (row.retryCount ?? 0) + 1;
    row.error = message;
    await row.save();
    const exhausted = row.retryCount >= MAX_WEBHOOK_RETRIES;
    logger.error(
      {
        err,
        eventId: parsed.eventId,
        type: parsed.type,
        retryCount: row.retryCount,
        exhausted,
      },
      'billing.webhook: dispatch failed',
    );
    return {
      statusCode: exhausted ? 200 : 500,
      body: { status: 'failed', eventId: parsed.eventId, error: message },
    };
  }
}
