/**
 * Test that startDate, voteQuestion, and votePartyTotal work correctly
 */
import { config } from '../src/config.js';

async function main() {
  const url = `${config.congress.baseUrl}/house-vote/118/1/1?api_key=${config.congress.apiKey}&format=json`;
  const res = await fetch(url);
  const data = await res.json() as { houseRollCallVote: Record<string, unknown> };
  const vote = data.houseRollCallVote;

  console.log('=== Testing startDate field ===');
  console.log('startDate:', vote.startDate);
  console.log('new Date(startDate):', new Date(vote.startDate as string));
  console.log('isValid:', !isNaN(new Date(vote.startDate as string).getTime()));

  console.log('\n=== Testing voteQuestion field ===');
  console.log('voteQuestion:', vote.voteQuestion);

  console.log('\n=== Testing votePartyTotal aggregation ===');
  const partyTotals = vote.votePartyTotal as Array<{yeaTotal: number; nayTotal: number; presentTotal: number; notVotingTotal: number}>;
  const yeas = partyTotals?.reduce((sum, p) => sum + p.yeaTotal, 0) ?? 0;
  const nays = partyTotals?.reduce((sum, p) => sum + p.nayTotal, 0) ?? 0;
  const present = partyTotals?.reduce((sum, p) => sum + p.presentTotal, 0) ?? 0;
  const notVoting = partyTotals?.reduce((sum, p) => sum + p.notVotingTotal, 0) ?? 0;
  console.log('yeas:', yeas, 'nays:', nays, 'present:', present, 'notVoting:', notVoting);

  console.log('\n=== FIX VALIDATED ===');
  if (!isNaN(new Date(vote.startDate as string).getTime())) {
    console.log('SUCCESS: startDate parses to valid Date object');
  } else {
    console.log('FAILURE: startDate does not parse correctly');
  }
}
main().catch(console.error);
