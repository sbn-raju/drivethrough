import { z } from 'zod';

export type Contact = { channel: 'email'; value: string } | { channel: 'phone'; value: string };

export const normaliseEmail = (email: string) => email.trim().toLowerCase();

/**
 * Normalises a phone number to E.164. Bare 10-digit numbers are treated as Indian (+91),
 * since DriveThrough launches in India.
 */
export function normalisePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-().]/g, '');
  if (/^[6-9]\d{9}$/.test(cleaned)) return `+91${cleaned}`;
  if (/^0[6-9]\d{9}$/.test(cleaned)) return `+91${cleaned.slice(1)}`;
  if (/^\+[1-9]\d{7,14}$/.test(cleaned)) return cleaned;
  return null;
}

export const emailSchema = z.string().trim().max(254).email('Enter a valid email address.').transform(normaliseEmail);

export const phoneSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const p = normalisePhone(v);
    if (!p) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid mobile number.' });
      return z.NEVER;
    }
    return p;
  });

/** Accepts either an email address or a phone number and detects which. */
export const identifierSchema = z
  .string()
  .trim()
  .min(1, 'Enter your email or mobile number.')
  .max(254)
  .transform((v, ctx): Contact => {
    if (v.includes('@')) {
      const r = emailSchema.safeParse(v);
      if (r.success) return { channel: 'email', value: r.data };
    } else {
      const p = normalisePhone(v);
      if (p) return { channel: 'phone', value: p };
    }
    ctx.addIssue({ code: 'custom', message: 'Enter a valid email or mobile number.' });
    return z.NEVER;
  });

export function maskContact(c: Contact): string {
  if (c.channel === 'email') {
    const [local, domain] = c.value.split('@');
    return `${local.slice(0, 2)}${'•'.repeat(Math.min(4, Math.max(1, local.length - 2)))}@${domain}`;
  }
  return `${c.value.slice(0, 3)}•••••${c.value.slice(-3)}`;
}
