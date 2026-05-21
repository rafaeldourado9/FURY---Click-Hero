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

## Estrutura do projeto

Monólito modular Node.js + TypeScript com **3 bounded contexts** isolados. Cada contexto segue **Ports & Adapters** (Hexagonal): `domain/` (tipos puros), `application/` (ports + use cases) e `infra/` (adapters concretos — Fastify, BullMQ, undici).

### Mapa completo

```
FURY Takedown API/
├── docker-compose.yml          # Stack: api + worker + redis (healthcheck)
├── Dockerfile                  # Imagem única para api e worker
├── .dockerignore               # Impede node_modules do host vazar pro build
├── .env.example                # Variáveis de ambiente (defaults só em dev)
├── eslint.config.js            # Complexidade ciclomática ≤6, sem `any`
├── tsconfig.json               # TS estrito (cobre src + tests)
├── tsconfig.build.json         # Build de produção (exclui tests)
├── vitest.config.ts            # Config dos testes
│
├── src/
│   ├── main/                                  # Entry points (DI + bootstrap)
│   │   ├── api.ts                             # Fastify + Swagger + rotas
│   │   └── worker.ts                          # Worker BullMQ (processo separado)
│   │
│   ├── contexts/                              # Bounded contexts (1 pasta = 1 responsabilidade)
│   │   │
│   │   ├── violation-intake/                  # CONTEXTO 1: recebe webhook
│   │   │   ├── domain/schemas/                #   tipos puros (Zod schema)
│   │   │   ├── application/                   #   regras de negócio
│   │   │   │   ├── ports/                     #     interfaces de saída
│   │   │   │   └── use-cases/                 #     ReceiveViolationUseCase
│   │   │   └── infra/http/                    #   adapter Fastify (controller + routes)
│   │   │
│   │   ├── takedown-execution/                # CONTEXTO 2: enfileira + processa
│   │   │   ├── domain/types/                  #   TakedownResult
│   │   │   ├── application/
│   │   │   │   ├── ports/                     #     TakedownQueue, ExternalTakedownGateway
│   │   │   │   └── use-cases/                 #     EnqueueTakedown + ProcessTakedown
│   │   │   └── infra/
│   │   │       ├── gateways/                  #   adapter HTTP externo (JSONPlaceholder)
│   │   │       └── queue/                     #   adapter BullMQ + worker
│   │   │
│   │   └── job-monitoring/                    # CONTEXTO 3: consulta status
│   │       ├── application/
│   │       │   ├── ports/                     #     JobStatusReader
│   │       │   └── use-cases/                 #     GetJobStatusUseCase
│   │       └── infra/
│   │           ├── http/                      #   GET /jobs/:id
│   │           └── queue/                     #   leitor BullMQ
│   │
│   └── shared/                                # Cross-cutting (NÃO domínio)
│       ├── config/env.ts                      # Env validado com Zod
│       ├── errors/                            # AppError + error handler global
│       ├── http/                              # HttpClient (port) + UndiciHttpClient (adapter)
│       └── queue/                             # Conexão Redis + factory da Queue
│
├── tests/
│   ├── unit/                                  # Testes unitários (mocks)
│   │   ├── violation-intake/
│   │   ├── takedown-execution/
│   │   ├── job-monitoring/
│   │   └── shared/
│   └── integration/http/routes.test.ts        # Testes HTTP (Fastify inject)
│
└── docs/
    ├── adr/                                   # Architecture Decision Records
    │   ├── 0001-...modular-monolith...md
    │   ├── 0002-...bullmq-redis...md
    │   ├── 0003-...zod-for-boundary...md
    │   ├── 0004-...jobid-for-idempotency...md
    │   ├── 0005-...vitest...md
    │   └── 0006-...cyclomatic-complexity...md
    └── bdd/                                   # Especificações Gherkin por contexto
        ├── violation-intake.feature
        ├── takedown-execution.feature
        └── job-monitoring.feature
```

### Convenção de camadas (igual em todos os contextos)

| Camada | Conhece | Não conhece | Exemplo |
|---|---|---|---|
| `domain/` | nada externo | tudo | `violation.schema.ts` |
| `application/ports/` | só tipos do `domain/` | infraestrutura | `TakedownQueue` (interface) |
| `application/use-cases/` | ports + domain | Fastify, BullMQ, undici | `ProcessTakedownUseCase` |
| `infra/` | tudo de fora + ports | — | `BullMqTakedownQueue` |

**Regra de ouro:** dependências sempre apontam **pra dentro** (`infra → application → domain`). Isso permite trocar BullMQ por SQS, JSONPlaceholder pela Meta API real, ou Fastify por Express — sem tocar use case nem domain.

### Por onde o avaliador deve começar

Ordem recomendada de leitura (15 min cobrem o projeto inteiro):

1. **`src/main/api.ts`** — DI explícita, mostra como os 3 contextos se conectam.
2. **`src/contexts/violation-intake/domain/schemas/violation.schema.ts`** — contrato do webhook (Zod).
3. **`src/contexts/violation-intake/infra/http/violation.controller.ts`** — fluxo: parse Zod → use case → 202.
4. **`src/contexts/takedown-execution/infra/queue/BullMqTakedownQueue.ts`** — idempotência + retry/backoff.
5. **`src/contexts/takedown-execution/infra/queue/takedown.worker.ts`** — worker "burro" delega ao use case.
6. **`src/contexts/job-monitoring/infra/queue/BullMqJobStatusReader.ts`** — mapeia estado BullMQ → resposta da spec.
7. **`docs/adr/`** — justificativa de cada decisão arquitetural.

### Onde está o quê (índice rápido por requisito do desafio)

| Requisito do sprint | Arquivo principal |
|---|---|
| Webhook + validação Zod | `src/contexts/violation-intake/infra/http/violation.controller.ts` |
| Schema do payload | `src/contexts/violation-intake/domain/schemas/violation.schema.ts` |
| Enfileiramento BullMQ | `src/contexts/takedown-execution/infra/queue/BullMqTakedownQueue.ts` |
| Retry `attempts:3` + backoff exponencial | `BullMqTakedownQueue.ts` linhas 4-5, 60-61 |
| Idempotência `tenantId+adId` | `BullMqTakedownQueue.ts` (`buildJobId`) |
| Worker + chamada HTTP externa | `src/contexts/takedown-execution/infra/queue/takedown.worker.ts` + `infra/gateways/JsonPlaceholderTakedownGateway.ts` |
| GET /jobs/:id | `src/contexts/job-monitoring/infra/http/jobs.controller.ts` |
| Timeout HTTP tratado como retriável | `src/shared/http/UndiciHttpClient.ts` |


## Pré-requisitos

Escolha **uma** das opções abaixo:

- **Opção A — Apenas Docker** (recomendada): Docker + Docker Compose. Nada precisa ser instalado no host.
- **Opção B — npm direto**: Node.js 20+ no host. Redis pode ser rodado via Docker (`docker compose up redis`) ou local.

---

## Opção A — Rodar com Docker (recomendada)

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

### Testar via Docker

```bash
# Suite completa (47 testes)
docker compose run --rm api npm run test

# Lint (ESLint com complexidade ciclomática ≤ 6)
docker compose run --rm api npm run lint

# Quality gate (lint + coverage)
docker compose run --rm api npm run quality
```

---

## Opção B — Rodar com npm

```bash
# 1. Instalar dependências
npm install

# 2. Subir só o Redis via Docker (única dependência externa)
docker compose up -d redis

# 3. Variáveis de ambiente (.env já vai por defaults em dev)
cp .env.example .env

# 4. API e Worker em terminais separados
npm run dev:api     # tsx watch — recarrega ao salvar
npm run dev:worker

# Build de produção
npm run build
npm run start:api   # node dist/main/api.js
npm run start:worker
```

### Testar via npm

```bash
npm run test            # 47 testes Vitest
npm run test:watch      # modo watch
npm run test:coverage   # com coverage HTML em ./coverage/
npm run lint            # ESLint
npm run typecheck       # tsc --noEmit em todo o projeto
npm run build           # tsc -p tsconfig.build.json (emite dist/)
npm run quality         # lint + coverage
```

---

## Endpoints

### POST /webhook/violation

Recebe notificação de violação e enfileira o job de takedown (idempotente por `tenantId+adId`).

**Schema do payload**

| Campo | Tipo | Validação |
|---|---|---|
| `adId` | string | obrigatório, não vazio |
| `tenantId` | string | obrigatório, não vazio |
| `violationType` | enum | `PROHIBITED_TERM \| BRAND_VIOLATION \| COMPLIANCE_FAIL` |
| `severity` | enum | `LOW \| MEDIUM \| HIGH \| CRITICAL` |
| `detectedAt` | string | ISO 8601 datetime com timezone |

**Como testar (request + response capturados em execução real)**

Request:

```bash
curl -X POST http://localhost:3000/webhook/violation \
  -H "Content-Type: application/json" \
  -d '{
    "adId": "ad_demo_001",
    "tenantId": "tenant_demo",
    "violationType": "PROHIBITED_TERM",
    "severity": "HIGH",
    "detectedAt": "2026-05-21T18:00:00.000Z"
  }'
```

Response — `202 Accepted`:

```json
{ "jobId": "tenant_demo:ad_demo_001", "status": "waiting" }
```

**Testando o caminho de erro** — request com `adId` vazio, `violationType`/`severity` fora do enum e `detectedAt` inválido:

```bash
curl -X POST http://localhost:3000/webhook/violation \
  -H "Content-Type: application/json" \
  -d '{
    "adId": "",
    "tenantId": "tenant_demo",
    "violationType": "INVALID",
    "severity": "EXTREME",
    "detectedAt": "not-iso"
  }'
```

Response — `400 Bad Request` (payload real do Zod `flatten()`):

```json
{
  "errors": {
    "formErrors": [],
    "fieldErrors": {
      "adId": ["String must contain at least 1 character(s)"],
      "violationType": ["Invalid enum value. Expected 'PROHIBITED_TERM' | 'BRAND_VIOLATION' | 'COMPLIANCE_FAIL', received 'INVALID'"],
      "severity": ["Invalid enum value. Expected 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', received 'EXTREME'"],
      "detectedAt": ["Invalid datetime"]
    }
  }
}
```

### GET /jobs/:id

Request:

```bash
curl http://localhost:3000/jobs/tenant_demo:ad_demo_001
```

Response — `200 OK` (job processado com sucesso):

```json
{
  "jobId": "tenant_demo:ad_demo_001",
  "status": "completed",
  "attempts": 1,
  "result": {
    "success": true,
    "externalStatusCode": 200,
    "externalRequestUrl": "https://jsonplaceholder.typicode.com/posts/1",
    "processedAt": "2026-05-21T22:05:17.692Z",
    "message": "Takedown request processed successfully"
  },
  "error": null
}
```

Response — `404 Not Found`:

```json
{ "error": "Job not found" }
```

**Estados possíveis de `status`**: `waiting`, `active`, `completed`, `failed`, `delayed` (vindo direto do BullMQ).

### Swagger UI

Documentação interativa em <http://localhost:3000/documentation>.

> **Nota:** o Swagger UI já vem embutido — você pode testar os dois endpoints diretamente do navegador, sem precisar de Postman, Insomnia ou qualquer outro client HTTP. Basta subir a stack e abrir a URL.

## Configuração (.env)

Em desenvolvimento o `docker-compose.yml` já fornece todas as variáveis (ou use `cp .env.example .env` se for rodar via npm). Em `NODE_ENV=production` **não há defaults** — qualquer variável faltando aborta o boot.

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
