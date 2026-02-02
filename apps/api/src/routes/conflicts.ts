import type { ConflictOfInterest } from '@ltip/shared';
import { Router, type Router as RouterType } from 'express';

import { validate } from '../middleware/validate.js';
import { listConflictsSchema, getConflictSchema } from '../schemas/conflicts.schema.js';

export const conflictsRouter: RouterType = Router();

// Get conflicts with filtering
conflictsRouter.get('/', validate(listConflictsSchema, 'query'), (req, res, next) => {
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
// ID validation: alphanumeric, dash, underscore only (prevents injection attacks)
conflictsRouter.get('/:id', validate(getConflictSchema, 'params'), (_req, res, next) => {
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
