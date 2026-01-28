/**
 * Enum Mapper Tests
 *
 * Verifies bidirectional transformation between Prisma and API enums.
 */

import { describe, it, expect } from 'vitest';
import {
  billTypeToApi,
  apiToBillType,
  billTypeToChamber,
  partyToApi,
  apiToParty,
  chamberToApi,
  apiToChamber,
  billStatusToApi,
  apiToBillStatus,
  votePositionToApi,
  apiToVotePosition,
  voteResultToApi,
  apiToVoteResult,
} from '../../mappers/enums.js';

describe('Enum Mappers', () => {
  describe('billTypeToApi', () => {
    it('converts HR to hr', () => {
      expect(billTypeToApi('HR')).toBe('hr');
    });

    it('converts S to s', () => {
      expect(billTypeToApi('S')).toBe('s');
    });

    it('converts all bill types correctly', () => {
      expect(billTypeToApi('HJRES')).toBe('hjres');
      expect(billTypeToApi('SJRES')).toBe('sjres');
      expect(billTypeToApi('HCONRES')).toBe('hconres');
      expect(billTypeToApi('SCONRES')).toBe('sconres');
      expect(billTypeToApi('HRES')).toBe('hres');
      expect(billTypeToApi('SRES')).toBe('sres');
    });
  });

  describe('apiToBillType', () => {
    it('converts hr to HR', () => {
      expect(apiToBillType('hr')).toBe('HR');
    });

    it('converts s to S', () => {
      expect(apiToBillType('s')).toBe('S');
    });

    it('is inverse of billTypeToApi', () => {
      const types = ['hr', 's', 'hjres', 'sjres', 'hconres', 'sconres', 'hres', 'sres'] as const;
      for (const t of types) {
        expect(billTypeToApi(apiToBillType(t))).toBe(t);
      }
    });
  });

  describe('billTypeToChamber', () => {
    it('returns house for House bill types', () => {
      expect(billTypeToChamber('HR')).toBe('house');
      expect(billTypeToChamber('HRES')).toBe('house');
      expect(billTypeToChamber('HJRES')).toBe('house');
      expect(billTypeToChamber('HCONRES')).toBe('house');
    });

    it('returns senate for Senate bill types', () => {
      expect(billTypeToChamber('S')).toBe('senate');
      expect(billTypeToChamber('SRES')).toBe('senate');
      expect(billTypeToChamber('SJRES')).toBe('senate');
      expect(billTypeToChamber('SCONRES')).toBe('senate');
    });
  });

  describe('partyToApi', () => {
    it('maps D to D (identical)', () => {
      expect(partyToApi('D')).toBe('D');
    });

    it('maps R to R (identical)', () => {
      expect(partyToApi('R')).toBe('R');
    });

    it('maps all parties correctly', () => {
      expect(partyToApi('I')).toBe('I');
      expect(partyToApi('L')).toBe('L');
      expect(partyToApi('G')).toBe('G');
    });

    it('maps Other to Independent', () => {
      expect(partyToApi('O')).toBe('I');
    });
  });

  describe('apiToParty', () => {
    it('maps D to D', () => {
      expect(apiToParty('D')).toBe('D');
    });

    it('maps all API parties correctly', () => {
      expect(apiToParty('R')).toBe('R');
      expect(apiToParty('I')).toBe('I');
      expect(apiToParty('L')).toBe('L');
      expect(apiToParty('G')).toBe('G');
    });
  });

  describe('chamberToApi', () => {
    it('converts HOUSE to house', () => {
      expect(chamberToApi('HOUSE')).toBe('house');
    });

    it('converts SENATE to senate', () => {
      expect(chamberToApi('SENATE')).toBe('senate');
    });
  });

  describe('apiToChamber', () => {
    it('converts house to HOUSE', () => {
      expect(apiToChamber('house')).toBe('HOUSE');
    });

    it('converts senate to SENATE', () => {
      expect(apiToChamber('senate')).toBe('SENATE');
    });

    it('returns null for joint (no Prisma equivalent)', () => {
      expect(apiToChamber('joint')).toBeNull();
    });
  });

  describe('billStatusToApi', () => {
    it('converts INTRODUCED to introduced', () => {
      expect(billStatusToApi('INTRODUCED')).toBe('introduced');
    });

    it('converts IN_COMMITTEE to in_committee', () => {
      expect(billStatusToApi('IN_COMMITTEE')).toBe('in_committee');
    });

    it('collapses REPORTED_BY_COMMITTEE to in_committee', () => {
      expect(billStatusToApi('REPORTED_BY_COMMITTEE')).toBe('in_committee');
    });

    it('converts SIGNED_INTO_LAW to became_law', () => {
      expect(billStatusToApi('SIGNED_INTO_LAW')).toBe('became_law');
    });

    it('maps VETO_OVERRIDDEN to became_law', () => {
      expect(billStatusToApi('VETO_OVERRIDDEN')).toBe('became_law');
    });

    it('maps POCKET_VETOED to vetoed', () => {
      expect(billStatusToApi('POCKET_VETOED')).toBe('vetoed');
    });

    it('maps WITHDRAWN to failed', () => {
      expect(billStatusToApi('WITHDRAWN')).toBe('failed');
    });

    it('maps ENACTED to became_law', () => {
      expect(billStatusToApi('ENACTED')).toBe('became_law');
    });
  });

  describe('apiToBillStatus', () => {
    it('converts introduced to INTRODUCED', () => {
      expect(apiToBillStatus('introduced')).toBe('INTRODUCED');
    });

    it('converts became_law to SIGNED_INTO_LAW', () => {
      expect(apiToBillStatus('became_law')).toBe('SIGNED_INTO_LAW');
    });
  });

  describe('votePositionToApi', () => {
    it('converts YEA to yea', () => {
      expect(votePositionToApi('YEA')).toBe('yea');
    });

    it('converts NAY to nay', () => {
      expect(votePositionToApi('NAY')).toBe('nay');
    });

    it('converts PRESENT to present', () => {
      expect(votePositionToApi('PRESENT')).toBe('present');
    });

    it('converts NOT_VOTING to not_voting', () => {
      expect(votePositionToApi('NOT_VOTING')).toBe('not_voting');
    });
  });

  describe('apiToVotePosition', () => {
    it('converts yea to YEA', () => {
      expect(apiToVotePosition('yea')).toBe('YEA');
    });

    it('is inverse of votePositionToApi', () => {
      const positions = ['yea', 'nay', 'present', 'not_voting'] as const;
      for (const p of positions) {
        expect(votePositionToApi(apiToVotePosition(p))).toBe(p);
      }
    });
  });

  describe('voteResultToApi', () => {
    it('converts PASSED to passed', () => {
      expect(voteResultToApi('PASSED')).toBe('passed');
    });

    it('converts FAILED to failed', () => {
      expect(voteResultToApi('FAILED')).toBe('failed');
    });

    it('converts AGREED_TO to agreed_to', () => {
      expect(voteResultToApi('AGREED_TO')).toBe('agreed_to');
    });

    it('converts REJECTED to rejected', () => {
      expect(voteResultToApi('REJECTED')).toBe('rejected');
    });
  });

  describe('apiToVoteResult', () => {
    it('converts passed to PASSED', () => {
      expect(apiToVoteResult('passed')).toBe('PASSED');
    });

    it('is inverse of voteResultToApi', () => {
      const results = ['passed', 'failed', 'agreed_to', 'rejected'] as const;
      for (const r of results) {
        expect(voteResultToApi(apiToVoteResult(r))).toBe(r);
      }
    });
  });
});
