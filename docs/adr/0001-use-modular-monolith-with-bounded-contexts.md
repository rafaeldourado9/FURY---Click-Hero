# ADR-0001: Use Modular Monolith with Bounded Contexts

**Status:** Accepted

## Contexto
O desafio requer uma API assíncrona com processamento de violações e takedown. Precisávamos definir um estilo arquitetural que demonstrasse separação de responsabilidades sem overengineering.

## Decisão
Usar monólito modular com bounded contexts (violation-intake, takedown-execution, job-monitoring) dentro de um único processo.

## Alternativas Consideradas
- **Microserviços:** Rejeitado. Overkill para 3 endpoints e 1 worker. Adicionaria complexidade operacional desnecessária.
- **MVC tradicional:** Rejeitado. Não demonstra separação de domínio nem facilita testes unitários por contexto.

## Tradeoffs
| Vantagem | Desvantagem |
|----------|-------------|
| Fronteiras claras entre contextos | Mais estrutura de pastas que um MVC simples |
| Testabilidade por contexto | Exige disciplina para não misturar contextos |
| Sem complexidade operacional de microserviços | — |
| Proporcional ao tamanho do desafio | — |

## Consequências
- Cada contexto tem suas próprias portas (interfaces)
- Nenhum contexto importa infraestrutura do outro
- Injeção de dependência conecta as peças nos pontos de entrada
