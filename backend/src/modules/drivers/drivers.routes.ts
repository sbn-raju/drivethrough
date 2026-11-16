import { Router } from 'express';
import { and, eq, inArray, notInArray } from 'drizzle-orm';
import { z } from 'zod';
import { isProduction } from '../../config/env.js';
import { db } from '../../db/index.js';
import { driverDocuments, driverProfiles, driverServiceAreas, type DriverDocument } from '../../db/schema.js';
import { badRequest, conflict } from '../../common/errors/app-error.js';
import { requireAuth, requireRole } from '../../common/middleware/auth.js';
import { parse } from '../../common/middleware/validate.js';
import { IDENTITY_DOCUMENT_TYPES, INDIAN_STATES, LICENCE_CLASSES, STATE_CODES } from '../../common/constants.js';
import { encrypt } from '../../common/utils/crypto.js';
import { audit } from '../../services/audit.js';
import { storePrivateFile, upload } from '../../services/storage.js';

/** Feature 03 — driver onboarding. Drivers can never change their own approval status beyond submitting. */
export const driversRouter = Router();
driversRouter.use(requireAuth, requireRole('driver'));

const EDITABLE_STATUSES = new Set(['not_submitted', 'needs_resubmission', 'rejected']);
const today = () => new Date().toISOString().slice(0, 10);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date.');

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const profileSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name as on your licence.').max(120),
    dateOfBirth: isoDate.refine((d) => {
      const dob = new Date(d);
      const adult = new Date();
      adult.setFullYear(adult.getFullYear() - 18);
      return dob <= adult && dob.getFullYear() > 1930;
    }, 'You must be at least 18 years old.'),
    homeCity: z.string().trim().min(2, 'Enter your city.').max(80),
    homeState: z.enum(STATE_CODES, { message: 'Choose your state.' }),
    bio: z.string().trim().max(500).nullable(),
    experienceYears: z.coerce.number().int().min(0, 'Enter 0 or more.').max(60, 'Enter a realistic number of years.'),
    languages: z.array(z.string().trim().min(2).max(40)).min(1, 'Add at least one language.').max(10),
  })
  .partial();

const licenceSchema = z
  .object({
    documentNumber: z
      .string()
      .trim()
      .toUpperCase()
      .transform((v) => v.replace(/[\s-]/g, ''))
      .pipe(z.string().regex(/^[A-Z0-9]{8,20}$/, 'Enter your licence number as printed on the card.')),
    issuingAuthority: z.enum(STATE_CODES, { message: 'Choose the issuing state.' }),
    licenceClasses: z
      .string()
      .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean))
      .pipe(z.array(z.enum(LICENCE_CLASSES)).min(1, 'Choose at least one licence class.')),
    issueDate: isoDate.refine((d) => d <= today(), 'Issue date cannot be in the future.'),
    expiryDate: isoDate.refine((d) => d > today(), 'This licence has expired.'),
  })
  .refine((v) => v.issueDate < v.expiryDate, { path: ['expiryDate'], message: 'Expiry must be after the issue date.' });

const identitySchema = z.object({
  documentSubtype: z.enum(IDENTITY_DOCUMENT_TYPES, { message: 'Choose a document type.' }),
  documentNumber: z
    .string()
    .trim()
    .toUpperCase()
    .transform((v) => v.replace(/[\s-]/g, ''))
    .pipe(z.string().regex(/^[A-Z0-9]{6,20}$/, 'Enter the document number.')),
  expiryDate: isoDate
    .refine((d) => d > today(), 'This document has expired.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

const serviceAreasSchema = z.object({
  stateCodes: z.array(z.enum(STATE_CODES)).min(1, 'Choose at least one state.').max(STATE_CODES.length),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getProfile(userId: string) {
  await db.insert(driverProfiles).values({ userId }).onConflictDoNothing();
  const [profile] = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, userId)).limit(1);
  return profile;
}

function assertEditable(profile: typeof driverProfiles.$inferSelect) {
  if (!EDITABLE_STATUSES.has(profile.approvalStatus)) {
    throw conflict(
      profile.approvalStatus === 'pending_review'
        ? 'Your profile is under review and cannot be changed right now.'
        : 'Your verified profile cannot be changed here. Contact support to update it.',
      'PROFILE_LOCKED',
    );
  }
}

/** Never expose encrypted numbers or storage keys to the client. */
const presentDocument = (d: DriverDocument) => ({
  id: d.id,
  documentType: d.documentType,
  documentSubtype: d.documentSubtype,
  fileName: d.fileName,
  verificationStatus: d.verificationStatus,
  documentNumberLast4: d.documentNumberLast4,
  issuingAuthority: d.issuingAuthority,
  issueDate: d.issueDate,
  expiryDate: d.expiryDate,
  licenceClasses: (d.metadata?.licenceClasses as string[] | undefined) ?? [],
  isSynthetic: d.isSynthetic,
  reviewReason: d.reviewReason,
  updatedAt: d.updatedAt,
});

async function loadOnboarding(userId: string) {
  const profile = await getProfile(userId);
  const documents = await db.select().from(driverDocuments).where(eq(driverDocuments.driverId, userId));
  const areas = await db
    .select({ stateCode: driverServiceAreas.stateCode })
    .from(driverServiceAreas)
    .where(eq(driverServiceAreas.driverId, userId));

  const licence = documents.find((d) => d.documentType === 'driving_licence');
  const identity = documents.find((d) => d.documentType === 'identity_proof');

  const checklist = [
    {
      key: 'personal',
      label: 'Personal details',
      complete: !!(profile.fullName && profile.dateOfBirth && profile.homeCity && profile.homeState),
    },
    {
      key: 'professional',
      label: 'Photo and experience',
      complete: !!(profile.profilePhotoKey && profile.experienceYears !== null && profile.languages.length > 0),
    },
    {
      key: 'licence',
      label: 'Driving licence',
      complete: !!(licence && licence.expiryDate && licence.expiryDate > today()),
    },
    { key: 'identity', label: 'Identity document', complete: !!identity },
    { key: 'service_areas', label: 'Operating states', complete: areas.length > 0 },
  ];

  return {
    profile: {
      fullName: profile.fullName,
      dateOfBirth: profile.dateOfBirth,
      homeCity: profile.homeCity,
      homeState: profile.homeState,
      bio: profile.bio,
      experienceYears: profile.experienceYears,
      languages: profile.languages,
      hasProfilePhoto: !!profile.profilePhotoKey,
      approvalStatus: profile.approvalStatus,
      submittedAt: profile.submittedAt,
      reviewReason: profile.reviewReason,
    },
    documents: documents.map(presentDocument),
    serviceAreas: areas.map((a) => ({ stateCode: a.stateCode, name: INDIAN_STATES[a.stateCode as keyof typeof INDIAN_STATES] })),
    checklist,
    canSubmit: EDITABLE_STATUSES.has(profile.approvalStatus) && checklist.every((c) => c.complete),
    dummyKyc: !isProduction && documents.some((d) => d.isSynthetic),
  };
}

async function upsertDocument(values: typeof driverDocuments.$inferInsert, hasNewFile: boolean) {
  const existing = await db
    .select({ id: driverDocuments.id })
    .from(driverDocuments)
    .where(and(eq(driverDocuments.driverId, values.driverId), eq(driverDocuments.documentType, values.documentType)))
    .limit(1);

  if (!existing.length && !hasNewFile) throw badRequest('Attach a photo or scan of the document.', 'FILE_REQUIRED');

  // Any change resets the document to "submitted" — a reviewer has to look at it again.
  const reset = { verificationStatus: 'submitted' as const, reviewerId: null, reviewReason: null, reviewedAt: null };
  if (existing.length) {
    await db
      .update(driverDocuments)
      .set({ ...values, ...reset })
      .where(eq(driverDocuments.id, existing[0].id));
  } else {
    await db
      .insert(driverDocuments)
      .values({ ...values, ...reset })
      .onConflictDoUpdate({
        target: [driverDocuments.driverId, driverDocuments.documentType],
        set: { ...values, ...reset, updatedAt: new Date() },
      });
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// GET /drivers/me/onboarding
driversRouter.get('/me/onboarding', async (req, res) => {
  res.json(await loadOnboarding(req.user!.id));
});

// PATCH /drivers/me/profile
driversRouter.patch('/me/profile', async (req, res) => {
  const input = parse(profileSchema, req.body);
  const profile = await getProfile(req.user!.id);
  assertEditable(profile);
  if (input.languages) input.languages = [...new Set(input.languages)];
  await db.update(driverProfiles).set(input).where(eq(driverProfiles.userId, req.user!.id));
  res.json(await loadOnboarding(req.user!.id));
});

// POST /drivers/me/profile-photo (multipart: file)
driversRouter.post('/me/profile-photo', upload.single('file'), async (req, res) => {
  if (!req.file) throw badRequest('Choose a photo to upload.', 'FILE_REQUIRED');
  const profile = await getProfile(req.user!.id);
  assertEditable(profile);
  const stored = await storePrivateFile({ userId: req.user!.id, folder: 'profile-photo', file: req.file, kind: 'image' });
  await db.update(driverProfiles).set({ profilePhotoKey: stored.storageKey }).where(eq(driverProfiles.userId, req.user!.id));
  res.json(await loadOnboarding(req.user!.id));
});

// POST /drivers/me/documents/driving-licence (multipart: file + fields)
driversRouter.post('/me/documents/driving-licence', upload.single('file'), async (req, res) => {
  const input = parse(licenceSchema, req.body);
  const profile = await getProfile(req.user!.id);
  assertEditable(profile);

  const stored = req.file
    ? await storePrivateFile({ userId: req.user!.id, folder: 'driving-licence', file: req.file, kind: 'document' })
    : null;

  await upsertDocument(
    {
      driverId: req.user!.id,
      documentType: 'driving_licence',
      documentNumberEncrypted: encrypt(input.documentNumber),
      documentNumberLast4: input.documentNumber.slice(-4),
      issuingAuthority: input.issuingAuthority,
      issueDate: input.issueDate,
      expiryDate: input.expiryDate,
      metadata: { licenceClasses: input.licenceClasses },
      ...(stored && {
        storageKey: stored.storageKey,
        fileName: req.file!.originalname.slice(0, 200),
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        isSynthetic: stored.isSynthetic,
      }),
    } as typeof driverDocuments.$inferInsert,
    !!stored,
  );
  await audit(req, 'driver.document.uploaded', { actorUserId: req.user!.id, metadata: { documentType: 'driving_licence' } });
  res.json(await loadOnboarding(req.user!.id));
});

// POST /drivers/me/documents/identity-proof (multipart: file + fields)
driversRouter.post('/me/documents/identity-proof', upload.single('file'), async (req, res) => {
  const input = parse(identitySchema, req.body);
  const profile = await getProfile(req.user!.id);
  assertEditable(profile);

  const stored = req.file
    ? await storePrivateFile({ userId: req.user!.id, folder: 'identity-proof', file: req.file, kind: 'document' })
    : null;

  await upsertDocument(
    {
      driverId: req.user!.id,
      documentType: 'identity_proof',
      documentSubtype: input.documentSubtype,
      documentNumberEncrypted: encrypt(input.documentNumber),
      documentNumberLast4: input.documentNumber.slice(-4),
      expiryDate: input.expiryDate ?? null,
      ...(stored && {
        storageKey: stored.storageKey,
        fileName: req.file!.originalname.slice(0, 200),
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        isSynthetic: stored.isSynthetic,
      }),
    } as typeof driverDocuments.$inferInsert,
    !!stored,
  );
  await audit(req, 'driver.document.uploaded', { actorUserId: req.user!.id, metadata: { documentType: 'identity_proof' } });
  res.json(await loadOnboarding(req.user!.id));
});

// GET /drivers/me/documents
driversRouter.get('/me/documents', async (req, res) => {
  const documents = await db.select().from(driverDocuments).where(eq(driverDocuments.driverId, req.user!.id));
  res.json({ documents: documents.map(presentDocument) });
});

// PUT /drivers/me/service-areas
driversRouter.put('/me/service-areas', async (req, res) => {
  const { stateCodes } = parse(serviceAreasSchema, req.body);
  const profile = await getProfile(req.user!.id);
  assertEditable(profile);
  const unique = [...new Set(stateCodes)];

  await db.transaction(async (tx) => {
    await tx
      .delete(driverServiceAreas)
      .where(and(eq(driverServiceAreas.driverId, req.user!.id), notInArray(driverServiceAreas.stateCode, unique)));
    await tx
      .insert(driverServiceAreas)
      .values(unique.map((stateCode) => ({ driverId: req.user!.id, stateCode })))
      .onConflictDoNothing();
  });
  res.json(await loadOnboarding(req.user!.id));
});

// POST /drivers/me/submit — moves the profile to `pending_review`. Approval is reviewer-only.
driversRouter.post('/me/submit', async (req, res) => {
  const state = await loadOnboarding(req.user!.id);
  if (!state.canSubmit) {
    const missing = state.checklist.filter((c) => !c.complete).map((c) => c.label);
    throw badRequest(
      missing.length ? `Complete these steps first: ${missing.join(', ')}.` : 'Your profile has already been submitted.',
      'ONBOARDING_INCOMPLETE',
      { missing },
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .update(driverProfiles)
      .set({ approvalStatus: 'pending_review', submittedAt: new Date(), reviewReason: null })
      .where(eq(driverProfiles.userId, req.user!.id));
    await tx
      .update(driverDocuments)
      .set({ verificationStatus: 'pending_review' })
      .where(
        and(
          eq(driverDocuments.driverId, req.user!.id),
          inArray(driverDocuments.verificationStatus, ['submitted', 'needs_resubmission']),
        ),
      );
  });
  await audit(req, 'driver.onboarding.submitted', { actorUserId: req.user!.id, entityType: 'driver', entityId: req.user!.id });
  res.json(await loadOnboarding(req.user!.id));
});
