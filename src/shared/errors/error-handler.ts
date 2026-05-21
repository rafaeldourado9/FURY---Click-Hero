import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from './AppError';

/**
 * Error handler global do Fastify.
 *
 * Decisões:
 * - `ZodError` → 400 com `errors.flatten()` (caso o controller deixe vazar).
 * - `AppError` → respeita o `statusCode` da exceção.
 * - Demais erros → 500 com mensagem genérica; o detalhe vai para o log
 *   estruturado do request (`request.log`), nunca para o body da resposta,
 *   para não vazar stack trace ao cliente.
 */
export const errorHandler = (
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): void => {
  if (error instanceof ZodError) {
    reply.status(400).send({ errors: error.flatten() });
    return;
  }

  if (error instanceof AppError) {
    request.log.warn({ err: error, statusCode: error.statusCode }, 'AppError');
    reply.status(error.statusCode).send({ error: error.message });
    return;
  }

  request.log.error({ err: error }, 'Unhandled error');
  reply.status(500).send({ error: 'Internal server error' });
};
