import { describe, it, expect, vi } from 'vitest';
import type { Queue } from 'bullmq';
import {
  BullMqTakedownQueue,
  buildJobId,
  toInternalJobId,
} from '../../../src/contexts/takedown-execution/infra/queue/BullMqTakedownQueue';

const baseInput = {
  adId: 'ad_123',
  tenantId: 'tenant_abc',
  violationType: 'PROHIBITED_TERM',
  severity: 'HIGH',
  detectedAt: '2026-05-20T12:00:00.000Z',
};

const makeQueue = (): Queue =>
  ({
    add: vi.fn().mockResolvedValue({ id: 'tenant_abc__ad_123' }),
  }) as unknown as Queue;

describe('buildJobId', () => {
  it('returns the public form tenantId:adId', () => {
    expect(buildJobId('t1', 'a1')).toBe('t1:a1');
  });
});

describe('toInternalJobId', () => {
  it('converts the public separator (:) to the BullMQ-safe one (__)', () => {
    expect(toInternalJobId('tenant_abc:ad_123')).toBe('tenant_abc__ad_123');
  });

  it('never returns a string containing a colon (forbidden by BullMQ)', () => {
    expect(toInternalJobId('tenant_abc:ad_123')).not.toContain(':');
  });

  it('replaces only the first colon, preserving any others inside the ids', () => {
    expect(toInternalJobId('a:b:c')).toBe('a__b:c');
  });
});

describe('BullMqTakedownQueue', () => {
  it('stores the job in BullMQ using the internal separator (__)', async () => {
    const queue = makeQueue();
    const subject = new BullMqTakedownQueue(queue);

    await subject.enqueue(baseInput);

    expect(queue.add).toHaveBeenCalledWith(
      'takedown',
      expect.anything(),
      expect.objectContaining({ jobId: 'tenant_abc__ad_123' }),
    );
  });

  it('returns the public jobId (with colon) to the caller', async () => {
    const queue = makeQueue();
    const subject = new BullMqTakedownQueue(queue);

    const result = await subject.enqueue(baseInput);

    expect(result).toEqual({ jobId: 'tenant_abc:ad_123', status: 'waiting' });
  });

  it('configures attempts=3 and exponential backoff with 1s base', async () => {
    const queue = makeQueue();
    const subject = new BullMqTakedownQueue(queue);

    await subject.enqueue(baseInput);

    expect(queue.add).toHaveBeenCalledWith(
      'takedown',
      expect.anything(),
      expect.objectContaining({
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: false,
        removeOnFail: false,
      }),
    );
  });

  it('forwards the violation payload to BullMQ', async () => {
    const queue = makeQueue();
    const subject = new BullMqTakedownQueue(queue);

    await subject.enqueue(baseInput);

    expect(queue.add).toHaveBeenCalledWith(
      'takedown',
      {
        adId: baseInput.adId,
        tenantId: baseInput.tenantId,
        violationType: baseInput.violationType,
        severity: baseInput.severity,
        detectedAt: baseInput.detectedAt,
      },
      expect.anything(),
    );
  });
});
