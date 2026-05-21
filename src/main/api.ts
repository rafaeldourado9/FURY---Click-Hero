import Fastify, { type FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { env } from '../shared/config/env';
import { errorHandler } from '../shared/errors/error-handler';
import { buildRedisConnection } from '../shared/queue/redis';
import { buildTakedownQueue } from '../shared/queue/bullmq';
import { ReceiveViolationUseCase } from '../contexts/violation-intake/application/use-cases/ReceiveViolationUseCase';
import { violationRoutes } from '../contexts/violation-intake/infra/http/violation.routes';
import { BullMqTakedownQueue } from '../contexts/takedown-execution/infra/queue/BullMqTakedownQueue';
import type { TakedownRequester } from '../contexts/violation-intake/application/ports/TakedownRequester';
import { GetJobStatusUseCase } from '../contexts/job-monitoring/application/use-cases/GetJobStatusUseCase';
import { BullMqJobStatusReader } from '../contexts/job-monitoring/infra/queue/BullMqJobStatusReader';
import { jobsRoutes } from '../contexts/job-monitoring/infra/http/jobs.routes';

/**
 * Bootstrap da API.
 *
 * Responsabilidades concentradas neste arquivo:
 * - cria UMA única conexão Redis e a compartilha entre `Queue` e
 *   `JobStatusReader` (antes a aplicação abria dois sockets);
 * - registra Swagger + Swagger UI (`/documentation`) usando o formato
 *   OpenAPI 3 — as rotas declaram `schema` próprio, então a UI fica
 *   populada com endpoints reais;
 * - aplica `bodyLimit` por env para limitar superfície de ataque;
 * - configura `onClose` para fechar fila e conexão Redis de forma
 *   determinística no shutdown.
 */
const registerSwagger = async (app: FastifyInstance): Promise<void> => {
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'FURY Takedown API',
        description: 'Mini-API assíncrona para recebimento de violações e processamento de takedown.',
        version: '1.0.0',
      },
      servers: [{ url: `http://localhost:${env.PORT}` }],
      tags: [
        { name: 'violations', description: 'Webhook de violação' },
        { name: 'jobs', description: 'Status de jobs' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/documentation',
    uiConfig: { docExpansion: 'list', deepLinking: false },
  });
};

const buildApp = async (): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
    bodyLimit: env.BODY_LIMIT_BYTES,
    // O AJV padrão do Fastify vem com `coerceTypes: 'array'` ativo, que
    // converte silenciosamente number→string, string→number, etc., antes
    // do validador rodar. Isso burlaria o Zod no controller (ex.: `adId:
    // 123` viraria `"123"`). Desligamos a coerção aqui para que o Zod
    // permaneça como único validador de tipo efetivo.
    ajv: { customOptions: { coerceTypes: false } },
  });
  app.setErrorHandler(errorHandler);

  await registerSwagger(app);

  // Conexão Redis única, compartilhada entre Queue e Reader.
  const redisConnection = buildRedisConnection();
  const queue = buildTakedownQueue(redisConnection);

  // Adapter cross-context: `BullMqTakedownQueue` (porta de saída de
  // `takedown-execution`) satisfaz o contrato `TakedownRequester` esperado
  // por `violation-intake`. Os dois ports são mantidos separados para
  // preservar a isolation entre contextos.
  const enqueuePort = new BullMqTakedownQueue(queue);
  const takedownRequester: TakedownRequester = {
    request: (input) => enqueuePort.enqueue(input),
  };
  await violationRoutes(app, new ReceiveViolationUseCase(takedownRequester));

  const jobStatusReader = new BullMqJobStatusReader(queue);
  await jobsRoutes(app, new GetJobStatusUseCase(jobStatusReader));

  app.addHook('onClose', async () => {
    await queue.close();
    await redisConnection.quit();
  });

  return app;
};

const installSignalHandlers = (app: FastifyInstance): void => {
  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'shutting down api');
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
};

const start = async (): Promise<void> => {
  const app = await buildApp();
  installSignalHandlers(app);
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  app.log.info(`Swagger UI: http://localhost:${env.PORT}/documentation`);
};

start().catch((err) => {
  console.error('Failed to start API:', err);
  process.exit(1);
});
