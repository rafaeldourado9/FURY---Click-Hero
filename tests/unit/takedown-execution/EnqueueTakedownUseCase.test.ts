import { describe, it, expect, vi } from 'vitest';
import { EnqueueTakedownUseCase } from '../../../src/contexts/takedown-execution/application/use-cases/EnqueueTakedownUseCase';
import type { TakedownQueue } from '../../../src/contexts/takedown-execution/application/ports/TakedownQueue';

describe('EnqueueTakedownUseCase', () => {
  const makeQueue = (): TakedownQueue => ({
    enqueue: vi.fn().mockResolvedValue({ jobId: 'tenant_abc:ad_123', status: 'waiting' }),
  });

  it('should call queue.enqueue with correct input', async () => {
    const queue = makeQueue();
    const useCase = new EnqueueTakedownUseCase(queue);
    const input = {
      adId: 'ad_123',
      tenantId: 'tenant_abc',
      violationType: 'PROHIBITED_TERM',
      severity: 'HIGH',
      detectedAt: '2026-05-20T12:00:00.000Z',
    };

    await useCase.execute(input);

    expect(queue.enqueue).toHaveBeenCalledWith(input);
  });

  it('should return jobId and status from queue', async () => {
    const useCase = new EnqueueTakedownUseCase(makeQueue());
    const result = await useCase.execute({
      adId: 'ad_123',
      tenantId: 'tenant_abc',
      violationType: 'PROHIBITED_TERM',
      severity: 'HIGH',
      detectedAt: '2026-05-20T12:00:00.000Z',
    });

    expect(result).toEqual({ jobId: 'tenant_abc:ad_123', status: 'waiting' });
  });
});
