import { Router, type Router as RouterType } from 'express';

import { ApiError } from '../middleware/error.js';
import { validate } from '../middleware/validate.js';
import { listCommitteesSchema, standingCommitteesSchema, getCommitteeSchema, committeeMembersSchema, committeeReferralsSchema } from '../schemas/committees.schema.js';
import { committeeService } from '../services/index.js';

export const committeesRouter: RouterType = Router();

// Get all committees with filtering and pagination
committeesRouter.get('/', validate(listCommitteesSchema, 'query'), async (req, res, next) => {
  try {
    const validated = listCommitteesSchema.parse(req.query);
    const result = await committeeService.list({
      limit: validated.limit,
      offset: validated.offset,
      ...(validated.chamber !== undefined && { chamber: validated.chamber }),
      ...(validated.type !== undefined && { type: validated.type }),
      ...(validated.parentId !== undefined && { parentId: validated.parentId }),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get standing committees by chamber
committeesRouter.get('/standing', validate(standingCommitteesSchema, 'query'), async (req, res, next) => {
  try {
    const validated = standingCommitteesSchema.parse(req.query);
    const committees = await committeeService.getStandingCommittees(validated.chamber);
    res.json({ data: committees });
  } catch (error) {
    next(error);
  }
});

// Get single committee by ID
// ID validation: alphanumeric, dash, underscore only (prevents injection attacks)
committeesRouter.get('/:id', validate(getCommitteeSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = getCommitteeSchema.parse(req.params);
    const committee = await committeeService.getById(id);

    if (!committee) {
      throw ApiError.notFound('Committee');
    }

    res.json(committee);
  } catch (error) {
    next(error);
  }
});

// Get subcommittees for a committee
committeesRouter.get('/:id/subcommittees', validate(getCommitteeSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = getCommitteeSchema.parse(req.params);
    const subcommittees = await committeeService.getSubcommittees(id);
    res.json({ data: subcommittees });
  } catch (error) {
    next(error);
  }
});

// Get committee members
committeesRouter.get(
  '/:id/members',
  validate(getCommitteeSchema, 'params'),
  validate(committeeMembersSchema, 'query'),
  async (req, res, next) => {
    try {
      const { id } = getCommitteeSchema.parse(req.params);
      const { includeHistorical } = committeeMembersSchema.parse(req.query);
      const members = await committeeService.getMembers(id, includeHistorical);
      res.json({ data: members });
    } catch (error) {
      next(error);
    }
  }
);

// Get bills referred to committee
committeesRouter.get(
  '/:id/bills',
  validate(getCommitteeSchema, 'params'),
  validate(committeeReferralsSchema, 'query'),
  async (req, res, next) => {
    try {
      const { id } = getCommitteeSchema.parse(req.params);
      const { limit, offset } = committeeReferralsSchema.parse(req.query);
      const result = await committeeService.getReferredBills(id, limit, offset);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);
