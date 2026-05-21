import type { ExternalTakedownGateway } from '../ports/ExternalTakedownGateway';
import type { TakedownResult } from '../../domain/types/TakedownResult';

/**
 * Caso de uso executado pelo worker para cada job da fila.
 *
 * Apenas orquestra a chamada ao gateway externo. Não trata retry —
 * isso é responsabilidade do BullMQ via `attempts` + `backoff` definidos
 * no enfileiramento.
 */
export class ProcessTakedownUseCase {
  constructor(private readonly gateway: ExternalTakedownGateway) {}

  async execute(jobId: string): Promise<TakedownResult> {
    return this.gateway.execute(jobId);
  }
}
