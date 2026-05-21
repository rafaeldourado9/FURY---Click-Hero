import type {
  TakedownRequester,
  RequestTakedownInput,
  RequestTakedownOutput,
} from '../ports/TakedownRequester';

export type ReceiveViolationInput = RequestTakedownInput;
export type ReceiveViolationOutput = RequestTakedownOutput;

/**
 * Caso de uso de recebimento de violação.
 *
 * Responsabilidade única: delegar ao `TakedownRequester` o pedido de
 * takedown. Não conhece HTTP, BullMQ nem Redis — depende apenas da porta.
 *
 * O use case é o ponto natural para futuras políticas (deduplicação por
 * tenant, ratelimit por adId etc.) sem poluir o controller ou a fila.
 */
export class ReceiveViolationUseCase {
  constructor(private readonly takedownRequester: TakedownRequester) {}

  async execute(input: ReceiveViolationInput): Promise<ReceiveViolationOutput> {
    return this.takedownRequester.request(input);
  }
}
