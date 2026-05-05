# Payment Provider API Documentation

## Stripe API Reference

### Authentication

```bash
Authorization: Bearer sk_test_xxx
```

### Common Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/checkout/sessions` | POST | Create checkout session |
| `/v1/subscriptions` | POST | Create subscription |
| `/v1/subscriptions/{id}` | GET | Retrieve subscription |
| `/v1/subscriptions/{id}` | POST | Update subscription |
| `/v1/subscriptions/{id}` | DELETE | Cancel subscription |
| `/v1/customers` | POST | Create customer |
| `/v1/billing_portal/sessions` | POST | Create portal session |
| `/v1/refunds` | POST | Create refund |

### Webhook Events

| Event | Trigger |
|-------|---------|
| `checkout.session.completed` | Checkout completed successfully |
| `customer.subscription.created` | New subscription created |
| `customer.subscription.updated` | Subscription modified |
| `customer.subscription.deleted` | Subscription canceled |
| `invoice.paid` | Invoice payment succeeded |
| `invoice.payment_failed` | Invoice payment failed |

### Subscription Statuses

| Status | Description |
|--------|-------------|
| `active` | Currently active subscription |
| `trialing` | In trial period |
| `past_due` | Payment failed, grace period |
| `canceled` | Explicitly canceled |
| `unpaid` | Payment failed, no grace |
| `paused` | Temporarily paused |

### Test Cards

| Number | Description |
|--------|-------------|
| `4242424242424242` | Successful payment |
| `4000000000000002` | Card declined |
| `4000000000003220` | Requires 3DS |
| `4000000000009995` | Insufficient funds |
| `4000000000000127` | Incorrect CVC |

---

## Moyasar API Reference

### Authentication

```bash
Authorization: Basic base64(sk_test_xxx:)
```

### Common Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/payments` | POST | Create payment |
| `/v1/payments/{id}` | GET | Retrieve payment |
| `/v1/payments/{id}/refund` | POST | Refund payment |
| `/v1/payments/{id}/capture` | POST | Capture authorized payment |
| `/v1/payments/{id}/void` | POST | Void payment |
| `/v1/invoices` | POST | Create invoice |

### Payment Statuses

| Status | Description |
|--------|-------------|
| `initiated` | Payment started, awaiting completion |
| `authorized` | Card authorized, awaiting capture |
| `paid` | Payment completed successfully |
| `failed` | Payment failed |
| `refunded` | Payment refunded |
| `voided` | Authorization voided |
| `captured` | Authorized payment captured |

### Webhook Events

| Event | Trigger |
|-------|---------|
| `payment.paid` | Payment completed |
| `payment.failed` | Payment failed |
| `payment.refunded` | Payment refunded |
| `invoice.paid` | Invoice paid |
| `invoice.expired` | Invoice expired |

### Supported Payment Methods

| Method | Code | Description |
|--------|------|-------------|
| Credit Card | `creditcard` | Visa, Mastercard |
| Mada | `mada` | Saudi debit cards |
| Apple Pay | `applepay` | iOS/Safari |
| STC Pay | `stcpay` | Saudi mobile wallet |

### Test Cards

| Number | Type | Result |
|--------|------|--------|
| `4111111111111111` | Visa | Success |
| `5105105105105100` | Mastercard | Success |
| `4000000000000077` | Visa | Declined |
| Any card starting with `588845` | Mada | Success |

---

## LemonSqueezy API Reference

### Authentication

```bash
Authorization: Bearer xxx
```

### Common Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/checkouts` | POST | Create checkout |
| `/v1/subscriptions` | GET | List subscriptions |
| `/v1/subscriptions/{id}` | GET | Get subscription |
| `/v1/subscriptions/{id}` | PATCH | Update subscription |
| `/v1/subscriptions/{id}` | DELETE | Cancel subscription |
| `/v1/orders` | GET | List orders |
| `/v1/customers` | GET | List customers |

### Webhook Events

| Event | Trigger |
|-------|---------|
| `subscription_created` | New subscription |
| `subscription_updated` | Subscription modified |
| `subscription_cancelled` | Subscription canceled |
| `subscription_resumed` | Subscription resumed |
| `subscription_expired` | Subscription expired |
| `subscription_paused` | Subscription paused |
| `subscription_unpaused` | Subscription unpaused |
| `order_created` | New order placed |
| `order_refunded` | Order refunded |
| `license_key_created` | License key generated |

### Subscription Statuses

| Status | Description |
|--------|-------------|
| `on_trial` | In trial period |
| `active` | Active subscription |
| `paused` | Paused subscription |
| `past_due` | Payment past due |
| `unpaid` | Payment failed |
| `cancelled` | Canceled |
| `expired` | Expired |

### Checkout Options

| Option | Type | Description |
|--------|------|-------------|
| `email` | string | Pre-fill customer email |
| `name` | string | Pre-fill customer name |
| `custom_price` | number | Override price (in cents) |
| `discount_code` | string | Apply discount code |
| `redirect_url` | string | Post-checkout redirect |
| `checkout_data` | object | Custom metadata |

### VAT Handling

LemonSqueezy automatically:
- Detects customer location via IP
- Applies correct VAT rate
- Generates compliant invoices
- Handles EU VAT reporting

---

## Error Code Reference

### Stripe Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `card_declined` | 402 | Card was declined |
| `expired_card` | 402 | Card has expired |
| `incorrect_cvc` | 402 | CVC verification failed |
| `insufficient_funds` | 402 | Insufficient funds |
| `invalid_request_error` | 400 | Invalid parameters |
| `rate_limit` | 429 | Too many requests |
| `authentication_required` | 402 | 3DS required |

### Moyasar Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `invalid_request_error` | 400 | Invalid request |
| `authentication_error` | 401 | Invalid API key |
| `card_error` | 402 | Card error |
| `rate_limit_error` | 429 | Rate limited |
| `api_error` | 500 | Server error |

### LemonSqueezy Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `not_found` | 404 | Resource not found |
| `validation_error` | 422 | Validation failed |
| `rate_limited` | 429 | Too many requests |
| `server_error` | 500 | Server error |
