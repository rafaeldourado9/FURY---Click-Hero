import Redis, { type RedisOptions } from 'ioredis';
import { env } from '../config/env';

/**
 * Cria uma conexão ioredis configurada para uso com BullMQ.
 *
 * Importante: a mesma conexão é compartilhada entre `Queue`, `Worker` e
 * `JobStatusReader` para evitar múltiplos sockets contra o Redis.
 *
 * `maxRetriesPerRequest: null` é exigido pelo BullMQ — sem isso, comandos
 * lentos são abortados e o worker entra em loop de reconexão.
 */
export const buildRedisConnection = (): Redis => {
  const options: RedisOptions = {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
  };

  if (env.REDIS_PASSWORD) {
    options.password = env.REDIS_PASSWORD;
  }

  return new Redis(options);
};
