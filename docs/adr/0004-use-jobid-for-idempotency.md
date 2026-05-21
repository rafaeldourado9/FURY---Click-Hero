# ADR-0004: Use JobId for Idempotency

**Status:** Accepted

## Contexto
O mesmo `adId + tenantId` não deve gerar dois jobs simultâneos na fila. Precisávamos de uma estratégia de idempotência simples.

## Decisão
Usar `jobId = tenantId:adId` via BullMQ.

## Alternativas Consideradas
- **Banco de dados com tabela de deduplicação:** Rejeitado. Adiciona dependência de persistência só para idempotência.
- **Redis SETNX manual:** Rejeitado. BullMQ já gerencia jobId customizado; não reinventar a roda.

## Tradeoffs
| Vantagem | Desvantagem |
|----------|-------------|
| Simples e sem lógica extra | Depende do comportamento interno do BullMQ |
| Comportamento previsível | Job `completed/failed` não é recriado automaticamente |
| Nenhum banco de dados necessário | — |

## Consequências
- Job duplicado retorna o job existente
- Idempotência garantida pelo BullMQ sem código customizado
- Documentado no schema de enfileiramento
