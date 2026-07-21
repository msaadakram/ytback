import Stripe from 'stripe';
import { isStripeConfigured } from '../../config/billing.js';
import logger from '../../utils/logger.js';

let client = null;

/**
 * Lazily initialize the Stripe client. Returns null when Stripe is not
 * configured, so callers can branch into the graceful-fallback path.
 */
export function getStripe() {
  if (!isStripeConfigured()) return null;
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
      appInfo: { name: 'DownForge', version: '1.0.0' },
    });
    logger.info('stripe client initialized');
  }
  return client;
}

/** Construct the Stripe webhook event from a raw body, verifying the signature. */
export function buildWebhookEvent(rawBody, signature) {
  const stripe = getStripe();
  if (!stripe) return null;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return null;
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}
