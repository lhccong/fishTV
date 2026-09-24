import { createClient } from 'redis';
import { getConfig } from './config.js';

export type RedisConnection = ReturnType<typeof createClient>;
let client: RedisConnection | null = null;
let connecting: Promise<boolean> | null = null;

export async function connectRedis(url: string) {
  const connection = createClient({
    url, disableOfflineQueue: true,
    socket: { connectTimeout: 5000, reconnectStrategy: false },
  });
  connection.on('error', () => console.error('[redis] connection_error'));
  const timer = setTimeout(() => { if (connection.isOpen) connection.destroy(); }, 6000);
  try {
    await connection.connect();
    await connection.ping();
    return connection;
  } catch {
    if (connection.isOpen) connection.destroy();
    throw new Error('Redis 连接失败');
  } finally { clearTimeout(timer); }
}

export function adoptRedis(connection: RedisConnection) {
  if (client?.isOpen && client !== connection) client.destroy();
  client = connection;
}

export async function initRedis(): Promise<boolean> {
  if (client?.isReady) return true;
  if (connecting) return connecting;
  const config = getConfig();
  if (!config) return false;
  connecting = (async () => {
    try {
      adoptRedis(await connectRedis(config.redisUrl));
      console.info('[redis] connected');
      return true;
    } catch {
      console.error('[redis] unavailable');
      return false;
    } finally { connecting = null; }
  })();
  return connecting;
}

export function isRedisConnected() { return Boolean(client?.isReady); }
export function getRedisClient() { return client?.isReady ? client : null; }
export function mustRedis() {
  const redis = getRedisClient();
  if (!redis) throw new Error('Redis unavailable');
  return redis;
}
export async function closeRedis() {
  if (client?.isOpen) client.destroy();
  client = null;
}
setInterval(() => {
  if (getConfig() && !client?.isReady) void initRedis();
}, 10000).unref();
