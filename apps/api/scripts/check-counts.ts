/**
 * Quick validation count check
 * Run: pnpm exec tsx scripts/check-counts.ts
 */

import { prisma } from '../src/db/client.js';

async function main() {
  console.log("=== Database Record Counts ===\n");

  // Legislators
  const legislators = await prisma.legislator.count();
  const legPass = legislators >= 440;
  console.log(`Legislators: ${legislators} (threshold: 440) ${legPass ? '✓' : '✗ FAIL'}`);

  // Committees
  const committees = await prisma.committee.count();
  const comPass = committees >= 224;
  console.log(`Committees: ${committees} (threshold: 224) ${comPass ? '✓' : '✗ FAIL'}`);

  // Bills by Congress
  const bills118 = await prisma.bill.count({ where: { congressNumber: 118 }});
  const bills119 = await prisma.bill.count({ where: { congressNumber: 119 }});
  const totalBills = await prisma.bill.count();
  const bills118Pass = bills118 >= 12000;
  const bills119Pass = bills119 >= 4000;
  const totalBillsPass = totalBills >= 16000;
  console.log(`Bills Congress 118: ${bills118} (threshold: 12000) ${bills118Pass ? '✓' : '✗ FAIL'}`);
  console.log(`Bills Congress 119: ${bills119} (threshold: 4000) ${bills119Pass ? '✓' : '✗ FAIL'}`);
  console.log(`Total Bills: ${totalBills} (threshold: 16000) ${totalBillsPass ? '✓' : '✗ FAIL'}`);

  // Roll calls
  const rollCalls118 = await prisma.rollCallVote.count({ where: { congressNumber: 118 }});
  const rollCalls119 = await prisma.rollCallVote.count({ where: { congressNumber: 119 }});
  const totalRollCalls = await prisma.rollCallVote.count();
  const rc118Pass = rollCalls118 >= 1200; // 80% of 1500
  const rc119Pass = rollCalls119 >= 240;  // 80% of 300
  console.log(`Roll Calls Congress 118: ${rollCalls118} (threshold: 1200) ${rc118Pass ? '✓' : '✗ FAIL'}`);
  console.log(`Roll Calls Congress 119: ${rollCalls119} (threshold: 240) ${rc119Pass ? '✓' : '✗ FAIL'}`);
  console.log(`Total Roll Calls: ${totalRollCalls}`);

  // Individual votes
  const votes = await prisma.vote.count();
  console.log(`Individual Votes: ${votes}`);

  // Roll calls with votes (referential integrity check)
  const rollCallsWithVotes = await prisma.rollCallVote.count({
    where: { individualVotes: { some: {} } },
  });
  const rcIntegrityPass = totalRollCalls === 0 || rollCallsWithVotes === totalRollCalls;
  console.log(`Roll Calls with Votes: ${rollCallsWithVotes}/${totalRollCalls} ${rcIntegrityPass ? '✓' : '✗ FAIL (some roll calls have no votes)'}`);

  // Congresses
  const congresses = await prisma.congress.count();
  console.log(`Congresses: ${congresses}`);

  // Summary
  console.log("\n=== Summary ===");
  const failures = [
    !legPass && 'Legislator Count',
    !comPass && 'Committee Count',
    !bills118Pass && 'Bills Congress 118',
    !bills119Pass && 'Bills Congress 119',
    !totalBillsPass && 'Total Bills',
    !rc118Pass && 'Roll Calls Congress 118',
    !rc119Pass && 'Roll Calls Congress 119',
    !rcIntegrityPass && 'Roll Call Integrity',
  ].filter(Boolean);

  if (failures.length === 0) {
    console.log("All validation checks PASSED ✓");
  } else {
    console.log(`FAILED CHECKS (${failures.length}):`);
    failures.forEach(f => console.log(`  - ${f}`));
  }

  await prisma.$disconnect();
}

main().catch(console.error);
