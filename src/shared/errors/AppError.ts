/**
 * Erro de aplicação carregando um `statusCode` HTTP.
 *
 * Usado para distinguir falhas previstas (4xx, 5xx, timeout) de erros
 * inesperados — o `error-handler` da API responde com o `statusCode` quando
 * o erro é uma `AppError`, e cai para 500 genérico em qualquer outro caso.
 *
 * No worker, lançar `AppError` é a forma idiomática de sinalizar que o
 * BullMQ deve aplicar retry (sem implementar retry manual).
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, AppError);
  }
}
