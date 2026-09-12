import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { env } from '@/config/env.js';
import { dependencies as productionDependencies } from './dependencies.js';
import type { AppDependencies } from './dependencies.js';
import type { Express } from 'express';
import { openapi } from '@/docs/openapi.js';
import { createUserRouter } from '@/modules/users/user.routes.js';
import { errorHandler, notFound, requestId } from '@/shared/http.js';
import { logger } from '@/shared/logger.js';
export function createApp(dependencies: AppDependencies = productionDependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);
  app.use(
    requestId,
    pinoHttp({ logger }),
    helmet(),
    cors({
      origin(origin, cb) {
        cb(null, !origin || env.CORS_ORIGINS.includes(origin));
      },
    }),
    rateLimit({ windowMs: 60000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }),
    express.json({ limit: '10mb' }),
    express.urlencoded({ extended: false, limit: '10mb' }),
  );
  app.get('/', (_q, r) =>
    r.json({ success: true, data: { name: 'Express TypeScript PostgreSQL Starter' } }),
  );
  app.get('/health/live', (_q, r) => r.json({ success: true, data: { status: 'alive' } }));
  app.get('/health/ready', async (_q, r) => {
    const ready = await dependencies.checkDatabase();
    r.status(ready ? 200 : 503).json({
      success: ready,
      data: { status: ready ? 'ready' : 'not_ready' },
    });
  });
  app.get('/health', (_q, r) => r.redirect(307, '/health/ready'));
  app.get('/docs/openapi.json', (_q, r) => r.json(openapi));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));
  app.use(`${env.API_PREFIX}/users`, createUserRouter(dependencies.userService));
  app.use(notFound, errorHandler);
  return app;
}
