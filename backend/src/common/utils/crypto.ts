import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** Opaque, URL-safe random token (used for refresh tokens). */
export const randomToken = (bytes = 48) => randomBytes(bytes).toString('base64url');

/** Six-digit numeric one-time code. */
export const generateOtp = () => randomInt(0, 1_000_000).toString().padStart(6, '0');

/** OTPs are stored as a keyed HMAC so a database leak does not expose usable codes. */
export const hashOtp = (code: string, scope: string) =>
  createHmac('sha256', env.OTP_PEPPER).update(`${scope}:${code}`).digest('hex');

export const safeEqualHex = (a: string, b: string) => {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ab.length === bb.length && timingSafeEqual(ab, bb);
};

const encryptionKey = Buffer.from(env.DATA_ENCRYPTION_KEY, 'base64');

/** AES-256-GCM. Output: base64(iv).base64(tag).base64(ciphertext) */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((b) => b.toString('base64')).join('.');
}

export function decrypt(payload: string): string {
  const [iv, tag, ciphertext] = payload.split('.').map((p) => Buffer.from(p, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
