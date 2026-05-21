import { z } from 'zod';

/**
 * Tipos de violação suportados pela mini-API.
 * Espelha o contrato do webhook de detecção de anúncios.
 */
export const ViolationType = z.enum([
  'PROHIBITED_TERM',
  'BRAND_VIOLATION',
  'COMPLIANCE_FAIL',
]);

/**
 * Severidade da violação, da menor (`LOW`) à maior (`CRITICAL`).
 * Usada apenas como rótulo — não afeta o fluxo de takedown nesta versão.
 */
export const Severity = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

/**
 * Schema do payload de `POST /webhook/violation`.
 *
 * - `adId` e `tenantId` formam o `jobId` (`tenantId:adId`) usado para
 *   idempotência no BullMQ.
 * - `detectedAt` é obrigatoriamente ISO 8601 com timezone (`.datetime()`).
 *
 * Mantemos Zod apenas na borda HTTP (controller); o domínio não conhece Zod.
 */
export const ViolationSchema = z.object({
  adId: z.string().min(1),
  tenantId: z.string().min(1),
  violationType: ViolationType,
  severity: Severity,
  detectedAt: z.string().datetime(),
});

export type ViolationInput = z.infer<typeof ViolationSchema>;
export type ViolationTypeValue = z.infer<typeof ViolationType>;
export type SeverityValue = z.infer<typeof Severity>;
