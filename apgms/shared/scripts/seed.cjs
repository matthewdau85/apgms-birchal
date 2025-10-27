const { prisma } = require('../src/db');

(async () => {
  try {
    const org = await prisma.org.upsert({
      where: { id: 'seed-org' },
      update: {},
      create: {
        id: 'seed-org',
        name: 'Seed Org',
      },
    });

    await prisma.bankLine.create({
      data: {
        orgId: org.id,
        date: new Date(),
        amount: 123.45,
        payee: 'Seed payee',
        desc: 'Seed row',
      },
    });

    console.log('Seeded 1 bankLine');
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
