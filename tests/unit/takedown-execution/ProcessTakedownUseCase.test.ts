import { describe, it, expect, vi } from 'vitest';
import { ProcessTakedownUseCase } from '../../../src/contexts/takedown-execution/application/use-cases/ProcessTakedownUseCase';
import type { ExternalTakedownGateway } from '../../../src/contexts/takedown-execution/application/ports/ExternalTakedownGateway';
import type { TakedownResult } from '../../../src/contexts/takedown-execution/domain/types/TakedownResult';

describe('ProcessTakedownUseCase', () => {
  const makeGateway = (result: TakedownResult): ExternalTakedownGateway => ({
    execute: vi.fn().mockResolvedValue(result),
  });

  it('should return success when gateway responds with 2xx', async () => {
    const expectedResult: TakedownResult = {
      success: true,
      externalStatusCode: 200,
      externalRequestUrl: 'https://jsonplaceholder.typicode.com/posts/1',
      processedAt: '2026-05-20T14:04:00.000Z',
      message: 'Takedown request processed successfully',
    };
    const useCase = new ProcessTakedownUseCase(makeGateway(expectedResult));

    const result = await useCase.execute('tenant_abc:ad_123');

    expect(result).toEqual(expectedResult);
  });

  it('should throw error when gateway fails with 4xx', async () => {
    const gateway: ExternalTakedownGateway = {
      execute: vi.fn().mockRejectedValue(new Error('Client error')),
    };
    const useCase = new ProcessTakedownUseCase(gateway);

    await expect(useCase.execute('tenant_abc:ad_123')).rejects.toThrow('Client error');
  });

  it('should throw error when gateway fails with 5xx', async () => {
    const gateway: ExternalTakedownGateway = {
      execute: vi.fn().mockRejectedValue(new Error('Server error')),
    };
    const useCase = new ProcessTakedownUseCase(gateway);

    await expect(useCase.execute('tenant_abc:ad_123')).rejects.toThrow('Server error');
  });
});
