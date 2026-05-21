# ADR-0006: Use Cyclomatic Complexity Quality Gate

**Status:** Accepted

## Contexto
Precisávamos garantir que o código permaneça simples, testável e manutenível.

## Decisão
Configurar ESLint com `complexity: 6` como quality gate.

## Alternativas Consideradas
- **SonarQube:** Rejeitado. Ferramenta externa pesada; ESLint integrado ao CI é suficiente.
- **Limite mais alto (10):** Rejeitado. 6 força funções realmente pequenas e focadas.
- **Sem quality gate:** Rejeitado. Não demonstra preocupação com qualidade de código.

## Tradeoffs
| Vantagem | Desvantagem |
|----------|-------------|
| Força funções menores e mais testáveis | Pode exigir refatorações pequenas |
| Evita controllers com regra de negócio | — |
| Demonstra qualidade de código objetivamente | — |

## Consequências
- Funções com mais de 5 caminhos independentes geram erro de lint
- Extrair guards e métodos auxiliares se torna prática comum
- Quality gate (`npm run quality`) inclui lint + coverage
