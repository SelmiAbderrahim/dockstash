# Leadership Dashboard — Metrics Definitions

## Revenue Metrics

### MRR (Monthly Recurring Revenue)

- **Definition**: Total recurring revenue normalized to a monthly amount. Includes only active paid subscriptions.
- **Formula**: `SUM(active_pro_subscriptions * $29) + SUM(active_enterprise_contracts / 12)`
- **Data Source**: Stripe subscription API / `pricingTiers` table
- **Target**: $2,900/mo (100 Pro subscribers) within 12 months
- **Cadence**: Daily snapshot, weekly trend

### ARR (Annual Recurring Revenue)

- **Definition**: MRR projected over 12 months.
- **Formula**: `MRR * 12`
- **Data Source**: Derived from MRR
- **Target**: $34,800 within 12 months

### Net Revenue Retention (NRR)

- **Definition**: Revenue retained from existing customers over a period, including expansion and contraction.
- **Formula**: `(Beginning MRR + Expansion - Contraction - Churn) / Beginning MRR * 100`
- **Data Source**: Stripe subscription events
- **Target**: >100% (expansion offsets churn)

### Average Revenue Per User (ARPU)

- **Definition**: Average monthly revenue across all active users (free and paid).
- **Formula**: `MRR / total_active_users`
- **Data Source**: Stripe + user table
- **Target**: Increasing trend as conversion improves

## Growth Metrics

### WAD (Weekly Active Deployers)

- **Definition**: Unique users who triggered at least one deployment in the past 7 days.
- **Formula**: `COUNT(DISTINCT user_id WHERE deployment.created_at > NOW() - 7 days)`
- **Data Source**: `deployment` table
- **Target**: 200 WAD within 12 months
- **Why this metric**: Deployers are activated users; passive signups do not indicate product-market fit.

### Total Registered Users

- **Definition**: Cumulative user accounts created.
- **Formula**: `COUNT(*) FROM user`
- **Data Source**: `user` table
- **Target**: 1,000 within 12 months

### Weekly Signups

- **Definition**: New user registrations in the past 7 days.
- **Formula**: `COUNT(*) FROM user WHERE created_at > NOW() - 7 days`
- **Data Source**: `user` table
- **Target**: 25+/week by month 6

### Signup-to-Activation Rate

- **Definition**: Percentage of new signups who complete activation (first successful deploy) within 7 days.
- **Formula**: `(users_with_deploy_in_7d / new_signups_7d_ago) * 100`
- **Data Source**: `user` + `deployment` tables
- **Target**: >40%

### Free-to-Pro Conversion Rate

- **Definition**: Percentage of free users who upgrade to Pro within 30 days of signup.
- **Formula**: `(pro_upgrades_within_30d / signups_30d_ago) * 100`
- **Data Source**: Stripe + `user` table
- **Target**: 10% (100 Pro out of 1,000 total)

## Retention Metrics

### Monthly Churn Rate

- **Definition**: Percentage of paying customers who cancel in a given month.
- **Formula**: `(churned_pro_subscribers / beginning_pro_subscribers) * 100`
- **Data Source**: Stripe subscription cancellation events
- **Target**: <5% monthly

### DAU/MAU Ratio

- **Definition**: Daily active users as a percentage of monthly active users. Measures engagement stickiness.
- **Formula**: `(DAU / MAU) * 100`
- **Data Source**: Application session/activity logs
- **Target**: >20% (indicates regular usage)

### 30-Day Retention

- **Definition**: Percentage of users who return and perform an action 30 days after signup.
- **Formula**: `(users_active_at_day_30 / cohort_signup_count) * 100`
- **Data Source**: Activity logs
- **Target**: >30%

## Product Metrics

### Deploy Success Rate

- **Definition**: Percentage of deployments that complete without errors.
- **Formula**: `(successful_deploys / total_deploys) * 100`
- **Data Source**: `deployment` table (status field)
- **Target**: >95%

### Median Deploy Time

- **Definition**: Median wall-clock time from deploy trigger to running state.
- **Formula**: `MEDIAN(deployment.completed_at - deployment.created_at)`
- **Data Source**: `deployment` table
- **Target**: <120 seconds

### Platform Uptime

- **Definition**: Percentage of time the platform is fully operational.
- **Formula**: `(total_minutes - downtime_minutes) / total_minutes * 100`
- **Data Source**: Monitoring service (port 43867)
- **Target**: 99.9% (8.7 hours downtime/year max)

### Error Rate

- **Definition**: Percentage of API requests that return 5xx errors.
- **Formula**: `(5xx_responses / total_responses) * 100`
- **Data Source**: Nginx access logs / monitoring
- **Target**: <0.1%

## Customer Metrics

### NPS (Net Promoter Score)

- **Definition**: Likelihood that users would recommend ServerlessBase to others.
- **Formula**: `%Promoters (9-10) - %Detractors (0-6)`
- **Data Source**: In-app survey (quarterly)
- **Target**: >40
- **Scale**: -100 to +100

### Support Response Time

- **Definition**: Median time from support ticket creation to first human/AI response.
- **Formula**: `MEDIAN(first_response_at - ticket_created_at)`
- **Data Source**: Support system
- **Target**: <4 hours during business hours

### CSAT (Customer Satisfaction Score)

- **Definition**: Post-interaction satisfaction rating.
- **Formula**: `(satisfied_responses / total_responses) * 100`
- **Data Source**: Post-interaction survey
- **Target**: >85%

## Unit Economics

### CAC (Customer Acquisition Cost)

- **Definition**: Total cost to acquire one paying customer.
- **Formula**: `total_sales_and_marketing_spend / new_paying_customers`
- **Data Source**: Financial records + Stripe
- **Target**: <$100 (3.4x LTV payback within 12 months)

### LTV (Lifetime Value)

- **Definition**: Predicted total revenue from a customer over their lifetime.
- **Formula**: `ARPU_paying / monthly_churn_rate`
- **Example**: `$29 / 0.05 = $580`
- **Data Source**: Stripe + churn data
- **Target**: >$340 (LTV:CAC ratio >3:1)

### LTV:CAC Ratio

- **Definition**: Ratio of customer lifetime value to acquisition cost.
- **Formula**: `LTV / CAC`
- **Data Source**: Derived
- **Target**: >3:1

### Payback Period

- **Definition**: Months to recover the cost of acquiring a customer.
- **Formula**: `CAC / ARPU_paying`
- **Data Source**: Derived
- **Target**: <6 months

## Operations Metrics

### Agent Utilization Rate

- **Definition**: Percentage of available AI agents that performed at least one task in the past week.
- **Formula**: `(agents_with_activity / total_agents) * 100`
- **Data Source**: Agent activity logs
- **Current**: 169 agents available

### Skill Coverage

- **Definition**: Percentage of identified business functions covered by at least one skill.
- **Formula**: `(functions_with_skills / total_identified_functions) * 100`
- **Data Source**: Skill registry
- **Current**: 89 skills available

### Infrastructure Cost per User

- **Definition**: Monthly infrastructure spend divided by active users.
- **Formula**: `monthly_infra_cost / monthly_active_users`
- **Data Source**: Cloud provider billing
- **Target**: <$2/user/month

### AI Token Cost per User

- **Definition**: Monthly AI API spend divided by active users.
- **Formula**: `monthly_ai_api_cost / monthly_active_users`
- **Data Source**: AI provider billing (Anthropic, OpenAI, etc.)
- **Target**: <$1/user/month

## Metric Status Indicators

| Icon | Status | Meaning |
|------|--------|---------|
| :green_circle: | On Track | At or above target |
| :yellow_circle: | At Risk | Within 20% of target but trending wrong |
| :red_circle: | Off Track | More than 20% below target |
| :arrow_up: | Improving | Week-over-week improvement |
| :arrow_down: | Declining | Week-over-week decline |
| :left_right_arrow: | Flat | No significant change |

## Data Collection Cadence

| Metric Group | Collection | Review |
|--------------|-----------|--------|
| Revenue | Real-time (Stripe webhooks) | Weekly |
| Growth | Daily batch | Weekly |
| Product | Real-time (app metrics) | Weekly |
| Customer | Survey-triggered | Monthly |
| Unit Economics | Monthly calculation | Monthly |
| Operations | Daily batch | Weekly |
