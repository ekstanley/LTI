import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import type { ConflictOfInterest } from '@ltip/shared';

export const conflictsRouter: RouterType = Router();

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
    const { limit, offset } = listConflictsSchema.parse(req.query);

    // TODO: Replace with actual database query when conflict detection service is implemented
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

conflictsRouter.get('/:id', validate(getConflictSchema, 'params'), async (_req, res, next) => {
  try {
    // TODO: Replace with actual database query when conflict detection service is implemented
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
