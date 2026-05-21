# DEVELOPMENT KIT — FURY Takedown API
> Desafio Técnico Full Stack Pleno · Documentação completa de desenvolvimento

---

## Sumário

1. [Visão Geral do Desafio](#1-visão-geral-do-desafio)
2. [Escopo Funcional](#2-escopo-funcional)
3. [Escopo Não Funcional](#3-escopo-não-funcional)
4. [Stack Técnica](#4-stack-técnica)
5. [Arquitetura](#5-arquitetura)
6. [Bounded Contexts](#6-bounded-contexts)
7. [Estrutura de Pastas](#7-estrutura-de-pastas)
8. [Fluxo da Aplicação](#8-fluxo-da-aplicação)
9. [Estratégia de Idempotência](#9-estratégia-de-idempotência)
10. [Estratégia de Retry e Backoff](#10-estratégia-de-retry-e-backoff)
11. [Princípios SOLID Aplicados](#11-princípios-solid-aplicados)
12. [Estratégia de Testes](#12-estratégia-de-testes)
13. [TDD — Test-Driven Development](#13-tdd--test-driven-development)
14. [BDD — Behavior-Driven Development](#14-bdd--behavior-driven-development)
15. [Complexidade Ciclomática](#15-complexidade-ciclomática)
16. [Docker](#16-docker)
17. [ADRs — Architectural Decision Records](#17-adrs--architectural-decision-records)
18. [Técnicas Ágeis](#18-técnicas-ágeis)
19. [Engenharia de Prompt](#19-engenharia-de-prompt)
20. [Ordem de Implementação](#20-ordem-de-implementação)
21. [Critérios de Aceite Final](#21-critérios-de-aceite-final)

---

## 1. Visão Geral do Desafio

O projeto **FURY** é um gestor autônomo de tráfego pago movido a IA. Uma de suas funcionalidades centrais é a integração com a Meta Ads API para detectar anúncios com violação, processar ações automatizadas e expor o estado dessas operações.

Este kit documenta a implementação de uma **mini-API assíncrona** que simula o fluxo real do Sprint 1:

```
Webhook de violação → Validação → Fila BullMQ → Worker → Integração HTTP simulada
```

O objetivo é demonstrar **senioridade técnica pela qualidade**, não pela quantidade de features. A arquitetura é proporcional ao tamanho do problema.

---

## 2. Escopo Funcional

| # | Funcionalidade | Endpoint | Descrição |
|---|----------------|----------|-----------|
| 1 | Receber webhook de violação | `POST /webhook/violation` | Valida payload e enfileira job |
| 2 | Processar job de takedown | Worker interno | Faz chamada HTTP e trata resultado |
| 3 | Consultar status do job | `GET /jobs/:id` | Retorna estado atual do job na fila |

### Payload do webhook

```json
{
  "adId": "ad_123",
  "tenantId": "tenant_abc",
  "violationType": "PROHIBITED_TERM",
  "severity": "HIGH",
  "detectedAt": "2026-05-20T12:00:00.000Z"
}
```

### Resposta de sucesso (`202 Accepted`)

```json
{
  "jobId": "tenant_abc:ad_123",
  "status": "waiting"
}
```

### Resposta de status do job

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

---

## 3. Escopo Não Funcional

| Requisito | Detalhe |
|-----------|---------|
| Tipagem consistente | TypeScript sem `any` espalhado |
| Validação na borda | Zod no controller, não no domínio |
| Idempotência | `jobId = tenantId:adId` evita jobs duplicados |
| Retry automático | BullMQ com 3 tentativas e backoff exponencial |
| Testabilidade | Interfaces de porta permitem mock em testes |
| Observabilidade básica | Status, attempts, result e error no endpoint |
| Complexidade controlada | ESLint com limite de complexidade ciclomática ≤ 6 |
| Containerização | Docker Compose com api, worker e redis |
| Documentação | ADRs, BDD, README e este kit |

---

## 4. Stack Técnica

```
Runtime:      Node.js + TypeScript
Framework:    Fastify
Validação:    Zod
Fila:         BullMQ + Redis (ioredis)
HTTP Client:  Undici
Testes:       Vitest + Nock (mock HTTP)
Lint:         ESLint (complexidade ciclomática)
Infra:        Docker + Docker Compose
```

### Justificativas rápidas

- **Fastify** → mais performático que Express, suporte nativo a TypeScript e schemas
- **Zod** → validação com inferência de tipo; sem duplicação entre schema e type
- **BullMQ** → job status, retry, backoff e idempotência via jobId nativos
- **Undici** → client HTTP nativo do Node.js, sem dependência extra pesada
- **Vitest** → compatível com ESM, rápido e com API similar ao Jest

---

## 5. Arquitetura

### Estilo arquitetural

**Monólito Modular com Bounded Contexts** dentro de um único processo (dois processos Docker: api e worker). Sem microserviços, sem Kafka, sem banco de dados, sem overengineering.

```
┌──────────────────────────────────────────────────────────┐
│                    Monólito Modular                        │
│                                                            │
│  ┌──────────────────┐   ┌──────────────────────────────┐  │
│  │ Violation Intake │   │    Takedown Execution         │  │
│  │                  │──▶│                               │  │
│  │ POST /webhook    │   │  BullMQ Queue + Worker        │  │
│  │ Zod Validation   │   │  HTTP Gateway (JSONPlaceholder)│  │
│  └──────────────────┘   └──────────────────────────────┘  │
│                                      │                     │
│  ┌───────────────────────────────────▼─────────────────┐  │
│  │               Job Monitoring                         │  │
│  │               GET /jobs/:id                          │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
             │                    │
         [Redis]          [JSONPlaceholder]
```

### Camadas por bounded context

```
Controller (HTTP)  →  Use Case (Application)  →  Port (Interface)
                                                      ↑
                                               Infra (Implementação)
```

Cada context tem suas próprias portas. **Nenhum context importa diretamente a infraestrutura do outro.** A injeção de dependência conecta as peças em `api.ts` e `worker.ts`.

---

## 6. Bounded Contexts

### 6.1 Violation Intake Context

**Responsabilidade:** receber, validar e encaminhar notificações de violação.

```
violation-intake/
  domain/
    entities/
      Violation.ts            ← entidade com propriedades tipadas
    value-objects/
      AdId.ts                 ← wrapper com validação
      TenantId.ts
      Severity.ts
      ViolationType.ts
    schemas/
      violation.schema.ts     ← schema Zod (camada HTTP, não domínio)
  application/
    ports/
      TakedownRequester.ts    ← interface de saída
    use-cases/
      ReceiveViolationUseCase.ts
  infra/
    http/
      violation.controller.ts
      violation.routes.ts
```

**Porta de saída:**
```typescript
export interface TakedownRequester {
  request(input: RequestTakedownInput): Promise<RequestTakedownOutput>;
}
```

O use case depende da interface. Não conhece BullMQ, Redis nem HTTP externo.

### 6.2 Takedown Execution Context

**Responsabilidade:** enfileirar e processar jobs de takedown de forma assíncrona.

```
takedown-execution/
  domain/
    entities/
      TakedownJob.ts
    types/
      TakedownResult.ts
  application/
    ports/
      ExternalTakedownGateway.ts
      TakedownQueue.ts
    use-cases/
      EnqueueTakedownUseCase.ts
      ProcessTakedownUseCase.ts
  infra/
    gateways/
      JsonPlaceholderTakedownGateway.ts
    queue/
      BullMqTakedownQueue.ts
      takedown.worker.ts
```

**Porta de saída do gateway:**
```typescript
export interface ExternalTakedownGateway {
  execute(jobId: string): Promise<TakedownResult>;
}
```

**Porta da fila:**
```typescript
export interface TakedownQueue {
  enqueue(input: EnqueueInput): Promise<EnqueueOutput>;
}
```

### 6.3 Job Monitoring Context

**Responsabilidade:** expor o estado atual de um job para consulta HTTP.

```
job-monitoring/
  application/
    ports/
      JobStatusReader.ts
    use-cases/
      GetJobStatusUseCase.ts
  infra/
    http/
      jobs.controller.ts
      jobs.routes.ts
    queue/
      BullMqJobStatusReader.ts
```

**Porta de leitura:**
```typescript
export interface JobStatusReader {
  findById(jobId: string): Promise<JobStatus | null>;
}
```

---

## 7. Estrutura de Pastas

```
fury-takedown-api/
├── docs/
│   ├── adr/
│   │   ├── 0001-use-modular-monolith-with-bounded-contexts.md
│   │   ├── 0002-use-bullmq-redis-for-async-jobs.md
│   │   ├── 0003-use-zod-for-boundary-validation.md
│   │   ├── 0004-use-jobid-for-idempotency.md
│   │   ├── 0005-use-vitest-for-tests.md
│   │   └── 0006-use-cyclomatic-complexity-quality-gate.md
│   ├── bdd/
│   │   ├── violation-intake.feature
│   │   ├── takedown-execution.feature
│   │   └── job-monitoring.feature
│   └── architecture/
│       ├── context-map.md
│       ├── quality-strategy.md
│       └── testing-strategy.md
│
├── src/
│   ├── main/
│   │   ├── api.ts               ← bootstrap Fastify + injeção de dependências
│   │   └── worker.ts            ← bootstrap BullMQ Worker + injeção de dependências
│   │
│   ├── shared/
│   │   ├── config/
│   │   │   └── env.ts           ← variáveis de ambiente validadas com Zod
│   │   ├── errors/
│   │   │   ├── AppError.ts
│   │   │   └── error-handler.ts
│   │   ├── http/
│   │   │   ├── HttpClient.ts    ← interface
│   │   │   └── UndiciHttpClient.ts
│   │   └── queue/
│   │       ├── redis.ts
│   │       └── bullmq.ts
│   │
│   └── contexts/
│       ├── violation-intake/    ← (estrutura detalhada acima)
│       ├── takedown-execution/
│       └── job-monitoring/
│
├── tests/
│   ├── unit/
│   │   ├── violation-intake/
│   │   ├── takedown-execution/
│   │   └── job-monitoring/
│   └── integration/
│       ├── http/
│       ├── queue/
│       └── worker/
│
├── docker-compose.yml
├── Dockerfile
├── package.json
├── tsconfig.json
├── eslint.config.js
├── vitest.config.ts
└── README.md
```

---

## 8. Fluxo da Aplicação

### Fluxo happy path

```
1. Cliente envia POST /webhook/violation
2. violation.controller.ts recebe a requisição
3. violation.schema.ts (Zod) valida o payload
   → Se inválido: retorna 400 com erros detalhados
4. ReceiveViolationUseCase chama TakedownRequester.request()
5. BullMqTakedownQueue.enqueue() cria job com jobId = tenantId:adId
   → Se job já existe (waiting/active): retorna o job existente
6. API retorna 202 Accepted com { jobId, status: "waiting" }
7. Worker recebe o job da fila
8. ProcessTakedownUseCase chama ExternalTakedownGateway.execute()
9. JsonPlaceholderTakedownGateway faz GET para jsonplaceholder
   → 2xx: retorna TakedownResult de sucesso
   → 4xx/5xx/timeout: lança erro → BullMQ aplica retry
10. Job marcado como "completed" com result
11. GET /jobs/:id retorna o status com result e attempts
```

### Tratamento de erro no worker

```
Falha → BullMQ captura o erro → Verifica attempts restantes
      → Se tentativas < 3: reagenda com backoff exponencial
      → Se tentativas = 3: marca como "failed" com error
```

---

## 9. Estratégia de Idempotência

### Problema

O mesmo `adId + tenantId` não deve gerar dois jobs simultâneos na fila.

### Solução

Usar **jobId customizado** do BullMQ:

```typescript
const jobId = `${input.tenantId}:${input.adId}`;

await queue.add("takedown", payload, {
  jobId,
  attempts: 3,
  backoff: { type: "exponential", delay: 1000 },
  removeOnComplete: false,
  removeOnFail: false,
});
```

### Comportamento esperado

| Estado do job existente | Ação |
|------------------------|------|
| `waiting` | Retorna job existente |
| `active` | Retorna job existente |
| `delayed` | Retorna job existente |
| `completed` | Retorna job existente (idempotência simples) |
| `failed` | Retorna job existente (idempotência simples) |
| Não existe | Cria novo job |

O BullMQ com `jobId` customizado não cria um segundo job com o mesmo ID se o anterior ainda está ativo/waiting. Isso garante **idempotência sem lógica extra**.

> Documentado em: `docs/adr/0004-use-jobid-for-idempotency.md`

---

## 10. Estratégia de Retry e Backoff

### Configuração

```typescript
{
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 1000  // ms base
  }
}
```

### Comportamento do backoff exponencial

| Tentativa | Delay |
|-----------|-------|
| 1ª falha | 1s |
| 2ª falha | 2s |
| 3ª falha | 4s (final) |

### Responsabilidades

| Quem | Responsabilidade |
|------|-----------------|
| **Worker** | Lançar `Error` em caso de falha (4xx, 5xx, timeout) |
| **BullMQ** | Capturar o erro e aplicar retry automático |

O worker **nunca** implementa retry manual. Ele apenas lança o erro e delega ao BullMQ.

```typescript
// ✅ Correto — worker lança, BullMQ reage
if (response.statusCode >= 400) {
  throw new AppError("External takedown request failed", response.statusCode);
}

// ❌ Errado — retry manual no worker
for (let i = 0; i < 3; i++) { /* ... */ }
```

---

## 11. Princípios SOLID Aplicados

Este projeto demonstra SOLID de forma prática e proporcional, **com exemplos de classes reais**.

### S — Single Responsibility Principle

Cada classe tem uma única razão para mudar.

```typescript
// ✅ ReceiveViolationUseCase: apenas orquestra o recebimento de violação
export class ReceiveViolationUseCase {
  constructor(private readonly takedownRequester: TakedownRequester) {}

  async execute(input: ReceiveViolationInput): Promise<ReceiveViolationOutput> {
    const jobResult = await this.takedownRequester.request({
      adId: input.adId,
      tenantId: input.tenantId,
      violationType: input.violationType,
      severity: input.severity,
      detectedAt: input.detectedAt,
    });

    return { jobId: jobResult.jobId, status: jobResult.status };
  }
}

// ✅ violation.controller.ts: apenas coordena HTTP ↔ use case
export const buildViolationController = (useCase: ReceiveViolationUseCase) => ({
  async handleWebhook(request: FastifyRequest, reply: FastifyReply) {
    const parsed = ViolationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ errors: parsed.error.flatten() });
    }
    const result = await useCase.execute(parsed.data);
    return reply.status(202).send(result);
  },
});
```

### O — Open/Closed Principle

Aberto para extensão, fechado para modificação.

```typescript
// A interface define o contrato — implementações podem variar sem mudar o use case
export interface ExternalTakedownGateway {
  execute(jobId: string): Promise<TakedownResult>;
}

// Implementação atual: JSONPlaceholder
export class JsonPlaceholderTakedownGateway implements ExternalTakedownGateway {
  constructor(private readonly httpClient: HttpClient) {}

  async execute(jobId: string): Promise<TakedownResult> {
    const response = await this.httpClient.get(env.EXTERNAL_TAKEDOWN_URL);
    if (response.statusCode >= 400) {
      throw new AppError("External takedown request failed", response.statusCode);
    }
    return {
      success: true,
      externalStatusCode: response.statusCode,
      externalRequestUrl: env.EXTERNAL_TAKEDOWN_URL,
      processedAt: new Date().toISOString(),
      message: "Takedown request processed successfully",
    };
  }
}

// Futura implementação: Meta Ads API real
// export class MetaAdsTakedownGateway implements ExternalTakedownGateway { ... }
// O use case não muda.
```

### L — Liskov Substitution Principle

Implementações são substituíveis sem quebrar o contrato.

```typescript
// ✅ No teste: mock substitui a implementação real
class MockTakedownQueue implements TakedownQueue {
  async enqueue(input: EnqueueInput): Promise<EnqueueOutput> {
    return { jobId: `${input.tenantId}:${input.adId}`, status: "waiting" };
  }
}

// O use case funciona com a implementação real ou com o mock
const useCase = new ReceiveViolationUseCase(new MockTakedownQueue());
```

### I — Interface Segregation Principle

Interfaces pequenas e focadas, sem métodos que o cliente não usa.

```typescript
// ✅ JobStatusReader: apenas leitura de status
export interface JobStatusReader {
  findById(jobId: string): Promise<JobStatus | null>;
}

// ✅ TakedownQueue: apenas enfileiramento
export interface TakedownQueue {
  enqueue(input: EnqueueInput): Promise<EnqueueOutput>;
}

// ❌ Evitado: uma interface gigante com tudo
export interface JobManager {
  enqueue(): void;
  findById(): void;
  delete(): void;
  pause(): void;
  // ...demais métodos que a maioria dos clients não usa
}
```

### D — Dependency Inversion Principle

Use cases dependem de abstrações (interfaces), não de implementações concretas.

```typescript
// ✅ Use case depende da interface — não do BullMQ diretamente
export class EnqueueTakedownUseCase {
  constructor(private readonly queue: TakedownQueue) {}

  async execute(input: EnqueueInput): Promise<EnqueueOutput> {
    return this.queue.enqueue(input);
  }
}

// ✅ Composição em api.ts (ponto de entrada)
const redisConnection = buildRedisConnection();
const bullmqQueue = new BullMqTakedownQueue(redisConnection);
const enqueueUseCase = new EnqueueTakedownUseCase(bullmqQueue);
```

---

## 12. Estratégia de Testes

### Pirâmide de testes

```
       ┌─────────────┐
       │ Integration │  ← testes HTTP + fila com containers reais
       │   Tests     │
       ├─────────────┤
       │    Unit     │  ← testes de use cases, schemas, gateways com mocks
       │    Tests    │
       └─────────────┘
```

### 12.1 Testes Unitários

**Violation Intake:**
- Schema Zod aceita payload válido
- Schema rejeita ausência de `adId`
- Schema rejeita ausência de `tenantId`
- Schema rejeita `violationType` inválido
- Schema rejeita `severity` inválido
- Schema rejeita `detectedAt` inválido (formato não ISO 8601)
- `ReceiveViolationUseCase` chama `TakedownRequester.request()` com os dados corretos
- `ReceiveViolationUseCase` retorna `jobId` e `status`

**Takedown Execution:**
- `EnqueueTakedownUseCase` cria job com `jobId = tenantId:adId`
- Job é configurado com `attempts = 3`
- Job é configurado com backoff exponencial
- Payload duplicado retorna job existente (idempotência)
- `ProcessTakedownUseCase` retorna sucesso quando API externa responde 2xx
- `ProcessTakedownUseCase` inclui `externalStatusCode` no resultado
- `ProcessTakedownUseCase` inclui `processedAt` no resultado
- `ProcessTakedownUseCase` lança erro em 4xx
- `ProcessTakedownUseCase` lança erro em 5xx
- `ProcessTakedownUseCase` lança erro em timeout

**Job Monitoring:**
- `GetJobStatusUseCase` retorna job existente com todos os campos
- Retorna `completed` com `result` preenchido
- Retorna `failed` com `error` preenchido
- Retorna `active` com `result: null`
- Retorna `null` para job inexistente (404 no controller)

### 12.2 Testes de Integração

- `POST /webhook/violation` com payload válido retorna `202`
- `POST /webhook/violation` com payload inválido retorna `400` com erros detalhados
- `POST /webhook/violation` duplicado retorna mesmo `jobId`
- Worker processa job real na fila (com Redis de teste)
- Worker registra `result` de sucesso no job
- `GET /jobs/:id` retorna status de job existente
- `GET /jobs/:id` retorna `404` para job inexistente
- Falha HTTP externa gera retry automático (verificar `attempts`)

### 12.3 Exemplo de teste unitário

```typescript
// tests/unit/violation-intake/violation.schema.test.ts
import { describe, it, expect } from "vitest";
import { ViolationSchema } from "@/contexts/violation-intake/domain/schemas/violation.schema";

describe("ViolationSchema", () => {
  const validPayload = {
    adId: "ad_123",
    tenantId: "tenant_abc",
    violationType: "PROHIBITED_TERM",
    severity: "HIGH",
    detectedAt: "2026-05-20T12:00:00.000Z",
  };

  it("should accept a valid payload", () => {
    const result = ViolationSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("should reject missing adId", () => {
    const result = ViolationSchema.safeParse({ ...validPayload, adId: undefined });
    expect(result.success).toBe(false);
  });

  it("should reject invalid violationType", () => {
    const result = ViolationSchema.safeParse({ ...validPayload, violationType: "UNKNOWN" });
    expect(result.success).toBe(false);
  });
});
```

### 12.4 Exemplo de teste de use case com mock (LSP + DIP em ação)

```typescript
// tests/unit/violation-intake/ReceiveViolationUseCase.test.ts
import { describe, it, expect, vi } from "vitest";
import { ReceiveViolationUseCase } from "@/contexts/violation-intake/application/use-cases/ReceiveViolationUseCase";
import type { TakedownRequester } from "@/contexts/violation-intake/application/ports/TakedownRequester";

describe("ReceiveViolationUseCase", () => {
  const makeRequester = (): TakedownRequester => ({
    request: vi.fn().mockResolvedValue({ jobId: "tenant_abc:ad_123", status: "waiting" }),
  });

  it("should call TakedownRequester with correct input", async () => {
    const requester = makeRequester();
    const useCase = new ReceiveViolationUseCase(requester);
    const input = {
      adId: "ad_123",
      tenantId: "tenant_abc",
      violationType: "PROHIBITED_TERM" as const,
      severity: "HIGH" as const,
      detectedAt: "2026-05-20T12:00:00.000Z",
    };

    await useCase.execute(input);

    expect(requester.request).toHaveBeenCalledWith(input);
  });

  it("should return jobId and status from requester", async () => {
    const useCase = new ReceiveViolationUseCase(makeRequester());
    const result = await useCase.execute({
      adId: "ad_123",
      tenantId: "tenant_abc",
      violationType: "PROHIBITED_TERM",
      severity: "HIGH",
      detectedAt: "2026-05-20T12:00:00.000Z",
    });

    expect(result).toEqual({ jobId: "tenant_abc:ad_123", status: "waiting" });
  });
});
```

---

## 13. TDD — Test-Driven Development

### Ciclo

```
1. Escrever o teste que falha (RED)
2. Implementar o mínimo para passar (GREEN)
3. Refatorar mantendo testes verdes (REFACTOR)
4. Rodar lint e quality gate
5. Próximo comportamento
```

### Ordem de implementação TDD

```
① Schema Zod                    → test → implement → refactor
② ReceiveViolationUseCase       → test → implement → refactor
③ EnqueueTakedownUseCase        → test → implement → refactor
④ BullMqTakedownQueue           → test → implement → refactor
⑤ ProcessTakedownUseCase        → test → implement → refactor
⑥ JsonPlaceholderGateway        → test (Nock) → implement → refactor
⑦ GetJobStatusUseCase           → test → implement → refactor
⑧ BullMqJobStatusReader         → test → implement → refactor
⑨ HTTP integration tests        → test → implement (controllers/routes)
⑩ Worker integration tests      → test → validate
⑪ Docker Compose                → configurar e validar
⑫ README + ADRs                 → documentar
```

### Por que TDD aqui?

- Forçar interface antes da implementação cria **designs mais limpos**
- Testes escritos antes servem como especificação viva
- Descobrir casos-limite antes de integrar é mais barato
- Demonstra disciplina e processo, não apenas código funcional

---

## 14. BDD — Behavior-Driven Development

Os arquivos `.feature` vivem em `docs/bdd/` e servem como **especificação de comportamento legível** por stakeholders técnicos e não técnicos.

### `violation-intake.feature`

```gherkin
Feature: Violation Intake

  Scenario: Receive a valid violation webhook
    Given a valid violation payload with adId "ad_123" and tenantId "tenant_abc"
    When the webhook is submitted to POST /webhook/violation
    Then the system should enqueue a takedown job
    And the API should return status 202
    And the response should contain the jobId "tenant_abc:ad_123"

  Scenario: Reject an invalid violation webhook
    Given an invalid violation payload missing adId
    When the webhook is submitted to POST /webhook/violation
    Then the API should return status 400
    And the response should contain validation errors

  Scenario: Idempotent submission with same adId and tenantId
    Given a violation payload with adId "ad_123" and tenantId "tenant_abc"
    When the webhook is submitted twice
    Then both responses should contain the same jobId
    And only one job should exist in the queue
```

### `takedown-execution.feature`

```gherkin
Feature: Takedown Execution

  Scenario: Process takedown successfully
    Given a takedown job is waiting in the queue
    When the worker processes the job
    And the external API returns 2xx
    Then the job should be marked as completed
    And the job result should contain success true
    And the result should contain externalStatusCode 200

  Scenario: Retry takedown on external failure
    Given a takedown job is waiting in the queue
    When the external API returns 5xx
    Then the job should be retried
    And the retry should use exponential backoff
    And the maximum attempts should be 3

  Scenario: Mark job as failed after all retries are exhausted
    Given a takedown job is waiting in the queue
    When the external API returns 5xx on all 3 attempts
    Then the job should be marked as failed
    And the error should be recorded
```

### `job-monitoring.feature`

```gherkin
Feature: Job Monitoring

  Scenario: Query existing completed job status
    Given a completed takedown job with id "tenant_abc:ad_123"
    When I request GET /jobs/tenant_abc:ad_123
    Then the API should return status 200
    And the response should contain jobId, status, attempts, result and error
    And the status should be "completed"
    And the result should contain success true

  Scenario: Query nonexistent job
    Given a takedown job with id "unknown:job" does not exist
    When I request GET /jobs/unknown:job
    Then the API should return status 404
```

---

## 15. Complexidade Ciclomática

### O que é

Complexidade ciclomática mede o número de caminhos independentes num fluxo de código. Um valor alto indica código difícil de testar, entender e manter.

### Regra: máximo 6 por função

Com **limite 6**, uma função pode ter até 5 `if/else/switch/catch` independentes. Qualquer coisa acima exige refatoração.

### Configuração ESLint

```javascript
// eslint.config.js
export default [
  {
    files: ["src/**/*.ts", "tests/**/*.ts"],
    rules: {
      "complexity": ["error", 6],
      "max-depth": ["error", 3],
      "max-lines-per-function": ["warn", 40],
      "max-params": ["warn", 4],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-function-return-type": "warn",
    },
  },
];
```

### Exemplo: refatorando para reduzir complexidade

```typescript
// ❌ Antes — complexidade 7 (muitos ifs aninhados)
async function processResponse(res: Response) {
  if (res.ok) {
    if (res.status === 200) {
      const body = await res.json();
      if (body.id) {
        if (body.title) {
          return { success: true, data: body };
        } else {
          throw new Error("Missing title");
        }
      } else {
        throw new Error("Missing id");
      }
    }
  } else {
    if (res.status >= 500) {
      throw new Error("Server error");
    } else {
      throw new Error("Client error");
    }
  }
}

// ✅ Depois — complexidade 3 (extraindo guards e métodos)
function assertSuccessResponse(statusCode: number): void {
  if (statusCode >= 500) throw new AppError("Server error", statusCode);
  if (statusCode >= 400) throw new AppError("Client error", statusCode);
}

async function processResponse(res: HttpResponse): Promise<TakedownResult> {
  assertSuccessResponse(res.statusCode);
  return buildSuccessResult(res.statusCode);
}
```

### Scripts de quality gate

```json
{
  "scripts": {
    "lint": "eslint src tests",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "quality": "npm run lint && npm run test:coverage"
  }
}
```

O comando `npm run quality` é o **quality gate completo**: lint + coverage. O CI (ou o reviewer) deve rodar esse comando antes de qualquer merge.

---

## 16. Docker

### Serviços

| Serviço | Porta | Responsabilidade |
|---------|-------|-----------------|
| `api` | 3000 | Fastify — endpoints HTTP |
| `worker` | — | BullMQ Worker — processa jobs |
| `redis` | 6379 | Backend da fila |

### `docker-compose.yml`

```yaml
services:
  api:
    build: .
    command: npm run dev:api
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
      PORT: 3000
      REDIS_HOST: redis
      REDIS_PORT: 6379
      EXTERNAL_TAKEDOWN_URL: https://jsonplaceholder.typicode.com/posts/1
    depends_on:
      redis:
        condition: service_healthy
    volumes:
      - .:/app
      - /app/node_modules

  worker:
    build: .
    command: npm run dev:worker
    environment:
      NODE_ENV: development
      REDIS_HOST: redis
      REDIS_PORT: 6379
      EXTERNAL_TAKEDOWN_URL: https://jsonplaceholder.typicode.com/posts/1
    depends_on:
      redis:
        condition: service_healthy
    volumes:
      - .:/app
      - /app/node_modules

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
```

### `Dockerfile`

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build
```

### Comandos

```bash
# Subir tudo
docker compose up --build

# Subir em background
docker compose up -d --build

# Ver logs da API
docker compose logs -f api

# Ver logs do worker
docker compose logs -f worker

# Parar tudo
docker compose down
```

---

## 17. ADRs — Architectural Decision Records

Os ADRs vivem em `docs/adr/` e documentam **por que** cada decisão foi tomada, com tradeoffs reais.

### Template de ADR

```markdown
# ADR-XXXX: [Título]

**Status:** Accepted

## Contexto
[O que motivou essa decisão?]

## Decisão
[O que foi decidido?]

## Alternativas Consideradas
- Alternativa A: [por que não]
- Alternativa B: [por que não]

## Tradeoffs
| Vantagem | Desvantagem |
|----------|-------------|
| ...      | ...         |

## Consequências
[O que muda no projeto com essa decisão?]
```

### ADR-0001 — Monólito Modular com Bounded Contexts

**Decisão:** usar monólito modular em vez de microserviços ou MVC simples.

**Tradeoffs:**

| Vantagem | Desvantagem |
|----------|-------------|
| Fronteiras claras entre contextos | Mais estrutura de pastas que um MVC simples |
| Testabilidade por contexto | Exige disciplina para não misturar contextos |
| Sem complexidade operacional de microserviços | — |
| Proporcional ao tamanho do desafio | — |

### ADR-0002 — BullMQ + Redis para Jobs Assíncronos

**Decisão:** BullMQ como engine de fila.

**Tradeoffs:**

| Vantagem | Desvantagem |
|----------|-------------|
| Job status, retry e backoff nativos | Requer Redis |
| jobId customizado resolve idempotência | Overhead de Redis para projeto pequeno |
| API TypeScript de primeira classe | — |

**Alternativas descartadas:** RabbitMQ (excesso), fila em memória (não durável).

### ADR-0003 — Zod para Validação de Payload

**Decisão:** Zod na camada HTTP, não no domínio.

**Tradeoffs:**

| Vantagem | Desvantagem |
|----------|-------------|
| Tipagem inferida automaticamente | Acoplamento ao schema na camada HTTP |
| Erros detalhados sem código extra | — |
| Evita `any` nos inputs do controller | — |

### ADR-0004 — jobId Customizado para Idempotência

**Decisão:** `jobId = tenantId:adId` via BullMQ.

**Tradeoffs:**

| Vantagem | Desvantagem |
|----------|-------------|
| Simples e sem lógica extra | Depende do comportamento interno do BullMQ |
| Comportamento previsível | Job `completed/failed` não é recriado automaticamente |
| Nenhum banco de dados necessário | — |

### ADR-0005 — Vitest para Testes

**Decisão:** Vitest em vez de Jest.

**Tradeoffs:**

| Vantagem | Desvantagem |
|----------|-------------|
| Compatível com ESM nativo | Menos material de referência que Jest |
| Setup mais simples com TypeScript | — |
| API praticamente idêntica ao Jest | — |

### ADR-0006 — Complexidade Ciclomática como Quality Gate

**Decisão:** ESLint com `complexity: 6`.

**Tradeoffs:**

| Vantagem | Desvantagem |
|----------|-------------|
| Força funções menores e mais testáveis | Pode exigir refatorações pequenas |
| Evita controllers com regra de negócio | — |
| Demonstra qualidade de código objetivamente | — |

---

## 18. Técnicas Ágeis

### Sprint Goal

> Entregar uma mini-API assíncrona para recebimento de violações e processamento de takedown com BullMQ, Redis, Docker, testes automatizados e documentação de decisões arquiteturais.

### Backlog Técnico (ordem de prioridade)

| # | Story | Critério de Aceite |
|---|-------|-------------------|
| 1 | Receber violação | `POST /webhook/violation` retorna 202 com payload válido; 400 com inválido |
| 2 | Enfileirar takedown | Job criado no BullMQ com jobId correto e configuração de retry |
| 3 | Processar job | Worker faz chamada HTTP, trata 2xx/4xx/5xx/timeout |
| 4 | Consultar status | `GET /jobs/:id` retorna status, attempts, result e error |
| 5 | Qualidade e documentação | ESLint passa, coverage, ADRs, BDD, README |

### Definition of Ready

- História tem critérios de aceite definidos
- Dependências externas conhecidas (Redis local disponível)
- Schema do payload documentado
- Interface de porta definida antes da implementação

### Definition of Done

- Testes unitários passando
- Testes de integração passando
- ESLint sem erros
- Complexidade ciclomática ≤ 6
- Coverage relevante documentado
- ADR criado se houve decisão arquitetural nova
- README atualizado se necessário
- Docker Compose sobe sem erros

### Plano de commits (Conventional Commits)

```
feat(violation-intake): add Zod schema for violation payload
test(violation-intake): add unit tests for ViolationSchema
feat(violation-intake): implement ReceiveViolationUseCase
test(violation-intake): add unit tests for ReceiveViolationUseCase
feat(takedown-execution): implement BullMqTakedownQueue
test(takedown-execution): add unit tests for EnqueueTakedownUseCase
feat(takedown-execution): implement JsonPlaceholderGateway
test(takedown-execution): add unit tests for ProcessTakedownUseCase with Nock
feat(job-monitoring): implement BullMqJobStatusReader
test(job-monitoring): add unit tests for GetJobStatusUseCase
feat(http): add violation routes and integration tests
feat(docker): add Dockerfile and docker-compose.yml
docs(adr): add ADR-0001 through ADR-0006
docs(bdd): add .feature files for all three contexts
docs(readme): add full README with curl examples
```

---

## 19. Engenharia de Prompt

### Prompt base do projeto

```
Você é um engenheiro de software sênior trabalhando no projeto FURY.
Siga estas diretrizes:

- Use Node.js + TypeScript sem `any` explícito
- Respeite DDD tático leve com bounded contexts: violation-intake, takedown-execution, job-monitoring
- Use interfaces de porta para separar use cases de infraestrutura
- Aplique SOLID de forma prática: SRP, OCP com interfaces, DIP com injeção de dependência
- Mantenha complexidade ciclomática ≤ 6 por função
- Use BullMQ + Redis para filas assíncronas
- Use Zod apenas na camada HTTP (schemas), nunca no domínio
- Use Fastify para a API
- Use Undici para chamadas HTTP externas
- Separe API e worker em processos Docker distintos
- Não use banco de dados, autenticação, CQRS pesado ou Event Sourcing
- A arquitetura deve ser proporcional ao tamanho do problema
- Explique brevemente o arquivo antes de gerar o código
```

### Prompt para gerar testes antes da implementação (TDD)

```
Com base na interface ou contrato a seguir, escreva testes unitários com Vitest
ANTES de qualquer implementação.

Interface: [colar interface]

Regras:
- Teste o comportamento, não a implementação
- Use mocks para dependências externas (vi.fn())
- Cubra: happy path, edge cases e erros esperados
- Sem `any`
- Cada teste deve ter uma asserção clara
- Nomes no padrão: "should [comportamento esperado] when [condição]"
```

### Prompt para implementar após os testes

```
Os testes a seguir estão falhando (RED). Implemente o mínimo de código necessário
para fazê-los passar (GREEN). Não adicione lógica além do que os testes exigem.

Testes: [colar testes]

Regras:
- Siga a interface de porta definida
- Complexidade ciclomática ≤ 6
- Sem `any`
- Funções ≤ 40 linhas
- Explique brevemente o que cada classe/função faz antes de escrever
```

### Prompt para revisão como tech lead

```
Revise o código a seguir como um tech lead sênior.
Verifique:

1. SOLID está sendo respeitado?
2. Alguma responsabilidade está no lugar errado?
3. Existe `any` ou lógica de negócio no controller?
4. O use case depende de abstração ou de implementação?
5. Complexidade ciclomática está acima de 6?
6. Existe código duplicado que poderia ser extraído?
7. Os nomes de classes/métodos comunicam intenção claramente?

Código: [colar código]
```

### Prompt para detectar overengineering

```
Analise a arquitetura a seguir e identifique:

1. Existe complexidade acidental que poderia ser removida?
2. Alguma abstração foi criada sem necessidade real?
3. O tamanho da solução é proporcional ao problema?
4. Existe alguma camada que poderia ser eliminada sem perder qualidade?

Descreva com exemplos concretos o que simplificaria sem perder clareza.

Arquitetura: [colar estrutura de pastas ou diagrama]
```

### Prompt para gerar ADR

```
Gere um ADR (Architectural Decision Record) para a seguinte decisão:

Decisão: [descrever]
Contexto: [por que surgiu essa necessidade]
Alternativas consideradas: [listar]

O ADR deve conter: Status, Contexto, Decisão, Alternativas, Tradeoffs (tabela), Consequências.
Seja objetivo e direto. Sem floreio.
```

---

## 20. Ordem de Implementação

```
FASE 1 — Domínio e Validação
  ① violation.schema.ts        (Zod + testes)
  ② Violation.ts               (entidade)
  ③ Value Objects              (AdId, TenantId, Severity, ViolationType)

FASE 2 — Violation Intake
  ④ TakedownRequester.ts       (interface de porta)
  ⑤ ReceiveViolationUseCase    (use case + testes)
  ⑥ violation.controller.ts   (controller + testes de integração HTTP)

FASE 3 — Takedown Execution
  ⑦ TakedownQueue.ts           (interface de porta)
  ⑧ ExternalTakedownGateway.ts (interface de porta)
  ⑨ EnqueueTakedownUseCase     (use case + testes)
  ⑩ BullMqTakedownQueue        (infra + testes)
  ⑪ ProcessTakedownUseCase     (use case + testes com Nock)
  ⑫ JsonPlaceholderGateway     (infra + testes com Nock)
  ⑬ takedown.worker.ts         (worker + testes de integração)

FASE 4 — Job Monitoring
  ⑭ JobStatusReader.ts         (interface de porta)
  ⑮ GetJobStatusUseCase        (use case + testes)
  ⑯ BullMqJobStatusReader      (infra + testes)
  ⑰ jobs.controller.ts         (controller + testes de integração HTTP)

FASE 5 — Infra e Documentação
  ⑱ env.ts                     (variáveis de ambiente com Zod)
  ⑲ api.ts                     (bootstrap com DI)
  ⑳ worker.ts                  (bootstrap com DI)
  ㉑ docker-compose.yml + Dockerfile
  ㉒ docs/adr/ (6 ADRs)
  ㉓ docs/bdd/ (3 feature files)
  ㉔ README.md
```

---

## 21. Critérios de Aceite Final

### Funcionamento

- [ ] `docker compose up --build` sobe API, worker e Redis sem erros
- [ ] `POST /webhook/violation` com payload válido retorna `202` com `jobId`
- [ ] `POST /webhook/violation` com payload inválido retorna `400` com erros Zod
- [ ] Job é criado no BullMQ com `jobId = tenantId:adId`
- [ ] Worker processa o job e faz chamada HTTP para JSONPlaceholder
- [ ] Sucesso 2xx gera `result` com `success: true`
- [ ] Falha 4xx/5xx/timeout gera retry com backoff exponencial
- [ ] Após 3 falhas, job fica como `failed` com `error` registrado
- [ ] `GET /jobs/:id` retorna `status`, `attempts`, `result`, `error`
- [ ] `GET /jobs/:id` para job inexistente retorna `404`
- [ ] Mesmo `adId + tenantId` não gera dois jobs simultâneos

### Qualidade

- [ ] `npm run lint` passa sem erros
- [ ] `npm run test` passa com todos os casos
- [ ] `npm run test:coverage` gera coverage
- [ ] Complexidade ciclomática ≤ 6 em todas as funções
- [ ] Zero `any` explícito no código de produção

### Documentação

- [ ] `README.md` com instruções completas, endpoints e exemplos `curl`
- [ ] 6 ADRs em `docs/adr/` com tradeoffs reais
- [ ] 3 arquivos `.feature` em `docs/bdd/`
- [ ] Arquitetura proporcional ao tamanho do problema

### Mensagem que o projeto deve passar

> "Eu sei arquitetar software, mas também sei respeitar o tamanho do problema."

---

*FURY · DEVELOPMENT_KIT.md · Última atualização: maio 2026*