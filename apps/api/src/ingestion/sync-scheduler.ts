/**
 * Sync Scheduler
 *
 * Orchestrates data synchronization from Congress.gov API to the database.
 * Handles incremental updates, full syncs, and error recovery.
 *
 * @example
 * ```ts
 * const scheduler = new SyncScheduler(prisma);
 * await scheduler.start();
 *
 * // Manual sync
 * const result = await scheduler.syncBills(118);
 * ```
 */

import type { PrismaClient } from '@prisma/client';

import { config } from '../config.js';
import { logger } from '../lib/logger.js';

import { CongressApiClient, getCongressClient } from './congress-client.js';
import {
  transformBillListItem,
  transformBillDetail,
  transformBillAction,
  transformCosponsor,
  transformTextVersion,
  transformMemberListItem,
  transformMemberDetail,
  transformCommittee,
  generateBillId,
  type BillCreateInput,
  type LegislatorCreateInput,
  type CommitteeCreateInput,
} from './data-transformer.js';
import type { SyncState, SyncResult, CongressBillType } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SyncOptions {
  /** Congress number (e.g., 118) */
  congress?: number;
  /** Only sync items updated since this date */
  fromDate?: Date;
  /** Sync specific entity types */
  entityTypes?: Array<'bills' | 'members' | 'committees'>;
  /** Enable dry run (no database writes) */
  dryRun?: boolean;
  /** Batch size for database operations */
  batchSize?: number;
  /** Whether to fetch full details for each bill */
  fetchDetails?: boolean;
}

export interface SyncStats {
  bills: { processed: number; created: number; updated: number; errors: number };
  members: { processed: number; created: number; updated: number; errors: number };
  committees: { processed: number; created: number; updated: number; errors: number };
  actions: { processed: number; created: number };
  cosponsors: { processed: number; created: number };
  textVersions: { processed: number; created: number };
}

const DEFAULT_SYNC_OPTIONS: Required<SyncOptions> = {
  congress: 118,
  fromDate: new Date(0),
  entityTypes: ['bills', 'members', 'committees'],
  dryRun: false,
  batchSize: 50,
  fetchDetails: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// Sync Scheduler Class
// ─────────────────────────────────────────────────────────────────────────────

export class SyncScheduler {
  private readonly prisma: PrismaClient;
  private readonly client: CongressApiClient;
  private state: SyncState;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(prisma: PrismaClient, client?: CongressApiClient) {
    this.prisma = prisma;
    this.client = client ?? getCongressClient();
    this.state = {
      lastSyncTime: null,
      lastSuccessfulSync: null,
      isRunning: false,
      errorCount: 0,
      lastError: null,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Starts the automatic sync scheduler.
   * Runs sync at configured interval (default: 15 minutes).
   */
  async start(): Promise<void> {
    if (this.intervalId) {
      logger.warn('Sync scheduler already running');
      return;
    }

    logger.info(
      { intervalMs: config.congress.syncIntervalMs },
      'Starting sync scheduler'
    );

    // Run initial sync
    await this.runSync({ fetchDetails: false });

    // Schedule periodic syncs
    this.intervalId = setInterval(() => {
      void (async () => {
        const syncOpts: SyncOptions = { fetchDetails: false };
        if (this.state.lastSuccessfulSync) {
          syncOpts.fromDate = this.state.lastSuccessfulSync;
        }
        await this.runSync(syncOpts);
      })();
    }, config.congress.syncIntervalMs);
  }

  /**
   * Stops the automatic sync scheduler.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Sync scheduler stopped');
    }
  }

  /**
   * Gets current sync state.
   */
  getState(): SyncState {
    return { ...this.state };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Main Sync Logic
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Runs a full or incremental sync.
   */
  async runSync(options: SyncOptions = {}): Promise<SyncResult> {
    if (this.state.isRunning) {
      logger.warn('Sync already in progress, skipping');
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ id: 'sync', error: 'Sync already in progress' }],
        duration: 0,
      };
    }

    const opts = { ...DEFAULT_SYNC_OPTIONS, ...options };
    const startTime = Date.now();
    this.state.isRunning = true;
    this.state.lastSyncTime = new Date();

    const stats: SyncStats = {
      bills: { processed: 0, created: 0, updated: 0, errors: 0 },
      members: { processed: 0, created: 0, updated: 0, errors: 0 },
      committees: { processed: 0, created: 0, updated: 0, errors: 0 },
      actions: { processed: 0, created: 0 },
      cosponsors: { processed: 0, created: 0 },
      textVersions: { processed: 0, created: 0 },
    };

    const errors: Array<{ id: string; error: string }> = [];

    try {
      // Ensure Congress record exists
      await this.ensureCongress(opts.congress);

      // Sync committees first (needed for bill referrals)
      if (opts.entityTypes.includes('committees')) {
        const committeeResult = await this.syncCommittees(opts);
        stats.committees = committeeResult;
      }

      // Sync members (needed for sponsors)
      if (opts.entityTypes.includes('members')) {
        const memberResult = await this.syncMembers(opts);
        stats.members = memberResult;
      }

      // Sync bills last (depends on members and committees)
      if (opts.entityTypes.includes('bills')) {
        const billResult = await this.syncBills(opts);
        stats.bills = billResult.stats;
        stats.actions = billResult.actions;
        stats.cosponsors = billResult.cosponsors;
        stats.textVersions = billResult.textVersions;
      }

      this.state.lastSuccessfulSync = new Date();
      this.state.errorCount = 0;
      this.state.lastError = null;
    } catch (error) {
      this.state.errorCount++;
      this.state.lastError =
        error instanceof Error ? error.message : String(error);
      errors.push({ id: 'sync', error: this.state.lastError });
      logger.error({ error }, 'Sync failed');
    } finally {
      this.state.isRunning = false;
    }

    const duration = Date.now() - startTime;

    logger.info(
      {
        duration,
        stats,
        errorsCount: errors.length,
      },
      'Sync completed'
    );

    return {
      success: errors.length === 0,
      recordsProcessed:
        stats.bills.processed + stats.members.processed + stats.committees.processed,
      recordsCreated:
        stats.bills.created + stats.members.created + stats.committees.created,
      recordsUpdated:
        stats.bills.updated + stats.members.updated + stats.committees.updated,
      errors,
      duration,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Entity Sync Methods
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Syncs bills from Congress.gov.
   */
  private async syncBills(
    opts: Required<SyncOptions>
  ): Promise<{
    stats: SyncStats['bills'];
    actions: SyncStats['actions'];
    cosponsors: SyncStats['cosponsors'];
    textVersions: SyncStats['textVersions'];
  }> {
    const stats = { processed: 0, created: 0, updated: 0, errors: 0 };
    const actionsStats = { processed: 0, created: 0 };
    const cosponsorsStats = { processed: 0, created: 0 };
    const textVersionsStats = { processed: 0, created: 0 };

    logger.info({ congress: opts.congress }, 'Syncing bills');

    let batch: BillCreateInput[] = [];

    for await (const billItem of this.client.listBills(opts.congress, {
      fromDateTime: opts.fromDate,
      sort: 'updateDate+asc',
    })) {
      stats.processed++;

      try {
        const billData = transformBillListItem(billItem);
        batch.push(billData);

        // Process batch when full
        if (batch.length >= opts.batchSize) {
          const result = await this.upsertBillBatch(batch, opts.dryRun);
          stats.created += result.created;
          stats.updated += result.updated;
          batch = [];
        }

        // Fetch details if enabled
        if (opts.fetchDetails) {
          const detailStats = await this.syncBillDetails(
            opts.congress,
            billItem.type,
            billItem.number,
            opts
          );
          actionsStats.processed += detailStats.actions.processed;
          actionsStats.created += detailStats.actions.created;
          cosponsorsStats.processed += detailStats.cosponsors.processed;
          cosponsorsStats.created += detailStats.cosponsors.created;
          textVersionsStats.processed += detailStats.textVersions.processed;
          textVersionsStats.created += detailStats.textVersions.created;
        }
      } catch (error) {
        stats.errors++;
        logger.error(
          { error, billType: billItem.type, billNumber: billItem.number },
          'Error processing bill'
        );
      }
    }

    // Process remaining batch
    if (batch.length > 0) {
      const result = await this.upsertBillBatch(batch, opts.dryRun);
      stats.created += result.created;
      stats.updated += result.updated;
    }

    logger.info({ stats }, 'Bills sync completed');

    return {
      stats,
      actions: actionsStats,
      cosponsors: cosponsorsStats,
      textVersions: textVersionsStats,
    };
  }

  /**
   * Syncs full details for a specific bill.
   */
  private async syncBillDetails(
    congress: number,
    type: CongressBillType,
    number: number,
    opts: Required<SyncOptions>
  ): Promise<{
    actions: SyncStats['actions'];
    cosponsors: SyncStats['cosponsors'];
    textVersions: SyncStats['textVersions'];
  }> {
    const billId = generateBillId(type, number, congress);
    const actionsStats = { processed: 0, created: 0 };
    const cosponsorsStats = { processed: 0, created: 0 };
    const textVersionsStats = { processed: 0, created: 0 };

    try {
      // Fetch and update bill details
      const detail = await this.client.getBillDetail(congress, type, number);
      const updateData = transformBillDetail(detail);

      if (!opts.dryRun) {
        // Transform subjects array to Prisma nested write format
        // BillSubject is a join table to Subject, so we use connectOrCreate
        const { subjects, ...restUpdateData } = updateData;
        await this.prisma.bill.update({
          where: { id: billId },
          data: {
            ...restUpdateData,
            subjects: {
              deleteMany: {},
              create: subjects.map((name) => ({
                subject: {
                  connectOrCreate: {
                    where: { name },
                    create: { name },
                  },
                },
              })),
            },
          },
        });
      }

      // Sync actions
      const { actions } = await this.client.getBillActions(congress, type, number);
      for (const action of actions) {
        actionsStats.processed++;
        const actionData = transformBillAction(action, billId);

        if (!opts.dryRun) {
          try {
            await this.prisma.billAction.create({ data: actionData });
            actionsStats.created++;
          } catch {
            // Likely duplicate, skip
          }
        }
      }

      // Sync cosponsors
      const { cosponsors } = await this.client.getBillCosponsors(
        congress,
        type,
        number
      );
      for (const cosponsor of cosponsors) {
        cosponsorsStats.processed++;

        // Ensure legislator exists first
        const legislatorExists = await this.prisma.legislator.findUnique({
          where: { id: cosponsor.bioguideId },
          select: { id: true },
        });

        if (legislatorExists && !opts.dryRun) {
          const cosponsorData = transformCosponsor(cosponsor, billId);
          try {
            await this.prisma.billSponsor.upsert({
              where: {
                billId_legislatorId: {
                  billId,
                  legislatorId: cosponsor.bioguideId,
                },
              },
              create: cosponsorData,
              update: {
                cosponsorDate: cosponsorData.cosponsorDate,
              },
            });
            cosponsorsStats.created++;
          } catch {
            // Skip errors
          }
        }
      }

      // Sync text versions
      const textVersions = await this.client.getBillTextVersions(
        congress,
        type,
        number
      );
      for (const version of textVersions) {
        textVersionsStats.processed++;
        const versionData = transformTextVersion(version, billId);

        if (versionData && !opts.dryRun) {
          try {
            await this.prisma.billTextVersion.upsert({
              where: {
                billId_versionCode: {
                  billId,
                  versionCode: versionData.versionCode,
                },
              },
              create: versionData,
              update: {
                textUrl: versionData.textUrl,
                publishedDate: versionData.publishedDate,
              },
            });
            textVersionsStats.created++;
          } catch {
            // Skip errors
          }
        }
      }
    } catch (error) {
      logger.error(
        { error, congress, type, number },
        'Error syncing bill details'
      );
    }

    return {
      actions: actionsStats,
      cosponsors: cosponsorsStats,
      textVersions: textVersionsStats,
    };
  }

  /**
   * Syncs members from Congress.gov.
   */
  private async syncMembers(
    opts: Required<SyncOptions>
  ): Promise<SyncStats['members']> {
    const stats = { processed: 0, created: 0, updated: 0, errors: 0 };

    logger.info('Syncing members');

    let batch: LegislatorCreateInput[] = [];

    for await (const memberItem of this.client.listMembers({
      fromDateTime: opts.fromDate,
    })) {
      stats.processed++;

      try {
        const memberData = transformMemberListItem(memberItem);
        batch.push(memberData);

        if (batch.length >= opts.batchSize) {
          const result = await this.upsertMemberBatch(batch, opts.dryRun);
          stats.created += result.created;
          stats.updated += result.updated;
          batch = [];
        }

        // Fetch full details
        if (opts.fetchDetails) {
          try {
            const detail = await this.client.getMemberDetail(memberItem.bioguideId);
            const updateData = transformMemberDetail(detail);

            if (!opts.dryRun) {
              await this.prisma.legislator.update({
                where: { id: memberItem.bioguideId },
                data: updateData,
              });
            }
          } catch {
            // Skip detail errors
          }
        }
      } catch (error) {
        stats.errors++;
        logger.error(
          { error, bioguideId: memberItem.bioguideId },
          'Error processing member'
        );
      }
    }

    // Process remaining batch
    if (batch.length > 0) {
      const result = await this.upsertMemberBatch(batch, opts.dryRun);
      stats.created += result.created;
      stats.updated += result.updated;
    }

    logger.info({ stats }, 'Members sync completed');

    return stats;
  }

  /**
   * Syncs committees from Congress.gov.
   */
  private async syncCommittees(
    opts: Required<SyncOptions>
  ): Promise<SyncStats['committees']> {
    const stats = { processed: 0, created: 0, updated: 0, errors: 0 };

    logger.info('Syncing committees');

    // Fetch all committees first to handle parent-child ordering
    const committees: CommitteeCreateInput[] = [];

    for await (const committeeItem of this.client.listCommittees()) {
      stats.processed++;
      try {
        committees.push(transformCommittee(committeeItem));
      } catch (error) {
        stats.errors++;
        logger.error(
          { error, systemCode: committeeItem.systemCode },
          'Error processing committee'
        );
      }
    }

    // Sort by hierarchy (parents first)
    const sorted = [...committees].sort((a, b) => {
      const aHasParent = 'parent' in a && a.parent !== undefined;
      const bHasParent = 'parent' in b && b.parent !== undefined;
      if (aHasParent && !bHasParent) return 1;
      if (!aHasParent && bHasParent) return -1;
      return 0;
    });

    // Upsert in order
    for (const committee of sorted) {
      if (opts.dryRun) continue;

      try {
        const existing = await this.prisma.committee.findUnique({
          where: { id: committee.id },
          select: { id: true },
        });

        if (existing) {
          await this.prisma.committee.update({
            where: { id: committee.id },
            data: {
              name: committee.name,
              chamber: committee.chamber,
              type: committee.type,
            },
          });
          stats.updated++;
        } else {
          // Skip parent connection for now if parent doesn't exist yet
          const createData = { ...committee };
          if ('parent' in createData) {
            const parentId = (createData.parent as { connect: { id: string } })
              ?.connect?.id;
            if (parentId) {
              const parentExists = await this.prisma.committee.findUnique({
                where: { id: parentId },
                select: { id: true },
              });
              if (!parentExists) {
                delete (createData as Record<string, unknown>).parent;
              }
            }
          }

          await this.prisma.committee.create({ data: createData });
          stats.created++;
        }
      } catch (error) {
        stats.errors++;
        logger.error({ error, committeeId: committee.id }, 'Error upserting committee');
      }
    }

    logger.info({ stats }, 'Committees sync completed');

    return stats;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Helper Methods
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Ensures Congress record exists.
   */
  private async ensureCongress(congressNumber: number): Promise<void> {
    const existing = await this.prisma.congress.findUnique({
      where: { number: congressNumber },
    });

    if (!existing) {
      // Calculate approximate start date
      // Congress sessions start in odd years, January 3
      const startYear = 2023 - (118 - congressNumber) * 2;

      await this.prisma.congress.create({
        data: {
          number: congressNumber,
          startDate: new Date(`${startYear}-01-03`),
        },
      });

      logger.info({ congressNumber }, 'Created Congress record');
    }
  }

  /**
   * Upserts a batch of bills.
   */
  private async upsertBillBatch(
    batch: BillCreateInput[],
    dryRun: boolean
  ): Promise<{ created: number; updated: number }> {
    if (dryRun || batch.length === 0) {
      return { created: 0, updated: 0 };
    }

    let created = 0;
    let updated = 0;

    for (const bill of batch) {
      try {
        const existing = await this.prisma.bill.findUnique({
          where: { id: bill.id },
          select: { id: true },
        });

        if (existing) {
          await this.prisma.bill.update({
            where: { id: bill.id },
            data: {
              title: bill.title,
              status: bill.status,
              lastActionDate: bill.lastActionDate,
              lastSyncedAt: bill.lastSyncedAt,
            },
          });
          updated++;
        } else {
          await this.prisma.bill.create({ data: bill });
          created++;
        }
      } catch (error) {
        logger.error({ error, billId: bill.id }, 'Error upserting bill');
      }
    }

    return { created, updated };
  }

  /**
   * Upserts a batch of members.
   */
  private async upsertMemberBatch(
    batch: LegislatorCreateInput[],
    dryRun: boolean
  ): Promise<{ created: number; updated: number }> {
    if (dryRun || batch.length === 0) {
      return { created: 0, updated: 0 };
    }

    let created = 0;
    let updated = 0;

    for (const member of batch) {
      try {
        const existing = await this.prisma.legislator.findUnique({
          where: { id: member.id },
          select: { id: true },
        });

        if (existing) {
          await this.prisma.legislator.update({
            where: { id: member.id },
            data: {
              fullName: member.fullName,
              party: member.party,
              chamber: member.chamber,
              state: member.state,
              district: member.district,
              inOffice: member.inOffice,
              lastSyncedAt: member.lastSyncedAt,
            },
          });
          updated++;
        } else {
          await this.prisma.legislator.create({ data: member });
          created++;
        }
      } catch (error) {
        logger.error({ error, memberId: member.id }, 'Error upserting member');
      }
    }

    return { created, updated };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton
// ─────────────────────────────────────────────────────────────────────────────

let syncScheduler: SyncScheduler | null = null;

/**
 * Gets or creates the singleton sync scheduler.
 */
export function getSyncScheduler(prisma: PrismaClient): SyncScheduler {
  if (!syncScheduler) {
    syncScheduler = new SyncScheduler(prisma);
  }
  return syncScheduler;
}

/**
 * Resets the singleton scheduler (for testing).
 */
export function resetSyncScheduler(): void {
  if (syncScheduler) {
    syncScheduler.stop();
  }
  syncScheduler = null;
}
