import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { loadStripeScript, getStripe } from './stripeGlobal';

beforeEach(() => {
  document.getElementById('stripe-import')?.remove();
  delete (window as { Stripe?: unknown }).Stripe;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadStripeScript', () => {
  it('appends the Stripe v2 script tag once', () => {
    loadStripeScript();
    const el = document.getElementById('stripe-import') as HTMLScriptElement | null;
    expect(el).not.toBeNull();
    expect(el?.src).toBe('https://js.stripe.com/v2/');
    expect(el?.async).toBe(true);
  });

  it('is idempotent — a second call does not add another script', () => {
    loadStripeScript();
    loadStripeScript();
    expect(document.querySelectorAll('#stripe-import')).toHaveLength(1);
  });

  it('no-ops when document is undefined (SSR guard)', () => {
    vi.stubGlobal('document', undefined);
    expect(() => loadStripeScript()).not.toThrow();
  });
});

describe('getStripe', () => {
  it('returns window.Stripe when present', () => {
    const fake = {
      setPublishableKey: vi.fn(),
      card: { createToken: vi.fn() },
    };
    (window as { Stripe?: unknown }).Stripe = fake;
    expect(getStripe()).toBe(fake);
  });

  it('returns undefined when window is undefined (SSR guard)', () => {
    vi.stubGlobal('window', undefined);
    expect(getStripe()).toBeUndefined();
  });
});
