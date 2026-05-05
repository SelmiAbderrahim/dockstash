# Payments API Reference

## Payment Object

```typescript
interface Payment {
  id: string;
  status: PaymentStatus;
  amount: number;
  fee: number;
  currency: string;
  refunded: number;
  captured: number;
  description: string;
  callback_url: string;
  created_at: string;
  updated_at: string;
  metadata: Record<string, string>;
  source: PaymentSource;
}

type PaymentStatus =
  | 'initiated'
  | 'paid'
  | 'failed'
  | 'authorized'
  | 'captured'
  | 'refunded'
  | 'voided';

interface PaymentSource {
  type: 'creditcard' | 'applepay' | 'stcpay' | 'token';
  company?: string;
  name?: string;
  number?: string;
  message?: string;
}
```

## Create Payment

```http
POST https://api.moyasar.com/v1/payments
```

### Request Body

```json
{
  "amount": 1000,
  "currency": "SAR",
  "description": "Order #1234",
  "callback_url": "https://yoursite.com/callback",
  "source": {
    "type": "creditcard",
    "name": "John Doe",
    "number": "4111111111111111",
    "cvc": "123",
    "month": "12",
    "year": "2027"
  },
  "metadata": {
    "order_id": "order_1234"
  }
}
```

### TypeScript Implementation

```typescript
interface CreatePaymentInput {
  amount: number;
  currency: string;
  description?: string;
  callbackUrl: string;
  source: PaymentSource;
  metadata?: Record<string, string>;
}

async function createPayment(input: CreatePaymentInput): Promise<Payment> {
  const secretKey = process.env.MOYASAR_SECRET_KEY!;

  const response = await fetch('https://api.moyasar.com/v1/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: input.amount,
      currency: input.currency,
      description: input.description,
      callback_url: input.callbackUrl,
      source: input.source,
      metadata: input.metadata,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
}
```

## Retrieve Payment

```http
GET https://api.moyasar.com/v1/payments/{payment_id}
```

```typescript
async function getPayment(paymentId: string): Promise<Payment> {
  const secretKey = process.env.MOYASAR_SECRET_KEY!;

  const response = await fetch(
    `https://api.moyasar.com/v1/payments/${paymentId}`,
    {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Payment not found');
  }

  return response.json();
}
```

## List Payments

```http
GET https://api.moyasar.com/v1/payments?page=1&per_page=25
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | integer | 1 | Page number |
| per_page | integer | 25 | Items per page (max 100) |
| status | string | - | Filter by status |
| created[gte] | string | - | Created after (ISO 8601) |
| created[lte] | string | - | Created before (ISO 8601) |

## Refund Payment

```http
POST https://api.moyasar.com/v1/payments/{payment_id}/refund
```

### Full Refund

```typescript
async function refundPayment(paymentId: string): Promise<Payment> {
  const secretKey = process.env.MOYASAR_SECRET_KEY!;

  const response = await fetch(
    `https://api.moyasar.com/v1/payments/${paymentId}/refund`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
      },
    }
  );

  return response.json();
}
```

### Partial Refund

```typescript
async function partialRefund(paymentId: string, amount: number): Promise<Payment> {
  const secretKey = process.env.MOYASAR_SECRET_KEY!;

  const response = await fetch(
    `https://api.moyasar.com/v1/payments/${paymentId}/refund`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount }),
    }
  );

  return response.json();
}
```

## Capture Payment

For authorized payments (manual capture mode):

```http
POST https://api.moyasar.com/v1/payments/{payment_id}/capture
```

## Void Payment

Cancel authorized payment before capture:

```http
POST https://api.moyasar.com/v1/payments/{payment_id}/void
```

## Payment Status Flow

```
initiated → paid → refunded
          → failed
          → authorized → captured
                      → voided
```

## Idempotency

Prevent duplicate payments:

```typescript
const response = await fetch('https://api.moyasar.com/v1/payments', {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json',
    'X-Idempotency-Key': orderId, // Unique per order
  },
  body: JSON.stringify(paymentData),
});
```

## Payment Verification Pattern

**Critical**: Always verify before fulfilling orders:

```typescript
async function verifyAndFulfill(
  paymentId: string,
  expectedAmount: number,
  expectedCurrency: string = 'SAR'
): Promise<void> {
  const payment = await getPayment(paymentId);

  // Verify status
  if (payment.status !== 'paid') {
    throw new Error(`Invalid payment status: ${payment.status}`);
  }

  // Verify amount
  if (payment.amount !== expectedAmount) {
    throw new Error(`Amount mismatch: ${payment.amount} !== ${expectedAmount}`);
  }

  // Verify currency
  if (payment.currency !== expectedCurrency) {
    throw new Error(`Currency mismatch: ${payment.currency} !== ${expectedCurrency}`);
  }

  // Safe to fulfill
  await fulfillOrder(payment.metadata.order_id);
}
```
