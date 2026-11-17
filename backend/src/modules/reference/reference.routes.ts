import { Router } from 'express';
import { asc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { serviceStates } from '../../db/schema.js';
import { requireAuth } from '../../common/middleware/auth.js';

/** Centrally managed reference data (Feature 04 §3). Editing is an admin task (Feature 12). */
export const referenceRouter = Router();
referenceRouter.use(requireAuth);

// GET /reference/states
referenceRouter.get('/states', async (_req, res) => {
  const states = await db
    .select({ code: serviceStates.code, name: serviceStates.name, isEnabled: serviceStates.isEnabled })
    .from(serviceStates)
    .orderBy(asc(serviceStates.name));
  res.json({ states });
});
