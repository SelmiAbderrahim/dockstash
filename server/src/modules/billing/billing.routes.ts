import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import {
  changeSubscription,
  createSubscription,
  deleteSubscription,
  getCustomer,
  updateCustomerBillingInfo,
  webhook,
} from './billing.controller.js';

export const billingRouter: Router = Router();

billingRouter.post('/webhook-notify', webhook);
billingRouter.post('/customer', requireAuth, createSubscription);
billingRouter.put('/customer', requireAuth, updateCustomerBillingInfo);
billingRouter.get('/customer', requireAuth, getCustomer);
billingRouter.put('/subscription', requireAuth, changeSubscription);
billingRouter.delete('/subscription', requireAuth, deleteSubscription);
