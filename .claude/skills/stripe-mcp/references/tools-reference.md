# Stripe MCP Tools Reference

Complete parameter documentation for all tools exposed by the Stripe MCP server.

## Account & Balance

### get_stripe_account_info

Get details about the connected Stripe account.

**Parameters**: None

**Returns**: Account name, ID, capabilities, settings, country, default currency.

---

### retrieve_balance

Get the current account balance.

**Parameters**: None

**Returns**: Available and pending balance per currency. Amounts in minor units.

---

## Products & Prices

### list_products

List products in the account.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer | No | Number of products (1-100, default 10) |

**Returns**: Array of product objects with id, name, description, active status.

---

### create_product

Create a new product.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Product name |
| `description` | string | No | Product description |

**Returns**: Created product object with `prod_` prefixed ID.

**Notes**: Check `list_products` first to avoid duplicates.

---

### list_prices

List prices, optionally filtered by product.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `product` | string | No | Product ID to filter by (`prod_xxx`) |
| `limit` | integer | No | Number of prices (1-100, default 10) |

**Returns**: Array of price objects. `unit_amount` is in minor units.

---

### create_price

Create a new price for a product.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `product` | string | Yes | Product ID (`prod_xxx`) |
| `unit_amount` | number | Yes | Amount in minor units (e.g., 2999 = $29.99) |
| `currency` | string | Yes | Three-letter ISO currency code (e.g., `usd`) |
| `recurring` | object | No | For subscriptions: `{ interval, interval_count? }` |
| `recurring.interval` | string | Yes* | `day`, `week`, `month`, or `year` |
| `recurring.interval_count` | integer | No | Billing frequency (e.g., 3 = every 3 months) |

**Returns**: Created price object with `price_` prefixed ID.

**Notes**:
- Product must exist before creating a price
- One-time prices: omit `recurring`
- Subscription prices: include `recurring` with at least `interval`
- Maximum interval: 3 years (3 years, 36 months, 156 weeks)

---

## Customers

### list_customers

List customers with optional email filter.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer | No | Number of customers (1-100) |
| `email` | string | No | Case-sensitive email filter |

**Returns**: Array of customer objects with id, name, email, metadata.

---

### create_customer

Create a new customer.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Customer name |
| `email` | string | No | Customer email |

**Returns**: Created customer object with `cus_` prefixed ID.

**Notes**: Search by email first with `list_customers` to avoid duplicates.

---

## Subscriptions

### list_subscriptions

List subscriptions with filters.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customer` | string | No | Customer ID (`cus_xxx`) |
| `price` | string | No | Price ID (`price_xxx`) |
| `status` | string | No | One of: `active`, `all`, `canceled`, `incomplete`, `incomplete_expired`, `past_due`, `trialing`, `unpaid` |
| `limit` | integer | No | Number of results (1-100) |

**Returns**: Array of subscription objects with items, status, current period dates.

---

### cancel_subscription

Cancel a subscription.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `subscription` | string | Yes | Subscription ID (`sub_xxx`) |

**Returns**: Cancelled subscription object.

**Notes**: Cancels immediately by default. To cancel at period end, use `update_subscription` with `cancel_at_period_end` instead.

---

### update_subscription

Update a subscription's items or proration behavior.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `subscription` | string | Yes | Subscription ID (`sub_xxx`) |
| `items` | array | No | Subscription items to update/add/remove |
| `items[].id` | string | No | Existing subscription item ID (`si_xxx`) |
| `items[].price` | string | No | New price ID to switch to |
| `items[].quantity` | number | No | New quantity |
| `items[].deleted` | boolean | No | Set true to remove item |
| `proration_behavior` | string | No | `create_prorations`, `none`, `always_invoice`, `none_implicit` |

**Returns**: Updated subscription object.

**Notes**: To change a plan, set the old item as `deleted: true` and add a new item with the new price.

---

## Invoices

### list_invoices

List invoices with optional customer filter.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customer` | string | No | Customer ID (`cus_xxx`) |
| `limit` | integer | No | Number of invoices (1-100, default 10) |

**Returns**: Array of invoice objects with status, amounts, line items.

---

### create_invoice

Create a draft invoice.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customer` | string | Yes | Customer ID (`cus_xxx`) |
| `days_until_due` | number | No | Payment due in N days |

**Returns**: Draft invoice object with `in_` prefixed ID.

**Notes**: Invoice starts as `draft`. Add items with `create_invoice_item`, then `finalize_invoice`.

---

### create_invoice_item

Add a line item to a draft invoice.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customer` | string | Yes | Customer ID (`cus_xxx`) |
| `price` | string | Yes | Price ID (`price_xxx`) |
| `invoice` | string | Yes | Invoice ID (`in_xxx`) |

**Returns**: Created invoice item object.

**Notes**: Invoice must be in `draft` status. Price must already exist.

---

### finalize_invoice

Finalize a draft invoice and send to customer.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `invoice` | string | Yes | Invoice ID (`in_xxx`) |

**Returns**: Finalized invoice object.

**Notes**: **IRREVERSIBLE** - Once finalized, the invoice cannot be edited. Verify all items are correct before finalizing.

---

## Payments & Refunds

### list_payment_intents

List payment intents with optional customer filter.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customer` | string | No | Customer ID (`cus_xxx`) |
| `limit` | integer | No | Number of results (1-100) |

**Returns**: Array of payment intent objects. `amount` in minor units.

---

### create_refund

Refund a payment intent (full or partial).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `payment_intent` | string | Yes | Payment Intent ID (`pi_xxx`) |
| `amount` | integer | No | Partial refund amount in minor units (omit for full refund) |
| `reason` | string | No | `duplicate`, `fraudulent`, or `requested_by_customer` |

**Returns**: Refund object with `re_` prefixed ID.

**Notes**: Verify the payment intent status is `succeeded` before refunding. Refund amount must not exceed charge minus previous refunds.

---

### list_refunds

List refunds for a specific charge or payment intent.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `charge_or_payment_intent` | string | Yes | Charge ID (`ch_xxx`) or Payment Intent ID (`pi_xxx`) |

**Returns**: Array of refund objects. Amounts in minor units.

---

## Payment Links & Coupons

### create_payment_link

Create a shareable payment link.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `price` | string | Yes | Price ID (`price_xxx`) |
| `quantity` | number | Yes | Product quantity |

**Returns**: Payment link object with shareable URL.

---

### list_coupons

List existing coupons.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer | No | Number of coupons (1-100) |

**Returns**: Array of coupon objects with discount info.

---

### create_coupon

Create a discount coupon.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Coupon display name |
| `percent_off` | number | No | Percentage discount (0-100). Use this OR `amount_off`. |
| `amount_off` | number | No | Fixed discount in minor units. Use this OR `percent_off`. |
| `currency` | string | No | Required if `amount_off` is used (e.g., `usd`) |
| `duration` | string | No | `once` (default), `repeating`, or `forever` |
| `duration_in_months` | number | No | Required if duration is `repeating` |

**Returns**: Created coupon object.

**Notes**: Use exactly one of `percent_off` or `amount_off`, not both.

---

## Disputes

### list_disputes

List disputes with optional filters.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `charge` | string | No | Charge ID (`ch_xxx`) |
| `payment_intent` | string | No | Payment Intent ID (`pi_xxx`) |
| `limit` | integer | No | Number of results (1-100, default 10) |

**Returns**: Array of dispute objects with status, reason, amount.

---

### update_dispute

Submit evidence for a dispute.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `dispute` | string | Yes | Dispute ID (`dp_xxx`) |
| `evidence` | object | No | Evidence fields |
| `evidence.cancellation_policy_disclosure` | string | No | How cancellation policy was shown |
| `evidence.cancellation_rebuttal` | string | No | Rebuttal to cancellation claim |
| `evidence.duplicate_charge_explanation` | string | No | Explanation for duplicate charge claim |
| `evidence.uncategorized_text` | string | No | Any additional evidence |
| `submit` | boolean | No | `true` to submit immediately; `false` to stage |

**Returns**: Updated dispute object.

**Notes**: Contact the customer first. Submit `true` sends evidence to the bank (one chance). Use `false` to stage evidence first.

---

## Search & Utilities

### search_stripe_resources

Search across resource types using Stripe's query syntax.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Format: `resource:query_clause` |

**Searchable resources**: `customers`, `payment_intents`, `charges`, `invoices`, `prices`, `products`, `subscriptions`

**Query syntax**:

| Operator | Syntax | Example |
|----------|--------|---------|
| Exact | `field:value` | `email:"user@example.com"` |
| Substring | `field~value` | `email~"example.com"` |
| AND | `clause AND clause` | `status:"active" AND amount>500` |
| OR | `clause OR clause` | `currency:"usd" OR currency:"eur"` |
| NOT | `-field:value` | `-status:"canceled"` |
| NULL | `field:null` | `description:null` |
| Compare | `> < >= <=` | `amount>=10000` |
| Metadata | `metadata['key']:'value'` | `metadata['env']:'production'` |

**Examples**:

```
customers:email:"john@example.com"
customers:email~"example.com"
payment_intents:amount>10000 AND currency:"usd"
invoices:status:"open" AND customer:"cus_xxx"
products:name~"Pro"
subscriptions:status:"active"
charges:metadata['order_id']:'12345'
```

**Returns**: Up to 100 matching resources.

---

### fetch_stripe_resources

Fetch a single Stripe object by ID.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Object ID with prefix (`cus_xxx`, `pi_xxx`, `sub_xxx`, etc.) |

**Supported prefixes**: `cus_`, `prod_`, `price_`, `sub_`, `in_`, `pi_`, `ch_`

**Returns**: Full object with all fields.

**Notes**: Only use after you have an ID from a search or list operation.

---

### search_stripe_documentation

Search the Stripe documentation.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `question` | string | Yes | Question to search for |
| `language` | string | No | `node`, `python`, `ruby`, `php`, `go`, `java`, `dotnet`, `curl` |
| `search_only_api_ref` | boolean | No | `true` for API ref only; `false` (default) for full docs |

**Returns**: Relevant documentation excerpts with code examples.

---

### stripe_integration_recommender

Interactive integration planning tool.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `answer` | string | Yes | Business summary (new) or response to question (continuing) |
| `plan_id` | string | No | Plan ID from previous response (for continuation) |
| `notes` | string | No | Technical context from codebase |

**Returns**: Either a `question` (continue Q&A) or `summary` (final recommendation).

---

### send_stripe_mcp_feedback

Submit feedback about the MCP tools.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sentiment` | string | Yes | `positive`, `negative`, or `neutral` |
| `quote` | string | Yes | Exact feedback message (max 1000 chars) |
| `context` | string | Yes | User persona and task context |
| `source` | string | Yes | `user` or `agent` |
| `tool_name` | string | No | Specific tool the feedback is about |

**Returns**: Confirmation of feedback submission.
