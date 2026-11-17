import { Router } from 'express';
import { z } from 'zod';
import { requireActiveAccount, requireAuth, requireRole } from '../../common/middleware/auth.js';
import { mapsLimiters } from '../../common/middleware/rate-limit.js';
import { parse } from '../../common/middleware/validate.js';
import { autocomplete, staticMap } from './uber.client.js';
import { createRouteEstimate, loadOwnedEstimate, presentEstimate } from './route-estimate.service.js';

/**
 * Feature 05 — location search and route estimation. Uber's client secret stays on the server, so the
 * browser never calls the maps provider directly: suggestions are proxied, and coordinates, distance and
 * duration are always resolved here from place ids (never accepted from the client).
 */

const placeId = z.string().trim().min(3, 'Choose a location from the list.').max(200);

const suggestionsQuery = z.object({
  q: z.string().trim().min(2, 'Type at least 2 characters.').max(120),
  context: z.enum(['origin', 'destination']).default('origin'),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

const estimateSchema = z.object({ pickupPlaceId: placeId, dropPlaceId: placeId });
const idParam = z.object({ id: z.uuid('Route not found.') });
const staticMapQuery = z.object({
  w: z.coerce.number().int().min(200).max(1280).default(640),
  h: z.coerce.number().int().min(120).max(1280).default(320),
});

// GET /locations/suggestions?q=…&context=origin|destination
export const locationsRouter = Router();
locationsRouter.use(requireAuth, requireRole('consumer'));
locationsRouter.get('/suggestions', mapsLimiters.suggestions, async (req, res) => {
  const q = parse(suggestionsQuery, req.query);
  const near = q.lat !== undefined && q.lng !== undefined ? { latitude: q.lat, longitude: q.lng } : undefined;
  const suggestions = await autocomplete({ query: q.q, context: q.context, near });
  res.json({ suggestions });
});

export const routesRouter = Router();
routesRouter.use(requireAuth, requireRole('consumer'), requireActiveAccount);

// POST /routes/estimate — { pickupPlaceId, dropPlaceId }
routesRouter.post('/estimate', mapsLimiters.estimate, async (req, res) => {
  const input = parse(estimateSchema, req.body);
  const row = await createRouteEstimate(req.user!.id, input);
  res.status(201).json({ estimate: await presentEstimate(row) });
});

// GET /routes/estimates/:id
routesRouter.get('/estimates/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  const row = await loadOwnedEstimate(req.user!.id, id, { allowExpired: true });
  res.json({ estimate: await presentEstimate(row), expired: row.expiresAt <= new Date() });
});

// GET /routes/estimates/:id/static-map?w=&h= — signed Uber static map URL (generated per request, not stored)
routesRouter.get('/estimates/:id/static-map', mapsLimiters.staticMap, async (req, res) => {
  const { id } = parse(idParam, req.params);
  const { w, h } = parse(staticMapQuery, req.query);
  const row = await loadOwnedEstimate(req.user!.id, id, { allowExpired: true });
  const url = await staticMap({
    width: w,
    height: h,
    originPlaceId: row.pickup.placeId,
    destinationPlaceId: row.drop.placeId,
    origin: { latitude: row.pickup.latitude, longitude: row.pickup.longitude },
    destination: { latitude: row.drop.latitude, longitude: row.drop.longitude },
  });
  res.json({ url });
});

// POST /routes/validate-coverage — { routeEstimateId } → which states the trip needs and whether we serve them
routesRouter.post('/validate-coverage', async (req, res) => {
  const { routeEstimateId } = parse(z.object({ routeEstimateId: z.uuid('Route not found.') }), req.body);
  const row = await loadOwnedEstimate(req.user!.id, routeEstimateId, { allowExpired: true });
  const { routeStates, coverage } = await presentEstimate(row);
  res.json({ routeStates, coverage });
});
