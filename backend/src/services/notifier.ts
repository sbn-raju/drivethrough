import { isProduction } from '../config/env.js';
import type { Contact } from '../common/utils/contact.js';
import { maskContact } from '../common/utils/contact.js';

type OtpPurpose = 'signup' | 'password_reset' | 'contact_change';

const subjects: Record<OtpPurpose, string> = {
  signup: 'Verify your DriveThrough account',
  password_reset: 'Reset your DriveThrough password',
  contact_change: 'Confirm your new contact details',
};

/**
 * OTP / email / SMS delivery.
 *
 * TODO(provider): plug in the chosen SMS + email providers (e.g. MSG91 / Twilio / Resend).
 * Until then, codes are printed to the server console in non-production environments only.
 * Production refuses to "send" so codes are never silently lost or logged.
 */
export async function sendOtp(to: Contact, code: string, purpose: OtpPurpose) {
  if (isProduction) {
    throw new Error('No OTP delivery provider configured for production.');
  }
  console.info(`\n[dev-notifier] ${subjects[purpose]} -> ${to.channel} ${maskContact(to)}\n[dev-notifier] code: ${code}\n`);
}

/** Sent when someone tries to register with a contact that already has an account. */
export async function sendAccountExistsNotice(to: Contact) {
  if (isProduction) return; // TODO(provider)
  console.info(`[dev-notifier] Account-exists notice -> ${to.channel} ${maskContact(to)}`);
}
