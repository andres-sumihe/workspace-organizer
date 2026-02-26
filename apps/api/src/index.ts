import { createApp } from './app.js';
import { env } from './config/env.js';
import { apiLogger } from './utils/logger.js';
import { setupCollaborationWebSocket } from './services/collaboration.service.js';

const start = async () => {
  try {
    const app = await createApp();

    const server = app.listen(env.port, () => {
      apiLogger.info({ port: env.port }, `API server listening on http://localhost:${env.port}`);
    });

    // Attach WebSocket upgrade handler for collaboration
    setupCollaborationWebSocket(server);
  } catch (error) {
    apiLogger.error({ err: error }, 'Failed to start server');
    throw error;
  }
};

start();
