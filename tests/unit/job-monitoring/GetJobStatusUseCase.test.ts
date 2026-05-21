import { describe, it, expect, vi } from 'vitest';
import { GetJobStatusUseCase } from '../../../src/contexts/job-monitoring/application/use-cases/GetJobStatusUseCase';
import type { JobStatusReader, JobStatus } from '../../../src/contexts/job-monitoring/application/ports/JobStatusReader';

describe('GetJobStatusUseCase', () => {
  const makeReader = (status: JobStatus | null): JobStatusReader => ({
    findById: vi.fn().mockResolvedValue(status),
  });

  it('should return job status when job exists', async () => {
    const expectedStatus: JobStatus = {
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
    const useCase = new GetJobStatusUseCase(makeReader(expectedStatus));

    const result = await useCase.execute('tenant_abc:ad_123');

    expect(result).toEqual(expectedStatus);
  });

  it('should return null when job does not exist', async () => {
    const useCase = new GetJobStatusUseCase(makeReader(null));

    const result = await useCase.execute('unknown:job');

    expect(result).toBeNull();
  });
});
