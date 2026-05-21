# FURY Takedown API

Mini-API assíncrona para recebimento de violações e processamento de takedown com BullMQ, Redis, Docker e testes automatizados.

## Stack

- Node.js 20 + TypeScript estrito
- Fastify 4 + `@fastify/swagger` + `@fastify/swagger-ui`
- BullMQ + Redis (ioredis)
- Undici (com timeout configurável)
- Zod (validação na borda HTTP)
- Pino (logs estruturados)
- Vitest

## Estrutura

Monólito modular com 3 bounded contexts:

- `violation-intake` — recebe e valida o webhook de violação.
- `takedown-execution` — enfileira e processa jobs via worker.
- `job-monitoring` — expõe o status atual de um job.

Cada contexto segue o mesmo formato: `domain/` (tipos), `application/` (ports + use cases) e `infra/` (Fastify, BullMQ, undici).

## Pré-requisitos

Apenas Docker e Docker Compose. **Não é necessário rodar `npm install` localmente** — as dependências são instaladas dentro da imagem (`Dockerfile` → `npm ci`).

## Como rodar

```bash
# Sobe Redis, API e Worker
docker compose up --build

# Em segundo plano
docker compose up --build -d

# Logs
docker compose logs -f api worker

# Derruba tudo
docker compose down
```

API em <http://localhost:3000> · Swagger UI em <http://localhost:3000/documentation>.

## Como testar

```bash
# Suite completa de testes (24 testes)
docker compose run --rm api npm run test

# Lint (ESLint com complexidade ciclomática ≤ 6)
docker compose run --rm api npm run lint

# Quality gate (lint + coverage)
docker compose run --rm api npm run quality
```

## Endpoints

### POST /webhook/violation

Recebe notificação de violação e enfileira o job de takedown (idempotente por `tenantId__adId`).

```bash
curl -X POST http://localhost:3000/webhook/violation \
  -H "Content-Type: application/json" \
  -d '{
    "adId": "ad_123",
    "tenantId": "tenant_abc",
    "violationType": "PROHIBITED_TERM",
    "severity": "HIGH",
    "detectedAt": "2026-05-20T12:00:00.000Z"
  }'
```

`violationType`: `PROHIBITED_TERM | BRAND_VIOLATION | COMPLIANCE_FAIL`
`severity`: `LOW | MEDIUM | HIGH | CRITICAL`

Resposta `202 Accepted`:

```json
{ "jobId": "tenant_abc:ad_123", "status": "waiting" }
```

Resposta `400 Bad Request` com payload inválido:

```json
{ "errors": { "fieldErrors": { "adId": ["Required"] } } }
```

### GET /jobs/:id

```bash
curl http://localhost:3000/jobs/tenant_abc:ad_123
```

Resposta `200 OK`:

```json
{
  "jobId": "tenant_abc:ad_123",
  "status": "completed",
  "attempts": 1,
  "result": {
    "success": true,
    "externalStatusCode": 200,
    "externalRequestUrl": "https://jsonplaceholder.typicode.com/posts/1",
    "processedAt": "2026-05-20T14:04:00.000Z",
    "message": "Takedown request processed successfully"
  },
  "error": null
}
```

Resposta `404 Not Found`:

```json
{ "error": "Job not found" }
```

### Swagger UI

Documentação interativa em <http://localhost:3000/documentation>.

> **Nota:** o Swagger UI já vem embutido — você pode testar os dois endpoints diretamente do navegador, sem precisar de Postman, Insomnia ou qualquer outro client HTTP. Basta subir o `docker compose up` e abrir a URL.

## Configuração (.env)

Em desenvolvimento o `docker-compose.yml` já fornece todas as variáveis. Em `NODE_ENV=production` **não há defaults** — qualquer variável faltando aborta o boot.

| Variável | Obrigatória em prod | Padrão (dev) |
|---|---|---|
| `NODE_ENV` | sim | `development` |
| `PORT` | sim | `3000` |
| `LOG_LEVEL` | sim | `info` |
| `BODY_LIMIT_BYTES` | sim | `65536` |
| `REDIS_HOST` | sim | `localhost` |
| `REDIS_PORT` | sim | `6379` |
| `REDIS_PASSWORD` | não | — |
| `EXTERNAL_TAKEDOWN_URL` | sim | `https://jsonplaceholder.typicode.com/posts/1` |
| `HTTP_TIMEOUT_MS` | sim | `5000` |

## Idempotência e retry

- `jobId = tenantId:adId` na API (forma pública conforme a spec).
- Internamente o BullMQ armazena com `__` no lugar do `:` (BullMQ 5 reserva `:` para chaves de Redis); a tradução fica confinada aos adapters em `infra/queue/`.
- O BullMQ ignora `add` se já existir job ativo com o mesmo id → mesmo `tenantId+adId` não gera dois jobs simultâneos.
- Retry automático: `attempts=3`, backoff exponencial base 1s (1s, 2s, 4s).
- Timeout HTTP (`HTTP_TIMEOUT_MS`) vira `AppError(504)` no gateway → BullMQ aplica retry.
- Worker nunca implementa retry manual — apenas lança.

## Decisões Arquiteturais

Veja `docs/adr/`.

## Comportamento BDD

Veja `docs/bdd/`.
