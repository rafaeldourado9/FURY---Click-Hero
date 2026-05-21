import { pino, type Logger } from 'pino';
import { env } from '../shared/config/env';
import { buildRedisConnection } from '../shared/queue/redis';
import { UndiciHttpClient } from '../shared/http/UndiciHttpClient';
import { ProcessTakedownUseCase } from '../contexts/takedown-execution/application/use-cases/ProcessTakedownUseCase';
import { JsonPlaceholderTakedownGateway } from '../contexts/takedown-execution/infra/gateways/JsonPlaceholderTakedownGateway';
import { buildTakedownWorker } from '../contexts/takedown-execution/infra/queue/takedown.worker';

/**
 * Bootstrap do worker (processo separado da API).
 *
 * Mantém apenas composição (DI) e ciclo de vida:
 * - logger estruturado pino (mesma família do Fastify);
 * - conexão Redis dedicada (não compartilhada com a API porque rodam em
 *   processos distintos no docker-compose);
 * - shutdown gracioso fecha worker e conexão antes do `process.exit`.
 */
const start = async (logger: Logger): Promise<void> => {
  const redisConnection = buildRedisConnection();
  const httpClient = new UndiciHttpClient();
  const gateway = new JsonPlaceholderTakedownGateway(httpClient);
  const processUseCase = new ProcessTakedownUseCase(gateway);
  const worker = buildTakedownWorker(redisConnection, processUseCase, logger);

  logger.info('worker started');

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutting down worker');
    await worker.close();
    await redisConnection.quit();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
};

const logger = pino({ level: env.LOG_LEVEL, name: 'takedown-worker' });

start(logger).catch((err) => {
  logger.fatal({ err }, 'failed to start worker');
  process.exit(1);
});
