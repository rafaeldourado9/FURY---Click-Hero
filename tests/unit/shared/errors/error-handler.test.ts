import { describe, it, expect, vi } from 'vitest';
import { z, ZodError } from 'zod';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { errorHandler } from '../../../../src/shared/errors/error-handler';
import { AppError } from '../../../../src/shared/errors/AppError';

interface ReplySpy {
  status: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

const makeReply = (): { reply: FastifyReply; spy: ReplySpy } => {
  const spy: ReplySpy = { status: vi.fn(), send: vi.fn() };
  spy.status.mockReturnValue({ send: spy.send });
  const reply = { status: spy.status, send: spy.send } as unknown as FastifyReply;
  return { reply, spy };
};

const makeRequest = (): FastifyRequest =>
  ({
    log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
  }) as unknown as FastifyRequest;

describe('errorHandler', () => {
  it('returns 400 with flattened errors for ZodError', () => {
    const zodErr = (() => {
      try {
        z.object({ a: z.string() }).parse({});
        return null;
      } catch (e) {
        return e as ZodError;
      }
    })();
    const { reply, spy } = makeReply();

    errorHandler(zodErr as unknown as FastifyError, makeRequest(), reply);

    expect(spy.status).toHaveBeenCalledWith(400);
    expect(spy.send).toHaveBeenCalledWith(expect.objectContaining({ errors: expect.anything() }));
  });

  it('honors the statusCode of AppError', () => {
    const err = new AppError('External takedown request failed', 502);
    const { reply, spy } = makeReply();

    errorHandler(err as unknown as FastifyError, makeRequest(), reply);

    expect(spy.status).toHaveBeenCalledWith(502);
    expect(spy.send).toHaveBeenCalledWith({ error: 'External takedown request failed' });
  });

  it('returns 500 with a generic message for unknown errors and does not leak the stack', () => {
    const err = new Error('database connection refused');
    const { reply, spy } = makeReply();

    errorHandler(err as FastifyError, makeRequest(), reply);

    expect(spy.status).toHaveBeenCalledWith(500);
    expect(spy.send).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
