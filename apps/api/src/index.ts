import { createApp } from './app.js';
import { env } from './config/env.js';
import { apiLogger } from './utils/logger.js';

const start = async () => {
  try {
    const app = await createApp();

    app.listen(env.port, () => {
      apiLogger.info({ port: env.port }, `API server listening on http://localhost:${env.port}`);
    });
  } catch (error) {
    apiLogger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
};

start();
