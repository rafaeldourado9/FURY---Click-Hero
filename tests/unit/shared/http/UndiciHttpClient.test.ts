import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UndiciHttpClient } from '../../../../src/shared/http/UndiciHttpClient';
import { AppError } from '../../../../src/shared/errors/AppError';

// Mock do `undici.request`. Cada teste configura o retorno/erro desejado.
vi.mock('undici', () => ({
  request: vi.fn(),
}));

import { request as undiciRequest } from 'undici';

const requestMock = undiciRequest as unknown as ReturnType<typeof vi.fn>;

const buildResponse = (statusCode: number, body: unknown): { statusCode: number; body: { json: () => Promise<unknown>; text: () => Promise<string> } } => ({
  statusCode,
  body: {
    json: async () => body,
    text: async () => JSON.stringify(body),
  },
});

describe('UndiciHttpClient', () => {
  let subject: UndiciHttpClient;

  beforeEach(() => {
    requestMock.mockReset();
    subject = new UndiciHttpClient();
  });

  it('returns statusCode and parsed body on success', async () => {
    requestMock.mockResolvedValueOnce(buildResponse(200, { id: 1 }));

    const response = await subject.get('https://api.example.com/x', { timeoutMs: 5000 });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ id: 1 });
  });

  it('passes timeoutMs as headersTimeout and bodyTimeout to undici', async () => {
    requestMock.mockResolvedValueOnce(buildResponse(200, {}));

    await subject.get('https://api.example.com/x', { timeoutMs: 1234 });

    expect(requestMock).toHaveBeenCalledWith(
      'https://api.example.com/x',
      expect.objectContaining({
        method: 'GET',
        headersTimeout: 1234,
        bodyTimeout: 1234,
      }),
    );
  });

  it('returns null body when response is not valid JSON', async () => {
    requestMock.mockResolvedValueOnce({
      statusCode: 200,
      body: {
        json: async () => {
          throw new Error('Unexpected token');
        },
        text: async () => 'not json',
      },
    });

    const response = await subject.get('https://api.example.com/x', { timeoutMs: 5000 });

    expect(response.body).toBeNull();
  });

  it('throws AppError(504) on timeout', async () => {
    const timeoutErr = new Error('headers timeout');
    timeoutErr.name = 'HeadersTimeoutError';
    requestMock.mockRejectedValueOnce(timeoutErr);

    await expect(subject.get('https://api.example.com/x', { timeoutMs: 100 })).rejects.toMatchObject({
      statusCode: 504,
    });
  });

  it('throws AppError(502) on generic network failure', async () => {
    requestMock.mockRejectedValueOnce(new Error('ECONNRESET'));

    const promise = subject.get('https://api.example.com/x', { timeoutMs: 5000 });

    await expect(promise).rejects.toBeInstanceOf(AppError);
    await expect(promise).rejects.toMatchObject({ statusCode: 502 });
  });
});
