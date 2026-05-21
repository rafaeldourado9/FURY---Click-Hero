import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { ReceiveViolationUseCase } from '../../../src/contexts/violation-intake/application/use-cases/ReceiveViolationUseCase';
import { violationRoutes } from '../../../src/contexts/violation-intake/infra/http/violation.routes';
import { GetJobStatusUseCase } from '../../../src/contexts/job-monitoring/application/use-cases/GetJobStatusUseCase';
import { jobsRoutes } from '../../../src/contexts/job-monitoring/infra/http/jobs.routes';
import type { TakedownRequester } from '../../../src/contexts/violation-intake/application/ports/TakedownRequester';
import type { JobStatusReader, JobStatus } from '../../../src/contexts/job-monitoring/application/ports/JobStatusReader';

describe('HTTP Integration Tests', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    const mockRequester: TakedownRequester = {
      request: async () => ({ jobId: 'tenant_abc:ad_123', status: 'waiting' }),
    };
    const receiveUseCase = new ReceiveViolationUseCase(mockRequester);
    await violationRoutes(app, receiveUseCase);

    const mockReader: JobStatusReader = {
      findById: async (id: string): Promise<JobStatus | null> => {
        if (id === 'tenant_abc:ad_123') {
          return {
            jobId: 'tenant_abc:ad_123',
            status: 'completed',
            attempts: 1,
            result: {
              success: true,
              externalStatusCode: 200,
              externalRequestUrl: 'https://jsonplaceholder.typicode.com/posts/1',
              processedAt: '2026-05-20T14:04:00.000Z',
              message: 'Takedown request processed successfully',
            },
            error: null,
          };
        }
        return null;
      },
    };
    const getStatusUseCase = new GetJobStatusUseCase(mockReader);
    await jobsRoutes(app, getStatusUseCase);
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /webhook/violation should return 202 with valid payload', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/webhook/violation',
      payload: {
        adId: 'ad_123',
        tenantId: 'tenant_abc',
        violationType: 'PROHIBITED_TERM',
        severity: 'HIGH',
        detectedAt: '2026-05-20T12:00:00.000Z',
      },
    });

    expect(response.statusCode).toBe(202);
    const body = JSON.parse(response.body);
    expect(body.jobId).toBe('tenant_abc:ad_123');
    expect(body.status).toBe('waiting');
  });

  it('POST /webhook/violation should return 400 with invalid payload', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/webhook/violation',
      payload: {
        adId: 'ad_123',
        violationType: 'PROHIBITED_TERM',
        severity: 'HIGH',
        detectedAt: '2026-05-20T12:00:00.000Z',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.errors).toBeDefined();
  });

  it('GET /jobs/:id should return 200 for existing job', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/jobs/tenant_abc:ad_123',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('completed');
    expect(body.result.success).toBe(true);
  });

  it('GET /jobs/:id should return 404 for nonexistent job', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/jobs/unknown:job',
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Job not found');
  });
});
