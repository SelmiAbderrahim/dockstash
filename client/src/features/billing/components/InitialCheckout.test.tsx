import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { InitialCheckout } from './InitialCheckout';
import { billingReducer } from '../store/slice';

vi.mock('../stripeGlobal', () => ({
  loadStripeScript: vi.fn(),
  getStripe: vi.fn(),
}));

vi.mock('../api', () => ({
  createCustomerRequest: vi.fn(),
  updateBillingRequest: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('InitialCheckout', () => {
  it('renders the checkout form for the plan in the route params', () => {
    render(
      <Provider store={configureStore({ reducer: { billing: billingReducer } })}>
        <MemoryRouter initialEntries={['/checkout/gold']}>
          <Routes>
            <Route path="/checkout/:plan" element={<InitialCheckout />} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    );
    expect(screen.getByLabelText(/card number/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument();
  });
});
