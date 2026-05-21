import type { FastifyRequest, FastifyReply } from 'fastify';
import { ReceiveViolationUseCase } from '../../application/use-cases/ReceiveViolationUseCase';
import { ViolationSchema } from '../../domain/schemas/violation.schema';

interface ViolationController {
  handleWebhook(request: FastifyRequest, reply: FastifyReply): Promise<void>;
}

/**
 * Controller HTTP do contexto Violation Intake.
 *
 * Mantém-se fino propositalmente:
 * - valida o body com Zod (`safeParse` — sem throw, sem stack trace exposta);
 * - encaminha ao use case;
 * - converte resposta em `202 Accepted` (job ainda não foi processado,
 *   só foi aceito na fila).
 *
 * Qualquer regra de negócio deve subir para o use case, não viver aqui.
 */
export const buildViolationController = (useCase: ReceiveViolationUseCase): ViolationController => ({
  async handleWebhook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const parsed = ViolationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ errors: parsed.error.flatten() });
    }
    const result = await useCase.execute(parsed.data);
    return reply.status(202).send(result);
  },
});
