import { useParams } from 'react-router-dom';
import { CheckoutForm } from './CheckoutForm';

export const InitialCheckout = () => {
  const { plan } = useParams<{ plan: string }>();
  return <CheckoutForm plan={plan} />;
};
