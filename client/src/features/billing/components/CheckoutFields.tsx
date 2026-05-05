import type { ChangeEvent, FormEvent } from 'react';

export interface CheckoutFormState {
  cardNumber: string;
  cvc: string;
  expMonth: string;
  expYear: string;
}

interface CheckoutFieldsProps {
  formState: CheckoutFormState;
  handleChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export const CheckoutFields = ({ formState, handleChange, onSubmit }: CheckoutFieldsProps) => (
  <form onSubmit={onSubmit}>
    <div>
      <label htmlFor="cardNumber">Card Number</label>
      <input
        id="cardNumber"
        autoComplete="off"
        value={formState.cardNumber}
        onChange={handleChange}
      />
    </div>
    <div>
      <label htmlFor="cvc">CVC</label>
      <input id="cvc" autoComplete="off" value={formState.cvc} onChange={handleChange} />
    </div>
    <div>
      <label htmlFor="expMonth">Expiration Month (MM)</label>
      <input
        id="expMonth"
        autoComplete="off"
        value={formState.expMonth}
        onChange={handleChange}
      />
    </div>
    <div>
      <label htmlFor="expYear">Expiration Year (YYYY)</label>
      <input id="expYear" autoComplete="off" value={formState.expYear} onChange={handleChange} />
    </div>
    <button type="submit">Get Started!</button>
  </form>
);
