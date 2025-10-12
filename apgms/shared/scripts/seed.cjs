const { prisma } = require('../src/db');

(async () => {
  try {
    const row = await prisma.bankLine.create({
      data: {
        amount: 250.0,
        description: 'Seed: opening test line',
        txDate: new Date()
      }
    });
    await prisma.auditEvent.create({
      data: { kind: 'SEED', actor: 'seed', payload: { bankLineId: row.id } }
    });
    console.log('Seeded 1 bankLine and 1 auditEvent');
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
