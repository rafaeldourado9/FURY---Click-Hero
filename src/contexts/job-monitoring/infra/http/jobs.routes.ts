import type { FastifyInstance, FastifySchema } from 'fastify';
import { GetJobStatusUseCase } from '../../application/use-cases/GetJobStatusUseCase';
import { buildJobsController } from './jobs.controller';

/**
 * Schema OpenAPI para `GET /jobs/:id`.
 *
 * Apenas documental — o use case decide o conteúdo da resposta, então a
 * propriedade `response` aqui é uma especificação para humanos
 * (e para a UI do Swagger), não validação.
 */
const getJobSchema: FastifySchema = {
  description: 'Consulta o status atual de um job de takedown',
  tags: ['jobs'],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', description: 'jobId no formato tenantId:adId' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        jobId: { type: 'string' },
        status: { type: 'string' },
        attempts: { type: 'number' },
        result: {
          type: ['object', 'null'],
          properties: {
            success: { type: 'boolean' },
            externalStatusCode: { type: 'number' },
            externalRequestUrl: { type: 'string' },
            processedAt: { type: 'string' },
            message: { type: 'string' },
          },
        },
        error: {
          type: ['object', 'null'],
          properties: {
            message: { type: 'string' },
            stack: { type: 'string' },
          },
        },
      },
    },
    404: {
      type: 'object',
      properties: { error: { type: 'string' } },
    },
  },
};

export const jobsRoutes = async (
  app: FastifyInstance,
  useCase: GetJobStatusUseCase,
): Promise<void> => {
  const controller = buildJobsController(useCase);

  app.get(
    '/jobs/:id',
    { schema: getJobSchema, attachValidation: true },
    async (request, reply) => {
      await controller.getStatus(
        request as Parameters<typeof controller.getStatus>[0],
        reply,
      );
    },
  );
};
