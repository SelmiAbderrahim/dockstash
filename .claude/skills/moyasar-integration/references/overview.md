# Moyasar Overview Reference

## What is Moyasar?

Moyasar is a payment gateway service for accepting payments in Saudi Arabia and the Middle East, supporting:

- **Card Networks**: Visa, Mastercard, Mada, American Express
- **Digital Wallets**: Apple Pay, STC Pay, Samsung Pay
- **Currencies**: SAR (Saudi Riyal) primary, with international support

## API Endpoints

| Environment | Base URL |
|-------------|----------|
| Production | `https://api.moyasar.com/v1` |
| Dashboard | `https://dashboard.moyasar.com` |
| Help Center | `https://help.moyasar.com/en/` |

## Authentication

### HTTP Basic Auth

```typescript
const auth = Buffer.from(`${secretKey}:`).toString('base64');

const response = await fetch('https://api.moyasar.com/v1/payments', {
  headers: {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json',
  },
});
```

### API Key Types

| Key Type | Prefix | Scope | Usage |
|----------|--------|-------|-------|
| Publishable Test | `pk_test_` | Create payments only | Frontend testing |
| Secret Test | `sk_test_` | Full access | Backend testing |
| Publishable Live | `pk_live_` | Create payments only | Frontend production |
| Secret Live | `sk_live_` | Full access | Backend production |

## Currency & Amounts

### Smallest Currency Unit

Moyasar uses the **smallest currency unit** for all amounts:

| Display | API Amount | Description |
|---------|------------|-------------|
| 10.00 SAR | 1000 | 1000 Halalas |
| 1.00 SAR | 100 | 100 Halalas (minimum) |
| 257.58 SAR | 25758 | 25758 Halalas |

### Conversion Functions

```typescript
// SAR to Halalas
function toHalalas(sar: number): number {
  return Math.round(sar * 100);
}

// Halalas to SAR
function toSar(halalas: number): number {
  return halalas / 100;
}

// Format for display
function formatSar(halalas: number): string {
  return `${toSar(halalas).toFixed(2)} SAR`;
}
```

## Environment Configuration

### Required Environment Variables

```bash
# Root .env file only (per project rules)
MOYASAR_PUBLISHABLE_KEY=pk_test_your_key_here
MOYASAR_SECRET_KEY=sk_test_your_key_here

# Frontend accessible (Vite)
VITE_MOYASAR_PUBLISHABLE_KEY=pk_test_your_key_here

# Optional
MOYASAR_WEBHOOK_SECRET=your_webhook_secret
```

### Key Management

1. Get keys from Dashboard > Settings > API Keys
2. Store secret keys securely (never in frontend)
3. Regenerate if compromised
4. Use test keys for development

## Security Requirements

| Requirement | Implementation |
|-------------|----------------|
| HTTPS Only | All API calls must use HTTPS |
| Secret Key Protection | Never expose in frontend code |
| Cardholder Data | Never handle raw card data on server |
| Webhook Verification | Always verify webhook signatures |
| Payment Verification | Always verify on backend before fulfilling |

## Response Format

All API responses are JSON:

```json
{
  "id": "79cced57-9deb-4c4b-8f48-59c124f79688",
  "status": "paid",
  "amount": 1000,
  "currency": "SAR",
  "description": "Order #1234",
  "created_at": "2024-01-15T10:30:00Z"
}
```

## Error Format

```json
{
  "type": "invalid_request_error",
  "message": "Amount must be at least 100",
  "errors": {
    "amount": ["must be greater than or equal to 100"]
  }
}
```

## Postman Collections

Moyasar provides Postman collections for:
- Payments
- Invoices
- Payouts
- Settlements
- Sources

Download from Dashboard > Developer > API Documentation.
