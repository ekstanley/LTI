import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { ApiError } from '../middleware/error.js';
import { legislatorService } from '../services/index.js';

export const legislatorsRouter: RouterType = Router();

const listLegislatorsSchema = z.object({
  chamber: z.enum(['house', 'senate']).optional(),
  party: z.enum(['D', 'R', 'I', 'L', 'G']).optional(),
  state: z.string().length(2).toUpperCase().optional(),
  search: z.string().max(100).optional(),
  inOffice: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// Get all legislators with filtering and pagination
legislatorsRouter.get('/', validate(listLegislatorsSchema, 'query'), async (req, res, next) => {
  try {
    const validated = listLegislatorsSchema.parse(req.query);
    const result = await legislatorService.list({
      limit: validated.limit,
      offset: validated.offset,
      ...(validated.chamber !== undefined && { chamber: validated.chamber }),
      ...(validated.party !== undefined && { party: validated.party }),
      ...(validated.state !== undefined && { state: validated.state }),
      ...(validated.search !== undefined && { search: validated.search }),
      ...(validated.inOffice !== undefined && { inOffice: validated.inOffice }),
    });
    res.json(result);
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
    const { id } = getLegislatorSchema.parse(req.params);
    const legislator = await legislatorService.getById(id);

    if (!legislator) {
      throw ApiError.notFound('Legislator');
    }

    res.json(legislator);
  } catch (error) {
    next(error);
  }
});

// Get legislator with committees
legislatorsRouter.get('/:id/committees', validate(getLegislatorSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = getLegislatorSchema.parse(req.params);
    const legislator = await legislatorService.getWithCommittees(id);

    if (!legislator) {
      throw ApiError.notFound('Legislator');
    }

    res.json({ data: legislator.committees });
  } catch (error) {
    next(error);
  }
});

// Get legislator's sponsored bills
const legislatorBillsSchema = z.object({
  primaryOnly: z.coerce.boolean().default(false),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

legislatorsRouter.get(
  '/:id/bills',
  validate(getLegislatorSchema, 'params'),
  validate(legislatorBillsSchema, 'query'),
  async (req, res, next) => {
    try {
      const { id } = getLegislatorSchema.parse(req.params);
      const { primaryOnly, limit, offset } = legislatorBillsSchema.parse(req.query);
      const result = await legislatorService.getBills(id, primaryOnly, limit, offset);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get legislator's voting record
const legislatorVotesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

legislatorsRouter.get(
  '/:id/votes',
  validate(getLegislatorSchema, 'params'),
  validate(legislatorVotesSchema, 'query'),
  async (req, res, next) => {
    try {
      const { id } = getLegislatorSchema.parse(req.params);
      const { limit, offset } = legislatorVotesSchema.parse(req.query);
      const result = await legislatorService.getVotes(id, limit, offset);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Alias: voting-record -> votes (for API consistency)
legislatorsRouter.get(
  '/:id/voting-record',
  validate(getLegislatorSchema, 'params'),
  validate(legislatorVotesSchema, 'query'),
  async (req, res, next) => {
    try {
      const { id } = getLegislatorSchema.parse(req.params);
      const { limit, offset } = legislatorVotesSchema.parse(req.query);
      const result = await legislatorService.getVotes(id, limit, offset);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get legislator's statistics
legislatorsRouter.get('/:id/stats', validate(getLegislatorSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = getLegislatorSchema.parse(req.params);
    const stats = await legislatorService.getStats(id);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});
