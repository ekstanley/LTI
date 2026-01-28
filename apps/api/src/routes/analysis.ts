import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { ApiError } from '../middleware/error.js';
import type { BillAnalysis } from '@ltip/shared';

export const analysisRouter: RouterType = Router();

// Get analysis by bill ID
const getAnalysisSchema = z.object({
  billId: z.string().min(1),
});

analysisRouter.get('/:billId', validate(getAnalysisSchema, 'params'), async (_req, res, next) => {
  try {
    // TODO: Replace with actual database query when analysis service is implemented
    const analysis: BillAnalysis | null = null;

    if (!analysis) {
      throw ApiError.notFound('Analysis');
    }

    res.json(analysis);
  } catch (error) {
    next(error);
  }
});

// Request new analysis (triggers AI processing)
analysisRouter.post('/:billId/generate', validate(getAnalysisSchema, 'params'), async (req, res, next) => {
  try {
    const { billId } = req.params;

    // TODO: Queue analysis job
    // This would typically add to a job queue (Bull, etc.)

    res.status(202).json({
      message: 'Analysis generation queued',
      billId,
      status: 'pending',
    });
  } catch (error) {
    next(error);
  }
});
