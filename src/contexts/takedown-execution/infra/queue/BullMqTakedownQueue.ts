import type { Queue } from 'bullmq';
import type { TakedownQueue, EnqueueInput, EnqueueOutput } from '../../application/ports/TakedownQueue';

const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_DELAY_MS = 1_000;
const PUBLIC_SEPARATOR = ':';
const INTERNAL_SEPARATOR = '__';

/**
 * Forma pública do `jobId` exposta pela API: `tenantId:adId`,
 * conforme a spec do desafio.
 */
export const buildJobId = (tenantId: string, adId: string): string =>
  `${tenantId}${PUBLIC_SEPARATOR}${adId}`;

/**
 * Conversor público → interno (`:` → `__`).
 *
 * BullMQ 5 rejeita `:` em custom ids (é reservado para chaves internas
 * no Redis), então a fila armazena `tenantId__adId`. Essa tradução fica
 * confinada aos adaptadores BullMQ — os contratos da aplicação só
 * trafegam a forma pública.
 *
 * `replace` (não `replaceAll`) é proposital: substitui apenas o primeiro
 * `:` (o separador), preservando colons válidos dentro de `tenantId` ou
 * `adId` caso apareçam no futuro.
 */
export const toInternalJobId = (publicId: string): string =>
  publicId.replace(PUBLIC_SEPARATOR, INTERNAL_SEPARATOR);

/**
 * Implementação BullMQ da porta `TakedownQueue`.
 *
 * Idempotência: usamos `buildJobId(tenantId, adId)` como chave determinística.
 * O id é traduzido para a forma interna do BullMQ na hora de enfileirar.
 * Se já houver job com o mesmo id em estado waiting/active/delayed,
 * `queue.add` é ignorado — duplicatas naturais não geram jobs paralelos.
 *
 * Retry: `attempts=3` com backoff exponencial base 1s (1s, 2s, 4s).
 * O worker apenas lança erro — o BullMQ aplica o retry automaticamente.
 */
export class BullMqTakedownQueue implements TakedownQueue {
  constructor(private readonly queue: Queue) {}

  async enqueue(input: EnqueueInput): Promise<EnqueueOutput> {
    const publicJobId = buildJobId(input.tenantId, input.adId);
    const internalJobId = toInternalJobId(publicJobId);

    await this.queue.add(
      'takedown',
      {
        adId: input.adId,
        tenantId: input.tenantId,
        violationType: input.violationType,
        severity: input.severity,
        detectedAt: input.detectedAt,
      },
      {
        jobId: internalJobId,
        attempts: MAX_ATTEMPTS,
        backoff: { type: 'exponential', delay: BACKOFF_BASE_DELAY_MS },
        removeOnComplete: false,
        removeOnFail: false,
      },
    );

    return { jobId: publicJobId, status: 'waiting' };
  }
}
