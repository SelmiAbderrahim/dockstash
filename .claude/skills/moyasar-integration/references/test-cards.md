# Moyasar Test Cards Reference

## General Requirements

All test cards require:
- **Name**: At least two words (e.g., "Test User")
- **Month**: Any future month (01-12)
- **Year**: Any future year (e.g., 2027)
- **CVC**: Three digits (four for Amex)

> **Important**: Using any card not listed here will result in a failed payment.

## Mada Cards (Saudi Debit)

### Success

| Card Number | Response Code | Result |
|-------------|---------------|--------|
| `4201320111111010` | 00 | Approved |

### Failure Scenarios

| Card Number | Scenario |
|-------------|----------|
| `4201320000013020` | Unspecified failure |
| `4201320000311101` | Insufficient funds |
| `4201320131000508` | Lost card |
| `4201321144311528` | Stolen card |
| `4201322267774310` | Expired card |

## Visa Cards

### Success

| Card Number | Result | 3DS Behavior |
|-------------|--------|--------------|
| `4111114005765430` | Approved | Frictionless 3DS |
| `4111111111111111` | Approved | Standard |

### 3DS Test Scenarios

| Card Number | Result | Scenario |
|-------------|--------|----------|
| `4111118250252531` | Approved | 3DS attempted but unavailable |
| `4111113343111067` | Failed | 3DS enrollment check failure |
| `4111115784228433` | Failed | Authentication rejected by issuer |

### Decline Scenarios

| Card Number | Scenario |
|-------------|----------|
| `4111110000000211` | Unspecified failure |
| `4111110000000112` | Insufficient funds |
| `4111110000000310` | Lost card |
| `4111110000000419` | Stolen card |
| `4111110000000518` | Expired card |
| `4111110000000617` | Withdrawal limit exceeded |

## Mastercard

### Success

| Card Number | Response Code | Result |
|-------------|---------------|--------|
| `5421080101000000` | 00 | Approved |

### Decline Scenarios

| Card Number | Scenario |
|-------------|----------|
| `5421080000000012` | Unspecified failure |
| `5421080000000111` | Insufficient funds |
| `5421080000000210` | Lost card |
| `5421080000000319` | Stolen card |
| `5421080000000418` | Expired card |

## American Express

**Note**: Amex requires **4-digit CVC**.

### Success

| Card Number | Response Code | Result |
|-------------|---------------|--------|
| `340000000900000` | 00 | Approved |

### Decline Scenarios

| Card Number | Scenario |
|-------------|----------|
| `340000000000017` | Unspecified failure |
| `340000000000116` | Insufficient funds |
| `340000000000215` | Lost card |
| `340000000000314` | Stolen card |
| `340000000000413` | Expired card |

## STC Pay Test OTPs

Use any valid Saudi mobile format (e.g., `966500000000`):

| OTP Code | Result |
|----------|--------|
| `123456` | Success |
| `000000` | Success |
| `111111` | Insufficient funds |
| `222222` | Daily limit exceeded |
| `333333` | Transaction limit exceeded |
| `444444` | Timeout |
| Any other | Invalid OTP |

## Apple Pay Testing

### Requirements

- **Physical iOS device required** (simulators NOT supported)
- API key must start with `pk_test_`
- Add actual card to device Wallet
- No real charges in test environment

### Why Simulators Don't Work

1. Secure Element - Hardware component required
2. Card Provisioning - Cannot add cards
3. Biometric Auth - Not available
4. Secure Enclave - Missing
5. NFC - Hardware only

## Test Scenario Checklist

Use these test cases before going live:

### Success Scenarios
- [ ] Mada card success (`4201320111111010`)
- [ ] Visa frictionless 3DS (`4111114005765430`)
- [ ] Mastercard success (`5421080101000000`)
- [ ] Amex success (`340000000900000`)
- [ ] STC Pay success (OTP: `123456`)

### Failure Scenarios
- [ ] Insufficient funds (multiple networks)
- [ ] Lost/Stolen card handling
- [ ] Expired card rejection
- [ ] 3DS authentication failure
- [ ] Invalid OTP handling

### Edge Cases
- [ ] Minimum amount (100 = 1.00 SAR)
- [ ] Large amount handling
- [ ] Refund flow
- [ ] Idempotency with same request
- [ ] Webhook delivery

## Code Example

```typescript
// Test utilities
const TEST_CARDS = {
  mada: {
    success: '4201320111111010',
    insufficientFunds: '4201320000311101',
  },
  visa: {
    success: '4111114005765430',
    insufficientFunds: '4111110000000112',
  },
  mastercard: {
    success: '5421080101000000',
    insufficientFunds: '5421080000000111',
  },
  amex: {
    success: '340000000900000',
    insufficientFunds: '340000000000116',
  },
};

const STC_PAY_OTPS = {
  success: '123456',
  insufficientFunds: '111111',
  dailyLimit: '222222',
  transactionLimit: '333333',
  timeout: '444444',
};
```
