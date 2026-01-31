/**
 * Data Transformer Unit Tests
 *
 * Tests for transforming Congress.gov API responses to Prisma schema format.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateBillId,
  parseBillId,
  mapBillType,
  mapChamber,
  mapParty,
  mapCommitteeType,
  inferBillStatus,
  parseDate,
  parseDateRequired,
  transformBillListItem,
  transformBillDetail,
  transformBillAction,
  transformCosponsor,
  transformTextVersion,
  transformMemberListItem,
  transformMemberDetail,
  transformCommittee,
  transformBillBatch,
  transformMemberBatch,
  transformCommitteeBatch,
} from '../../ingestion/data-transformer.js';
import type {
  BillListItem,
  BillDetail,
  BillAction,
  BillCosponsor,
  BillTextVersion,
  MemberListItem,
  MemberDetail,
  CommitteeListItem,
} from '../../ingestion/types.js';

describe('DataTransformer', () => {
  // Use fake timers for consistent date testing
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-20T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('generateBillId', () => {
    it('generates correct bill ID format', () => {
      expect(generateBillId('hr', 1234, 118)).toBe('hr-1234-118');
      expect(generateBillId('s', 100, 117)).toBe('s-100-117');
      expect(generateBillId('hjres', 50, 118)).toBe('hjres-50-118');
    });

    it('handles edge cases', () => {
      expect(generateBillId('hr', 1, 100)).toBe('hr-1-100');
      expect(generateBillId('sconres', 999999, 118)).toBe('sconres-999999-118');
    });
  });

  describe('parseBillId', () => {
    it('parses valid bill IDs', () => {
      expect(parseBillId('hr-1234-118')).toEqual({
        type: 'hr',
        number: 1234,
        congress: 118,
      });
      expect(parseBillId('s-100-117')).toEqual({
        type: 's',
        number: 100,
        congress: 117,
      });
    });

    it('returns null for invalid IDs', () => {
      expect(parseBillId('invalid')).toBeNull();
      expect(parseBillId('hr-abc-118')).toBeNull();
      expect(parseBillId('')).toBeNull();
    });
  });

  describe('mapBillType', () => {
    it('maps Congress.gov bill types to Prisma enums', () => {
      expect(mapBillType('hr')).toBe('HR');
      expect(mapBillType('s')).toBe('S');
      expect(mapBillType('hjres')).toBe('HJRES');
      expect(mapBillType('sjres')).toBe('SJRES');
      expect(mapBillType('hconres')).toBe('HCONRES');
      expect(mapBillType('sconres')).toBe('SCONRES');
      expect(mapBillType('hres')).toBe('HRES');
      expect(mapBillType('sres')).toBe('SRES');
    });

    // Note: mapBillType uses lowercase keys, so uppercase won't match
    it('returns HR for unknown types', () => {
      // Unknown types fall back to HR
      expect(mapBillType('unknown' as 'hr')).toBe('HR');
    });
  });

  describe('mapChamber', () => {
    it('maps chamber values correctly', () => {
      expect(mapChamber('House')).toBe('HOUSE');
      expect(mapChamber('Senate')).toBe('SENATE');
      expect(mapChamber('house')).toBe('HOUSE');
      expect(mapChamber('senate')).toBe('SENATE');
      expect(mapChamber('HOUSE')).toBe('HOUSE');
      expect(mapChamber('SENATE')).toBe('SENATE');
      expect(mapChamber('H')).toBe('HOUSE');
      expect(mapChamber('S')).toBe('SENATE');
      expect(mapChamber('House of Representatives')).toBe('HOUSE');
    });

    it('returns null for unknown or empty values', () => {
      expect(mapChamber('unknown')).toBeNull();
      expect(mapChamber('')).toBeNull();
      expect(mapChamber(null)).toBeNull();
      expect(mapChamber(undefined)).toBeNull();
    });
  });

  describe('mapParty', () => {
    it('maps party values correctly', () => {
      // Returns single-letter codes from Prisma Party enum
      expect(mapParty('Democratic')).toBe('D');
      expect(mapParty('Democrat')).toBe('D');
      expect(mapParty('Republican')).toBe('R');
      expect(mapParty('Independent')).toBe('I');
      expect(mapParty('Libertarian')).toBe('L');
      expect(mapParty('Green')).toBe('G');
      expect(mapParty('D')).toBe('D');
      expect(mapParty('R')).toBe('R');
      expect(mapParty('I')).toBe('I');
    });

    it('returns O (Other) for unknown or null parties', () => {
      expect(mapParty('Unknown')).toBe('O');
      expect(mapParty(null)).toBe('O');
      expect(mapParty(undefined)).toBe('O');
      expect(mapParty('')).toBe('O');
    });
  });

  describe('mapCommitteeType', () => {
    it('maps committee types correctly', () => {
      expect(mapCommitteeType('Standing')).toBe('STANDING');
      expect(mapCommitteeType('Select')).toBe('SELECT');
      expect(mapCommitteeType('Joint')).toBe('JOINT');
      expect(mapCommitteeType('Special')).toBe('SPECIAL');
      expect(mapCommitteeType('Subcommittee')).toBe('SUBCOMMITTEE');
    });

    it('returns STANDING for unknown or null types', () => {
      expect(mapCommitteeType('unknown')).toBe('STANDING');
      expect(mapCommitteeType(null)).toBe('STANDING');
      expect(mapCommitteeType(undefined)).toBe('STANDING');
    });
  });

  describe('inferBillStatus', () => {
    it('infers ENACTED from action text', () => {
      expect(inferBillStatus({ text: 'Became Public Law No: 118-50.' })).toBe('ENACTED');
      expect(inferBillStatus({ text: 'became public law' })).toBe('ENACTED');
      expect(inferBillStatus({ text: 'became law today' })).toBe('ENACTED');
    });

    it('infers SIGNED_INTO_LAW from action text', () => {
      expect(inferBillStatus({ text: 'Signed by President.' })).toBe('SIGNED_INTO_LAW');
      expect(inferBillStatus({ text: 'signed by the president on Jan 15' })).toBe('SIGNED_INTO_LAW');
    });

    it('infers VETOED from action text', () => {
      expect(inferBillStatus({ text: 'Vetoed by President.' })).toBe('VETOED');
      expect(inferBillStatus({ text: 'vetoed by the president' })).toBe('VETOED');
    });

    it('infers VETO_OVERRIDDEN from action text', () => {
      expect(inferBillStatus({ text: 'Veto overridden by Congress.' })).toBe('VETO_OVERRIDDEN');
    });

    it('infers POCKET_VETOED from action text', () => {
      expect(inferBillStatus({ text: 'Pocket vetoed by President.' })).toBe('POCKET_VETOED');
    });

    it('infers TO_PRESIDENT from action text', () => {
      expect(inferBillStatus({ text: 'Presented to President.' })).toBe('TO_PRESIDENT');
      expect(inferBillStatus({ text: 'Sent to President for signature.' })).toBe('TO_PRESIDENT');
    });

    it('infers RESOLVING_DIFFERENCES from action text', () => {
      expect(inferBillStatus({ text: 'Resolving differences between chambers.' })).toBe('RESOLVING_DIFFERENCES');
      expect(inferBillStatus({ text: 'In conference committee.' })).toBe('RESOLVING_DIFFERENCES');
    });

    it('infers PASSED_HOUSE from action text', () => {
      expect(inferBillStatus({ text: 'Passed House by Yea-Nay Vote.' })).toBe('PASSED_HOUSE');
      expect(inferBillStatus({ text: 'passed house 250-180' })).toBe('PASSED_HOUSE');
      expect(inferBillStatus({ text: 'Agreed to in House.' })).toBe('PASSED_HOUSE');
    });

    it('infers PASSED_SENATE from action text', () => {
      expect(inferBillStatus({ text: 'Passed Senate by voice vote.' })).toBe('PASSED_SENATE');
      expect(inferBillStatus({ text: 'agreed to in senate' })).toBe('PASSED_SENATE');
    });

    it('infers REPORTED_BY_COMMITTEE from action text', () => {
      expect(inferBillStatus({ text: 'Reported by the Committee on Ways and Means.' })).toBe('REPORTED_BY_COMMITTEE');
      expect(inferBillStatus({ text: 'Ordered to be reported.' })).toBe('REPORTED_BY_COMMITTEE');
    });

    it('infers IN_COMMITTEE from action text', () => {
      expect(inferBillStatus({ text: 'Referred to the Committee on Ways and Means.' })).toBe('IN_COMMITTEE');
      expect(inferBillStatus({ text: 'In committee review.' })).toBe('IN_COMMITTEE');
    });

    it('infers FAILED from action text', () => {
      expect(inferBillStatus({ text: 'Failed to pass House.' })).toBe('FAILED');
      expect(inferBillStatus({ text: 'Motion rejected.' })).toBe('FAILED');
    });

    it('infers WITHDRAWN from action text', () => {
      expect(inferBillStatus({ text: 'Sponsor withdrew the bill.' })).toBe('WITHDRAWN');
    });

    it('infers INTRODUCED as default', () => {
      expect(inferBillStatus({ text: 'Introduced in House.' })).toBe('INTRODUCED');
      expect(inferBillStatus(null)).toBe('INTRODUCED');
      expect(inferBillStatus(undefined)).toBe('INTRODUCED');
      expect(inferBillStatus({ text: '' })).toBe('INTRODUCED');
    });
  });

  describe('parseDate', () => {
    it('parses valid date strings', () => {
      const date = parseDate('2024-01-15');
      expect(date).toBeInstanceOf(Date);
      expect(date?.toISOString()).toContain('2024-01-15');
    });

    it('parses ISO datetime strings', () => {
      const date = parseDate('2024-01-15T10:30:00Z');
      expect(date).toBeInstanceOf(Date);
    });

    it('returns null for invalid dates', () => {
      expect(parseDate('invalid')).toBeNull();
      expect(parseDate('')).toBeNull();
      expect(parseDate(null)).toBeNull();
      expect(parseDate(undefined)).toBeNull();
    });
  });

  describe('parseDateRequired', () => {
    it('parses valid date strings', () => {
      const date = parseDateRequired('2024-01-15');
      expect(date).toBeInstanceOf(Date);
      expect(date.toISOString()).toContain('2024-01-15');
    });

    it('returns fallback date for invalid dates', () => {
      const fallback = new Date('2024-01-01');
      const date = parseDateRequired('invalid', fallback);
      expect(date).toBe(fallback);
    });

    it('returns current date as default fallback', () => {
      const date = parseDateRequired('invalid');
      expect(date).toBeInstanceOf(Date);
      // With fake timers, this should be our set time
      expect(date.toISOString()).toBe('2024-01-20T12:00:00.000Z');
    });
  });

  describe('transformBillListItem', () => {
    const mockBillListItem: BillListItem = {
      congress: 118,
      type: 'hr',
      number: 1234,
      originChamber: 'House',
      title: 'Test Bill Act',
      latestAction: {
        actionDate: '2024-01-15',
        text: 'Referred to the Committee on Ways and Means.',
      },
      updateDate: '2024-01-16',
      url: 'https://api.congress.gov/v3/bill/118/hr/1234',
    };

    it('transforms bill list item correctly', () => {
      const result = transformBillListItem(mockBillListItem);

      expect(result.id).toBe('hr-1234-118');
      expect(result.billType).toBe('HR');
      expect(result.billNumber).toBe(1234);
      expect(result.congressNumber).toBe(118);
      expect(result.title).toBe('Test Bill Act');
      expect(result.status).toBe('IN_COMMITTEE');
      expect(result.introducedDate).toBeInstanceOf(Date);
      expect(result.lastActionDate).toBeInstanceOf(Date);
      expect(result.dataSource).toBe('CONGRESS_GOV');
      expect(result.dataQuality).toBe('UNVERIFIED');
      expect(result.lastSyncedAt).toBeInstanceOf(Date);
    });

    it('handles missing latestAction', () => {
      const minimalItem: BillListItem = {
        congress: 118,
        type: 'hr',
        number: 1,
        title: 'Minimal Bill',
        updateDate: '2024-01-01',
        url: 'https://api.congress.gov/v3/bill/118/hr/1',
      };

      const result = transformBillListItem(minimalItem);
      expect(result.status).toBe('INTRODUCED');
      expect(result.lastActionDate).toBeNull();
    });
  });

  describe('transformBillDetail', () => {
    const mockBillDetail: BillDetail = {
      congress: 118,
      type: 'hr',
      number: 1234,
      originChamber: 'House',
      title: 'Test Bill Act',
      introducedDate: '2024-01-01',
      latestAction: {
        actionDate: '2024-01-15',
        text: 'Passed House.',
      },
      updateDate: '2024-01-16',
      sponsors: [
        {
          bioguideId: 'A000001',
          fullName: 'Rep. Test Member',
          firstName: 'Test',
          lastName: 'Member',
          party: 'D',
          state: 'CA',
        },
      ],
      policyArea: {
        name: 'Economics and Public Finance',
      },
      subjects: {
        legislativeSubjects: [{ name: 'Budget' }, { name: 'Taxation' }],
      },
      summaries: {
        summary: [
          {
            text: '<p>This bill does something.</p>',
            actionDate: '2024-01-10',
            versionCode: '00',
          },
        ],
      },
    };

    it('transforms bill detail correctly', () => {
      const result = transformBillDetail(mockBillDetail);

      expect(result.title).toBe('Test Bill Act');
      expect(result.introducedDate).toBeInstanceOf(Date);
      expect(result.sponsorBioguideId).toBe('A000001');
      expect(result.policyAreaName).toBe('Economics and Public Finance');
      expect(result.subjects).toEqual(['Budget', 'Taxation']);
      expect(result.summary).toBe('<p>This bill does something.</p>');
      expect(result.status).toBe('PASSED_HOUSE');
      expect(result.dataQuality).toBe('VERIFIED');
      expect(result.lastSyncedAt).toBeInstanceOf(Date);
    });

    it('handles missing sponsor', () => {
      const billWithoutSponsor = { ...mockBillDetail, sponsors: [] };
      const result = transformBillDetail(billWithoutSponsor);
      expect(result.sponsorBioguideId).toBeNull();
    });

    it('handles undefined sponsors', () => {
      const billWithoutSponsor = { ...mockBillDetail, sponsors: undefined };
      const result = transformBillDetail(billWithoutSponsor);
      expect(result.sponsorBioguideId).toBeNull();
    });

    it('handles missing policy area', () => {
      const billWithoutPolicyArea = { ...mockBillDetail, policyArea: undefined };
      const result = transformBillDetail(billWithoutPolicyArea);
      expect(result.policyAreaName).toBeNull();
    });

    it('handles missing subjects', () => {
      const billWithoutSubjects = { ...mockBillDetail, subjects: undefined };
      const result = transformBillDetail(billWithoutSubjects);
      expect(result.subjects).toEqual([]);
    });

    it('handles missing summaries', () => {
      const billWithoutSummary = { ...mockBillDetail, summaries: undefined };
      const result = transformBillDetail(billWithoutSummary);
      expect(result.summary).toBeNull();
    });
  });

  describe('transformBillAction', () => {
    const mockAction: BillAction = {
      actionDate: '2024-01-15',
      text: 'Introduced in House.',
      type: 'IntroReferral',
      actionCode: '1000',
      sourceSystem: {
        code: 9,
        name: 'Library of Congress',
      },
    };

    it('transforms action correctly', () => {
      const result = transformBillAction(mockAction, 'hr-1234-118');

      expect(result.billId).toBe('hr-1234-118');
      expect(result.actionDate).toBeInstanceOf(Date);
      expect(result.actionText).toBe('Introduced in House.');
      expect(result.actionCode).toBe('1000');
      // Chamber is mapped from sourceSystem.name
      expect(result.chamber).toBeNull(); // 'Library of Congress' doesn't map to a chamber
    });

    it('extracts chamber from sourceSystem', () => {
      const senateAction: BillAction = {
        ...mockAction,
        sourceSystem: { code: 0, name: 'Senate' },
      };
      const result = transformBillAction(senateAction, 'hr-1234-118');
      expect(result.chamber).toBe('SENATE');

      const houseAction: BillAction = {
        ...mockAction,
        sourceSystem: { code: 2, name: 'House' },
      };
      const houseResult = transformBillAction(houseAction, 'hr-1234-118');
      expect(houseResult.chamber).toBe('HOUSE');
    });

    it('handles missing actionCode', () => {
      const actionNoCode: BillAction = {
        actionDate: '2024-01-15',
        text: 'Some action.',
      };
      const result = transformBillAction(actionNoCode, 'hr-1234-118');
      expect(result.actionCode).toBeNull();
    });
  });

  describe('transformCosponsor', () => {
    const mockCosponsor: BillCosponsor = {
      bioguideId: 'B000002',
      fullName: 'Rep. Cosponsor Test',
      firstName: 'Cosponsor',
      lastName: 'Test',
      party: 'R',
      state: 'TX',
      sponsorshipDate: '2024-01-05',
      isOriginalCosponsor: true,
    };

    it('transforms cosponsor correctly', () => {
      const result = transformCosponsor(mockCosponsor, 'hr-1234-118');

      expect(result.legislatorId).toBe('B000002');
      expect(result.billId).toBe('hr-1234-118');
      expect(result.isPrimary).toBe(false);
      expect(result.cosponsorDate).toBeInstanceOf(Date);
    });

    it('handles missing sponsorshipDate', () => {
      const cosponsorNoDate: BillCosponsor = {
        ...mockCosponsor,
        sponsorshipDate: undefined,
      };
      const result = transformCosponsor(cosponsorNoDate, 'hr-1234-118');
      expect(result.cosponsorDate).toBeNull();
    });
  });

  describe('transformTextVersion', () => {
    const mockTextVersion: BillTextVersion = {
      date: '2024-01-15',
      type: 'ih',
      formats: [
        { type: 'Formatted Text', url: 'https://example.com/text' },
        { type: 'PDF', url: 'https://example.com/pdf' },
        { type: 'Formatted XML', url: 'https://example.com/xml' },
      ],
    };

    it('transforms text version correctly', () => {
      const result = transformTextVersion(mockTextVersion, 'hr-1234-118');

      expect(result).not.toBeNull();
      expect(result!.billId).toBe('hr-1234-118');
      expect(result!.versionCode).toBe('ih');
      expect(result!.versionName).toBe('Introduced in House');
      expect(result!.publishedDate).toBeInstanceOf(Date);
      // Prefers XML format
      expect(result!.textUrl).toBe('https://example.com/xml');
      expect(result!.textFormat).toBe('XML');
      expect(result!.textHash).toBe(''); // Will be computed later
    });

    it('falls back to HTML if no XML', () => {
      const htmlVersion: BillTextVersion = {
        ...mockTextVersion,
        formats: [
          { type: 'Formatted Text', url: 'https://example.com/text' },
          { type: 'HTML', url: 'https://example.com/html' },
        ],
      };
      const result = transformTextVersion(htmlVersion, 'hr-1234-118');
      expect(result!.textFormat).toBe('HTML');
    });

    it('falls back to PDF if no HTML', () => {
      const pdfVersion: BillTextVersion = {
        ...mockTextVersion,
        formats: [{ type: 'PDF', url: 'https://example.com/pdf' }],
      };
      const result = transformTextVersion(pdfVersion, 'hr-1234-118');
      expect(result!.textFormat).toBe('PDF');
    });

    it('returns null if no formats available', () => {
      const noFormats: BillTextVersion = {
        ...mockTextVersion,
        formats: [],
      };
      const result = transformTextVersion(noFormats, 'hr-1234-118');
      expect(result).toBeNull();
    });

    it('returns null if formats is undefined', () => {
      const undefinedFormats: BillTextVersion = {
        ...mockTextVersion,
        formats: undefined,
      };
      const result = transformTextVersion(undefinedFormats, 'hr-1234-118');
      expect(result).toBeNull();
    });

    it('maps version codes to human-readable names', () => {
      const versions = [
        { type: 'ih', expected: 'Introduced in House' },
        { type: 'is', expected: 'Introduced in Senate' },
        { type: 'rh', expected: 'Reported in House' },
        { type: 'rs', expected: 'Reported in Senate' },
        { type: 'eh', expected: 'Engrossed in House' },
        { type: 'es', expected: 'Engrossed in Senate' },
        { type: 'enr', expected: 'Enrolled Bill' },
        { type: 'unknown', expected: 'UNKNOWN' },
      ];

      for (const { type, expected } of versions) {
        const version: BillTextVersion = {
          date: '2024-01-15',
          type,
          formats: [{ type: 'XML', url: 'https://example.com/xml' }],
        };
        const result = transformTextVersion(version, 'hr-1234-118');
        expect(result!.versionName).toBe(expected);
      }
    });
  });

  describe('transformMemberListItem', () => {
    const mockMember: MemberListItem = {
      bioguideId: 'A000001',
      name: 'Member, Test',
      partyName: 'Democratic',
      state: 'California',
      terms: {
        item: [
          {
            chamber: 'House of Representatives',
            startYear: 2021,
            endYear: 2023,
          },
        ],
      },
      updateDate: '2024-01-15',
      url: 'https://api.congress.gov/v3/member/A000001',
    };

    it('transforms member list item correctly', () => {
      const result = transformMemberListItem(mockMember);

      expect(result.id).toBe('A000001');
      expect(result.fullName).toBe('Member, Test');
      expect(result.firstName).toBe('Test');
      expect(result.lastName).toBe('Member');
      expect(result.party).toBe('D');
      // State names are converted to 2-char codes for database CHAR(2) column
      expect(result.state).toBe('CA');
      expect(result.chamber).toBe('HOUSE');
      expect(result.inOffice).toBe(true);
      expect(result.dataSource).toBe('CONGRESS_GOV');
      expect(result.lastSyncedAt).toBeInstanceOf(Date);
    });

    it('handles missing terms', () => {
      const memberNoTerms: MemberListItem = {
        ...mockMember,
        terms: undefined,
      };
      const result = transformMemberListItem(memberNoTerms);
      expect(result.chamber).toBe('HOUSE'); // Default
      // State names are converted to 2-char codes for database CHAR(2) column
      expect(result.state).toBe('CA');
    });

    it('parses "First Last" name format', () => {
      const member: MemberListItem = {
        ...mockMember,
        name: 'John Smith',
      };
      const result = transformMemberListItem(member);
      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Smith');
    });

    it('parses "First Middle Last" name format', () => {
      const member: MemberListItem = {
        ...mockMember,
        name: 'John Adam Smith',
      };
      const result = transformMemberListItem(member);
      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Smith');
      expect(result.middleName).toBe('Adam');
    });
  });

  describe('transformMemberDetail', () => {
    const mockMemberDetail: MemberDetail = {
      bioguideId: 'A000001',
      firstName: 'Test',
      lastName: 'Member',
      directOrderName: 'Test Member',
      partyHistory: [{ partyAbbreviation: 'D', partyName: 'Democratic', startYear: 2021 }],
      state: 'California',
      terms: [
        {
          chamber: 'House of Representatives',
          startYear: 2021,
          endYear: 2023,
          congress: 117,
        },
        {
          chamber: 'House of Representatives',
          startYear: 2023,
          congress: 118,
        },
      ],
      currentMember: true,
      depiction: {
        imageUrl: 'https://bioguide.congress.gov/photo/A/A000001.jpg',
      },
      updateDate: '2024-01-15',
    };

    it('transforms member detail correctly', () => {
      const result = transformMemberDetail(mockMemberDetail);

      expect(result.firstName).toBe('Test');
      expect(result.lastName).toBe('Member');
      expect(result.fullName).toBe('Test Member');
      expect(result.party).toBe('D');
      // State names are converted to 2-char codes for database CHAR(2) column
      expect(result.state).toBe('CA');
      expect(result.chamber).toBe('HOUSE');
      expect(result.inOffice).toBe(true);
      expect(result.lastSyncedAt).toBeInstanceOf(Date);
    });

    it('handles member without current term', () => {
      const formerMember: MemberDetail = {
        ...mockMemberDetail,
        currentMember: false,
        terms: [
          {
            chamber: 'House of Representatives',
            startYear: 2019,
            endYear: 2021,
            congress: 116,
          },
        ],
      };
      const result = transformMemberDetail(formerMember);
      expect(result.inOffice).toBe(false);
    });

    it('handles missing firstName/lastName', () => {
      const memberNoNames: MemberDetail = {
        ...mockMemberDetail,
        firstName: undefined,
        lastName: undefined,
      };
      const result = transformMemberDetail(memberNoNames);
      expect(result.firstName).toBeUndefined();
      expect(result.lastName).toBeUndefined();
      expect(result.fullName).toBe('Test Member'); // Falls back to directOrderName
    });

    it('constructs fullName from firstName and lastName if directOrderName missing', () => {
      const memberNoDirectName: MemberDetail = {
        ...mockMemberDetail,
        directOrderName: undefined,
      };
      const result = transformMemberDetail(memberNoDirectName);
      expect(result.fullName).toBe('Test Member');
    });

    it('handles missing state', () => {
      const memberWithStateCode: MemberDetail = {
        ...mockMemberDetail,
        state: undefined,
        terms: [
          {
            chamber: 'House',
            stateCode: 'CA',
            startYear: 2021,
          },
        ],
      };
      const result = transformMemberDetail(memberWithStateCode);
      expect(result.state).toBe('CA');
    });

    it('handles missing chamber', () => {
      const memberNoChamber: MemberDetail = {
        ...mockMemberDetail,
        terms: undefined,
      };
      const result = transformMemberDetail(memberNoChamber);
      expect(result.chamber).toBeUndefined();
    });
  });

  describe('transformCommittee', () => {
    const mockCommittee: CommitteeListItem = {
      systemCode: 'hsag00',
      name: 'House Committee on Agriculture',
      chamber: 'House',
      committeeTypeCode: 'Standing',
      parent: null,
      url: 'https://api.congress.gov/v3/committee/house/hsag00',
      updateDate: '2024-01-15',
    };

    it('transforms committee correctly', () => {
      const result = transformCommittee(mockCommittee);

      expect(result.id).toBe('hsag00');
      expect(result.name).toBe('House Committee on Agriculture');
      expect(result.chamber).toBe('HOUSE');
      expect(result.type).toBe('STANDING');
      expect(result.parentId).toBeNull();
    });

    it('handles committee with parent', () => {
      const subcommittee: CommitteeListItem = {
        ...mockCommittee,
        systemCode: 'hsag14',
        name: 'Subcommittee on Conservation and Forestry',
        committeeTypeCode: 'Subcommittee',
        parent: { systemCode: 'hsag00', name: 'House Committee on Agriculture' },
      };

      const result = transformCommittee(subcommittee);
      expect(result.parentId).toBe('hsag00');
      expect(result.type).toBe('SUBCOMMITTEE');
    });

    it('handles Senate chamber', () => {
      const senateCommittee: CommitteeListItem = {
        ...mockCommittee,
        chamber: 'Senate',
      };
      const result = transformCommittee(senateCommittee);
      expect(result.chamber).toBe('SENATE');
    });
  });

  describe('batch transformers', () => {
    it('transforms bill batch', () => {
      const bills: BillListItem[] = [
        {
          congress: 118,
          type: 'hr',
          number: 1,
          originChamber: 'House',
          title: 'Bill 1',
          updateDate: '2024-01-01',
          url: 'https://api.congress.gov/v3/bill/118/hr/1',
        },
        {
          congress: 118,
          type: 's',
          number: 2,
          originChamber: 'Senate',
          title: 'Bill 2',
          updateDate: '2024-01-02',
          url: 'https://api.congress.gov/v3/bill/118/s/2',
        },
      ];

      const result = transformBillBatch(bills);
      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe('hr-1-118');
      expect(result[1]?.id).toBe('s-2-118');
    });

    it('transforms member batch', () => {
      const members: MemberListItem[] = [
        {
          bioguideId: 'A000001',
          name: 'Member One',
          partyName: 'Democratic',
          state: 'CA',
          updateDate: '2024-01-01',
          url: 'https://api.congress.gov/v3/member/A000001',
        },
        {
          bioguideId: 'B000002',
          name: 'Member Two',
          partyName: 'Republican',
          state: 'TX',
          updateDate: '2024-01-02',
          url: 'https://api.congress.gov/v3/member/B000002',
        },
      ];

      const result = transformMemberBatch(members);
      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe('A000001');
      expect(result[1]?.id).toBe('B000002');
    });

    it('transforms committee batch and sorts parents first', () => {
      const committees: CommitteeListItem[] = [
        {
          systemCode: 'hsag14',
          name: 'Subcommittee',
          chamber: 'House',
          committeeTypeCode: 'Subcommittee',
          parent: { systemCode: 'hsag00', name: 'Agriculture' },
          updateDate: '2024-01-01',
          url: 'https://api.congress.gov/v3/committee/house/hsag14',
        },
        {
          systemCode: 'hsag00',
          name: 'Agriculture',
          chamber: 'House',
          committeeTypeCode: 'Standing',
          parent: null,
          updateDate: '2024-01-02',
          url: 'https://api.congress.gov/v3/committee/house/hsag00',
        },
      ];

      const result = transformCommitteeBatch(committees);
      expect(result).toHaveLength(2);
      // Parents should come first
      expect(result[0]?.id).toBe('hsag00');
      expect(result[1]?.id).toBe('hsag14');
    });
  });
});
