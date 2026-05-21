/**
 * Resposta normalizada de uma chamada HTTP externa.
 * Mantemos `body` como `unknown` para forçar parsing/validação no chamador.
 */
export interface HttpResponse {
  statusCode: number;
  body: unknown;
}

/**
 * Opções por requisição. `timeoutMs` é obrigatório no nível do caller —
 * nenhum gateway HTTP deve fazer chamada externa sem timeout.
 */
export interface HttpRequestOptions {
  timeoutMs: number;
}

/**
 * Contrato mínimo de cliente HTTP usado pelos gateways.
 *
 * Mantemos a interface pequena (ISP) — só os métodos efetivamente usados.
 * Trocar a implementação (undici, fetch, mock de teste) não exige mudar
 * o gateway.
 */
export interface HttpClient {
  get(url: string, options: HttpRequestOptions): Promise<HttpResponse>;
}
