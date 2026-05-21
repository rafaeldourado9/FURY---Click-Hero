import type { FastifyRequest, FastifyReply } from 'fastify';
import { GetJobStatusUseCase } from '../../application/use-cases/GetJobStatusUseCase';

type JobsRequest = FastifyRequest<{ Params: { id: string } }>;

interface JobsController {
  getStatus(request: JobsRequest, reply: FastifyReply): Promise<void>;
}

/**
 * Controller de `GET /jobs/:id`.
 *
 * - `null` do use case → 404 com mensagem genérica (não distingue id
 *   mal-formado de inexistente — para o cliente, ambos são "não encontrado").
 * - job encontrado → 200 com o `JobStatus` completo.
 */
export const buildJobsController = (useCase: GetJobStatusUseCase): JobsController => ({
  async getStatus(request: JobsRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params;
    const result = await useCase.execute(id);

    if (!result) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    return reply.status(200).send(result);
  },
});
