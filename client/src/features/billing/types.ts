// Plans, Usage, Overview, Selection (prompt 07 / Polar).

export type BillingStatus =
  | 'active'
  | 'past_due'
  | 'incomplete'
  | 'canceled'
  | 'revoked'
  | 'none';
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

export interface ProjectMetrics {
  id: string;
  name: string;
  sizeBytes: number;
  snapshotCount: number;
  lastRunAt: string | null;
  lastStatus: string;
}

export interface UsageResponse {
  projects: {
    used: number;
    cap: number | null;
    active: ProjectRef[];
    paused: ProjectRef[];
  };
  metering: ProjectMetrics[];
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

export interface PortalResponse {
  url: string;
}

export interface SelectProjectsResponse {
  active: number;
  paused: number;
}

export interface BillingState {
  message: string;
  error: string;
  /** Usage-tab-scoped error; rendered inline with a retry action. */
  usageError: string;
  tiers: PricingTier[];
  overview: BillingOverview | null;
  usage: UsageResponse | null;
  loadingTiers: boolean;
  loadingOverview: boolean;
  loadingUsage: boolean;
}
