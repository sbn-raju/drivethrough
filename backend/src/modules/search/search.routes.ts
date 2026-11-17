import { Router } from 'express';
import { z } from 'zod';
import { tripType } from '../../db/schema.js';
import { requireActiveAccount, requireAuth, requireRole } from '../../common/middleware/auth.js';
import { mapsLimiters } from '../../common/middleware/rate-limit.js';
import { parse } from '../../common/middleware/validate.js';
import { searchDrivers } from './search.service.js';

/** Feature 06 — POST /search/drivers. Consumers only; suspended accounts cannot search to book. */
export const searchRouter = Router();
searchRouter.use(requireAuth, requireRole('consumer'), requireActiveAccount);

const instant = z.iso.datetime({ offset: true, message: 'Enter a valid date and time.' }).transform((v) => new Date(v));

const searchSchema = z.object({
  routeEstimateId: z.uuid('Plan your route first.'),
  tripType: z.enum(tripType.enumValues, { message: 'Choose one-way or round-trip.' }),
  pickupAt: instant,
  returnAt: instant.optional().nullable().transform((v) => v ?? undefined),
  vehicleId: z.uuid('Choose a vehicle.'),
  language: z
    .string()
    .trim()
    .max(40)
    .optional()
    .nullable()
    .transform((v) => v || undefined),
});

searchRouter.post('/drivers', mapsLimiters.search, async (req, res) => {
  const input = parse(searchSchema, req.body);
  res.json(await searchDrivers(req.user!.id, input));
});
