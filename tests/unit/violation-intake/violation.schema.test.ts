import { describe, it, expect } from 'vitest';
import { ViolationSchema } from '../../../src/contexts/violation-intake/domain/schemas/violation.schema';

describe('ViolationSchema', () => {
  const validPayload = {
    adId: 'ad_123',
    tenantId: 'tenant_abc',
    violationType: 'PROHIBITED_TERM',
    severity: 'HIGH',
    detectedAt: '2026-05-20T12:00:00.000Z',
  };

  it('should accept a valid payload', () => {
    const result = ViolationSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('should reject missing adId', () => {
    const result = ViolationSchema.safeParse({ ...validPayload, adId: undefined });
    expect(result.success).toBe(false);
  });

  it('should reject missing tenantId', () => {
    const result = ViolationSchema.safeParse({ ...validPayload, tenantId: undefined });
    expect(result.success).toBe(false);
  });

  it('should reject invalid violationType', () => {
    const result = ViolationSchema.safeParse({ ...validPayload, violationType: 'UNKNOWN' });
    expect(result.success).toBe(false);
  });

  it('should reject invalid severity', () => {
    const result = ViolationSchema.safeParse({ ...validPayload, severity: 'UNKNOWN' });
    expect(result.success).toBe(false);
  });

  it('should reject invalid detectedAt format', () => {
    const result = ViolationSchema.safeParse({ ...validPayload, detectedAt: 'not-a-date' });
    expect(result.success).toBe(false);
  });
});
