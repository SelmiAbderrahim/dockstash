import type Stripe from 'stripe';
import { logger } from '../../config/logger.js';
import { HttpError } from '../../shared/utils/http-error.js';
import { findUserById, User, type UserHydrated } from '../users/index.js';
import { sendEmail } from '../communication/index.js';
import { getStripe } from './stripe.client.js';

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

async function loadUser(userId: string): Promise<UserHydrated> {
  const user = await findUserById(userId);
  if (!user) throw HttpError.notFound('User not found.');
  return user;
}

function ensureStripeBlock(user: UserHydrated): NonNullable<UserHydrated['stripe']> {
  if (!user.stripe) {
    user.stripe = {
      customerId: '',
      subscriptionId: '',
      lastFour: '',
      plan: '',
    };
  }
  return user.stripe;
}

export async function createSubscriptionForUser(
  userId: string,
  input: { plan: string; stripeToken: string; lastFour: string },
): Promise<{ message: string }> {
  const stripe = getStripe();
  const user = await loadUser(userId);
  const stripeBlock = ensureStripeBlock(user);

  if (stripeBlock.customerId) {
    const subscription = await stripe.subscriptions.create({
      customer: stripeBlock.customerId,
      items: [{ price: input.plan }],
    });
    stripeBlock.lastFour = input.lastFour;
    stripeBlock.subscriptionId = subscription.id;
    stripeBlock.plan = input.plan;
    await user.save();
    return { message: `You have been successfully subscribed to the ${input.plan} plan.` };
  }

  const customer = await stripe.customers.create({
    source: input.stripeToken,
    email: user.email,
  });
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: input.plan }],
  });

  stripeBlock.lastFour = input.lastFour;
  stripeBlock.customerId = customer.id;
  stripeBlock.subscriptionId = subscription.id;
  stripeBlock.plan = input.plan;
  await user.save();
  return { message: `You have been successfully subscribed to the ${input.plan} plan.` };
}

export async function changeSubscriptionForUser(
  userId: string,
  newPlan: string,
): Promise<{ message: string }> {
  const stripe = getStripe();
  const user = await loadUser(userId);
  const stripeBlock = ensureStripeBlock(user);
  if (!stripeBlock.subscriptionId) {
    throw HttpError.badRequest('No active subscription to change.');
  }

  const existing = await stripe.subscriptions.retrieve(stripeBlock.subscriptionId);
  const itemId = existing.items.data[0]?.id;
  if (!itemId) {
    throw HttpError.internal('Subscription has no items.');
  }

  const updated = await stripe.subscriptions.update(stripeBlock.subscriptionId, {
    items: [{ id: itemId, price: newPlan }],
  });
  stripeBlock.subscriptionId = updated.id;
  stripeBlock.plan = newPlan;
  await user.save();
  return { message: `Your subscription has been successfully updated to the ${newPlan} plan.` };
}

export async function deleteSubscriptionForUser(userId: string): Promise<{ message: string }> {
  const stripe = getStripe();
  const user = await loadUser(userId);
  const stripeBlock = ensureStripeBlock(user);
  if (!stripeBlock.subscriptionId) {
    throw HttpError.badRequest('No active subscription to cancel.');
  }
  await stripe.subscriptions.update(stripeBlock.subscriptionId, { cancel_at_period_end: true });
  stripeBlock.subscriptionId = '';
  stripeBlock.lastFour = '';
  stripeBlock.plan = '';
  stripeBlock.activeUntil = new Date();
  await user.save();
  return { message: 'Subscription successfully deleted.' };
}

export async function getCustomerForUser(userId: string): Promise<{ customer: Stripe.Customer | Stripe.DeletedCustomer }> {
  const stripe = getStripe();
  const user = await loadUser(userId);
  const stripeBlock = ensureStripeBlock(user);
  if (!stripeBlock.customerId) {
    throw HttpError.notFound('No Stripe customer associated with this user.');
  }
  const customer = await stripe.customers.retrieve(stripeBlock.customerId);
  return { customer };
}

export async function updateCustomerBillingInfoForUser(
  userId: string,
  stripeToken: string,
): Promise<{ message: string }> {
  const stripe = getStripe();
  const user = await loadUser(userId);
  const stripeBlock = ensureStripeBlock(user);
  if (!stripeBlock.customerId) {
    throw HttpError.notFound('No Stripe customer associated with this user.');
  }
  const customer = (await stripe.customers.update(stripeBlock.customerId, {
    source: stripeToken,
  })) as Stripe.Customer;
  const card = customer.sources?.data?.[0] as Stripe.Card | undefined;
  if (card?.last4) {
    stripeBlock.lastFour = card.last4;
  }
  await user.save();
  return { message: 'Payment method successfully updated.' };
}

export async function handleStripeWebhook(eventId: string): Promise<void> {
  const stripe = getStripe();
  const event = await stripe.events.retrieve(eventId);

  switch (event.type) {
    case 'customer.created':
      logger.info({ eventId }, 'stripe customer created');
      break;
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      if (!customerId) return;
      const user = await User.findOne({ 'stripe.customerId': customerId });
      if (!user) return;
      ensureStripeBlock(user).activeUntil = new Date(Date.now() + ONE_MONTH_MS);
      await user.save();
      logger.info({ email: user.email }, 'invoice payment succeeded');
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      if (!customerId) return;
      const user = await User.findOne({ 'stripe.customerId': customerId });
      if (!user) return;
      const amount = ((invoice.amount_due ?? 0) / 100).toFixed(2);
      await sendEmail({
        to: user.email,
        subject: 'Payment Failed',
        text:
          `You are receiving this because your most recent payment for $${amount} failed.\n` +
          'This could be due to a change or expiration on your provided credit card or interference from your bank.\n' +
          'Please update your payment information as soon as possible.',
      });
      break;
    }
    default:
      logger.debug({ type: event.type }, 'unhandled stripe event');
  }
}

