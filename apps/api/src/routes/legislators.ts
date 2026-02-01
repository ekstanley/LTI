import { Router, type Router as RouterType } from 'express';

import { ApiError } from '../middleware/error.js';
import { validateLegislatorIdParam } from '../middleware/routeValidation.js';
import { validate } from '../middleware/validate.js';
import { listLegislatorsSchema, getLegislatorSchema, legislatorBillsSchema, legislatorVotesSchema } from '../schemas/legislators.schema.js';
import { legislatorService } from '../services/index.js';

export const legislatorsRouter: RouterType = Router();

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
// ID validation: bioguideId format (1 uppercase letter + 6 digits) or alphanumeric
legislatorsRouter.get('/:id', validateLegislatorIdParam, validate(getLegislatorSchema, 'params'), async (req, res, next) => {
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
legislatorsRouter.get('/:id/committees', validateLegislatorIdParam, validate(getLegislatorSchema, 'params'), async (req, res, next) => {
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
legislatorsRouter.get(
  '/:id/bills',
  validateLegislatorIdParam,
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
legislatorsRouter.get(
  '/:id/votes',
  validateLegislatorIdParam,
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
  validateLegislatorIdParam,
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
legislatorsRouter.get('/:id/stats', validateLegislatorIdParam, validate(getLegislatorSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = getLegislatorSchema.parse(req.params);
    const stats = await legislatorService.getStats(id);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});
