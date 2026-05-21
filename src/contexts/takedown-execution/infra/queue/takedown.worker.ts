import { Worker, type Job } from 'bullmq';
import type Redis from 'ioredis';
import type { Logger } from 'pino';
import { ProcessTakedownUseCase } from '../../application/use-cases/ProcessTakedownUseCase';
import type { TakedownResult } from '../../domain/types/TakedownResult';
import { TAKEDOWN_QUEUE_NAME } from '../../../../shared/queue/bullmq';
import { buildJobId } from './BullMqTakedownQueue';

interface TakedownJobData {
  adId: string;
  tenantId: string;
  violationType: string;
  severity: string;
  detectedAt: string;
}

/**
 * Constrói o BullMQ Worker que consome jobs de takedown.
 *
 * O worker é deliberadamente "burro":
 * - delega o processamento ao `ProcessTakedownUseCase`;
 * - se o use case lançar, o BullMQ aplica retry com o `backoff` definido
 *   no enfileiramento (3 tentativas, exponencial).
 *
 * Logs estruturados via pino — nada de `console.log` no caminho quente
 * para evitar logs sem contexto e PII vazada.
 */
export const buildTakedownWorker = (
  redisConnection: Redis,
  processUseCase: ProcessTakedownUseCase,
  logger: Logger,
): Worker => {
  const worker = new Worker<TakedownJobData, TakedownResult>(
    TAKEDOWN_QUEUE_NAME,
    async (job: Job<TakedownJobData>) => {
      // O `job.id` interno usa `__` (BullMQ não aceita `:`). Para o use case
      // passamos a forma pública (`tenantId:adId`) — derivada dos dados,
      // que são imunes a mudança de separador.
      const publicJobId = buildJobId(job.data.tenantId, job.data.adId);
      return processUseCase.execute(publicJobId);
    },
    { connection: redisConnection },
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, attempts: job.attemptsMade }, 'job completed');
  });

  worker.on('failed', (job, err) => {
    logger.warn(
      { jobId: job?.id, attempts: job?.attemptsMade, err: { message: err.message, name: err.name } },
      'job failed',
    );
  });

  worker.on('error', (err) => {
    logger.error({ err: { message: err.message, name: err.name } }, 'worker error');
  });

  return worker;
};
