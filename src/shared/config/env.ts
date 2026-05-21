import { z } from 'zod';

/**
 * Schema de variáveis de ambiente.
 *
 * Defaults só se aplicam fora de produção. Em `NODE_ENV=production` os
 * campos críticos (`PORT`, `REDIS_HOST`, `REDIS_PORT`, `EXTERNAL_TAKEDOWN_URL`)
 * tornam-se obrigatórios — assim a aplicação não sobe silenciosamente com
 * configuração ausente.
 */
const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().int().positive().max(65535),
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().int().positive().max(65535),
  REDIS_PASSWORD: z.string().min(1).optional(),
  EXTERNAL_TAKEDOWN_URL: z.string().url(),
  HTTP_TIMEOUT_MS: z.coerce.number().int().positive().max(60_000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),
  BODY_LIMIT_BYTES: z.coerce.number().int().positive().max(10 * 1024 * 1024),
});

const devDefaults = {
  NODE_ENV: 'development',
  PORT: '3000',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  EXTERNAL_TAKEDOWN_URL: 'https://jsonplaceholder.typicode.com/posts/1',
  HTTP_TIMEOUT_MS: '5000',
  LOG_LEVEL: 'info',
  BODY_LIMIT_BYTES: String(64 * 1024),
} as const;

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Em produção parseia `process.env` cru — qualquer ausência vira erro.
 * Em dev/test merge com defaults para reduzir fricção local.
 */
const rawEnv = isProduction ? process.env : { ...devDefaults, ...process.env };

const parsed = baseSchema.safeParse(rawEnv);

if (!parsed.success) {
  console.error('Configuração de ambiente inválida:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof baseSchema>;
