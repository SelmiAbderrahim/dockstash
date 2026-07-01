import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { env } from '../../../config/env.js';
import { PolarProvider, __getRawCustomerMapper } from './polar.js';
import { WebhookVerifyError } from '../payment-provider.js';

const NOW = 1_700_000_000;
const SECRET = 'test-webhook-secret';

function provider() {
  return new PolarProvider({ nowSeconds: () => NOW, getWebhookSecret: () => SECRET });
}

function parse(body: unknown, headers: Record<string, string | string[]> = {}) {
  return provider().parseEvent(Buffer.from(JSON.stringify(body)), {
    'webhook-id': 'wh_1',
    'webhook-timestamp': String(NOW),
    ...headers,
  });
}

describe('polar / parseEvent subscription actions + mapping', () => {
  it('maps subscription.created / updated', () => {
    for (const action of ['created', 'updated'] as const) {
      const evt = parse({
        type: `subscription.${action}`,
        data: { id: 's', status: 'active', product_id: 'p', customer_id: 'c' },
      });
      expect(evt.payload.kind).toBe('subscription');
      if (evt.payload.kind === 'subscription') expect(evt.payload.action).toBe(action);
    }
  });

  it('subscription with an unhandled action is unknown', () => {
    const evt = parse({ type: 'subscription.paused', data: { id: 's' } });
    expect(evt.payload.kind).toBe('unknown');
  });

  it('missing status → incomplete; unknown status → incomplete', () => {
    const noStatus = parse({ type: 'subscription.updated', data: { id: 's', product_id: 'p', customer_id: 'c' } });
    if (noStatus.payload.kind === 'subscription') expect(noStatus.payload.subscription.status).toBe('incomplete');
    const weird = parse({
      type: 'subscription.updated',
      data: { id: 's', status: 'weird', product_id: 'p', customer_id: 'c' },
    });
    if (weird.payload.kind === 'subscription') expect(weird.payload.subscription.status).toBe('incomplete');
  });

  it('resolves externalCustomerId from nested customer.external_id when top-level is absent', () => {
    const evt = parse({
      type: 'subscription.updated',
      data: {
        id: 's',
        status: 'active',
        product_id: 'p',
        customer_id: 'c',
        customer: { external_id: 'user_nested', email: 'n@x.y' },
      },
    });
    if (evt.payload.kind === 'subscription') {
      expect(evt.payload.subscription.externalCustomerId).toBe('user_nested');
      expect(evt.payload.customer?.email).toBe('n@x.y');
    }
  });

  it('omits the customer when the sub payload has no email', () => {
    const evt = parse({
      type: 'subscription.updated',
      data: { id: 's', status: 'active', product_id: 'p', customer_id: 'c', customer: { external_id: 'x' } },
    });
    if (evt.payload.kind === 'subscription') expect(evt.payload.customer).toBeUndefined();
  });

  it('defaults data to {} when the envelope omits it', () => {
    const evt = parse({ type: 'subscription.active' });
    expect(evt.payload.kind).toBe('subscription');
  });
});

describe('polar / parseEvent order actions + mapping', () => {
  it('maps order.created / paid / refunded and normalises amount fallbacks', () => {
    const created = parse({ type: 'order.created', data: { id: 'o', customer_id: 'c', amount: 500 } });
    if (created.payload.kind === 'order') {
      expect(created.payload.action).toBe('created');
      expect(created.payload.order.amount).toBe(500); // amount fallback
      expect(created.payload.order.status).toBe('paid');
      expect(created.payload.order.currency).toBe('usd'); // currency default
    }
    const noAmount = parse({ type: 'order.paid', data: { id: 'o2', customer_id: 'c' } });
    if (noAmount.payload.kind === 'order') expect(noAmount.payload.order.amount).toBe(0);
    // top-level external_customer_id takes precedence over the nested value.
    const withExternal = parse({
      type: 'order.created',
      data: { id: 'o4', customer_id: 'c', external_customer_id: 'ext_top', customer: { external_id: 'ext_nested' } },
    });
    if (withExternal.payload.kind === 'order') {
      expect(withExternal.payload.order.externalCustomerId).toBe('ext_top');
    }
    // no top-level id → falls back to the nested customer.external_id.
    const nestedOnly = parse({
      type: 'order.created',
      data: { id: 'o5', customer_id: 'c', customer: { external_id: 'ext_nested' } },
    });
    if (nestedOnly.payload.kind === 'order') {
      expect(nestedOnly.payload.order.externalCustomerId).toBe('ext_nested');
    }
    const refunded = parse({
      type: 'order.refunded',
      data: { id: 'o3', customer_id: 'c', total_amount: 999, currency: 'EUR', status: 'refunded' },
    });
    if (refunded.payload.kind === 'order') {
      expect(refunded.payload.order.amount).toBe(999);
      expect(refunded.payload.order.status).toBe('refunded');
      expect(refunded.payload.order.currency).toBe('eur');
    }
  });

  it('order with an unhandled action is unknown', () => {
    expect(parse({ type: 'order.disputed', data: { id: 'o' } }).payload.kind).toBe('unknown');
  });
});

describe('polar / verifyWebhook header + signature edge cases', () => {
  function sign(body: string, id: string, ts: number, secret = SECRET) {
    const digest = createHmac('sha256', Buffer.from(secret, 'utf8'))
      .update(`${id}.${ts}.${body}`, 'utf8')
      .digest('base64');
    return `v1,${digest}`;
  }

  it('reads header values supplied as arrays', () => {
    const body = JSON.stringify({ type: 'subscription.active', data: {} });
    const headers = {
      'webhook-id': ['wh_arr'],
      'webhook-timestamp': [String(NOW)],
      'webhook-signature': [sign(body, 'wh_arr', NOW)],
    };
    expect(() => provider().verifyWebhook(Buffer.from(body), headers)).not.toThrow();
  });

  it('skips non-v1 signature parts and parts without a value, then accepts a valid v1', () => {
    const body = JSON.stringify({ type: 'subscription.active', data: {} });
    const valid = sign(body, 'wh_1', NOW).slice('v1,'.length);
    const headers = {
      'webhook-id': 'wh_1',
      'webhook-timestamp': String(NOW),
      'webhook-signature': `v2,other noscheme v1,${valid}`,
    };
    expect(() => provider().verifyWebhook(Buffer.from(body), headers)).not.toThrow();
  });

  it('rejects a base64 value that passes the charset test but does not round-trip', () => {
    const body = JSON.stringify({ type: 'subscription.active', data: {} });
    const headers = {
      'webhook-id': 'wh_1',
      'webhook-timestamp': String(NOW),
      'webhook-signature': 'v1,QQ',
    };
    expect(() => provider().verifyWebhook(Buffer.from(body), headers)).toThrow(WebhookVerifyError);
  });
});

describe('polar / default option factories', () => {
  afterEach(() => {
    (env as unknown as Record<string, string | undefined>).POLAR_WEBHOOK_SECRET = undefined;
  });

  it('a provider with no options uses the env secret + real clock defaults', () => {
    (env as unknown as Record<string, string | undefined>).POLAR_WEBHOOK_SECRET = SECRET;
    const nowTs = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({ type: 'subscription.active', data: {} });
    const sig = createHmac('sha256', Buffer.from(SECRET, 'utf8'))
      .update(`wh_now.${nowTs}.${body}`, 'utf8')
      .digest('base64');
    const bare = new PolarProvider();
    expect(() =>
      bare.verifyWebhook(Buffer.from(body), {
        'webhook-id': 'wh_now',
        'webhook-timestamp': String(nowTs),
        'webhook-signature': `v1,${sig}`,
      }),
    ).not.toThrow();
  });

  it('the default webhook-secret factory returns null when the env is unset (→ 500)', () => {
    (env as unknown as Record<string, string | undefined>).POLAR_WEBHOOK_SECRET = undefined;
    const bare = new PolarProvider();
    expect(() => bare.verifyWebhook(Buffer.from('{}'), {})).toThrow(WebhookVerifyError);
  });
});

describe('polar / __getRawCustomerMapper', () => {
  it('maps id/email/external_id', () => {
    expect(__getRawCustomerMapper({ id: 'c1', email: 'a@b.c', external_id: 'u1' })).toEqual({
      providerCustomerId: 'c1',
      email: 'a@b.c',
      externalId: 'u1',
    });
    expect(__getRawCustomerMapper({ id: 'c2', email: 'x@y.z' }).externalId).toBeUndefined();
  });
});
