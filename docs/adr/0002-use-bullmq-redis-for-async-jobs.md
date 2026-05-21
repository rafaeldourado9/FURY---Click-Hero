# ADR-0002: Use BullMQ + Redis for Async Jobs

**Status:** Accepted

## Contexto
O processamento de takedown deve ser assíncrono com retry automático, backoff e idempotência. Precisávamos escolher uma engine de fila.

## Decisão
Usar BullMQ com Redis como backend de fila.

## Alternativas Consideradas
- **RabbitMQ:** Rejeitado. Excelente para sistemas distribuídos, mas excessivo para um único worker e uma fila.
- **Fila em memória:** Rejeitado. Não durável entre reinícios de processo e não oferece retry nativo.
- **Bull (v3):** Rejeitado. BullMQ é a versão moderna com suporte a TypeScript de primeira classe.

## Tradeoffs
| Vantagem | Desvantagem |
|----------|-------------|
| Job status, retry e backoff nativos | Requer Redis |
| jobId customizado resolve idempotência | Overhead de Redis para projeto pequeno |
| API TypeScript de primeira classe | — |

## Consequências
- Worker e API compartilham a mesma fila via Redis
- Retry automático configurado no BullMQ (não no worker)
- Idempotência via jobId customizado
