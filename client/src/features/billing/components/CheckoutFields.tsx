import type { ChangeEvent, FormEvent } from 'react';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@shared/ui/card';

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
  <Card className="w-full max-w-md">
    <CardHeader>
      <CardTitle>Card details</CardTitle>
    </CardHeader>
    <CardContent>
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cardNumber">Card Number</Label>
          <Input
            id="cardNumber"
            autoComplete="off"
            value={formState.cardNumber}
            onChange={handleChange}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cvc">CVC</Label>
          <Input id="cvc" autoComplete="off" value={formState.cvc} onChange={handleChange} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="expMonth">Expiration Month (MM)</Label>
          <Input
            id="expMonth"
            autoComplete="off"
            value={formState.expMonth}
            onChange={handleChange}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="expYear">Expiration Year (YYYY)</Label>
          <Input
            id="expYear"
            autoComplete="off"
            value={formState.expYear}
            onChange={handleChange}
          />
        </div>
        <Button type="submit" className="w-full">
          Get Started!
        </Button>
      </form>
    </CardContent>
  </Card>
);
