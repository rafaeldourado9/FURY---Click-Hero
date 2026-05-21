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

const makeFastifyError = (statusCode: number, message: string, code = 'FST_ERR_X'): FastifyError =>
  Object.assign(new Error(message), {
    name: 'FastifyError',
    code,
    statusCode,
  }) as FastifyError;

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

  it('echoes 400 from FastifyError when JSON body is malformed', () => {
    const err = makeFastifyError(400, 'Unexpected token', 'FST_ERR_CTP_INVALID_JSON_BODY');
    const { reply, spy } = makeReply();

    errorHandler(err, makeRequest(), reply);

    expect(spy.status).toHaveBeenCalledWith(400);
    expect(spy.send).toHaveBeenCalledWith({ error: 'Unexpected token' });
  });

  it('echoes 400 from FastifyError when body is empty for application/json', () => {
    const err = makeFastifyError(
      400,
      "Body cannot be empty when content-type is set to 'application/json'",
      'FST_ERR_CTP_EMPTY_JSON_BODY',
    );
    const { reply, spy } = makeReply();

    errorHandler(err, makeRequest(), reply);

    expect(spy.status).toHaveBeenCalledWith(400);
    expect(spy.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Body cannot be empty') }),
    );
  });

  it('echoes the original 4xx statusCode for any FastifyError in the client range', () => {
    const err = makeFastifyError(413, 'Payload too large', 'FST_ERR_CTP_BODY_TOO_LARGE');
    const { reply, spy } = makeReply();

    errorHandler(err, makeRequest(), reply);

    expect(spy.status).toHaveBeenCalledWith(413);
  });

  it('returns 500 with a generic message for unknown errors and does not leak the stack', () => {
    const err = new Error('database connection refused');
    const { reply, spy } = makeReply();

    errorHandler(err as FastifyError, makeRequest(), reply);

    expect(spy.status).toHaveBeenCalledWith(500);
    expect(spy.send).toHaveBeenCalledWith({ error: 'Internal server error' });
  });

  it('does not echo statusCode of a 5xx FastifyError (falls back to generic 500)', () => {
    const err = makeFastifyError(502, 'Upstream down', 'FST_ERR_X');
    const { reply, spy } = makeReply();

    errorHandler(err, makeRequest(), reply);

    expect(spy.status).toHaveBeenCalledWith(500);
    expect(spy.send).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
