// Load environment variables from repository root
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
loadEnv({ path: resolve(import.meta.dirname, '../../../.env') });

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.rollCallVote.count();
  console.log('Current vote count:', count);

  // Also show by congress
  const byCongress = await prisma.rollCallVote.groupBy({
    by: ['congressNumber'],
    _count: { id: true },
    orderBy: { congressNumber: 'desc' }
  });
  console.log('\nVotes by Congress:');
  byCongress.forEach(c => console.log(`  Congress ${c.congressNumber}: ${c._count.id}`));

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
