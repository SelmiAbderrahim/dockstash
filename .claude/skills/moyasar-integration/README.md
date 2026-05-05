# Moyasar Integration Skill

This skill provides comprehensive guidance for integrating Moyasar payment gateway into applications targeting Saudi Arabia and the Middle East.

## Overview

Moyasar is a payment gateway service supporting:
- **Card Networks**: Visa, Mastercard, Mada (Saudi debit), American Express
- **Digital Wallets**: Apple Pay, STC Pay, Samsung Pay
- **SDKs**: iOS, Android, Flutter, React Native, Web

## Skill Contents

### Core Files

| File | Description |
|------|-------------|
| `SKILL.md` | Main skill definition and quick start guide |

### Reference Documentation

| File | Description |
|------|-------------|
| `references/overview.md` | API keys, environments, currency handling |
| `references/payments-api.md` | Create, retrieve, refund payments |
| `references/web-integration.md` | Moyasar.js payment forms |
| `references/test-cards.md` | Sandbox test cards and OTPs |
| `references/best-practices.md` | Security and implementation patterns |

## Related Resources

### Local Documentation

Complete documentation is available at:
- `/docs/reference/moyasar/` - Full API and SDK documentation

### Agent

Expert agent available at:
- `.claude/agents/integrations/moyasar-payment-expert.md`

## When to Use

This skill should be used when:
- Setting up payment processing for Saudi Arabian market
- Integrating Mada card payments
- Implementing Apple Pay for iOS
- Adding STC Pay or Samsung Pay
- Building web payment forms
- Implementing mobile payment SDKs
- Setting up webhooks
- Testing with sandbox environment

## Quick Start

1. Get API keys from Moyasar Dashboard
2. Add to environment variables
3. Choose integration method (Web, iOS, Android, etc.)
4. Implement payment UI
5. Add backend verification
6. Set up webhooks
7. Test with sandbox cards
8. Go live

## Key Security Rules

1. **Never expose secret key** in frontend code
2. **Always verify payments** on backend before fulfilling
3. **Use HTTPS** for all endpoints
4. **Implement webhooks** for reliability
5. **Use idempotency keys** to prevent duplicates
