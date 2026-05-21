import type { TakedownQueue, EnqueueInput, EnqueueOutput } from '../ports/TakedownQueue';

/**
 * Caso de uso de enfileiramento.
 *
 * Hoje delega 1:1 à porta — o valor real é arquitetural: garante que
 * `ReceiveViolationUseCase` dependa de uma abstração (`TakedownRequester`/
 * `TakedownQueue`) e não diretamente do BullMQ.
 */
export class EnqueueTakedownUseCase {
  constructor(private readonly queue: TakedownQueue) {}

  async execute(input: EnqueueInput): Promise<EnqueueOutput> {
    return this.queue.enqueue(input);
  }
}
