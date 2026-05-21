/**
 * Resultado de sucesso conforme persistido pelo worker no `returnvalue`.
 * Espelha `TakedownResult`. Mantido duplicado aqui para não criar
 * acoplamento cross-context (cada bounded context define os tipos
 * que expõe).
 */
export interface JobResult {
  success: boolean;
  externalStatusCode: number;
  externalRequestUrl: string;
  processedAt: string;
  message: string;
}

/**
 * Erro persistido pelo BullMQ quando o job atinge `failed`.
 * `stack` é opcional e só é exposto para clientes internos.
 */
export interface JobError {
  message: string;
  stack?: string;
}

/**
 * Resposta de `GET /jobs/:id`, conforme spec do desafio:
 * `{ jobId, status, attempts, result, error }`.
 *
 * `result` e `error` são mutuamente exclusivos na prática (um job que
 * completou não tem error; um que falhou não tem result), mas o
 * consumidor deve checar pelo `status` em vez de assumir essa exclusão.
 */
export interface JobStatus {
  jobId: string;
  status: string;
  attempts: number;
  result: JobResult | null;
  error: JobError | null;
}

/**
 * Porta de saída do contexto Job Monitoring para leitura por id.
 * Retorna `null` quando o job não existe (o controller converte em 404).
 */
export interface JobStatusReader {
  findById(jobId: string): Promise<JobStatus | null>;
}
