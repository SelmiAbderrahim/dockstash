interface StripeCardCreateTokenInput {
  number: string;
  cvc: string;
  exp_month: string;
  exp_year: string;
}

interface StripeCardTokenResponse {
  id: string;
  card: { last4: string };
}

interface StripeError {
  message: string;
}

interface StripeApiResponse {
  error?: StripeError;
}

type StripeCardTokenCallback = (
  status: number,
  response: StripeCardTokenResponse & StripeApiResponse,
) => void;

interface StripeGlobal {
  setPublishableKey: (key: string) => void;
  card: {
    createToken: (input: StripeCardCreateTokenInput, cb: StripeCardTokenCallback) => void;
  };
}

declare global {
  interface Window {
    Stripe?: StripeGlobal;
  }
}

export const loadStripeScript = (): void => {
  if (typeof document === 'undefined') return;
  if (document.getElementById('stripe-import')) return;
  const script = document.createElement('script');
  script.id = 'stripe-import';
  script.src = 'https://js.stripe.com/v2/';
  script.async = true;
  document.body.appendChild(script);
};

export const getStripe = (): StripeGlobal | undefined =>
  typeof window === 'undefined' ? undefined : window.Stripe;
