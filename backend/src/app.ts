import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './common/middleware/error-handler.js';
import { generalLimiter } from './common/middleware/rate-limit.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { consumersRouter } from './modules/consumers/consumers.routes.js';
import { driversRouter } from './modules/drivers/drivers.routes.js';
import { locationsRouter, routesRouter } from './modules/maps/maps.routes.js';
import { referenceRouter } from './modules/reference/reference.routes.js';
import { searchRouter } from './modules/search/search.routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || env.CORS_ORIGINS.includes(origin)),
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const v1 = express.Router();
  v1.use(generalLimiter);
  v1.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  v1.use('/auth', authRouter);
  v1.use('/consumers', consumersRouter);
  v1.use('/drivers', driversRouter);
  v1.use('/reference', referenceRouter);
  v1.use('/locations', locationsRouter);
  v1.use('/routes', routesRouter);
  v1.use('/search', searchRouter);
  app.use('/api/v1', v1);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
