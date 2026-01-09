import { randomUUID } from 'node:crypto';

import pino from 'pino';
import pinoHttp from 'pino-http';

import type { IncomingMessage, ServerResponse } from 'node:http';

const isProduction = process.env.NODE_ENV === 'production';
const isElectron = !!process.env.ELECTRON_USER_DATA_PATH;

// Main Logger Instance
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
  transport:
    isProduction && !isElectron
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  base: {
    service: 'api',
    env: process.env.NODE_ENV,
  },
});

// HTTP Request Logger Middleware
export const requestLogger = pinoHttp.default({
  logger,
  genReqId: (req: IncomingMessage, res: ServerResponse) => {
    const existingId = req.headers['x-request-id'] as string | undefined;
    if (existingId) return existingId;

    const id = randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  customLogLevel: (
    _req: IncomingMessage,
    res: ServerResponse,
    err?: Error
  ): pino.Level => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    // Use trace for redirects (lowest level to effectively silence)
    if (res.statusCode >= 300) return 'trace';
    return 'info';
  },
  customSuccessMessage: (req: IncomingMessage, res: ServerResponse) => {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  customErrorMessage: (
    req: IncomingMessage,
    res: ServerResponse,
    _err: Error
  ) => {
    return `${req.method} ${req.url} failed with ${res.statusCode}`;
  },
  // Redact sensitive headers for logging only (deep copy to avoid mutating original request!)
  serializers: {
    req: (req: IncomingMessage) => {
      const serialized = pino.stdSerializers.req(req);
      if (serialized.headers) {
        // IMPORTANT: Create a new headers object to avoid mutating the original request
        serialized.headers = { ...serialized.headers };
        if (serialized.headers.authorization) {
          serialized.headers.authorization = '[REDACTED]';
        }
        if (serialized.headers.cookie) {
          serialized.headers.cookie = '[REDACTED]';
        }
      }
      return serialized;
    },
  },
});

// Child loggers for different modules
export const dbLogger = logger.child({ module: 'db' });
export const apiLogger = logger.child({ module: 'api' });
export const authLogger = logger.child({ module: 'auth' });
export const sessionLogger = logger.child({ module: 'session' });
