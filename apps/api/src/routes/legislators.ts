import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { ApiError } from '../middleware/error.js';
import type { Legislator, PaginatedResponse } from '@ltip/shared';

export const legislatorsRouter = Router();

const listLegislatorsSchema = z.object({
  chamber: z.enum(['house', 'senate']).optional(),
  party: z.enum(['D', 'R', 'I', 'L', 'G']).optional(),
  state: z.string().length(2).toUpperCase().optional(),
  search: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// Get all legislators with filtering and pagination
legislatorsRouter.get('/', validate(listLegislatorsSchema, 'query'), async (req, res, next) => {
  try {
    const { limit, offset } = req.query as z.infer<typeof listLegislatorsSchema>;

    // TODO: Replace with actual database query
    const legislators: Legislator[] = [];
    const total = 0;

    const response: PaginatedResponse<Legislator> = {
      data: legislators,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Get single legislator by ID
const getLegislatorSchema = z.object({
  id: z.string().min(1),
});

legislatorsRouter.get('/:id', validate(getLegislatorSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // TODO: Replace with actual database query
    const legislator: Legislator | null = null;

    if (!legislator) {
      throw ApiError.notFound('Legislator');
    }

    res.json(legislator);
  } catch (error) {
    next(error);
  }
});

// Get legislator's sponsored bills
legislatorsRouter.get('/:id/bills', validate(getLegislatorSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // TODO: Replace with actual database query
    const bills: unknown[] = [];

    res.json({ data: bills });
  } catch (error) {
    next(error);
  }
});

// Get legislator's voting record
legislatorsRouter.get('/:id/votes', validate(getLegislatorSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // TODO: Replace with actual database query
    const votes: unknown[] = [];

    res.json({ data: votes });
  } catch (error) {
    next(error);
  }
});
