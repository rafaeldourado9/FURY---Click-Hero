import { describe, it, expect, vi } from 'vitest';
import { JsonPlaceholderTakedownGateway } from '../../../src/contexts/takedown-execution/infra/gateways/JsonPlaceholderTakedownGateway';
import { AppError } from '../../../src/shared/errors/AppError';
import type { HttpClient } from '../../../src/shared/http/HttpClient';

describe('JsonPlaceholderTakedownGateway', () => {
  const makeHttpClient = (statusCode: number): HttpClient => ({
    get: vi.fn().mockResolvedValue({ statusCode, body: { id: 1 } }),
  });

  it('should return success result on 2xx response', async () => {
    const gateway = new JsonPlaceholderTakedownGateway(makeHttpClient(200));

    const result = await gateway.execute('tenant_abc:ad_123');

    expect(result.success).toBe(true);
    expect(result.externalStatusCode).toBe(200);
    expect(result.message).toBe('Takedown request processed successfully');
  });

  it('should throw AppError on 4xx response', async () => {
    const gateway = new JsonPlaceholderTakedownGateway(makeHttpClient(404));

    await expect(gateway.execute('tenant_abc:ad_123')).rejects.toThrow(AppError);
  });

  it('should throw AppError on 5xx response', async () => {
    const gateway = new JsonPlaceholderTakedownGateway(makeHttpClient(500));

    await expect(gateway.execute('tenant_abc:ad_123')).rejects.toThrow(AppError);
  });
});
