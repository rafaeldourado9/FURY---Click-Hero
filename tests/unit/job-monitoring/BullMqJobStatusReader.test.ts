import { describe, it, expect, vi } from 'vitest';
import { BullMqJobStatusReader } from '../../../src/contexts/job-monitoring/infra/queue/BullMqJobStatusReader';
import type { Queue, Job } from 'bullmq';

const makeQueue = (job: Job | null): Queue =>
  ({
    getJob: vi.fn().mockResolvedValue(job),
  }) as unknown as Queue;

const makeJob = (overrides: Partial<Job> = {}): Job =>
  ({
    id: 'tenant_abc__ad_123',
    attemptsMade: 1,
    returnvalue: {
      success: true,
      externalStatusCode: 200,
      externalRequestUrl: 'https://jsonplaceholder.typicode.com/posts/1',
      processedAt: '2026-05-20T14:04:00.000Z',
      message: 'Takedown request processed successfully',
    },
    failedReason: undefined,
    getState: vi.fn().mockResolvedValue('completed'),
    ...overrides,
  }) as unknown as Job;

describe('BullMqJobStatusReader', () => {
  it('returns null when job does not exist', async () => {
    const reader = new BullMqJobStatusReader(makeQueue(null));

    const result = await reader.findById('unknown:job');

    expect(result).toBeNull();
  });

  it('queries BullMQ using the internal separator (__) when given the public id', async () => {
    const queue = makeQueue(makeJob());
    const reader = new BullMqJobStatusReader(queue);

    await reader.findById('tenant_abc:ad_123');

    expect(queue.getJob).toHaveBeenCalledWith('tenant_abc__ad_123');
  });

  it('echoes back the public id (with colon) in the response', async () => {
    const reader = new BullMqJobStatusReader(makeQueue(makeJob()));

    const result = await reader.findById('tenant_abc:ad_123');

    expect(result?.jobId).toBe('tenant_abc:ad_123');
  });

  it('returns status, attempts and result fields when job exists', async () => {
    const reader = new BullMqJobStatusReader(makeQueue(makeJob()));

    const result = await reader.findById('tenant_abc:ad_123');

    expect(result).not.toBeNull();
    expect(result?.status).toBe('completed');
    expect(result?.attempts).toBe(1);
    expect(result?.result?.success).toBe(true);
    expect(result?.error).toBeNull();
  });

  it('maps failedReason into error.message and leaves result null', async () => {
    const failedJob = makeJob({
      returnvalue: undefined,
      failedReason: 'External takedown request failed',
      getState: vi.fn().mockResolvedValue('failed'),
    } as unknown as Partial<Job>);
    const reader = new BullMqJobStatusReader(makeQueue(failedJob));

    const result = await reader.findById('tenant_abc:ad_123');

    expect(result?.status).toBe('failed');
    expect(result?.result).toBeNull();
    expect(result?.error?.message).toBe('External takedown request failed');
  });
});
