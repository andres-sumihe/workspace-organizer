import { afterAll } from 'vitest';

import { closeDb } from '../db/client.js';

process.env.NODE_ENV = 'test';

afterAll(async () => {
  await closeDb();
});
