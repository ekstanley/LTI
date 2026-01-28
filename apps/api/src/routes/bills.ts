import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { ApiError } from '../middleware/error.js';
import type { Bill, PaginatedResponse } from '@ltip/shared';

export const billsRouter = Router();

// Query params schema
const listBillsSchema = z.object({
  congressNumber: z.coerce.number().int().min(1).optional(),
  billType: z.enum(['hr', 's', 'hjres', 'sjres', 'hconres', 'sconres', 'hres', 'sres']).optional(),
  status: z.enum([
    'introduced',
    'in_committee',
    'passed_house',
    'passed_senate',
    'resolving_differences',
    'to_president',
    'became_law',
    'vetoed',
    'failed',
  ]).optional(),
  chamber: z.enum(['house', 'senate', 'joint']).optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// Get all bills with filtering and pagination
billsRouter.get('/', validate(listBillsSchema, 'query'), async (req, res, next) => {
  try {
    const { limit, offset } = req.query as z.infer<typeof listBillsSchema>;

    // TODO: Replace with actual database query
    const mockBills: Bill[] = [];
    const total = 0;

    const response: PaginatedResponse<Bill> = {
      data: mockBills,
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

// Get single bill by ID
const getBillSchema = z.object({
  id: z.string().min(1),
});

billsRouter.get('/:id', validate(getBillSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // TODO: Replace with actual database query
    const bill: Bill | null = null;

    if (!bill) {
      throw ApiError.notFound('Bill');
    }

    res.json(bill);
  } catch (error) {
    next(error);
  }
});

// Get bill cosponsors
billsRouter.get('/:id/cosponsors', validate(getBillSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // TODO: Replace with actual database query
    const cosponsors: unknown[] = [];

    res.json({ data: cosponsors });
  } catch (error) {
    next(error);
  }
});

// Get bill actions/history
billsRouter.get('/:id/actions', validate(getBillSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // TODO: Replace with actual database query
    const actions: unknown[] = [];

    res.json({ data: actions });
  } catch (error) {
    next(error);
  }
});
