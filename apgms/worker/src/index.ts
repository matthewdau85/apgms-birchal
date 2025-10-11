import { logger } from './logger.js';
import { writeAuditEvent } from './audit.js';
import {
  QUEUE_NAMES,
  createQueueSystem,
  type JobContext,
  type Processor,
  type QueueName,
  type QueueSystem,
} from './queues.js';

async function main() {
  const processors = buildProcessors();
  const queueSystem = await createQueueSystem(processors, logger);
  const ticker = startHealthTicker();

  await enqueueSampleJobs(queueSystem);
  setupShutdown(queueSystem, ticker);

  process.on('unhandledRejection', (reason) => {
    logger.error({ event: 'worker.unhandled-rejection', reason }, 'Unhandled promise rejection');
  });

  process.on('uncaughtException', (error) => {
    logger.fatal({ event: 'worker.uncaught-exception', err: error }, 'Uncaught exception');
  });

  logger.info({ event: 'worker.ready', queues: QUEUE_NAMES }, 'Worker service started');
}

main().catch((error) => {
  logger.fatal({ event: 'worker.startup_failed', err: error }, 'Worker failed to start');
  process.exit(1);
});

function buildProcessors(): Record<QueueName, Processor> {
  return Object.fromEntries(
    QUEUE_NAMES.map((queueName) => [
      queueName,
      async (job: JobContext) => {
        logger.info(
          {
            event: 'queue.job.processing',
            queue: queueName,
            jobId: job.id,
            jobName: job.name,
            attempts: job.attemptsMade,
          },
          'Processing job',
        );

        try {
          await writeAuditEvent({
            queue: queueName,
            jobId: job.id,
            jobName: job.name,
            type: 'queue.job.processed',
            payload: job.data,
          });

          logger.info(
            { event: 'queue.job.processed', queue: queueName, jobId: job.id, jobName: job.name },
            'Job processed successfully',
          );
        } catch (error) {
          logger.error(
            { event: 'queue.job.audit-failed', queue: queueName, jobId: job.id, err: error },
            'Failed to write audit event',
          );

          try {
            await writeAuditEvent({
              queue: queueName,
              jobId: job.id,
              jobName: job.name,
              type: 'queue.job.failed',
              payload: job.data,
              error: error instanceof Error ? error.message : String(error),
            });
          } catch (auditError) {
            logger.error(
              {
                event: 'queue.job.audit-failed-secondary',
                queue: queueName,
                jobId: job.id,
                err: auditError,
              },
              'Failed to write failure audit event',
            );
          }

          throw error;
        }
      },
    ]),
  ) as Record<QueueName, Processor>;
}

function startHealthTicker(): NodeJS.Timeout {
  const startedAt = Date.now();
  return setInterval(() => {
    logger.info({ event: 'worker.tick', uptimeMs: Date.now() - startedAt }, 'Worker heartbeat tick');
  }, 5000);
}

async function enqueueSampleJobs(queueSystem: QueueSystem) {
  const timestamp = new Date().toISOString();

  await Promise.all(
    QUEUE_NAMES.map((queue) =>
      queueSystem.enqueue(queue, 'sample-job', {
        enqueuedAt: timestamp,
        queue,
        sample: true,
      }),
    ),
  );

  logger.info({ event: 'worker.sample-jobs.enqueued', timestamp }, 'Sample jobs enqueued');
}

function setupShutdown(queueSystem: QueueSystem, ticker: NodeJS.Timeout) {
  let shuttingDown = false;

  const handleSignal = (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.info({ event: 'worker.shutdown.start', signal }, 'Received shutdown signal');
    clearInterval(ticker);

    queueSystem
      .close()
      .then(() => {
        logger.info({ event: 'worker.shutdown.complete' }, 'Worker shutdown complete');
        process.exit(0);
      })
      .catch((error) => {
        logger.error({ event: 'worker.shutdown.error', err: error }, 'Worker shutdown encountered an error');
        process.exit(1);
      });
  };

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, handleSignal);
  }
}
