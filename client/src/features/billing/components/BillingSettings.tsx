import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import moment from 'moment';
import { useAppDispatch, useAppSelector } from '@shared/hooks/redux';
import {
  cancelSubscription,
  fetchCustomer,
  updateSubscription,
} from '../store/thunks';
import { selectBillingError, selectBillingMessage, selectCustomer } from '../store/selectors';
import { CheckoutForm } from './CheckoutForm';

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
        <div className="cancel-confirm">
          <p>Do you really want to cancel your membership?</p>
          <div className="action-buttons">
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => void dispatch(cancelSubscription())}
            >
              Yes
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setCancelConfirm(false)}
            >
              No
            </button>
          </div>
        </div>
      );
    }
    if (showChangeSubscription) {
      return (
        <div className="action-buttons">
          <select name="newPlan" value={newPlan} onChange={handlePlanChange}>
            <option value="bronze">Bronze</option>
            <option value="silver">Silver</option>
            <option value="gold">Gold</option>
          </select>
          <button type="button" className="btn btn-primary" onClick={submitPlanChange}>
            Change
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowChangeSubscription(false)}
          >
            Cancel
          </button>
        </div>
      );
    }
    if (showUpdateBilling) {
      return (
        <div className="action-buttons">
          <CheckoutForm />
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => setShowUpdateBilling(false)}
          >
            Cancel
          </button>
        </div>
      );
    }
    return (
      <div className="action-buttons">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowChangeSubscription(true)}
        >
          Change Subscription
        </button>
        <button
          type="button"
          className="btn btn-info"
          onClick={() => setShowUpdateBilling(true)}
        >
          Update Billing Information
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => setCancelConfirm(true)}
        >
          Cancel Subscription
        </button>
      </div>
    );
  };

  const renderPlan = () => {
    const subscriptions = customer.subscriptions;
    const sources = customer.sources;
    if (!subscriptions || !sources) {
      return <div className="loading">Loading...</div>;
    }

    const lastSubscription = subscriptions.data[subscriptions.total_count - 1];
    const lastSource = sources.data[sources.total_count - 1];
    if (!lastSubscription || !lastSource) {
      return <div className="loading">Loading...</div>;
    }

    const subscribedPlan = lastSubscription.plan.id;
    const lastFour = lastSource.last4;
    const pmtAmt = (lastSubscription.plan.amount / 100).toFixed(2);
    const pmtDate = moment
      .unix(lastSubscription.current_period_end)
      .format('dddd, MMMM Do YYYY');

    if (lastSubscription.cancel_at_period_end) {
      return (
        <div className="active-subscription">
          Your {subscribedPlan} plan will expire on {pmtDate}. You will not be charged again.
        </div>
      );
    }

    return (
      <div className="active-subscription">
        You are subscribed to the {subscribedPlan} plan. Your credit card ending in {lastFour}{' '}
        will be charged ${pmtAmt} on {pmtDate}.{renderAccountActions()}
      </div>
    );
  };

  return (
    <div className="user-subscription">
      {errorMessage ? (
        <div role="alert">
          <strong>Oops!</strong> {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div>
          <strong>Success!</strong> {successMessage}
        </div>
      ) : null}
      {renderPlan()}
    </div>
  );
};
