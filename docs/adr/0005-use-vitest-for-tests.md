# ADR-0005: Use Vitest for Tests

**Status:** Accepted

## Contexto
Precisávamos de um framework de testes rápido, compatível com ESM e TypeScript.

## Decisão
Usar Vitest em vez de Jest.

## Alternativas Consideradas
- **Jest:** Rejeitado. Configuração mais complexa com ESM e TypeScript; Vitest é nativo.
- **Node.js Test Runner:** Rejeitado. Ainda maturo, mas menos features de mocking e coverage.

## Tradeoffs
| Vantagem | Desvantagem |
|----------|-------------|
| Compatível com ESM nativo | Menos material de referência que Jest |
| Setup mais simples com TypeScript | — |
| API praticamente idêntica ao Jest | — |

## Consequências
- Testes usam `describe/it/expect` idênticos ao Jest
- Coverage via provider v8
- Nock continua funcionando para mock HTTP
