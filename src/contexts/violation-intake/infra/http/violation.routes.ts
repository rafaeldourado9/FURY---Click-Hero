import type { FastifyInstance, FastifySchema } from 'fastify';
import { ReceiveViolationUseCase } from '../../application/use-cases/ReceiveViolationUseCase';
import { buildViolationController } from './violation.controller';

/**
 * Schema OpenAPI da rota de webhook.
 *
 * O Zod continua sendo a fonte de verdade da validação (no controller);
 * este schema existe apenas para popular a UI do Swagger e dar tipagem
 * aos consumidores. Mantemos os dois manualmente sincronizados —
 * trocar isso por geração automática (`fastify-type-provider-zod`) seria
 * um upgrade futuro caso o número de rotas cresça.
 */
const webhookSchema: FastifySchema = {
  description: 'Recebe notificação de violação e enfileira job de takedown',
  tags: ['violations'],
  body: {
    type: 'object',
    required: ['adId', 'tenantId', 'violationType', 'severity', 'detectedAt'],
    properties: {
      adId: { type: 'string', minLength: 1 },
      tenantId: { type: 'string', minLength: 1 },
      violationType: { type: 'string', enum: ['PROHIBITED_TERM', 'BRAND_VIOLATION', 'COMPLIANCE_FAIL'] },
      severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
      detectedAt: { type: 'string', format: 'date-time' },
    },
  },
  response: {
    202: {
      type: 'object',
      properties: {
        jobId: { type: 'string' },
        status: { type: 'string' },
      },
    },
    400: {
      type: 'object',
      // Aceita ambos formatos: erros de validacao Zod (`errors`) e erros
      // de parser/payload do Fastify (`error`).
      properties: {
        errors: { type: 'object', additionalProperties: true },
        error: { type: 'string' },
      },
      additionalProperties: true,
    },
  },
};

/**
 * Registra a rota `POST /webhook/violation`.
 *
 * `attachValidation: true` faz o Fastify NÃO lançar erro de validação
 * baseada em JSON Schema (ele anexa em `request.validationError` e
 * segue em frente). Assim o Zod no controller continua sendo o único
 * validador efetivo, e o JSON Schema acima serve apenas para popular
 * a UI do Swagger.
 */
export const violationRoutes = async (
  app: FastifyInstance,
  useCase: ReceiveViolationUseCase,
): Promise<void> => {
  const controller = buildViolationController(useCase);

  app.post(
    '/webhook/violation',
    { schema: webhookSchema, attachValidation: true },
    async (request, reply) => {
      await controller.handleWebhook(request, reply);
    },
  );
};
