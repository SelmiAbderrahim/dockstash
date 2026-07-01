import type { RequestHandler } from 'express';
import { getPaymentProvider } from '../active-provider.js';
import { ingestWebhook } from './ingest.js';

// Public webhook handler mounted at POST /api/billing/webhook.
// Requires the raw body Buffer — the route is registered with
// `express.raw({ type: '*/*' })` BEFORE the global JSON parser in app.ts.
export const webhookHandler: RequestHandler = async (req, res) => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
  const provider = getPaymentProvider();
  const result = await ingestWebhook({
    provider,
    rawBody,
    headers: req.headers as Record<string, string | string[] | undefined>,
  });
  res.status(result.statusCode).json(result.body);
};
