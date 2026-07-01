import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useAppDispatch } from '@shared/hooks/redux';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { createCustomer, updateBilling } from '../store/thunks';
import { getStripe, loadStripeScript } from '../stripeGlobal';
import { CheckoutFields, type CheckoutFormState } from './CheckoutFields';

interface CheckoutFormProps {
  plan?: string;
}

const STRIPE_PUBLIC_KEY: string =
  import.meta.env.VITE_STRIPE_PUBLIC_KEY ?? 'pk_test_XXXXXXXXXXXXXXXXXXXXXXXX';

const initialFormState: CheckoutFormState = {
  cardNumber: '',
  cvc: '',
  expMonth: '',
  expYear: '',
};

export const CheckoutForm = ({ plan }: CheckoutFormProps) => {
  const dispatch = useAppDispatch();
  const [form, setForm] = useState<CheckoutFormState>(initialFormState);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadStripeScript();
  }, []);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { id, value } = event.target;
    if (id !== 'cardNumber' && id !== 'cvc' && id !== 'expMonth' && id !== 'expYear') return;
    setForm((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const stripe = getStripe();
    if (!stripe) {
      setError('Payment provider unavailable. Please try again.');
      return;
    }
    stripe.setPublishableKey(STRIPE_PUBLIC_KEY);
    stripe.card.createToken(
      {
        number: form.cardNumber,
        cvc: form.cvc,
        exp_month: form.expMonth,
        exp_year: form.expYear,
      },
      (_status, response) => {
        if (response.error) {
          setError(response.error.message);
          return;
        }
        const stripeToken = response.id;
        const lastFour = response.card.last4;
        if (!plan) {
          void dispatch(updateBilling(stripeToken));
        } else {
          void dispatch(createCustomer({ stripeToken, plan, lastFour }));
        }
      },
    );
  };

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <CheckoutFields formState={form} handleChange={handleChange} onSubmit={handleSubmit} />
    </div>
  );
};
