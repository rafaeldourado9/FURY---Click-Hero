import { Queue } from 'bullmq';
import type Redis from 'ioredis';

/**
 * Nome canônico da fila de takedown.
 * Centralizado aqui para que `Queue` e `Worker` nunca divirjam.
 */
export const TAKEDOWN_QUEUE_NAME = 'takedown';

/**
 * Constrói a `Queue` do BullMQ reutilizando uma conexão Redis existente.
 *
 * Recebe a conexão por injeção (em vez de criar internamente) para que a
 * aplicação tenha um único socket Redis e o shutdown seja determinístico.
 */
export const buildTakedownQueue = (connection: Redis): Queue => {
  return new Queue(TAKEDOWN_QUEUE_NAME, { connection });
};
