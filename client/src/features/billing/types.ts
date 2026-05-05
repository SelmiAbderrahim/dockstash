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

export interface BillingState {
  customer: Customer;
  message: string;
  error: string;
}

export interface MessageResponse {
  message: string;
}

export interface FetchCustomerResponse {
  customer: Customer;
}
