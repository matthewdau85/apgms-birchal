import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const org = await prisma.org.upsert({
    where: { id: 'seed-org-1' },
    update: {},
    create: { id: 'seed-org-1', name: 'Seed Org' }
  });
  await prisma.user.upsert({
    where: { email: 'demo@apgms.local' },
    update: {},
    create: { email: 'demo@apgms.local', orgId: org.id }
  });
  console.log('Seed complete');
}
main().finally(() => prisma.$disconnect());
