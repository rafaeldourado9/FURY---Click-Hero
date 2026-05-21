/**
 * Entrada do pedido de takedown vinda do contexto de Violation Intake.
 * Espelha (em string) o payload já validado pelo Zod na borda HTTP.
 */
export interface RequestTakedownInput {
  adId: string;
  tenantId: string;
  violationType: string;
  severity: string;
  detectedAt: string;
}

/**
 * Resultado retornado ao cliente HTTP após o enfileiramento.
 * `jobId` segue o formato `tenantId:adId` (garantia de idempotência).
 */
export interface RequestTakedownOutput {
  jobId: string;
  status: string;
}

/**
 * Porta de saída do contexto Violation Intake.
 *
 * Implementada em `takedown-execution` (via `BullMqTakedownQueue`).
 * Mantemos a interface aqui — no contexto que precisa dela — para que
 * `violation-intake` não dependa de pacotes do contexto de execução.
 */
export interface TakedownRequester {
  request(input: RequestTakedownInput): Promise<RequestTakedownOutput>;
}
