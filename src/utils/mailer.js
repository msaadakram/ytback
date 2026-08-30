import crypto from 'node:crypto';
import { config } from '../config/index.js';
import logger from './logger.js';

const RESEND_API_URL = 'https://api.resend.com/emails';

/** Generate a cryptographically random 6-digit numeric code. */
export function generateSixDigitCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** SHA-256 hash used to store codes at rest. */
export function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function emailShell(title, bodyHtml) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px;">
      <tr><td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(13,31,38,0.10);">
          <tr><td style="height:4px;background:linear-gradient(90deg,#5baab8,#0d1f26,#5baab8);"></td></tr>
          <tr><td style="padding:32px 36px 8px 36px;">
            <span style="font-size:11px;font-weight:bold;letter-spacing:0.18em;color:#5baab8;text-transform:uppercase;">DownForge</span>
            <h1 style="margin:10px 0 0 0;font-size:22px;color:#0d1f26;">${title}</h1>
          </td></tr>
          <tr><td style="padding:8px 36px 8px 36px;font-size:14px;line-height:1.7;color:#334155;">
            ${bodyHtml}
          </td></tr>
          <tr><td style="padding:20px 36px 32px 36px;font-size:11px;color:#94a3b8;line-height:1.6;">
            If you didn't request this email you can safely ignore it — your account is safe.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function codeBlock(code) {
  return `<div style="margin:20px 0;padding:16px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;text-align:center;">
    <span style="display:inline-block;font-size:30px;font-weight:bold;letter-spacing:10px;color:#0d1f26;font-family:'Courier New',monospace;">${code}</span>
  </div>`;
}

/**
 * Send an email through Resend (https://resend.com) REST API.
 * When RESEND_API_KEY is not configured the email is "sent" by logging its
 * contents, mirroring the graceful degradation used for Stripe billing —
 * so local development works without a mail provider.
 * Returns { delivered, id? }.
 */
async function sendMail(to, subject, html) {
  if (!config.resendApiKey) {
    // In production, missing API key is a deployment error — fail loudly so
    // the caller can surface it and the user can retry via resend without
    // being silently stuck. In development, degrade to log-only.
    if (config.isProd) {
      logger.error({ to, subject }, 'RESEND_API_KEY not set in production — email not sent');
      throw new Error('Email service not configured (missing RESEND_API_KEY)');
    }
    logger.warn({ to, subject }, '[DEV MAIL] RESEND_API_KEY not set — email not sent, code logged below');
    logger.warn({ to, subject }, html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    return { delivered: false, reason: 'missing_api_key' };
  }

  // Warn when the default onboarding address is used in production — Resend
  // only allows it to send to the account owner's own email, so all other
  // recipients will silently fail (or 403). This is a common deploy mistake.
  if (config.isProd && config.mailFrom.includes('onboarding@resend.dev')) {
    logger.warn(
      { to, from: config.mailFrom },
      'mailFrom still uses onboarding@resend.dev in production — verification emails will fail for external recipients. Set RESEND_FROM to an address on your verified domain.',
    );
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.mailFrom,
        to: [to],
        subject,
        html,
      }),
      // Don't let a slow mail provider hold up the request path.
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      // Try to surface Resend's JSON error message when present.
      let detail = body;
      try {
        const parsed = JSON.parse(body);
        detail = parsed.message || parsed.error || body;
      } catch {
        // leave as text
      }
      logger.error({ status: res.status, body, detail, to, subject, from: config.mailFrom }, 'Resend API returned an error');
      const err = new Error(`Resend API error (HTTP ${res.status}): ${detail}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }

    const data = await res.json();
    logger.info({ to, subject, id: data.id }, 'email sent via Resend');
    return { delivered: true, id: data.id };
  } catch (err) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      logger.error({ to, subject }, 'Resend API request timed out');
      const e = new Error('Email provider timed out');
      e.cause = err;
      throw e;
    }
    throw err;
  }
}

/** Escape a string for safe interpolation into HTML emails. */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Send the 6-digit email verification code. */
export async function sendVerificationEmail(email, code) {
  const minutes = config.emailCodeTtlMinutes;
  const html = emailShell(
    'Verify your email',
    `<p>Welcome to DownForge! Use the verification code below to confirm your email address. It expires in <strong>${minutes} minutes</strong>.</p>${codeBlock(code)}<p>You can also enter this code on the verification page you were directed to after signing up.</p>`
  );
  return sendMail(email, `Your DownForge verification code: ${code}`, html);
}

/** Send the 6-digit password reset code. */
export async function sendPasswordResetEmail(email, code) {
  const minutes = config.passwordResetTtlMinutes;
  const html = emailShell(
    'Reset your password',
    `<p>We received a request to reset your DownForge password. Use the code below to choose a new one. It expires in <strong>${minutes} minutes</strong>.</p>${codeBlock(code)}<p>If you didn't request a password reset, no changes were made to your account — your current password keeps working.</p>`
  );
  return sendMail(email, `Your DownForge password reset code: ${code}`, html);
}

/** Welcome email for new newsletter subscribers. */
export async function sendNewsletterWelcomeEmail(email) {
  const html = emailShell(
    'You are subscribed',
    `<p>Thanks for subscribing to DownForge updates! You will now receive product news and platform support announcements straight to your inbox.</p><p>No spam — you can unsubscribe at any time using the link at the bottom of any email.</p>`
  );
  return sendMail(email, 'Welcome to DownForge updates', html);
}

/** Internal notification for new contact page messages. */
export async function sendContactNotificationEmail({ name, email, subject, message }) {
  const html = emailShell(
    'New contact message',
    `<p><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}) sent a message via the DownForge contact form.</p>
     <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
     <div style="margin:16px 0;padding:16px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;white-space:pre-wrap;font-size:14px;color:#334155;">${escapeHtml(message)}</div>
     <p>Reply directly to <strong>${escapeHtml(email)}</strong> to answer.</p>`
  );
  return sendMail('support@downforge.me', `DownForge contact: ${subject}`, html);
}
