# Moyasar Best Practices Reference

## Security Best Practices

### 1. Never Expose Secret Keys

```typescript
// WRONG - Secret key in frontend
const config = {
  secret_api_key: 'sk_live_...',  // NEVER DO THIS
};

// CORRECT - Only publishable key in frontend
const config = {
  publishable_api_key: 'pk_live_...',
};
```

### 2. Always Verify Payments Server-Side

```typescript
// WRONG - Trust frontend status
const handleComplete = (payment) => {
  if (payment.status === 'paid') {
    fulfillOrder(); // DANGEROUS!
  }
};

// CORRECT - Verify on backend
const handleComplete = async (payment) => {
  const verified = await fetch('/api/verify', {
    method: 'POST',
    body: JSON.stringify({ paymentId: payment.id }),
  });

  if (verified.ok) {
    const result = await verified.json();
    if (result.status === 'paid') {
      fulfillOrder();
    }
  }
};
```

### 3. Verify All Critical Fields

```typescript
async function verifyPayment(
  paymentId: string,
  expectedAmount: number,
  expectedCurrency: string = 'SAR'
): Promise<boolean> {
  const payment = await getPaymentFromMoyasar(paymentId);

  // Check status
  if (payment.status !== 'paid') {
    throw new Error(`Invalid status: ${payment.status}`);
  }

  // Check amount
  if (payment.amount !== expectedAmount) {
    throw new Error(`Amount mismatch: ${payment.amount} !== ${expectedAmount}`);
  }

  // Check currency
  if (payment.currency !== expectedCurrency) {
    throw new Error(`Currency mismatch`);
  }

  return true;
}
```

### 4. Use HTTPS Everywhere

```typescript
// WRONG
const callbackUrl = 'http://yoursite.com/callback';

// CORRECT
const callbackUrl = 'https://yoursite.com/callback';
```

### 5. Store Keys Securely

```bash
# .env (root only, per project rules)
MOYASAR_SECRET_KEY=sk_live_...
MOYASAR_PUBLISHABLE_KEY=pk_live_...

# Never in:
# - Git commits
# - Frontend code
# - Logs
# - Error messages
```

## Implementation Best Practices

### 1. Use Idempotency Keys

```typescript
const createPayment = async (orderId: string, amount: number) => {
  return fetch('https://api.moyasar.com/v1/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': orderId, // Prevent duplicates
    },
    body: JSON.stringify({
      amount,
      currency: 'SAR',
      // ...
    }),
  });
};
```

### 2. Implement Webhooks for Reliability

```typescript
// Don't rely only on callback redirect
// Implement webhooks for guaranteed delivery

export async function handleWebhook(event: WebhookEvent) {
  switch (event.type) {
    case 'payment.paid':
      await markOrderPaid(event.data.metadata.order_id);
      break;
    case 'payment.failed':
      await markOrderFailed(event.data.metadata.order_id);
      break;
  }
}
```

### 3. Use Metadata for Tracking

```javascript
Moyasar.init({
  // ...
  metadata: {
    order_id: 'order_12345',
    customer_id: 'cust_67890',
    product_sku: 'SKU-001',
  },
});
```

### 4. Handle All Error Cases

```typescript
function handlePaymentError(error: any) {
  const errorMessages: Record<string, string> = {
    insufficient_funds: 'Your card has insufficient funds.',
    lost_card: 'This card has been reported lost.',
    stolen_card: 'This card has been reported stolen.',
    expired_card: 'This card has expired.',
    invalid_card: 'Invalid card details.',
    '3ds_failed': 'Card verification failed.',
    network_error: 'Network error. Please try again.',
  };

  const message = errorMessages[error.code] || 'Payment failed. Please try again.';
  showUserFriendlyError(message);
}
```

### 5. Implement Retry Logic

```typescript
async function createPaymentWithRetry(
  data: PaymentData,
  maxRetries = 3
): Promise<Payment> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await createPayment(data);
    } catch (error: any) {
      lastError = error;

      // Only retry on network errors
      if (!isRetryableError(error)) {
        throw error;
      }

      // Exponential backoff
      await sleep(Math.pow(2, i) * 1000);
    }
  }

  throw lastError;
}

function isRetryableError(error: any): boolean {
  return error.code === 'NETWORK_ERROR' ||
         error.status === 429 ||
         error.status >= 500;
}
```

## Amount Handling Best Practices

### Always Use Smallest Unit

```typescript
// WRONG - Passing decimal amount
const amount = 10.50; // Will cause issues

// CORRECT - Use smallest unit (halalas)
const amount = 1050; // 10.50 SAR in halalas
```

### Conversion Functions

```typescript
const toHalalas = (sar: number): number => Math.round(sar * 100);
const toSar = (halalas: number): number => halalas / 100;
const formatSar = (halalas: number): string =>
  `${toSar(halalas).toFixed(2)} SAR`;

// Usage
const displayAmount = formatSar(1050); // "10.50 SAR"
const apiAmount = toHalalas(10.50);    // 1050
```

### Minimum Amount

```typescript
const MIN_AMOUNT = 100; // 1.00 SAR

function validateAmount(amount: number): void {
  if (amount < MIN_AMOUNT) {
    throw new Error(`Minimum amount is ${formatSar(MIN_AMOUNT)}`);
  }
}
```

## Testing Best Practices

### 1. Test All Card Networks

```typescript
const TEST_SCENARIOS = [
  { card: '4201320111111010', network: 'mada', expected: 'success' },
  { card: '4111114005765430', network: 'visa', expected: 'success' },
  { card: '5421080101000000', network: 'mastercard', expected: 'success' },
  { card: '340000000900000', network: 'amex', expected: 'success' },
];
```

### 2. Test Failure Scenarios

```typescript
const FAILURE_SCENARIOS = [
  { card: '4201320000311101', expected: 'insufficient_funds' },
  { card: '4201320131000508', expected: 'lost_card' },
  { card: '4201321144311528', expected: 'stolen_card' },
  { card: '4201322267774310', expected: 'expired_card' },
];
```

### 3. Test STC Pay OTPs

```typescript
const STC_SCENARIOS = [
  { otp: '123456', expected: 'success' },
  { otp: '111111', expected: 'insufficient_funds' },
  { otp: '222222', expected: 'daily_limit' },
];
```

## Error Logging

```typescript
function logPaymentError(error: any, context: PaymentContext) {
  console.error('Payment Error:', {
    code: error.code,
    message: error.message,
    // Never log sensitive data
    orderId: context.orderId,
    amount: context.amount,
    // Don't log: card numbers, CVCs, etc.
  });
}
```

## Performance Best Practices

### 1. Load Script Async

```html
<script src="https://moyasar.com/js/moyasar.js" async></script>
```

### 2. Initialize After Load

```typescript
useEffect(() => {
  const script = document.createElement('script');
  script.src = 'https://moyasar.com/js/moyasar.js';
  script.async = true;
  script.onload = initMoyasar;
  document.head.appendChild(script);
}, []);
```

### 3. Cache Payment Status

```typescript
// Don't repeatedly fetch same payment
const paymentCache = new Map<string, Payment>();

async function getPaymentCached(id: string): Promise<Payment> {
  if (paymentCache.has(id)) {
    return paymentCache.get(id)!;
  }

  const payment = await getPayment(id);
  paymentCache.set(id, payment);
  return payment;
}
```
