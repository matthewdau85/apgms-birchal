import pino from 'pino';
import { prisma } from '@apgms/shared';
const log = pino({ level: 'info' });
async function tick() {
  const count = await prisma.user.count();
  log.info({ count }, 'tick');
}
setInterval(tick, 2000);
