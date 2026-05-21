import { request } from 'undici';
import { AppError } from '../errors/AppError';
import type { HttpClient, HttpRequestOptions, HttpResponse } from './HttpClient';

/**
 * Implementação de `HttpClient` baseada em undici.
 *
 * Particularidades importantes:
 * - Aplica `headersTimeout` E `bodyTimeout` para que a chamada externa nunca
 *   pendure o worker indefinidamente.
 * - Converte timeouts em `AppError` com `statusCode=504` para que o BullMQ
 *   trate como falha retriável (sem precisar inspecionar a causa).
 * - Lê o body como JSON best-effort. O caller decide se valida ou ignora.
 */
export class UndiciHttpClient implements HttpClient {
  async get(url: string, options: HttpRequestOptions): Promise<HttpResponse> {
    try {
      const { statusCode, body } = await request(url, {
        method: 'GET',
        headersTimeout: options.timeoutMs,
        bodyTimeout: options.timeoutMs,
      });

      const responseBody = await this.safeParseJson(body);
      return { statusCode, body: responseBody };
    } catch (err) {
      throw this.normalizeError(err);
    }
  }

  private async safeParseJson(body: { json(): Promise<unknown>; text(): Promise<string> }): Promise<unknown> {
    try {
      return await body.json();
    } catch {
      return null;
    }
  }

  private normalizeError(err: unknown): Error {
    if (err instanceof AppError) {
      return err;
    }
    const message = err instanceof Error ? err.message : String(err);
    if (this.isTimeout(err)) {
      return new AppError(`External HTTP timeout: ${message}`, 504);
    }
    return new AppError(`External HTTP error: ${message}`, 502);
  }

  private isTimeout(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    return /timeout/i.test(err.message) || err.name === 'HeadersTimeoutError' || err.name === 'BodyTimeoutError';
  }
}
