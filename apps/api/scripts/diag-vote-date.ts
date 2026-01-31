/**
 * Quick diagnostic: Check what date format Congress.gov API returns
 * for vote detail endpoint
 *
 * Run: pnpm --filter @ltip/api exec tsx scripts/diag-vote-date.ts
 */
import { config } from '../src/config.js';

async function main() {
  // Test a vote that was failing in the import (h118-1-296)
  const testCases = [
    { congress: 118, session: 1, rollCall: 296 },
    { congress: 118, session: 1, rollCall: 1 },
    { congress: 118, session: 1, rollCall: 320 },
  ];

  console.log('=== Congress.gov Vote API Date Format Diagnostic ===\n');
  console.log('API Key present:', !!config.congress.apiKey);
  console.log('API Base URL:', config.congress.baseUrl);
  console.log('');

  for (const { congress, session, rollCall } of testCases) {
    const endpoint = `/house-vote/${congress}/${session}/${rollCall}`;
    const url = `${config.congress.baseUrl}${endpoint}`;
    const fullUrl = config.congress.apiKey
      ? `${url}?api_key=${config.congress.apiKey}&format=json`
      : `${url}?format=json`;

    console.log(`\n--- Testing: ${endpoint} ---`);
    console.log('URL:', fullUrl.replace(config.congress.apiKey || '', 'HIDDEN'));

    try {
      const res = await fetch(fullUrl);
      const data = await res.json() as Record<string, unknown>;

      console.log('HTTP Status:', res.status);
      console.log('Response keys:', Object.keys(data));

      if ((data as { houseRollCallVote?: Record<string, unknown> }).houseRollCallVote) {
        const vote = (data as { houseRollCallVote: Record<string, unknown> }).houseRollCallVote;
        console.log('\n  === houseRollCallVote date analysis ===');
        console.log('  date field value:', JSON.stringify(vote.date));
        console.log('  date typeof:', typeof vote.date);
        console.log('  date === null:', vote.date === null);
        console.log('  date === undefined:', vote.date === undefined);
        console.log('  date === "":', vote.date === '');

        // Test Date parsing
        console.log('\n  === Date constructor test ===');
        const dateVal = vote.date;
        const dateObj = new Date(dateVal as string);
        console.log('  new Date(date):', String(dateObj));
        console.log('  isNaN(date.getTime()):', isNaN(dateObj.getTime()));
        console.log('  dateObj.toString():', dateObj.toString());

        // Show some other key fields
        console.log('\n  === Other fields ===');
        console.log('  congress:', vote.congress);
        console.log('  sessionNumber:', vote.sessionNumber);
        console.log('  rollCallNumber:', vote.rollCallNumber);
        console.log('  result:', vote.result);
        console.log('  totalYea:', vote.totalYea);
        console.log('  members length:', (vote.members as unknown[])?.length ?? 'N/A');
      } else {
        console.log('\nWARNING: houseRollCallVote NOT present in response');
        if ((data as { error?: unknown }).error) {
          console.log('Error:', JSON.stringify((data as { error: unknown }).error));
        }
        // Show full response for debugging
        console.log('Full response:', JSON.stringify(data, null, 2).slice(0, 500));
      }
    } catch (error) {
      console.error('Fetch error:', error);
    }
  }
}

main().catch(console.error);
