import type { Queue } from 'bullmq';
import type { JobStatusReader, JobStatus, JobResult } from '../../application/ports/JobStatusReader';
import { toInternalJobId } from '../../../takedown-execution/infra/queue/BullMqTakedownQueue';

/**
 * Implementação BullMQ de `JobStatusReader`.
 *
 * Converte o `jobId` público (`tenantId:adId`) para a forma interna do
 * BullMQ (`tenantId__adId`) antes de consultar a fila, e devolve sempre
 * a forma pública na resposta — o cliente nunca vê o separador interno.
 *
 * Mapeamento do `Job` do BullMQ para `JobStatus`:
 * - `returnvalue` (untyped) é estreitado via `Record<string, unknown>` e
 *   convertido campo a campo para respeitar `noExplicitAny`.
 * - `failedReason` (string do BullMQ) vira `{ message }`.
 * - `attempts` reflete `attemptsMade`, não o limite máximo.
 */
export class BullMqJobStatusReader implements JobStatusReader {
  constructor(private readonly queue: Queue) {}

  async findById(jobId: string): Promise<JobStatus | null> {
    const internalId = toInternalJobId(jobId);
    const job = await this.queue.getJob(internalId);
    if (!job) return null;

    const state = await job.getState();
    const returnValue = job.returnvalue as Record<string, unknown> | undefined;

    return {
      jobId,
      status: state,
      attempts: job.attemptsMade,
      result: returnValue ? this.toJobResult(returnValue) : null,
      error: job.failedReason ? { message: job.failedReason } : null,
    };
  }

  private toJobResult(value: Record<string, unknown>): JobResult {
    return {
      success: Boolean(value.success),
      externalStatusCode: Number(value.externalStatusCode),
      externalRequestUrl: String(value.externalRequestUrl),
      processedAt: String(value.processedAt),
      message: String(value.message),
    };
  }
}
