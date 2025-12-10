import { createApp } from './app.js';
import { env } from './config/env.js';

const start = async () => {
  try {
    const app = await createApp();

    app.listen(env.port, () => {
      console.log(`API server listening on http://localhost:${env.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();
