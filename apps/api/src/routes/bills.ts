import { Router, type Router as RouterType } from 'express';

import { ApiError } from '../middleware/error.js';
import { validateBillIdParam } from '../middleware/routeValidation.js';
import { validate } from '../middleware/validate.js';
import { listBillsSchema, getBillSchema, relatedBillsQuerySchema } from '../schemas/bills.schema.js';
import { billService } from '../services/index.js';

export const billsRouter: RouterType = Router();

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
billsRouter.get('/:id', validateBillIdParam, validate(getBillSchema, 'params'), async (req, res, next) => {
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

// Get all bill sponsors (primary + cosponsors)
billsRouter.get('/:id/sponsors', validateBillIdParam, validate(getBillSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = getBillSchema.parse(req.params);
    const sponsors = await billService.getSponsors(id);
    res.json({ data: sponsors });
  } catch (error) {
    next(error);
  }
});

// Get bill cosponsors (non-primary sponsors only)
billsRouter.get('/:id/cosponsors', validateBillIdParam, validate(getBillSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = getBillSchema.parse(req.params);
    const cosponsors = await billService.getCosponsors(id);
    res.json({ data: cosponsors });
  } catch (error) {
    next(error);
  }
});

// Get bill actions/history
billsRouter.get('/:id/actions', validateBillIdParam, validate(getBillSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = getBillSchema.parse(req.params);
    const actions = await billService.getActions(id);
    res.json({ data: actions });
  } catch (error) {
    next(error);
  }
});

// Get bill text versions
billsRouter.get('/:id/text', validateBillIdParam, validate(getBillSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = getBillSchema.parse(req.params);
    const textVersions = await billService.getTextVersions(id);
    res.json({ data: textVersions });
  } catch (error) {
    next(error);
  }
});

// Get related bills
billsRouter.get(
  '/:id/related',
  validateBillIdParam,
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
