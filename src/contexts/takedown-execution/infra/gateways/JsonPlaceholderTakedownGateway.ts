import { AppError } from '../../../../shared/errors/AppError';
import { env } from '../../../../shared/config/env';
import type { HttpClient } from '../../../../shared/http/HttpClient';
import type { ExternalTakedownGateway } from '../../application/ports/ExternalTakedownGateway';
import type { TakedownResult } from '../../domain/types/TakedownResult';

/**
 * Implementação que faz uma chamada GET para um endpoint externo (por
 * padrão, JSONPlaceholder) para simular a integração com a Meta Ads API.
 *
 * Política de erro (essencial para o ciclo de retry do BullMQ):
 * - 2xx → retorna `TakedownResult` com `success=true`.
 * - 4xx / 5xx → lança `AppError(statusCode)`.
 * - Timeout / falha de rede → o `UndiciHttpClient` já converte para
 *   `AppError(504|502)`, mantendo o contrato "qualquer falha lança".
 *
 * O `jobId` é recebido mas não é usado no GET (JSONPlaceholder não
 * consome payload). Mantemos o parâmetro na assinatura para que a
 * troca futura por uma integração real (POST com body) não exija mudar
 * o use case que chama esta porta.
 */
export class JsonPlaceholderTakedownGateway implements ExternalTakedownGateway {
  constructor(private readonly httpClient: HttpClient) {}

  async execute(_jobId: string): Promise<TakedownResult> {
    const response = await this.httpClient.get(env.EXTERNAL_TAKEDOWN_URL, {
      timeoutMs: env.HTTP_TIMEOUT_MS,
    });

    if (response.statusCode >= 400) {
      throw new AppError('External takedown request failed', response.statusCode);
    }

    return {
      success: true,
      externalStatusCode: response.statusCode,
      externalRequestUrl: env.EXTERNAL_TAKEDOWN_URL,
      processedAt: new Date().toISOString(),
      message: 'Takedown request processed successfully',
    };
  }
}
