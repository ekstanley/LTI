/**
 * Dump full API response to see actual field names
 */
import { config } from '../src/config.js';

async function main() {
  const endpoint = '/house-vote/118/1/1';
  const url = `${config.congress.baseUrl}${endpoint}`;
  const fullUrl = `${url}?api_key=${config.congress.apiKey}&format=json`;

  console.log('Fetching:', fullUrl.replace(config.congress.apiKey || '', 'HIDDEN'));

  const res = await fetch(fullUrl);
  const data = await res.json() as Record<string, unknown>;

  console.log('\n=== Full houseRollCallVote object ===');
  const vote = (data as { houseRollCallVote: Record<string, unknown> }).houseRollCallVote;
  console.log(JSON.stringify(vote, null, 2));
}

main().catch(console.error);
