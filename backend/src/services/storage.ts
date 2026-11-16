import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import multer from 'multer';
import { env, isProduction } from '../config/env.js';
import { AppError, badRequest } from '../common/errors/app-error.js';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Memory upload — files are validated, then streamed to private Supabase Storage. */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

type Kind = 'image' | 'document';

const signatures: { mime: string; ext: string; kind: Kind[]; test: (b: Buffer) => boolean }[] = [
  { mime: 'image/jpeg', ext: 'jpg', kind: ['image', 'document'], test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', ext: 'png', kind: ['image', 'document'], test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/webp', ext: 'webp', kind: ['image', 'document'], test: (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
  { mime: 'application/pdf', ext: 'pdf', kind: ['document'], test: (b) => b.toString('ascii', 0, 5) === '%PDF-' },
];

/** Validates by file content (magic bytes), not by the client-supplied MIME type or extension. */
export function detectFileType(file: Express.Multer.File, kind: Kind) {
  const match = signatures.find((s) => s.kind.includes(kind) && s.test(file.buffer));
  if (!match) {
    throw badRequest(
      kind === 'image' ? 'Upload a JPG, PNG or WebP image.' : 'Upload a JPG, PNG, WebP image or a PDF.',
      'UNSUPPORTED_FILE_TYPE',
    );
  }
  return match;
}

let client: SupabaseClient | null = null;
const storageConfigured = () => !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
const getClient = () =>
  (client ??= createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  }));

/**
 * Stores a KYC file in the private bucket and returns its object key (never a public URL).
 * Without Supabase Storage configured, non-production environments fall back to dummy KYC:
 * the file is discarded and the record is flagged `isSynthetic` (Feature 03, dummy KYC policy).
 */
export async function storePrivateFile(opts: { userId: string; folder: string; file: Express.Multer.File; kind: Kind }) {
  const type = detectFileType(opts.file, opts.kind);
  const key = `${opts.userId}/${opts.folder}/${randomUUID()}.${type.ext}`;

  if (!storageConfigured()) {
    if (isProduction) throw new AppError(503, 'STORAGE_UNAVAILABLE', 'Document uploads are temporarily unavailable.');
    return { storageKey: `synthetic/${key}`, mimeType: type.mime, sizeBytes: opts.file.size, isSynthetic: true };
  }

  const { error } = await getClient()
    .storage.from(env.SUPABASE_KYC_BUCKET)
    .upload(key, opts.file.buffer, { contentType: type.mime, upsert: false });
  if (error) {
    console.error('[storage] upload failed', error.message);
    throw new AppError(502, 'UPLOAD_FAILED', 'We could not upload your file. Please try again.');
  }
  return { storageKey: key, mimeType: type.mime, sizeBytes: opts.file.size, isSynthetic: false };
}

/** Short-lived signed URL for authorised viewers (the owner or a reviewer). */
export async function signedUrlFor(storageKey: string, expiresInSeconds = 120) {
  if (storageKey.startsWith('synthetic/') || !storageConfigured()) return null;
  const { data, error } = await getClient().storage.from(env.SUPABASE_KYC_BUCKET).createSignedUrl(storageKey, expiresInSeconds);
  return error ? null : data.signedUrl;
}
