import type { TakedownResult } from '../../domain/types/TakedownResult';

/**
 * Porta de saída para a integração externa de takedown.
 *
 * Recebe apenas o `jobId` — toda a informação que o worker precisa para
 * compor a requisição externa está embutida na implementação concreta
 * (ex.: URL configurável). Trocar JSONPlaceholder pela API real da Meta
 * exige apenas uma nova implementação desta porta.
 *
 * O contrato é: retornar `TakedownResult` em sucesso (2xx); **lançar** em
 * qualquer falha. Lançar é o sinal que o worker BullMQ usa para acionar
 * retry/backoff exponencial — não implementamos retry manual aqui.
 */
export interface ExternalTakedownGateway {
  execute(jobId: string): Promise<TakedownResult>;
}
