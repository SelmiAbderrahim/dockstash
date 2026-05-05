# Moyasar Web Integration Reference

## Quick Start

### 1. Include Script

```html
<script src="https://moyasar.com/js/moyasar.js"></script>
```

### 2. Create Container

```html
<div class="mysr-form"></div>
```

### 3. Initialize

```javascript
Moyasar.init({
  element: '.mysr-form',
  amount: 1000,
  currency: 'SAR',
  description: 'Order #1234',
  publishable_api_key: 'pk_test_...',
  callback_url: 'https://yoursite.com/callback',
  methods: ['creditcard'],
  supported_networks: ['visa', 'mastercard', 'mada'],
});
```

## Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `element` | string | Yes | CSS selector |
| `amount` | number | Yes | Amount in smallest unit (min: 100) |
| `currency` | string | Yes | ISO 4217 code |
| `description` | string | No | Payment description |
| `publishable_api_key` | string | Yes | Your publishable key |
| `callback_url` | string | Yes | Redirect URL after payment |
| `methods` | array | Yes | Payment methods to show |
| `supported_networks` | array | No | Card networks to accept |
| `on_completed` | function | No | Callback after completion |
| `on_failure` | function | No | Callback on failure |
| `metadata` | object | No | Custom key-value data |
| `language` | string | No | 'en' or 'ar' |

## Payment Methods

### Credit Card

```javascript
Moyasar.init({
  // ... base config
  methods: ['creditcard'],
  supported_networks: ['visa', 'mastercard', 'mada', 'amex'],
});
```

### Apple Pay

```javascript
Moyasar.init({
  // ... base config
  methods: ['applepay'],
  apple_pay: {
    country: 'SA',
    label: 'Your Store Name',
    validate_merchant_url: '/api/validate-merchant',
  },
});
```

### STC Pay

```javascript
Moyasar.init({
  // ... base config
  methods: ['stcpay'],
});
```

### Multiple Methods

```javascript
Moyasar.init({
  // ... base config
  methods: ['creditcard', 'applepay', 'stcpay'],
});
```

## Callbacks

### on_completed

```javascript
Moyasar.init({
  // ... config
  on_completed: async function(payment) {
    console.log('Payment ID:', payment.id);
    console.log('Status:', payment.status);

    // Track before redirect
    await fetch('/api/track-payment', {
      method: 'POST',
      body: JSON.stringify({ paymentId: payment.id }),
    });
  },
});
```

**Important**: "completed" means the process finished, not necessarily successful. Always check `payment.status`.

### on_failure

```javascript
Moyasar.init({
  // ... config
  on_failure: function(error) {
    console.error('Payment failed:', error.message);
    showErrorToUser(error.message);
  },
});
```

## React Integration

```tsx
'use client';

import { useEffect, useRef, useCallback } from 'react';

interface MoyasarFormProps {
  amount: number;
  description: string;
  onSuccess: (paymentId: string) => void;
  onError: (message: string) => void;
}

export function MoyasarForm({
  amount,
  description,
  onSuccess,
  onError,
}: MoyasarFormProps) {
  const formRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const script = document.createElement('script');
    script.src = 'https://moyasar.com/js/moyasar.js';
    script.async = true;

    script.onload = () => {
      (window as any).Moyasar.init({
        element: '.moyasar-form',
        amount,
        currency: 'SAR',
        description,
        publishable_api_key: process.env.NEXT_PUBLIC_MOYASAR_KEY,
        callback_url: `${window.location.origin}/payment/callback`,
        methods: ['creditcard', 'stcpay'],
        supported_networks: ['visa', 'mastercard', 'mada'],
        on_completed: (payment: any) => {
          if (payment.status === 'paid') {
            onSuccess(payment.id);
          }
        },
        on_failure: (error: any) => {
          onError(error.message);
        },
      });
    };

    document.head.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [amount, description, onSuccess, onError]);

  return <div className="moyasar-form" ref={formRef} />;
}
```

## Callback URL Handling

After payment, user redirects to callback URL with payment ID:

```
https://yoursite.com/callback?id=79cced57-9deb-4c4b-8f48-59c124f79688
```

### Next.js Callback Page

```tsx
// app/payment/callback/page.tsx
import { redirect } from 'next/navigation';

async function verifyPayment(paymentId: string) {
  const res = await fetch(`${process.env.API_URL}/verify-payment`, {
    method: 'POST',
    body: JSON.stringify({ paymentId }),
  });
  return res.json();
}

export default async function PaymentCallback({
  searchParams,
}: {
  searchParams: { id?: string };
}) {
  const paymentId = searchParams.id;

  if (!paymentId) {
    redirect('/payment/error');
  }

  try {
    const result = await verifyPayment(paymentId);

    if (result.status === 'paid') {
      redirect('/payment/success');
    } else {
      redirect('/payment/error');
    }
  } catch (error) {
    redirect('/payment/error');
  }
}
```

## Localization

### Arabic Support

```javascript
Moyasar.init({
  // ... config
  language: 'ar',
});
```

Form automatically adjusts for RTL layout.

## Styling

### Container

```css
.mysr-form {
  max-width: 400px;
  margin: 0 auto;
  padding: 20px;
}
```

### Theme

```javascript
Moyasar.init({
  // ... config
  theme: {
    primary_color: '#1e88e5',
    secondary_color: '#ffffff',
  },
});
```

## Security Checklist

- [ ] Use HTTPS for callback_url
- [ ] Never expose secret key in frontend
- [ ] Always verify payment on backend
- [ ] Validate amount and currency
- [ ] Implement webhook for reliability
- [ ] Handle all error scenarios
