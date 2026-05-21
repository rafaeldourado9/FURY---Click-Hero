/**
 * Resultado serializado de um job de takedown processado com sucesso.
 *
 * É o `returnvalue` do BullMQ e o `result` exposto em `GET /jobs/:id`.
 * Mantemos como `interface` (sem classe) porque o objeto trafega via
 * Redis/JSON — métodos não sobreviveriam à serialização.
 */
export interface TakedownResult {
  success: boolean;
  externalStatusCode: number;
  externalRequestUrl: string;
  processedAt: string;
  message: string;
}
