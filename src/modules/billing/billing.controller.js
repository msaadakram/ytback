import { getDb, ObjectId } from '../../db/index.js';
import { config } from '../../config/index.js';
import { getPlan, PLANS } from '../../config/billing.js';
import { getStripe } from './stripe.js';
import { wrapAsync } from '../../middlewares/error.js';
import { Errors } from '../../utils/HttpError.js';

function publicInvoiceShape(inv) {
  return {
    id: inv._id.toString(),
    number: inv.number,
    amount: inv.amount,
    currency: inv.currency || 'usd',
    status: inv.status,
    period_start: inv.period_start || null,
    period_end: inv.period_end || null,
    hosted_url: inv.hosted_url || null,
    pdf_url: inv.pdf_url || null,
    created_at: inv.created_at,
  };
}

async function loadUser(db, userId) {
  return db.collection('users').findOne({ _id: new ObjectId(userId) });
}

/**
 * GET /api/billing/plan
 * Current plan details + feature list + renewal date + a `stripe_enabled` flag.
 */
export const getPlanState = wrapAsync(async (req, res) => {
  const db = getDb();
  const user = await loadUser(db, req.user.id);
  const plan = getPlan(user?.plan);

  res.json({
    success: true,
    data: {
      plan: plan.id,
      name: plan.name,
      price: plan.price,
      interval: plan.interval,
      features: plan.features,
      status: plan.id === 'pro' ? 'Active' : '—',
      renews_at: user?.plan_expires_at || null,
      stripe_enabled: Boolean(getStripe()),
    },
  });
});

/**
 * GET /api/billing/invoices
 * List invoices for the user (Stripe-sourced when available, else seeded).
 */
export const listInvoices = wrapAsync(async (req, res) => {
  const db = getDb();
  const invoices = await db.collection('invoices')
    .find({ user_id: new ObjectId(req.user.id) })
    .sort({ created_at: -1 })
    .toArray();

  res.json({
    success: true,
    data: { invoices: invoices.map(publicInvoiceShape) },
  });
});

/**
 * POST /api/billing/checkout
 * Create a Stripe Checkout Session for the Pro plan.
 * Falls back to a direct plan toggle when Stripe is not configured.
 */
export const createCheckout = wrapAsync(async (req, res) => {
  const db = getDb();
  const user = await loadUser(db, req.user.id);
  const stripe = getStripe();

  // Fallback (no Stripe configured): toggle plan directly so the flow still works end-to-end.
  if (!stripe) {
    const now = new Date();
    const renews = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { plan: 'pro', plan_expires_at: renews, updated_at: now } },
    );
    return res.json({
      success: true,
      data: { url: null, fallback: true, message: 'Stripe not configured — plan upgraded directly.' },
    });
  }

  if (!config.stripeProPriceId) {
    throw Errors.Internal('STRIPE_PRO_PRICE_ID is not configured');
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: user.email,
    line_items: [{ price: config.stripeProPriceId, quantity: 1 }],
    client_reference_id: user._id.toString(),
    success_url: `${config.appBaseUrl}/dashboard/billing?checkout=success`,
    cancel_url: `${config.appBaseUrl}/dashboard/billing?checkout=cancelled`,
    subscription_data: { metadata: { user_id: user._id.toString() } },
  });

  res.json({ success: true, data: { url: session.url, fallback: false } });
});

/**
 * POST /api/billing/portal
 * Open the Stripe Billing Portal for the user to manage their subscription.
 */
export const createPortal = wrapAsync(async (req, res) => {
  const db = getDb();
  const user = await loadUser(db, req.user.id);
  const stripe = getStripe();

  if (!stripe) {
    return res.json({
      success: true,
      data: { url: null, fallback: true, message: 'Stripe not configured.' },
    });
  }

  if (!user?.stripe_customer_id) {
    throw Errors.BadRequest('No billing account is linked to this user yet');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${config.appBaseUrl}/dashboard/billing`,
  });

  res.json({ success: true, data: { url: session.url, fallback: false } });
});

/**
 * POST /api/billing/plan  (manual fallback)
 * Directly set the plan when Stripe is not configured.
 */
export const setPlan = wrapAsync(async (req, res) => {
  const db = getDb();
  const { plan } = req.validated;

  if (getStripe()) {
    throw Errors.BadRequest('Use Stripe checkout to change plans');
  }

  const now = new Date();
  const renews = plan === 'pro' ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) : null;

  await db.collection('users').updateOne(
    { _id: new ObjectId(req.user.id) },
    { $set: { plan, plan_expires_at: renews, updated_at: now } },
  );

  const updated = getPlan(plan);
  res.json({
    success: true,
    data: {
      plan: updated.id,
      name: updated.name,
      price: updated.price,
      interval: updated.interval,
      features: updated.features,
      renews_at: renews,
    },
  });
});

/**
 * Stripe webhook (mounted at /webhooks/stripe, BEFORE json middleware — needs raw body).
 * Handles checkout completion, paid invoices, and subscription deletion.
 */
export const stripeWebhook = wrapAsync(async (req, res) => {
  const stripe = getStripe();
  if (!stripe) {
    return res.status(400).json({ success: false, error: { code: 'STRIPE_DISABLED', message: 'Stripe is not configured' } });
  }

  const signature = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ success: false, error: { code: 'WEBHOOK_SIGNATURE', message: `Invalid signature: ${err.message}` } });
  }

  const db = getDb();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.client_reference_id || session.metadata?.user_id;
      const customerId = session.customer;
      const subscription = session.subscription;
      if (userId) {
        // Pull the subscription to get the period end (renewal date).
        let currentPeriodEnd = null;
        if (subscription) {
          try {
            const sub = await stripe.subscriptions.retrieve(subscription);
            currentPeriodEnd = new Date(sub.current_period_end * 1000);
          } catch { /* leave null */ }
        }
        await db.collection('users').updateOne(
          { _id: new ObjectId(userId) },
          {
            $set: {
              plan: 'pro',
              stripe_customer_id: customerId,
              plan_expires_at: currentPeriodEnd,
              updated_at: new Date(),
            },
          },
        );
      }
      break;
    }
    case 'invoice.paid': {
      const inv = event.data.object;
      const customerId = inv.customer;
      const user = await db.collection('users').findOne({ stripe_customer_id: customerId });
      if (user) {
        await db.collection('invoices').updateOne(
          { stripe_invoice_id: inv.id },
          {
            $set: {
              user_id: user._id,
              number: inv.number || inv.id,
              amount: (inv.total || 0) / 100,
              currency: inv.currency || 'usd',
              status: inv.paid ? 'Paid' : (inv.status || 'open'),
              period_start: new Date((inv.period_start || 0) * 1000),
              period_end: new Date((inv.period_end || 0) * 1000),
              hosted_url: inv.hosted_invoice_url || null,
              pdf_url: inv.invoice_pdf || null,
            },
            $setOnInsert: { created_at: new Date() },
          },
          { upsert: true },
        );
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const customerId = sub.customer;
      await db.collection('users').updateOne(
        { stripe_customer_id: customerId },
        { $set: { plan: 'free', plan_expires_at: null, updated_at: new Date() } },
      );
      break;
    }
    default:
      // Acknowledge unhandled event types so Stripe doesn't retry.
      break;
  }

  res.json({ received: true });
});

export { PLANS };
