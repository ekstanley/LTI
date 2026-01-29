/**
 * Import Votes
 *
 * Fetches all roll call votes from Congress.gov for targeted congresses (118, 119)
 * and upserts them into the database.
 *
 * IMPORTANT: The Congress.gov API only provides House vote endpoints (house-vote).
 * Senate roll call votes are NOT available through this API and would require
 * scraping senate.gov directly if needed.
 *
 * Import Strategy:
 * 1. Iterate over each target congress (118, 119)
 * 2. For each session (1, 2), fetch House roll call votes
 * 3. Upsert RollCallVote records
 * 4. For each roll call, fetch and upsert individual Vote positions
 * 5. Track progress in checkpoint with congress/chamber/session/offset
 *
 * @module scripts/import-votes
 */

import { config } from '../src/config.js';
import {
  getCongressApiLimiter,
  fetchWithRetry,
} from '../src/ingestion/index.js';
import { prisma } from '../src/db/client.js';
import { getCheckpointManager } from './checkpoint-manager.js';
import {
  TARGET_CONGRESSES,
  BATCH_SIZES,
  DB_BATCH_SIZES,
  ESTIMATED_COUNTS,
  DRY_RUN_CONFIG,
  LOG_CONFIG,
  type ImportOptions,
  type TargetCongress,
} from './import-config.js';
import type { Chamber, VotePosition, VoteResult, VoteType, VoteCategory } from '@prisma/client';

// =============================================================================
// TYPES (inline for Congress.gov vote API responses)
// =============================================================================

/**
 * Congress.gov roll call vote list item
 */
interface CongressVoteListItem {
  congress: number;
  chamber: string;
  sessionNumber: number;
  rollCallNumber: number;
  date: string;
  updateDate?: string;
  question?: string;
  description?: string;
  result?: string;
  url?: string;
}

/**
 * Congress.gov roll call vote detail
 */
interface CongressVoteDetail {
  congress: number;
  chamber: string;
  sessionNumber: number;
  rollCallNumber: number;
  date: string;
  question: string;
  description?: string;
  result: string;
  voteType?: string;
  category?: string;
  totalYea: number;
  totalNay: number;
  totalPresent?: number;
  totalNotVoting?: number;
  tieBreakerVp?: string;
  bill?: {
    congress: number;
    type: string;
    number: number;
  };
  members?: CongressVoteMember[];
}

/**
 * Congress.gov vote member position
 */
interface CongressVoteMember {
  bioguideId: string;
  fullName?: string;
  party?: string;
  state?: string;
  votePosition: string;
  isProxy?: boolean;
  pairedWith?: string;
}

/**
 * Congress.gov API response wrapper for vote list
 * Note: API returns "houseRollCallVotes" for House chamber votes
 */
interface VoteListResponse {
  houseRollCallVotes: CongressVoteListItem[];
  pagination?: {
    count: number;
    next?: string;
    prev?: string;
  };
}

/**
 * Congress.gov API response wrapper for vote detail
 * Note: API returns "houseRollCallVote" for House chamber vote details
 */
interface VoteDetailResponse {
  houseRollCallVote: CongressVoteDetail;
}

// =============================================================================
// TYPES (internal)
// =============================================================================

interface ImportStats {
  rollCallsProcessed: number;
  rollCallsCreated: number;
  rollCallsUpdated: number;
  rollCallsSkipped: number;
  positionsProcessed: number;
  positionsCreated: number;
  positionsUpdated: number;
  positionsSkipped: number;
  errors: string[];
  byCongressChamber: Map<string, {
    rollCalls: number;
    positions: number;
  }>;
}

// Note: Congress.gov API only provides House vote endpoints (house-vote).
// Senate votes are not available through the Congress.gov API.
// If Senate vote data is needed, it would require scraping senate.gov directly.
type ChamberKey = 'house';

const CHAMBERS: ChamberKey[] = ['house'];
const SESSIONS: number[] = [1, 2];

// =============================================================================
// LOGGING
// =============================================================================

function log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown): void {
  const levels = { debug: 0, info: 1, warn: 2, error: 3 };
  if (levels[level] >= levels[LOG_CONFIG.level]) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [votes]`;
    if (data) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
}

function logProgress(
  current: number,
  total: number,
  context?: string
): void {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  const progressBar = '█'.repeat(Math.floor(percent / 5)) + '░'.repeat(20 - Math.floor(percent / 5));
  const ctx = context ? ` [${context}]` : '';
  log('info', `[${progressBar}] ${percent}% (${current}/${total})${ctx}`);
}

// =============================================================================
// API FETCHING
// =============================================================================

const rateLimiter = getCongressApiLimiter();

/**
 * Build API URL with authentication
 */
function buildApiUrl(endpoint: string, params: Record<string, string | number> = {}): string {
  // Note: URL constructor replaces base path when endpoint starts with /
  // So we concatenate manually to preserve the /v3 path segment
  const url = new URL(`${config.congress.baseUrl}${endpoint}`);

  if (config.congress.apiKey) {
    url.searchParams.set('api_key', config.congress.apiKey);
  }

  url.searchParams.set('format', 'json');

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

/**
 * Fetch with rate limiting and retry
 */
async function apiFetch<T>(url: string): Promise<T> {
  await rateLimiter.acquire();

  const response = await fetchWithRetry(url, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Fetch list of roll call votes for a congress/chamber/session
 */
async function* listVotes(
  congress: number,
  chamber: ChamberKey,
  session: number,
  options: { limit?: number; offset?: number } = {}
): AsyncGenerator<CongressVoteListItem, void, unknown> {
  const limit = options.limit ?? BATCH_SIZES.votes;
  let offset = options.offset ?? 0;
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 3;

  while (true) {
    // Congress.gov API requires session in path: /{chamber}-vote/{congress}/{session}
    const endpoint = `/${chamber}-vote/${congress}/${session}`;
    const url = buildApiUrl(endpoint, {
      limit,
      offset,
    });

    log('debug', `Fetching votes: ${url}`);

    let response: VoteListResponse;
    try {
      response = await apiFetch<VoteListResponse>(url);
      consecutiveErrors = 0; // Reset on success
    } catch (error) {
      // WP7-A-002 FIX: More robust 404 detection and consecutive error handling
      const errorMsg = error instanceof Error ? error.message : String(error);
      const is404 = errorMsg.includes('404') || errorMsg.includes('Not Found');

      if (is404) {
        // 404 at any offset means end of data for this congress/chamber/session
        log('info', `End of votes data at offset ${offset} (404 - no more pages)`);
        break;
      }

      // Track consecutive errors at the SAME offset (WP7-A-005 FIX: prevent data loss)
      consecutiveErrors++;
      log('warn', `Failed to fetch votes at offset ${offset} (attempt ${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}): ${errorMsg}`);

      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        // After max retries at the same offset, this is a persistent error
        // Log and stop to prevent infinite loops - manual intervention required
        log('error', `Stopping votes pagination after ${MAX_CONSECUTIVE_ERRORS} consecutive errors at offset ${offset}. Manual retry may be needed.`);
        break;
      }

      // WP7-A-005 FIX: Retry the SAME offset for transient errors (429, 500, etc.)
      // Do NOT advance offset - this would permanently skip data
      continue;
    }

    const votes = response.houseRollCallVotes ?? [];

    // Filter by session
    const sessionVotes = votes.filter(v => v.sessionNumber === session);

    for (const vote of sessionVotes) {
      yield vote;
    }

    // Check if more pages exist
    if (!response.pagination?.next || votes.length < limit) {
      break;
    }

    offset += limit;
  }
}

/**
 * Fetch detailed vote information including member positions
 */
async function getVoteDetail(
  congress: number,
  chamber: ChamberKey,
  session: number,
  rollCallNumber: number
): Promise<CongressVoteDetail | null> {
  // Congress.gov API requires: /{chamber}-vote/{congress}/{session}/{rollCallNumber}
  const endpoint = `/${chamber}-vote/${congress}/${session}/${rollCallNumber}`;
  const url = buildApiUrl(endpoint);

  try {
    const response = await apiFetch<VoteDetailResponse>(url);
    return response.houseRollCallVote ?? null;
  } catch (error) {
    log('warn', `Failed to fetch vote detail ${chamber}-${congress}-${session}-${rollCallNumber}: ${error}`);
    return null;
  }
}

// =============================================================================
// DATA TRANSFORMATION
// =============================================================================

/**
 * Map API chamber string to Prisma Chamber enum
 */
function mapChamber(chamber: string): Chamber {
  const normalized = chamber.toLowerCase();
  if (normalized === 'house' || normalized === 'h') {
    return 'HOUSE';
  }
  if (normalized === 'senate' || normalized === 's') {
    return 'SENATE';
  }
  return 'HOUSE'; // default
}

/**
 * Map API result string to Prisma VoteResult enum
 */
function mapVoteResult(result: string): VoteResult {
  const normalized = result.toLowerCase();
  if (normalized.includes('passed') || normalized.includes('agreed')) {
    return 'PASSED';
  }
  if (normalized.includes('failed') || normalized.includes('rejected')) {
    return 'FAILED';
  }
  if (normalized.includes('agreed')) {
    return 'AGREED_TO';
  }
  if (normalized.includes('rejected')) {
    return 'REJECTED';
  }
  return 'PASSED'; // default
}

/**
 * Map API vote type string to Prisma VoteType enum
 *
 * Schema enum values: ROLL_CALL, VOICE, UNANIMOUS_CONSENT, DIVISION
 */
function mapVoteType(voteType?: string): VoteType {
  if (!voteType) return 'ROLL_CALL';

  const normalized = voteType.toLowerCase();
  // Yea/Nay votes are roll call votes
  if (normalized.includes('yea') || normalized.includes('nay')) {
    return 'ROLL_CALL';
  }
  if (normalized.includes('voice')) {
    return 'VOICE';
  }
  if (normalized.includes('unanimous')) {
    return 'UNANIMOUS_CONSENT';
  }
  if (normalized.includes('division')) {
    return 'DIVISION';
  }
  // "Recorded" votes are roll call votes
  if (normalized.includes('recorded') || normalized.includes('roll')) {
    return 'ROLL_CALL';
  }
  return 'ROLL_CALL'; // Default to roll call (most common)
}

/**
 * Map API vote category to Prisma VoteCategory enum
 *
 * Schema enum values: PASSAGE, AMENDMENT, PROCEDURAL, CLOTURE, NOMINATION,
 *   TREATY, VETO_OVERRIDE, MOTION_TO_RECOMMIT, MOTION_TO_TABLE, IMPEACHMENT
 */
function mapVoteCategory(category?: string): VoteCategory {
  if (!category) return 'PASSAGE';

  const normalized = category.toLowerCase();
  if (normalized.includes('amendment')) {
    return 'AMENDMENT';
  }
  if (normalized.includes('passage') || normalized.includes('final')) {
    return 'PASSAGE';
  }
  if (normalized.includes('cloture')) {
    return 'CLOTURE';
  }
  // Specific motion types
  if (normalized.includes('motion to recommit') || normalized.includes('recommit')) {
    return 'MOTION_TO_RECOMMIT';
  }
  if (normalized.includes('motion to table') || normalized.includes('table')) {
    return 'MOTION_TO_TABLE';
  }
  // Generic motions map to PROCEDURAL
  if (normalized.includes('motion') || normalized.includes('procedural')) {
    return 'PROCEDURAL';
  }
  if (normalized.includes('nomination')) {
    return 'NOMINATION';
  }
  if (normalized.includes('treaty')) {
    return 'TREATY';
  }
  if (normalized.includes('veto')) {
    return 'VETO_OVERRIDE';
  }
  if (normalized.includes('impeachment')) {
    return 'IMPEACHMENT';
  }
  return 'PASSAGE';
}

/**
 * Map API vote position string to Prisma VotePosition enum
 */
function mapVotePosition(position: string): VotePosition {
  const normalized = position.toLowerCase();
  if (normalized === 'yea' || normalized === 'aye' || normalized === 'yes') {
    return 'YEA';
  }
  if (normalized === 'nay' || normalized === 'no') {
    return 'NAY';
  }
  if (normalized === 'present') {
    return 'PRESENT';
  }
  return 'NOT_VOTING';
}

/**
 * Generate roll call vote ID
 * Format: h118-1-123 (chamber + congress + session + roll number)
 */
function generateRollCallId(
  chamber: ChamberKey,
  congress: number,
  session: number,
  rollNumber: number
): string {
  const chamberPrefix = chamber === 'house' ? 'h' : 's';
  return `${chamberPrefix}${congress}-${session}-${rollNumber}`;
}

/**
 * Generate bill ID from vote detail
 */
function generateBillIdFromVote(bill: { congress: number; type: string; number: number }): string {
  return `${bill.type.toLowerCase()}-${bill.congress}-${bill.number}`;
}

/**
 * Transform API vote detail to database format
 */
function transformRollCallVote(
  detail: CongressVoteDetail,
  chamber: ChamberKey
): {
  id: string;
  billId: string | null;
  chamber: Chamber;
  congressNumber: number;
  session: number;
  rollNumber: number;
  voteType: VoteType;
  voteCategory: VoteCategory;
  question: string;
  result: VoteResult;
  yeas: number;
  nays: number;
  present: number;
  notVoting: number;
  tieBreakerVp: string | null;
  voteDate: Date;
  dataSource: 'CONGRESS_GOV';
  lastSyncedAt: Date;
} {
  return {
    id: generateRollCallId(chamber, detail.congress, detail.sessionNumber, detail.rollCallNumber),
    billId: detail.bill ? generateBillIdFromVote(detail.bill) : null,
    chamber: mapChamber(chamber),
    congressNumber: detail.congress,
    session: detail.sessionNumber,
    rollNumber: detail.rollCallNumber,
    voteType: mapVoteType(detail.voteType),
    voteCategory: mapVoteCategory(detail.category),
    question: detail.question || detail.description || 'Unknown',
    result: mapVoteResult(detail.result),
    yeas: detail.totalYea ?? 0,
    nays: detail.totalNay ?? 0,
    present: detail.totalPresent ?? 0,
    notVoting: detail.totalNotVoting ?? 0,
    tieBreakerVp: detail.tieBreakerVp ?? null,
    voteDate: new Date(detail.date),
    dataSource: 'CONGRESS_GOV',
    lastSyncedAt: new Date(),
  };
}

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================

/**
 * Upsert a roll call vote to the database
 */
async function upsertRollCallVote(
  vote: ReturnType<typeof transformRollCallVote>,
  dryRun: boolean
): Promise<{ created: boolean; updated: boolean; skipped: boolean }> {
  if (dryRun) {
    log('debug', `[DRY RUN] Would upsert roll call ${vote.id}`);
    return { created: true, updated: false, skipped: false };
  }

  try {
    // Check if bill exists before referencing
    if (vote.billId) {
      const billExists = await prisma.bill.findUnique({
        where: { id: vote.billId },
        select: { id: true },
      });
      if (!billExists) {
        vote.billId = null;
      }
    }

    // Check if exists
    const existing = await prisma.rollCallVote.findUnique({
      where: { id: vote.id },
      select: { id: true },
    });

    if (existing) {
      await prisma.rollCallVote.update({
        where: { id: vote.id },
        data: {
          question: vote.question,
          result: vote.result,
          yeas: vote.yeas,
          nays: vote.nays,
          present: vote.present,
          notVoting: vote.notVoting,
          // Note: RollCallVote model doesn't have lastSyncedAt field
        },
      });
      return { created: false, updated: true, skipped: false };
    }

    await prisma.rollCallVote.create({ data: vote });
    return { created: true, updated: false, skipped: false };
  } catch (error) {
    log('debug', `Failed to upsert roll call ${vote.id}: ${error}`);
    return { created: false, updated: false, skipped: true };
  }
}

/**
 * Upsert vote positions for a roll call
 */
async function upsertVotePositions(
  rollCallId: string,
  members: CongressVoteMember[],
  dryRun: boolean
): Promise<{ created: number; updated: number; skipped: number }> {
  if (dryRun) {
    log('debug', `[DRY RUN] Would upsert ${members.length} vote positions for ${rollCallId}`);
    return { created: members.length, updated: 0, skipped: 0 };
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  // Process in sub-batches for memory efficiency
  const batchSize = DB_BATCH_SIZES.votePositions;

  for (let i = 0; i < members.length; i += batchSize) {
    const batch = members.slice(i, i + batchSize);

    for (const member of batch) {
      try {
        // Check if legislator exists
        const legislator = await prisma.legislator.findUnique({
          where: { id: member.bioguideId },
          select: { id: true },
        });

        if (!legislator) {
          log('debug', `Legislator ${member.bioguideId} not found, skipping vote`);
          skipped++;
          continue;
        }

        // Check if vote position exists
        const existing = await prisma.vote.findFirst({
          where: {
            rollCallId,
            legislatorId: member.bioguideId,
          },
          select: { id: true },
        });

        const positionData = {
          rollCallId,
          legislatorId: member.bioguideId,
          position: mapVotePosition(member.votePosition),
          isProxy: member.isProxy ?? false,
          pairedWithId: member.pairedWith ?? null,
        };

        if (existing) {
          await prisma.vote.update({
            where: { id: existing.id },
            data: {
              position: positionData.position,
              isProxy: positionData.isProxy,
            },
          });
          updated++;
        } else {
          await prisma.vote.create({ data: positionData });
          created++;
        }
      } catch (error) {
        log('debug', `Failed to upsert vote position for ${member.bioguideId}: ${error}`);
        skipped++;
      }
    }
  }

  return { created, updated, skipped };
}

// =============================================================================
// IMPORT HELPERS
// =============================================================================

/**
 * Get the estimated total vote count for all target congresses.
 */
function getEstimatedTotal(): number {
  let total = 0;
  for (const congress of TARGET_CONGRESSES) {
    total += ESTIMATED_COUNTS.votes[congress] ?? 0;
  }
  return total;
}

/**
 * Determine the starting point for import based on checkpoint.
 */
function getStartPoint(checkpoint: {
  congress: number | null;
  offset: number;
  metadata?: Record<string, unknown>;
} | null): {
  startCongress: TargetCongress;
  startChamber: ChamberKey;
  startSession: number;
  startOffset: number;
} {
  if (!checkpoint || checkpoint.congress === null) {
    return {
      startCongress: TARGET_CONGRESSES[0],
      startChamber: 'house',
      startSession: 1,
      startOffset: 0,
    };
  }

  const chamber = (checkpoint.metadata?.chamber as ChamberKey) ?? 'house';
  const session = (checkpoint.metadata?.session as number) ?? 1;

  return {
    startCongress: checkpoint.congress as TargetCongress,
    startChamber: chamber,
    startSession: session,
    startOffset: checkpoint.offset,
  };
}

/**
 * Check if we should skip this congress/chamber/session combination based on checkpoint.
 */
function shouldSkip(
  congress: TargetCongress,
  chamber: ChamberKey,
  session: number,
  startCongress: TargetCongress,
  startChamber: ChamberKey,
  startSession: number
): boolean {
  const congressIndex = TARGET_CONGRESSES.indexOf(congress);
  const startCongressIndex = TARGET_CONGRESSES.indexOf(startCongress);

  if (congressIndex < startCongressIndex) {
    return true;
  }

  if (congressIndex === startCongressIndex) {
    const chamberIndex = CHAMBERS.indexOf(chamber);
    const startChamberIndex = CHAMBERS.indexOf(startChamber);

    if (chamberIndex < startChamberIndex) {
      return true;
    }

    if (chamberIndex === startChamberIndex) {
      if (session < startSession) {
        return true;
      }
    }
  }

  return false;
}

// =============================================================================
// MAIN IMPORT FUNCTION
// =============================================================================

/**
 * Import all votes from Congress.gov for target congresses.
 *
 * This function:
 * 1. Iterates over each target congress (118, 119)
 * 2. For each congress, iterates over chambers (house, senate)
 * 3. For each session (1, 2), fetches roll call votes
 * 4. Upserts RollCallVote records
 * 5. Fetches and upserts individual Vote positions
 * 6. Updates checkpoint with congress/chamber/session/offset for resumability
 *
 * @param options - Import options (dryRun, verbose, etc.)
 */
export async function importVotes(options: ImportOptions): Promise<void> {
  const { dryRun = false, verbose = false, congress: targetCongress } = options;
  const startTime = Date.now();

  log('info', `Starting votes import${dryRun ? ' (DRY RUN)' : ''}`);

  const manager = getCheckpointManager();

  // Initialize stats
  const stats: ImportStats = {
    rollCallsProcessed: 0,
    rollCallsCreated: 0,
    rollCallsUpdated: 0,
    rollCallsSkipped: 0,
    positionsProcessed: 0,
    positionsCreated: 0,
    positionsUpdated: 0,
    positionsSkipped: 0,
    errors: [],
    byCongressChamber: new Map(),
  };

  // Get checkpoint state for resume
  const checkpoint = manager.getState();
  const { startCongress, startChamber, startSession, startOffset } = getStartPoint(
    checkpoint?.phase === 'votes' ? checkpoint : null
  );

  log('info', `Resume point: Congress ${startCongress}, Chamber ${startChamber}, Session ${startSession}, Offset ${startOffset}`);

  // Update checkpoint with estimated total
  manager.update({
    totalExpected: getEstimatedTotal(),
    recordsProcessed: stats.rollCallsProcessed,
  });

  // Determine which congresses to process
  const congressesToProcess = targetCongress
    ? [targetCongress]
    : TARGET_CONGRESSES;

  try {
    // Iterate over target congresses
    for (const congress of congressesToProcess) {
      log('info', `\n--- Congress ${congress} ---`);

      // Iterate over chambers
      for (const chamber of CHAMBERS) {
        // Iterate over sessions
        for (const session of SESSIONS) {
          const key = `${congress}-${chamber}-${session}`;

          // Skip if we haven't reached the resume point yet
          if (shouldSkip(congress, chamber, session, startCongress, startChamber, startSession)) {
            log('debug', `Skipping ${key} (before resume point)`);
            continue;
          }

          log('info', `Processing Congress ${congress}, ${chamber.toUpperCase()}, Session ${session}`);

          // Initialize stats for this combination
          const comboStats = { rollCalls: 0, positions: 0 };
          stats.byCongressChamber.set(key, comboStats);

          // Determine starting offset for this combination
          const offset =
            congress === startCongress && chamber === startChamber && session === startSession
              ? startOffset
              : 0;

          if (offset > 0) {
            log('info', `Resuming from offset ${offset}`);
          }

          // Update checkpoint for current position
          manager.update({
            congress,
            offset: comboStats.rollCalls,
            metadata: { chamber, session },
          });

          // Fetch roll call votes for this congress/chamber/session
          let rollCallCount = 0;

          for await (const voteListItem of listVotes(congress, chamber, session, { offset })) {
            rollCallCount++;

            // Fetch detailed vote information
            const detail = await getVoteDetail(congress, chamber, session, voteListItem.rollCallNumber);

            if (!detail) {
              stats.rollCallsSkipped++;
              continue;
            }

            // Transform and upsert roll call vote
            const rollCallData = transformRollCallVote(detail, chamber);
            const rollCallResult = await upsertRollCallVote(rollCallData, dryRun);

            if (rollCallResult.created) stats.rollCallsCreated++;
            if (rollCallResult.updated) stats.rollCallsUpdated++;
            if (rollCallResult.skipped) stats.rollCallsSkipped++;
            stats.rollCallsProcessed++;
            comboStats.rollCalls++;

            // Process vote positions if available
            if (detail.members && detail.members.length > 0) {
              const positionResult = await upsertVotePositions(
                rollCallData.id,
                detail.members,
                dryRun
              );

              stats.positionsCreated += positionResult.created;
              stats.positionsUpdated += positionResult.updated;
              stats.positionsSkipped += positionResult.skipped;
              stats.positionsProcessed += detail.members.length;
              comboStats.positions += detail.members.length;
            }

            // Update checkpoint periodically
            if (stats.rollCallsProcessed % 10 === 0) {
              manager.update({
                offset: comboStats.rollCalls,
                recordsProcessed: stats.rollCallsProcessed,
                metadata: { chamber, session },
              });
            }

            // Log progress
            if (
              stats.rollCallsProcessed % LOG_CONFIG.progressIntervalRecords === 0 ||
              verbose
            ) {
              logProgress(stats.rollCallsProcessed, getEstimatedTotal(), `${chamber}-${congress}-${session}`);
            }

            if (verbose) {
              log(
                'debug',
                `Roll call ${rollCallData.id}: ${detail.members?.length ?? 0} positions`
              );
            }

            // Dry run limit
            if (dryRun && stats.rollCallsProcessed >= DRY_RUN_CONFIG.maxRecords) {
              log('info', `Dry run limit reached (${DRY_RUN_CONFIG.maxRecords} records)`);
              break;
            }
          }

          // Log session completion
          log(
            'info',
            `Completed ${chamber.toUpperCase()} Session ${session}: ${comboStats.rollCalls} roll calls, ` +
            `${comboStats.positions} positions`
          );

          // Early exit for dry run
          if (dryRun && stats.rollCallsProcessed >= DRY_RUN_CONFIG.maxRecords) {
            break;
          }
        }

        // Early exit for dry run
        if (dryRun && stats.rollCallsProcessed >= DRY_RUN_CONFIG.maxRecords) {
          break;
        }
      }

      // Early exit for dry run
      if (dryRun && stats.rollCallsProcessed >= DRY_RUN_CONFIG.maxRecords) {
        break;
      }
    }

    // Final summary
    const duration = Date.now() - startTime;
    const durationStr = formatDuration(duration);

    log('info', '');
    log('info', '=== Votes Import Summary ===');
    log('info', `Roll Calls Processed: ${stats.rollCallsProcessed}`);
    log('info', `Roll Calls Created: ${stats.rollCallsCreated}`);
    log('info', `Roll Calls Updated: ${stats.rollCallsUpdated}`);
    log('info', `Roll Calls Skipped: ${stats.rollCallsSkipped}`);
    log('info', '');
    log('info', `Positions Processed: ${stats.positionsProcessed}`);
    log('info', `Positions Created: ${stats.positionsCreated}`);
    log('info', `Positions Updated: ${stats.positionsUpdated}`);
    log('info', `Positions Skipped: ${stats.positionsSkipped}`);
    log('info', '');
    log('info', `Errors: ${stats.errors.length}`);
    log('info', `Duration: ${durationStr}`);
    log('info', `Rate: ${Math.round(stats.rollCallsProcessed / (duration / 1000))} roll calls/sec`);

    // Breakdown by congress/chamber
    if (verbose) {
      log('info', '');
      log('info', 'Breakdown by Congress/Chamber/Session:');
      for (const [key, comboStats] of stats.byCongressChamber) {
        log(
          'info',
          `  ${key}: ${comboStats.rollCalls} roll calls, ${comboStats.positions} positions`
        );
      }
    }

    if (stats.errors.length > 0 && verbose) {
      log('warn', '');
      log('warn', 'Errors encountered:');
      stats.errors.slice(0, 10).forEach((err) => log('warn', `  - ${err}`));
      if (stats.errors.length > 10) {
        log('warn', `  ... and ${stats.errors.length - 10} more`);
      }
    }

    // Update final checkpoint
    manager.update({
      recordsProcessed: stats.rollCallsProcessed,
      totalExpected: stats.rollCallsProcessed,
      metadata: {
        rollCallsCreated: stats.rollCallsCreated,
        rollCallsUpdated: stats.rollCallsUpdated,
        rollCallsSkipped: stats.rollCallsSkipped,
        positionsCreated: stats.positionsCreated,
        positionsUpdated: stats.positionsUpdated,
        positionsSkipped: stats.positionsSkipped,
        errors: stats.errors.length,
        durationMs: duration,
      },
    });

    // Validate minimum count
    if (!dryRun) {
      const expectedMin = getEstimatedTotal() * 0.5; // 50% of estimate (votes can vary significantly)
      if (stats.rollCallsProcessed < expectedMin) {
        log(
          'warn',
          `Vote count (${stats.rollCallsProcessed}) is below 50% of expected (${expectedMin}). ` +
          'This may indicate an API issue or incomplete data.'
        );
      }
    }
  } catch (error) {
    log('error', `Votes import failed: ${error}`);
    manager.recordError(error instanceof Error ? error : String(error));
    throw error;
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}
