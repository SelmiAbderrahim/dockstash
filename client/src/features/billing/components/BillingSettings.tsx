import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import moment from 'moment';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { Button } from '@shared/ui/button';
import { Card, CardContent } from '@shared/ui/card';
import { cn } from '@shared/lib/utils';
import {
  cancelSubscription,
  fetchCustomer,
  updateSubscription,
} from '../store/thunks';
import { selectBillingError, selectBillingMessage, selectCustomer } from '../store/selectors';
import { CheckoutForm } from './CheckoutForm';

const selectClass = cn(
  'h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs',
  'outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
);

export const BillingSettings = () => {
  const dispatch = useAppDispatch();
  const customer = useAppSelector(selectCustomer);
  const errorMessage = useAppSelector(selectBillingError);
  const successMessage = useAppSelector(selectBillingMessage);

  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [showChangeSubscription, setShowChangeSubscription] = useState(false);
  const [showUpdateBilling, setShowUpdateBilling] = useState(false);
  const [newPlan, setNewPlan] = useState('');

  useEffect(() => {
    void dispatch(fetchCustomer());
  }, [dispatch]);

  const handlePlanChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setNewPlan(event.target.value);
  };

  const submitPlanChange = () => {
    void dispatch(updateSubscription(newPlan));
  };

  const renderAccountActions = () => {
    if (cancelConfirm) {
      return (
        <div className="mt-4 flex flex-col gap-3">
          <p>Do you really want to cancel your membership?</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              onClick={() => void dispatch(cancelSubscription())}
            >
              Yes
            </Button>
            <Button type="button" onClick={() => setCancelConfirm(false)}>
              No
            </Button>
          </div>
        </div>
      );
    }
    if (showChangeSubscription) {
      return (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select
            name="newPlan"
            value={newPlan}
            onChange={handlePlanChange}
            className={selectClass}
          >
            <option value="bronze">Bronze</option>
            <option value="silver">Silver</option>
            <option value="gold">Gold</option>
          </select>
          <Button type="button" onClick={submitPlanChange}>
            Change
          </Button>
          <Button type="button" variant="outline" onClick={() => setShowChangeSubscription(false)}>
            Cancel
          </Button>
        </div>
      );
    }
    if (showUpdateBilling) {
      return (
        <div className="mt-4 flex flex-col gap-3">
          <CheckoutForm />
          <Button
            type="button"
            variant="destructive"
            className="w-fit"
            onClick={() => setShowUpdateBilling(false)}
          >
            Cancel
          </Button>
        </div>
      );
    }
    return (
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={() => setShowChangeSubscription(true)}>
          Change Subscription
        </Button>
        <Button type="button" variant="secondary" onClick={() => setShowUpdateBilling(true)}>
          Update Billing Information
        </Button>
        <Button type="button" variant="destructive" onClick={() => setCancelConfirm(true)}>
          Cancel Subscription
        </Button>
      </div>
    );
  };

  const renderPlan = () => {
    const subscriptions = customer.subscriptions;
    const sources = customer.sources;
    if (!subscriptions || !sources) {
      return <div className="text-muted-foreground">Loading...</div>;
    }

    const lastSubscription = subscriptions.data[subscriptions.total_count - 1];
    const lastSource = sources.data[sources.total_count - 1];
    if (!lastSubscription || !lastSource) {
      return <div className="text-muted-foreground">Loading...</div>;
    }

    const subscribedPlan = lastSubscription.plan.id;
    const lastFour = lastSource.last4;
    const pmtAmt = (lastSubscription.plan.amount / 100).toFixed(2);
    const pmtDate = moment
      .unix(lastSubscription.current_period_end)
      .format('dddd, MMMM Do YYYY');

    if (lastSubscription.cancel_at_period_end) {
      return (
        <div>
          Your {subscribedPlan} plan will expire on {pmtDate}. You will not be charged again.
        </div>
      );
    }

    return (
      <div>
        You are subscribed to the {subscribedPlan} plan. Your credit card ending in {lastFour}{' '}
        will be charged ${pmtAmt} on {pmtDate}.{renderAccountActions()}
      </div>
    );
  };

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardContent className="flex flex-col gap-4">
        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>
              <strong>Oops!</strong> {errorMessage}
            </AlertDescription>
          </Alert>
        ) : null}
        {successMessage ? (
          <Alert>
            <AlertDescription>
              <strong>Success!</strong> {successMessage}
            </AlertDescription>
          </Alert>
        ) : null}
        {renderPlan()}
      </CardContent>
    </Card>
  );
};
