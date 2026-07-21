/**
 * Billing/plan configuration.
 *
 * Stripe keys are OPTIONAL. When `STRIPE_SECRET_KEY` is unset, the billing
 * routes degrade gracefully: the plan can still be toggled directly (useful in
 * development / demos), and invoices come from the seeded `invoices` collection.
 *
 * In production, set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and
 * STRIPE_PRO_PRICE_ID to enable real checkout + webhooks + the customer portal.
 */

export const PLANS = Object.freeze({
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: 'month',
    features: [
      'Standard-definition video',
      'MP3 & M4A audio',
      'Core formats',
      'Standard processing speed',
      '200+ platforms',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 9,
    interval: 'month',
    features: [
      'Unlimited downloads',
      '4K Ultra HD video',
      'All formats incl. FLAC & WebP',
      'Priority processing',
      '200+ platforms',
      'Batch playlist downloads',
      'No ads',
    ],
  },
});

export function getPlan(planId) {
  return PLANS[planId] || PLANS.free;
}

export function isStripeConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.trim(),
  );
}
