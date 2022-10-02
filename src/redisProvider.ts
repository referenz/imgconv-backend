import { createClient } from 'redis';

export function getRedisClient() {
  return process.env.NODE_ENV === 'development'
    ? createClient()
    : createClient({ socket: { port: 0, path: '/home/referenz/.redis/sock' } });
}
