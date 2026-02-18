import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { meRouter } from './routes/me.js';
import { tenantRouter } from './routes/tenant.js';
import { adminRouter } from './routes/admin.js';
import { metricsRouter } from './routes/metrics.js';
import { tenantsRouter } from './routes/tenants.js';
import { errorHandler } from './middleware/error-handler.js';

export const createApp = () => {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/auth', authRouter);
  app.use('/me', meRouter);
  app.use('/tenants', tenantsRouter);
  app.use('/tenant', tenantRouter);
  app.use('/admin', adminRouter);
  app.use('/metrics', metricsRouter);
  app.use(errorHandler);

  return app;
};
