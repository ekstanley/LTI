import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

type RequestLocation = 'body' | 'query' | 'params';

/**
 * Get request data from the specified location with type safety.
 * Express types req.body as `any`, req.query as `ParsedQs`, req.params as `ParamsDictionary`.
 * We return `unknown` to force callers to validate.
 */
function getRequestData(req: Request, location: RequestLocation): unknown {
  switch (location) {
    case 'body':
      return req.body as unknown;
    case 'query':
      return req.query;
    case 'params':
      return req.params;
  }
}

/**
 * Set validated data back on the request object.
 * Uses explicit property assignment to avoid dynamic indexing.
 */
function setRequestData(req: Request, location: RequestLocation, data: unknown): void {
  switch (location) {
    case 'body':
      req.body = data;
      break;
    case 'query':
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Express types req.query as ParsedQs; Zod output is structurally compatible but TypeScript can't verify this
      req.query = data as typeof req.query;
      break;
    case 'params':
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Express types req.params as ParamsDictionary; Zod output is structurally compatible but TypeScript can't verify this
      req.params = data as typeof req.params;
      break;
  }
}

export function validate<T extends z.ZodType>(
  schema: T,
  location: RequestLocation = 'body'
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const data = getRequestData(req, location);
    const result = schema.safeParse(data);

    if (!result.success) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: {
          errors: result.error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
      });
      return;
    }

    // Replace with parsed (and transformed) data
    setRequestData(req, location, result.data);
    next();
  };
}
