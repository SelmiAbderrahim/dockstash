export interface SubscriptionPlan {
  id: string;
  amount: number;
}

export interface SubscriptionData {
  plan: SubscriptionPlan;
  current_period_end: number;
  cancel_at_period_end: boolean;
}

export interface SubscriptionsCollection {
  total_count: number;
  data: SubscriptionData[];
}

export interface PaymentSource {
  last4: string;
}

export interface PaymentSourcesCollection {
  total_count: number;
  data: PaymentSource[];
}

export interface Customer {
  subscriptions?: SubscriptionsCollection;
  sources?: PaymentSourcesCollection;
}

export interface MessageResponse {
  message: string;
}

export interface FetchCustomerResponse {
  customer: Customer;
}

// New (prompt 07) — Plans, Usage, Overview, Selection.

export type BillingStatus = 'active' | 'past_due' | 'canceled' | 'revoked' | 'none';
export type ScheduleFrequency = 'daily' | 'hourly' | 'any-cron';

export interface PricingTier {
  slug: 'free' | 'pro' | 'business';
  name: string;
  priceMonthly: number;
  priceYearly: number;
  productIdMonthly: string | null;
  productIdYearly: string | null;
  caps: {
    projects: number | null;
    retentionDays: number;
    frequency: ScheduleFrequency;
  };
  flags: { schedules: boolean; emailAlerts: boolean; multiVps: boolean };
}

export interface BillingOverview {
  slug: 'free' | 'pro' | 'business';
  status: BillingStatus;
  currentPeriodEnd: string | null;
  graceEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  selectionRequired: boolean;
}

export interface ProjectRef {
  id: string;
  name: string;
}

export interface UsageResponse {
  projects: {
    used: number;
    cap: number | null;
    active: ProjectRef[];
    paused: ProjectRef[];
  };
  retentionDays: number;
  frequency: ScheduleFrequency;
  flags: { schedules: boolean; emailAlerts: boolean; multiVps: boolean };
  selectionRequired: boolean;
}

export interface CheckoutResponse {
  url: string;
  providerCheckoutId: string;
}

export interface ChangePlanResponse {
  status: string;
}

export interface SelectProjectsResponse {
  active: number;
  paused: number;
}

export interface BillingState {
  customer: Customer;
  message: string;
  error: string;
  tiers: PricingTier[];
  overview: BillingOverview | null;
  usage: UsageResponse | null;
  loadingTiers: boolean;
  loadingOverview: boolean;
  loadingUsage: boolean;
}
