import { Router, type Router as RouterType } from 'express';

import { ApiError } from '../middleware/error.js';
import { validate } from '../middleware/validate.js';
import { listVotesSchema, getVoteSchema, recentVotesChamberSchema, recentVotesQuerySchema, compareVotesSchema } from '../schemas/votes.schema.js';
import { voteService } from '../services/index.js';

export const votesRouter: RouterType = Router();

// Get all votes with filtering and pagination
votesRouter.get('/', validate(listVotesSchema, 'query'), async (req, res, next) => {
  try {
    const validated = listVotesSchema.parse(req.query);
    const result = await voteService.list({
      limit: validated.limit,
      offset: validated.offset,
      ...(validated.chamber !== undefined && { chamber: validated.chamber }),
      ...(validated.congressNumber !== undefined && { congressNumber: validated.congressNumber }),
      ...(validated.session !== undefined && { session: validated.session }),
      ...(validated.result !== undefined && { result: validated.result }),
      ...(validated.billId !== undefined && { billId: validated.billId }),
      ...(validated.voteDateAfter !== undefined && { voteDateAfter: validated.voteDateAfter }),
      ...(validated.voteDateBefore !== undefined && { voteDateBefore: validated.voteDateBefore }),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Compare voting records between two legislators
// ID validation: alphanumeric, dash, underscore only (prevents injection attacks)
// NOTE: This route must come before /:id to avoid shadowing
votesRouter.get('/compare', validate(compareVotesSchema, 'query'), async (req, res, next) => {
  try {
    const validated = compareVotesSchema.parse(req.query);
    const comparison = await voteService.compareVotingRecords(
      validated.legislator1,
      validated.legislator2,
      validated.congressNumber
    );
    res.json(comparison);
  } catch (error) {
    next(error);
  }
});

// Get recent votes by chamber
// NOTE: This route must come before /:id to avoid shadowing
votesRouter.get(
  '/recent/:chamber',
  validate(recentVotesChamberSchema, 'params'),
  validate(recentVotesQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const { chamber } = recentVotesChamberSchema.parse(req.params);
      const { limit } = recentVotesQuerySchema.parse(req.query);
      const votes = await voteService.getRecent(chamber, limit);
      res.json({ data: votes });
    } catch (error) {
      next(error);
    }
  }
);

// Get single vote by ID
// ID validation: alphanumeric, dash, underscore only (prevents injection attacks)
votesRouter.get('/:id', validate(getVoteSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = getVoteSchema.parse(req.params);
    const vote = await voteService.getById(id);

    if (!vote) {
      throw ApiError.notFound('Vote');
    }

    res.json(vote);
  } catch (error) {
    next(error);
  }
});

// Get vote breakdown (individual legislator votes)
votesRouter.get('/:id/breakdown', validate(getVoteSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = getVoteSchema.parse(req.params);
    const breakdown = await voteService.getVoteBreakdown(id);

    if (!breakdown) {
      throw ApiError.notFound('Vote');
    }

    res.json(breakdown);
  } catch (error) {
    next(error);
  }
});

// Get party breakdown for a vote
votesRouter.get('/:id/party-breakdown', validate(getVoteSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = getVoteSchema.parse(req.params);
    const partyBreakdown = await voteService.getPartyBreakdown(id);
    res.json({ data: partyBreakdown });
  } catch (error) {
    next(error);
  }
});
