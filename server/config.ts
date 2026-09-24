import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

export type SiteConfig = {
  version: 1;
  redisUrl: string;
  siteOrigin: string;
  clientId: string;
  clientSecret: string;
  authVersion: string;
};

export const dataDir = path.resolve(process.env.DATA_DIR || fileURLToPath(new URL('../data', import.meta.url)));
const configPath = path.join(dataDir, 'config.json');
let config: SiteConfig | null = null;

export function validateConfig(input: unknown): SiteConfig {
  if (!input || typeof input !== 'object') throw new Error('配置格式无效');
  const raw = input as Record<string, unknown>;
  const text = (key: string, max: number) => {
    const value = raw[key];
    if (typeof value !== 'string' || !value.trim() || value.length > max || /[\r\n\0]/.test(value)) {
      throw new Error(`配置字段 ${key} 无效`);
    }
    return value.trim();
  };
  const redisUrl = text('redisUrl', 2048);
  const redis = new URL(redisUrl);
  if (!['redis:', 'rediss:'].includes(redis.protocol) || !redis.hostname || redis.search || redis.hash ||
      !/^\/\d*$/.test(redis.pathname || '/') || /^(169\.254\.|100\.100\.100\.200$)/.test(redis.hostname)) {
    throw new Error('Redis 地址无效');
  }
  const origin = new URL(text('siteOrigin', 512));
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/' ||
      !(origin.protocol === 'https:' || (process.env.NODE_ENV !== 'production' && local && origin.protocol === 'http:'))) {
    throw new Error('站点地址必须是 HTTPS 源地址；本地开发可使用 HTTP');
  }
  return {
    version: 1, redisUrl, siteOrigin: origin.origin,
    clientId: text('clientId', 256), clientSecret: text('clientSecret', 2048),
    authVersion: randomUUID(),
  };
}

export function loadConfig() {
  if (fs.existsSync(configPath)) {
    const stored = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config = { ...validateConfig(stored), authVersion: stored.authVersion || randomUUID() };
    return;
  }
  // Existing environment deployments must never reopen the public installer.
  if (process.env.REDIS_URL || process.env.REDIS_HOST) {
    const url = new URL(process.env.REDIS_URL || `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || '6379'}/0`);
    if (process.env.REDIS_USERNAME) url.username = process.env.REDIS_USERNAME;
    if (process.env.REDIS_PASSWORD) url.password = process.env.REDIS_PASSWORD;
    if (process.env.REDIS_DB) url.pathname = `/${process.env.REDIS_DB}`;
    config = {
      version: 1, redisUrl: url.toString(), siteOrigin: process.env.SITE_ORIGIN || '',
      clientId: process.env.YUCODER_CLIENT_ID || '', clientSecret: process.env.YUCODER_CLIENT_SECRET || '',
      authVersion: 'legacy-env',
    };
  }
}

export function getConfig() { return config; }
export function setupRequired() {
  return !config || !config.siteOrigin || !config.clientId || !config.clientSecret;
}
export function oauthConfigured() { return Boolean(config?.siteOrigin && config.clientId && config.clientSecret); }

export function persistConfig(next: SiteConfig) {
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const temp = `${configPath}.${randomUUID()}.tmp`;
  try {
    const fd = fs.openSync(temp, 'wx', 0o600);
    try {
      fs.writeFileSync(fd, JSON.stringify(next, null, 2), 'utf8');
      fs.fsyncSync(fd);
    } finally { fs.closeSync(fd); }
    fs.renameSync(temp, configPath);
    config = next;
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}

export function acquireConfigLease() {
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const lease = path.join(dataDir, 'config.installing');
  const fd = fs.openSync(lease, 'wx', 0o600);
  return () => { fs.closeSync(fd); fs.unlinkSync(lease); };
}
