import { Router } from 'express';

import { healthRouter } from './health.js';
import { v1Router } from './v1/index.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/v1', v1Router);
