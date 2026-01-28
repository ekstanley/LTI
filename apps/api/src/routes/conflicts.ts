import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import type { ConflictOfInterest } from '@ltip/shared';

export const conflictsRouter = Router();

const listConflictsSchema = z.object({
  legislatorId: z.string().optional(),
  billId: z.string().optional(),
  type: z.enum(['stock_holding', 'family_employment', 'lobbying_contact', 'campaign_donation']).optional(),
  severity: z.enum(['high', 'medium', 'low']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// Get conflicts with filtering
conflictsRouter.get('/', validate(listConflictsSchema, 'query'), async (req, res, next) => {
  try {
    const { limit, offset } = req.query as z.infer<typeof listConflictsSchema>;

    // TODO: Replace with actual database query
    const conflicts: ConflictOfInterest[] = [];
    const total = 0;

    res.json({
      data: conflicts,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get single conflict by ID
const getConflictSchema = z.object({
  id: z.string().min(1),
});

conflictsRouter.get('/:id', validate(getConflictSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // TODO: Replace with actual database query
    const conflict: ConflictOfInterest | null = null;

    if (!conflict) {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Conflict of interest not found',
      });
      return;
    }

    res.json(conflict);
  } catch (error) {
    next(error);
  }
});
