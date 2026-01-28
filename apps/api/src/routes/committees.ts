import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { ApiError } from '../middleware/error.js';
import { committeeService } from '../services/index.js';

export const committeesRouter: RouterType = Router();

const listCommitteesSchema = z.object({
  chamber: z.enum(['house', 'senate', 'joint']).optional(),
  type: z.enum(['standing', 'select', 'special', 'subcommittee']).optional(),
  parentId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

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
const standingCommitteesSchema = z.object({
  chamber: z.enum(['house', 'senate']).optional(),
});

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
const getCommitteeSchema = z.object({
  id: z.string().min(1),
});

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
const committeeMembersSchema = z.object({
  includeHistorical: z.coerce.boolean().default(false),
});

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
const committeeReferralsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

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
