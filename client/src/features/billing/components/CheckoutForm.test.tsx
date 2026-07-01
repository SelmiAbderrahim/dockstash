import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { CheckoutForm } from './CheckoutForm';
import { billingReducer } from '../store/slice';
import * as stripeGlobal from '../stripeGlobal';
import * as api from '../api';

vi.mock('../stripeGlobal', () => ({
  loadStripeScript: vi.fn(),
  getStripe: vi.fn(),
}));

vi.mock('../api', () => ({
  createCustomerRequest: vi.fn(),
  updateBillingRequest: vi.fn(),
}));

const mockedStripe = vi.mocked(stripeGlobal);
const mockedApi = vi.mocked(api);

const makeStore = () => configureStore({ reducer: { billing: billingReducer } });

const renderForm = (plan?: string) =>
  render(
    <Provider store={makeStore()}>
      <CheckoutForm plan={plan} />
    </Provider>,
  );

const fillCard = () => {
  fireEvent.change(screen.getByLabelText(/card number/i), { target: { value: '4242' } });
  fireEvent.change(screen.getByLabelText(/cvc/i), { target: { value: '123' } });
  fireEvent.change(screen.getByLabelText(/expiration month/i), { target: { value: '12' } });
  fireEvent.change(screen.getByLabelText(/expiration year/i), { target: { value: '2030' } });
};

type TokenResponse = { id: string; card: { last4: string }; error?: { message: string } };

const fakeStripe = (response: TokenResponse) =>
  ({
    setPublishableKey: vi.fn(),
    card: {
      createToken: (_input: unknown, cb: (status: number, r: TokenResponse) => void) =>
        cb(200, response),
    },
  }) as unknown as ReturnType<typeof stripeGlobal.getStripe>;

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.createCustomerRequest.mockResolvedValue({ message: 'ok' });
  mockedApi.updateBillingRequest.mockResolvedValue({ message: 'ok' });
});

describe('CheckoutForm', () => {
  it('loads the Stripe script on mount', () => {
    mockedStripe.getStripe.mockReturnValue(undefined);
    renderForm();
    expect(mockedStripe.loadStripeScript).toHaveBeenCalled();
  });

  it('updates card fields on change', () => {
    mockedStripe.getStripe.mockReturnValue(undefined);
    renderForm();
    fillCard();
    expect((screen.getByLabelText(/card number/i) as HTMLInputElement).value).toBe('4242');
    expect((screen.getByLabelText(/cvc/i) as HTMLInputElement).value).toBe('123');
    expect((screen.getByLabelText(/expiration month/i) as HTMLInputElement).value).toBe('12');
    expect((screen.getByLabelText(/expiration year/i) as HTMLInputElement).value).toBe('2030');
  });

  it('ignores change events for unknown field ids', () => {
    mockedStripe.getStripe.mockReturnValue(undefined);
    renderForm();
    const cvc = screen.getByLabelText(/cvc/i) as HTMLInputElement;
    cvc.id = 'not-a-field';
    fireEvent.change(cvc, { target: { value: 'zzz' } });
    // Guard returned early: no controlled re-render happened, submit still has no token.
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/payment provider unavailable/i);
  });

  it('shows an error when the payment provider is unavailable', () => {
    mockedStripe.getStripe.mockReturnValue(undefined);
    renderForm();
    fillCard();
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/payment provider unavailable/i);
  });

  it('shows the Stripe error when tokenization fails', () => {
    mockedStripe.getStripe.mockReturnValue(
      fakeStripe({ id: '', card: { last4: '' }, error: { message: 'bad card' } }),
    );
    renderForm();
    fillCard();
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/bad card/i);
  });

  it('dispatches updateBilling when there is no plan', async () => {
    mockedStripe.getStripe.mockReturnValue(
      fakeStripe({ id: 'tok_update', card: { last4: '1111' } }),
    );
    renderForm();
    fillCard();
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    await waitFor(() =>
      expect(mockedApi.updateBillingRequest).toHaveBeenCalledWith('tok_update'),
    );
    expect(mockedApi.createCustomerRequest).not.toHaveBeenCalled();
  });

  it('dispatches createCustomer when a plan is provided', async () => {
    mockedStripe.getStripe.mockReturnValue(
      fakeStripe({ id: 'tok_new', card: { last4: '2222' } }),
    );
    renderForm('gold');
    fillCard();
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    await waitFor(() =>
      expect(mockedApi.createCustomerRequest).toHaveBeenCalledWith('tok_new', 'gold', '2222'),
    );
  });
});
