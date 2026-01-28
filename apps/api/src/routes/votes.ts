import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { ApiError } from '../middleware/error.js';
import type { Vote, PaginatedResponse } from '@ltip/shared';

export const votesRouter = Router();

const listVotesSchema = z.object({
  chamber: z.enum(['house', 'senate']).optional(),
  billId: z.string().optional(),
  result: z.enum(['passed', 'failed', 'agreed_to', 'rejected']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// Get all votes with filtering and pagination
votesRouter.get('/', validate(listVotesSchema, 'query'), async (req, res, next) => {
  try {
    const { limit, offset } = req.query as z.infer<typeof listVotesSchema>;

    // TODO: Replace with actual database query
    const votes: Vote[] = [];
    const total = 0;

    const response: PaginatedResponse<Vote> = {
      data: votes,
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

// Get single vote by ID
const getVoteSchema = z.object({
  id: z.string().min(1),
});

votesRouter.get('/:id', validate(getVoteSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // TODO: Replace with actual database query
    const vote: Vote | null = null;

    if (!vote) {
      throw ApiError.notFound('Vote');
    }

    res.json(vote);
  } catch (error) {
    next(error);
  }
});

// Get individual legislator votes for a roll call
votesRouter.get('/:id/legislators', validate(getVoteSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // TODO: Replace with actual database query
    const legislatorVotes: unknown[] = [];

    res.json({ data: legislatorVotes });
  } catch (error) {
    next(error);
  }
});
