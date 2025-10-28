import cors from 'cors';
import express from 'express';
import morgan from 'morgan';

import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { apiRouter } from './routes/index.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

app.use('/api', apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`API server listening on http://localhost:${env.port}`);
});
