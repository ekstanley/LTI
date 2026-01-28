import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

type RequestLocation = 'body' | 'query' | 'params';

export function validate<T extends z.ZodType>(
  schema: T,
  location: RequestLocation = 'body'
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const data = req[location];
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
    req[location] = result.data;
    next();
  };
}
