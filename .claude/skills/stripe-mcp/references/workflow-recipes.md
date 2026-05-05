# Stripe MCP Workflow Recipes

Step-by-step recipes for common Stripe operations using MCP tools.

## Recipe 1: Account Health Check

**Goal**: Quick overview of account status, balance, and potential issues.

**Steps**:

1. **Get account info**
   ```
   Tool: mcp__stripe__get_stripe_account_info
   Params: (none)
   → Note: account name, country, default currency
   ```

2. **Check balance**
   ```
   Tool: mcp__stripe__retrieve_balance
   Params: (none)
   → Note: available and pending amounts per currency
   ```

3. **Count active subscriptions**
   ```
   Tool: mcp__stripe__list_subscriptions
   Params: { status: "active", limit: 1 }
   → Note: total count from response
   ```

4. **Check for open disputes**
   ```
   Tool: mcp__stripe__list_disputes
   Params: { limit: 10 }
   → Note: any disputes requiring action
   ```

5. **Check for past-due subscriptions**
   ```
   Tool: mcp__stripe__list_subscriptions
   Params: { status: "past_due", limit: 10 }
   → Note: subscriptions needing attention
   ```

---

## Recipe 2: Create Product + Price + Payment Link

**Goal**: Set up a product with pricing and generate a shareable checkout link.

**Steps**:

1. **Check for existing product**
   ```
   Tool: mcp__stripe__list_products
   Params: { limit: 100 }
   → Look for duplicate names
   ```

2. **Create the product**
   ```
   Tool: mcp__stripe__create_product
   Params: { name: "Pro Plan", description: "Monthly pro subscription with all features" }
   → Save: prod_xxx
   ```

3. **Create a monthly price**
   ```
   Tool: mcp__stripe__create_price
   Params: {
     product: "prod_xxx",
     unit_amount: 2900,
     currency: "usd",
     recurring: { interval: "month" }
   }
   → Save: price_xxx
   ```

4. **Create annual price (optional)**
   ```
   Tool: mcp__stripe__create_price
   Params: {
     product: "prod_xxx",
     unit_amount: 29000,
     currency: "usd",
     recurring: { interval: "year" }
   }
   → Save: price_annual_xxx
   ```

5. **Generate payment link**
   ```
   Tool: mcp__stripe__create_payment_link
   Params: { price: "price_xxx", quantity: 1 }
   → Returns: shareable checkout URL
   ```

---

## Recipe 3: Find Customer and View Subscriptions

**Goal**: Look up a customer by email and review their subscription history.

**Steps**:

1. **Search by email**
   ```
   Tool: mcp__stripe__list_customers
   Params: { email: "user@example.com" }
   → Save: cus_xxx
   ```

2. **Get full customer details**
   ```
   Tool: mcp__stripe__fetch_stripe_resources
   Params: { id: "cus_xxx" }
   → Note: name, email, metadata, default payment method
   ```

3. **List all subscriptions**
   ```
   Tool: mcp__stripe__list_subscriptions
   Params: { customer: "cus_xxx", status: "all" }
   → Note: active, cancelled, past_due subscriptions
   ```

4. **List recent payments**
   ```
   Tool: mcp__stripe__list_payment_intents
   Params: { customer: "cus_xxx", limit: 10 }
   → Note: payment history with amounts and status
   ```

5. **List invoices**
   ```
   Tool: mcp__stripe__list_invoices
   Params: { customer: "cus_xxx", limit: 10 }
   → Note: invoice history with amounts and status
   ```

---

## Recipe 4: Graceful Subscription Cancellation

**Goal**: Cancel at end of billing period (not immediately).

**Steps**:

1. **Verify subscription exists and is active**
   ```
   Tool: mcp__stripe__fetch_stripe_resources
   Params: { id: "sub_xxx" }
   → Verify: status is "active" or "trialing"
   → Note: current_period_end date
   ```

2. **Cancel at period end** (graceful)
   ```
   Tool: mcp__stripe__update_subscription
   Params: { subscription: "sub_xxx", cancel_at_period_end: true }
   → Customer retains access until period ends
   ```

   **OR: Cancel immediately** (if requested)
   ```
   Tool: mcp__stripe__cancel_subscription
   Params: { subscription: "sub_xxx" }
   → Access revoked immediately
   ```

3. **Confirm cancellation**
   ```
   Tool: mcp__stripe__fetch_stripe_resources
   Params: { id: "sub_xxx" }
   → Verify: cancel_at_period_end is true (graceful) or status is "canceled" (immediate)
   ```

---

## Recipe 5: Upgrade/Downgrade Subscription

**Goal**: Change a customer's subscription from one plan to another.

**Steps**:

1. **Get current subscription details**
   ```
   Tool: mcp__stripe__fetch_stripe_resources
   Params: { id: "sub_xxx" }
   → Save: current subscription item ID (si_xxx) and current price
   ```

2. **Find the target price**
   ```
   Tool: mcp__stripe__list_prices
   Params: { product: "prod_xxx" }
   → Save: target price_xxx
   ```

3. **Update subscription items**
   ```
   Tool: mcp__stripe__update_subscription
   Params: {
     subscription: "sub_xxx",
     proration_behavior: "create_prorations",
     items: [
       { id: "si_xxx", deleted: true },
       { price: "price_new_xxx" }
     ]
   }
   → Old item removed, new item added, proration calculated
   ```

4. **Verify the change**
   ```
   Tool: mcp__stripe__fetch_stripe_resources
   Params: { id: "sub_xxx" }
   → Verify: new price is in subscription items
   ```

---

## Recipe 6: Manual Invoice Creation

**Goal**: Create and send a one-off invoice to a customer.

**Steps**:

1. **Find or create customer**
   ```
   Tool: mcp__stripe__list_customers
   Params: { email: "client@company.com" }
   → If not found: create_customer first
   → Save: cus_xxx
   ```

2. **Ensure price exists**
   ```
   Tool: mcp__stripe__list_prices
   Params: { product: "prod_xxx" }
   → Save: price_xxx (or create_price if needed)
   ```

3. **Create draft invoice**
   ```
   Tool: mcp__stripe__create_invoice
   Params: { customer: "cus_xxx", days_until_due: 30 }
   → Save: in_xxx (status: draft)
   ```

4. **Add line items**
   ```
   Tool: mcp__stripe__create_invoice_item
   Params: { customer: "cus_xxx", price: "price_xxx", invoice: "in_xxx" }
   → Repeat for additional items
   ```

5. **Review before finalizing**
   ```
   Tool: mcp__stripe__fetch_stripe_resources
   Params: { id: "in_xxx" }
   → Verify: correct items, amounts, customer
   → CONFIRM WITH USER before proceeding
   ```

6. **Finalize and send**
   ```
   Tool: mcp__stripe__finalize_invoice
   Params: { invoice: "in_xxx" }
   → IRREVERSIBLE - invoice sent to customer
   ```

---

## Recipe 7: Issue a Refund

**Goal**: Refund a payment (full or partial).

**Steps**:

1. **Find the payment**
   ```
   Tool: mcp__stripe__list_payment_intents
   Params: { customer: "cus_xxx", limit: 10 }
   → Save: pi_xxx
   ```

2. **Verify payment details**
   ```
   Tool: mcp__stripe__fetch_stripe_resources
   Params: { id: "pi_xxx" }
   → Verify: status is "succeeded"
   → Note: amount, currency
   → Check: existing refunds
   ```

3. **Check existing refunds**
   ```
   Tool: mcp__stripe__list_refunds
   Params: { charge_or_payment_intent: "pi_xxx" }
   → Calculate: remaining refundable amount
   ```

4. **Process refund**
   ```
   # Full refund
   Tool: mcp__stripe__create_refund
   Params: { payment_intent: "pi_xxx", reason: "requested_by_customer" }

   # Partial refund ($10 of a $29.99 charge)
   Tool: mcp__stripe__create_refund
   Params: { payment_intent: "pi_xxx", amount: 1000, reason: "requested_by_customer" }
   ```

5. **Confirm refund**
   ```
   Tool: mcp__stripe__list_refunds
   Params: { charge_or_payment_intent: "pi_xxx" }
   → Verify: refund appears with correct amount
   ```

---

## Recipe 8: Respond to a Dispute

**Goal**: Submit evidence for an open dispute.

**Steps**:

1. **List open disputes**
   ```
   Tool: mcp__stripe__list_disputes
   Params: { limit: 10 }
   → Identify: disputes with status "needs_response"
   ```

2. **Get dispute details**
   ```
   Tool: mcp__stripe__fetch_stripe_resources
   Params: { id: "dp_xxx" }
   → Note: reason, amount, evidence_details.due_by
   ```

3. **Stage evidence (without submitting)**
   ```
   Tool: mcp__stripe__update_dispute
   Params: {
     dispute: "dp_xxx",
     evidence: {
       uncategorized_text: "Customer purchased on [date]. Service was delivered on [date]. Attached logs show successful access on [dates]."
     },
     submit: false
   }
   → Evidence staged, not yet sent to bank
   ```

4. **Review and submit**
   ```
   Tool: mcp__stripe__update_dispute
   Params: {
     dispute: "dp_xxx",
     submit: true
   }
   → Evidence submitted to bank (ONE CHANCE)
   ```

---

## Recipe 9: Search Resources by Metadata

**Goal**: Find resources using metadata or complex filters.

**Steps**:

1. **Search by customer email (substring)**
   ```
   Tool: mcp__stripe__search_stripe_resources
   Params: { query: 'customers:email~"example.com"' }
   ```

2. **Search by metadata**
   ```
   Tool: mcp__stripe__search_stripe_resources
   Params: { query: 'charges:metadata[\'order_id\']:\'ORD-12345\'' }
   ```

3. **Search by amount range**
   ```
   Tool: mcp__stripe__search_stripe_resources
   Params: { query: 'payment_intents:amount>=10000 AND currency:"usd"' }
   ```

4. **Search open invoices**
   ```
   Tool: mcp__stripe__search_stripe_resources
   Params: { query: 'invoices:status:"open"' }
   ```

5. **Search active products**
   ```
   Tool: mcp__stripe__search_stripe_resources
   Params: { query: 'products:active:"true" AND name~"Pro"' }
   ```

---

## Recipe 10: Create Discount Coupon

**Goal**: Create coupons for promotions.

**Steps**:

1. **Check existing coupons**
   ```
   Tool: mcp__stripe__list_coupons
   Params: { limit: 50 }
   → Verify no duplicate coupon exists
   ```

2. **Create percentage coupon**
   ```
   Tool: mcp__stripe__create_coupon
   Params: {
     name: "Launch 20% Off",
     percent_off: 20,
     duration: "once"
   }
   ```

3. **Create fixed-amount coupon**
   ```
   Tool: mcp__stripe__create_coupon
   Params: {
     name: "$10 Off First Month",
     amount_off: 1000,
     currency: "usd",
     duration: "once"
   }
   ```

4. **Create repeating coupon**
   ```
   Tool: mcp__stripe__create_coupon
   Params: {
     name: "50% Off for 3 Months",
     percent_off: 50,
     duration: "repeating",
     duration_in_months: 3
   }
   ```

5. **Create forever coupon**
   ```
   Tool: mcp__stripe__create_coupon
   Params: {
     name: "Partner Discount",
     percent_off: 15,
     duration: "forever"
   }
   ```
