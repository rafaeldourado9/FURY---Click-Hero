import { describe, it, expect, vi } from 'vitest';
import { ReceiveViolationUseCase } from '../../../src/contexts/violation-intake/application/use-cases/ReceiveViolationUseCase';
import type { TakedownRequester } from '../../../src/contexts/violation-intake/application/ports/TakedownRequester';

describe('ReceiveViolationUseCase', () => {
  const makeRequester = (): TakedownRequester => ({
    request: vi.fn().mockResolvedValue({ jobId: 'tenant_abc:ad_123', status: 'waiting' }),
  });

  it('should call TakedownRequester with correct input', async () => {
    const requester = makeRequester();
    const useCase = new ReceiveViolationUseCase(requester);
    const input = {
      adId: 'ad_123',
      tenantId: 'tenant_abc',
      violationType: 'PROHIBITED_TERM',
      severity: 'HIGH',
      detectedAt: '2026-05-20T12:00:00.000Z',
    };

    await useCase.execute(input);

    expect(requester.request).toHaveBeenCalledWith(input);
  });

  it('should return jobId and status from requester', async () => {
    const useCase = new ReceiveViolationUseCase(makeRequester());
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
