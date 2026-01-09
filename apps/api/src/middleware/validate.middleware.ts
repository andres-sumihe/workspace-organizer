import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema, ZodError } from 'zod';

/**
 * Zod validation middleware for Express
 * 
 * Validates request body against a Zod schema and replaces
 * req.body with the parsed (and typed) data.
 * 
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 */
export const validate = <T>(schema: ZodSchema<T>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = formatZodError(result.error);
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: errors,
      });
      return;
    }

    // Replace body with parsed/validated data
    req.body = result.data;
    next();
  };
};

/**
 * Validate query parameters
 */
export const validateQuery = <T>(schema: ZodSchema<T>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const errors = formatZodError(result.error);
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Query parameter validation failed',
        details: errors,
      });
      return;
    }

    // Replace query with parsed data
    req.query = result.data as typeof req.query;
    next();
  };
};

/**
 * Validate URL parameters
 */
export const validateParams = <T>(schema: ZodSchema<T>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      const errors = formatZodError(result.error);
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'URL parameter validation failed',
        details: errors,
      });
      return;
    }

    // Replace params with parsed data
    req.params = result.data as typeof req.params;
    next();
  };
};

/**
 * Format Zod errors into a consistent API response format
 */
const formatZodError = (error: ZodError) => {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
};
