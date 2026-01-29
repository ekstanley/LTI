/**
 * Diagnostic: Use EXACT same code path as import-votes.ts
 * Tests getVoteDetail() with config loading and rate limiting
 *
 * Run: pnpm exec tsx scripts/diag-vote-import.ts
 */
import { config } from '../src/config.js';
import {
  getCongressApiLimiter,
  fetchWithRetry,
} from '../src/ingestion/index.js';

// Copy of types from import-votes.ts
interface CongressVoteDetail {
  congress: number;
  chamber: string;
  sessionNumber: number;
  rollCallNumber: number;
  date: string;
  result?: string;
  voteType?: string;
  question?: string;
  description?: string;
  members?: Array<{
    bioguideId: string;
    name: string;
    party: string;
    state: string;
    votePosition: string;
  }>;
}

interface VoteDetailResponse {
  houseRollCallVote: CongressVoteDetail;
}

const rateLimiter = getCongressApiLimiter();

function buildApiUrl(endpoint: string, params: Record<string, string | number> = {}): string {
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

async function getVoteDetail(
  congress: number,
  chamber: string,
  session: number,
  rollCallNumber: number
): Promise<CongressVoteDetail | null> {
  const endpoint = `/${chamber}-vote/${congress}/${session}/${rollCallNumber}`;
  const url = buildApiUrl(endpoint);

  console.log(`\nTesting URL: ${url.replace(config.congress.apiKey || '', 'HIDDEN')}`);

  try {
    const response = await apiFetch<VoteDetailResponse>(url);
    console.log('Response keys:', Object.keys(response));
    console.log('houseRollCallVote present:', 'houseRollCallVote' in response);
    console.log('houseRollCallVote value type:', typeof response.houseRollCallVote);
    if (response.houseRollCallVote) {
      console.log('Vote detail keys:', Object.keys(response.houseRollCallVote));
      console.log('Vote result:', response.houseRollCallVote.result);
      console.log('Members count:', response.houseRollCallVote.members?.length ?? 0);
    } else {
      console.log('houseRollCallVote is:', response.houseRollCallVote);
    }
    return response.houseRollCallVote ?? null;
  } catch (error) {
    console.error('ERROR in getVoteDetail:', error);
    return null;
  }
}

async function main() {
  console.log('=== Diagnostic: Using Import Code Path ===\n');

  // Show config
  console.log('Config:');
  console.log('  baseUrl:', config.congress.baseUrl);
  console.log('  apiKey set:', !!config.congress.apiKey);
  if (config.congress.apiKey) {
    console.log('  apiKey prefix:', config.congress.apiKey.slice(0, 8) + '...');
  } else {
    console.log('  WARNING: No API key configured!');
  }

  // Test a known good vote (from my earlier diagnostic)
  console.log('\n--- Test 1: Congress 118, Session 1, Roll Call 1 ---');
  const detail1 = await getVoteDetail(118, 'house', 1, 1);
  console.log('Result:', detail1 ? 'SUCCESS' : 'NULL (WOULD BE SKIPPED)');

  // Test another
  console.log('\n--- Test 2: Congress 118, Session 2, Roll Call 1 ---');
  const detail2 = await getVoteDetail(118, 'house', 2, 1);
  console.log('Result:', detail2 ? 'SUCCESS' : 'NULL (WOULD BE SKIPPED)');

  // Test 119
  console.log('\n--- Test 3: Congress 119, Session 1, Roll Call 1 ---');
  const detail3 = await getVoteDetail(119, 'house', 1, 1);
  console.log('Result:', detail3 ? 'SUCCESS' : 'NULL (WOULD BE SKIPPED)');

  // Summary
  console.log('\n=== Summary ===');
  const success = [detail1, detail2, detail3].filter(Boolean).length;
  const failed = 3 - success;
  console.log(`Success: ${success}/3`);
  console.log(`Would skip: ${failed}/3`);

  if (failed > 0) {
    console.log('\nConclusion: Same error pattern as import! Investigate the failures above.');
  } else {
    console.log('\nConclusion: All fetches succeeded. Issue may be elsewhere.');
  }
}

main().catch(console.error);
