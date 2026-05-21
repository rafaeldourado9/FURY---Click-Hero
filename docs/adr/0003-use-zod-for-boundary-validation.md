# ADR-0003: Use Zod for Boundary Validation

**Status:** Accepted

## Contexto
Precisávamos validar payloads HTTP de forma tipada e segura, sem usar `any`.

## Decisão
Usar Zod exclusivamente na camada HTTP (controllers/schemas), nunca no domínio.

## Alternativas Consideradas
- **Joi:** Rejeitado. Não oferece inferência de tipos TypeScript nativa.
- **class-validator:** Rejeitado. Requer decorators e transformação de classes, mais verboso.
- **Validação manual:** Rejeitado. Código repetitivo e propensa a erros.

## Tradeoffs
| Vantagem | Desvantagem |
|----------|-------------|
| Tipagem inferida automaticamente | Acoplamento ao schema na camada HTTP |
| Erros detalhados sem código extra | — |
| Evita `any` nos inputs do controller | — |

## Consequências
- Schemas Zod vivem em `domain/schemas/` (camada de borda, não domínio puro)
- Use cases recebem dados já validados
- Nenhuma regra de negócio depende de Zod
