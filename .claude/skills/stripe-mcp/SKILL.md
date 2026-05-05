---
name: stripe-mcp
description: |
  Stripe account management via the official Stripe MCP server. Covers all 22+ MCP tools
  for products, prices, customers, subscriptions, invoices, payments, refunds, disputes,
  coupons, payment links, balance, and resource search.

  Use when: managing Stripe account, creating products/prices, looking up customers,
  handling subscriptions, generating invoices, processing refunds, responding to disputes,
  checking balance, searching resources, creating payment links or coupons.

  Keywords: stripe, mcp, products, prices, customers, subscriptions, invoices, payments,
  refunds, disputes, coupons, payment links, balance, search
license: MIT
metadata:
  version: "1.0"
  author: "ServerlessBase Team"
  category: "payment"
  project: "serverlessbase"
  mcp_server: "https://mcp.stripe.com"
---

# Stripe MCP Skill

## Overview

Manage the connected Stripe account using the official Stripe MCP server. All operations
happen through MCP tool calls - no SDK code, no direct API calls.

## MCP Server Setup

### Remote Mode (OAuth) - Recommended

Authentication is handled via browser-based OAuth. The server config in `.mcp.json`:

```json
{
  "mcpServers": {
    "stripe": {
      "url": "https://mcp.stripe.com"
    }
  }
}
```

On first use, a browser window opens for Stripe OAuth authorization. Sessions can be
managed in the Stripe Dashboard under Settings.

### Local Mode (API Key) - Alternative

For environments without browser access, use the local npx-based server:

```json
{
  "mcpServers": {
    "stripe": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/stripe-mcp-server", "--tools=all"],
      "env": {
        "STRIPE_SECRET_KEY": "${STRIPE_SECRET_KEY}"
      }
    }
  }
}
```

Requires `STRIPE_SECRET_KEY` in the environment. Use a **restricted key** with only the
permissions you need (never use the full secret key in production).

## Key Concepts

### Amount Encoding

All amounts are in **minor currency units** (smallest denomination):

| Currency | Unit | $10.00 = | $0.50 = |
|----------|------|----------|---------|
| USD | cents | 1000 | 50 |
| EUR | cents | 1000 | 50 |
| GBP | pence | 1000 | 50 |
| JPY | yen | 10 | - |
| SAR | halalas | 1000 | 50 |

### Object ID Prefixes

| Prefix | Object Type | Example |
|--------|-------------|---------|
| `cus_` | Customer | `cus_NffrFeUfNV2Hib` |
| `prod_` | Product | `prod_NZKdYqrwRYO08Q` |
| `price_` | Price | `price_1MoBy5LkdIw` |
| `sub_` | Subscription | `sub_1MowQVLkdI` |
| `si_` | Subscription Item | `si_NcLYGj6LUi` |
| `in_` | Invoice | `in_1MoBy5LkdIw` |
| `pi_` | Payment Intent | `pi_3MtwBwLkdI` |
| `ch_` | Charge | `ch_3MtwBwLkdI` |
| `re_` | Refund | `re_3MtwBwLkdI` |
| `dp_` | Dispute | `dp_1MtwBwLkdI` |

### Restricted API Keys

For local mode, create restricted keys in Stripe Dashboard > Developers > API Keys:

| Permission | Read | Write | Use Case |
|------------|------|-------|----------|
| Products | Yes | Yes | Product/price management |
| Customers | Yes | Yes | Customer management |
| Subscriptions | Yes | Yes | Subscription lifecycle |
| Invoices | Yes | Yes | Invoice generation |
| Payment Intents | Yes | No | Read-only payment data |
| Refunds | Yes | Yes | Refund processing |
| Disputes | Yes | Yes | Dispute responses |

## Safety Patterns

### 1. Read Before Write

Always fetch current state before creating or modifying resources:

```
WRONG:  create_customer("John", "john@example.com")
RIGHT:  list_customers(email="john@example.com") → not found → create_customer(...)
```

### 2. Confirm Before Execute

For irreversible operations, summarize and get user confirmation:

- **Finalizing invoices** - Cannot be un-finalized
- **Processing refunds** - Cannot be reversed
- **Cancelling subscriptions** - May lose customer
- **Submitting dispute evidence** - One chance to respond

### 3. Metadata Traceability

When creating resources, recommend adding metadata for tracking:

```
create_product("Pro Plan", "Monthly pro subscription")
→ Consider adding metadata like order_id, created_by, environment
```

## Available Tools (22)

### Account & Balance
- `get_stripe_account_info` - Account details
- `retrieve_balance` - Available and pending balance

### Products & Prices
- `list_products` / `create_product`
- `list_prices` / `create_price`

### Customers
- `list_customers` / `create_customer`

### Subscriptions
- `list_subscriptions` / `cancel_subscription` / `update_subscription`

### Invoices
- `list_invoices` / `create_invoice` / `create_invoice_item` / `finalize_invoice`

### Payments & Refunds
- `list_payment_intents`
- `create_refund` / `list_refunds`

### Payment Links & Coupons
- `create_payment_link`
- `list_coupons` / `create_coupon`

### Disputes
- `list_disputes` / `update_dispute`

### Search & Utilities
- `search_stripe_resources` - Query across resource types
- `fetch_stripe_resources` - Fetch single object by ID
- `search_stripe_documentation` - Search Stripe docs
- `stripe_integration_recommender` - Interactive integration planning
- `send_stripe_mcp_feedback` - Report MCP tool issues

## Troubleshooting

### MCP Connection Issues

**Problem**: Tools not available or connection refused

1. Verify `.mcp.json` exists in project root
2. Verify `"stripe"` is in `.claude/settings.json` `enabledMcpjsonServers`
3. For remote mode: re-authenticate via browser OAuth
4. For local mode: verify `STRIPE_SECRET_KEY` is set

### Tool Not Found

**Problem**: `mcp__stripe__*` tool not recognized

1. Restart Claude Code session (MCP servers load on startup)
2. Check MCP server logs for errors
3. Verify the tool name matches exactly (see tools-reference.md)

### OAuth Session Expired

**Problem**: Remote mode stops working after a period

1. Stripe OAuth sessions may expire
2. Re-authenticate by triggering any Stripe MCP tool
3. Manage sessions in Stripe Dashboard > Settings

### Wrong Amounts

**Problem**: Charges are 100x too large or too small

1. All amounts are in minor units (cents for USD)
2. $10.00 = 1000, not 10
3. JPY is the exception - 1000 JPY = 1000 (no subdivision)

## Agent

Use the `stripe-mcp-manager` agent for complex multi-step Stripe operations:

```
Agent: stripe-mcp-manager
When: Multi-step workflows, bulk operations, account audits
```

## Reference Files

- [Tool Reference](./references/tools-reference.md) - All 22 tools with parameters
- [Workflow Recipes](./references/workflow-recipes.md) - 10 step-by-step recipes
