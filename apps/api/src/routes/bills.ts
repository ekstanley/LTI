import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { ApiError } from '../middleware/error.js';
import { billService } from '../services/index.js';

export const billsRouter: RouterType = Router();

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
    const validated = listBillsSchema.parse(req.query);
    const result = await billService.list({
      limit: validated.limit,
      offset: validated.offset,
      ...(validated.congressNumber !== undefined && { congressNumber: validated.congressNumber }),
      ...(validated.billType !== undefined && { billType: validated.billType }),
      ...(validated.status !== undefined && { status: validated.status }),
      ...(validated.chamber !== undefined && { chamber: validated.chamber }),
      ...(validated.search !== undefined && { search: validated.search }),
    });
    res.json(result);
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
    const { id } = getBillSchema.parse(req.params);
    const bill = await billService.getById(id);

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
    const { id } = getBillSchema.parse(req.params);
    const cosponsors = await billService.getCosponsors(id);
    res.json({ data: cosponsors });
  } catch (error) {
    next(error);
  }
});

// Get bill actions/history
billsRouter.get('/:id/actions', validate(getBillSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = getBillSchema.parse(req.params);
    const actions = await billService.getActions(id);
    res.json({ data: actions });
  } catch (error) {
    next(error);
  }
});

// Get bill text versions
billsRouter.get('/:id/text', validate(getBillSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = getBillSchema.parse(req.params);
    const textVersions = await billService.getTextVersions(id);
    res.json({ data: textVersions });
  } catch (error) {
    next(error);
  }
});

// Get related bills
const relatedBillsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

billsRouter.get(
  '/:id/related',
  validate(getBillSchema, 'params'),
  validate(relatedBillsQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const { id } = getBillSchema.parse(req.params);
      const { limit } = relatedBillsQuerySchema.parse(req.query);
      const relatedBills = await billService.getRelatedBills(id, limit);
      res.json({ data: relatedBills });
    } catch (error) {
      next(error);
    }
  }
);
