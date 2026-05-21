/**
 * Entrada para enfileiramento de takedown.
 * Carrega os mesmos campos do payload de violação validado.
 */
export interface EnqueueInput {
  adId: string;
  tenantId: string;
  violationType: string;
  severity: string;
  detectedAt: string;
}

/**
 * Resultado do enfileiramento.
 * `status` reflete o estado inicial atribuído pela fila (`waiting`).
 */
export interface EnqueueOutput {
  jobId: string;
  status: string;
}

/**
 * Porta de saída do contexto Takedown Execution para enfileiramento.
 *
 * O use case `EnqueueTakedownUseCase` depende desta interface; a
 * implementação concreta (`BullMqTakedownQueue`) vive em `infra/`.
 * Trocar a engine de fila (ex.: RabbitMQ, SQS) não exige mudar o use case.
 */
export interface TakedownQueue {
  enqueue(input: EnqueueInput): Promise<EnqueueOutput>;
}
