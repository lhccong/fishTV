import { randomUUID } from 'node:crypto';
import { getRedisClient } from './redis.js';

export type VideoSource = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  builtIn?: boolean;
  createdAt: number;
  updatedAt: number;
};

const KEY = 'fishTV:video:sources';
const defaults: VideoSource[] = [
  ['feifan', '非凡云', 'https://api.ffzyapi.com/api.php'],
  ['modu', '魔都云', 'http://mdzyapi.com/api.php'],
  ['youzhi', '优质云', 'http://api.yzzy-api.com/inc/apijson.php'],
  ['subocaiji', '速播云', 'http://subocaiji.com/api.php'],
].map(([id, name, url]) => ({
  id, name, url, enabled: true, builtIn: true, createdAt: 0, updatedAt: 0,
}));

let sources = defaults;

function sourceId(value: unknown) {
  const id = String(value || '').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{1,31}$/.test(id) ? id : null;
}

export function normalizeVideoSource(input: unknown, existingId?: string): VideoSource {
  if (!input || typeof input !== 'object') throw new Error('视频源格式无效');
  const raw = input as Record<string, unknown>;
  const id = sourceId(existingId || raw.id) || `source-${randomUUID().slice(0, 8)}`;
  const name = String(raw.name || '').trim();
  if (name.length < 1 || name.length > 64 || /[\r\n\0]/.test(name)) throw new Error('视频源名称无效');
  const url = String(raw.url || '').trim();
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password ||
      parsed.search || parsed.hash || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(parsed.hostname)) {
    throw new Error('视频源地址无效');
  }
  const now = Date.now();
  return {
    id, name, url: parsed.toString().replace(/\/$/, ''),
    enabled: raw.enabled !== false, builtIn: Boolean(raw.builtIn),
    createdAt: Number(raw.createdAt) || now, updatedAt: now,
  };
}

function sanitizeList(value: unknown) {
  if (!Array.isArray(value)) return null;
  const output: VideoSource[] = [];
  for (const item of value) {
    try {
      const source = normalizeVideoSource(item);
      if (!output.some((current) => current.id === source.id)) output.push(source);
    } catch {
      // Ignore invalid historical records instead of breaking all video sources.
    }
  }
  return output.length ? output : null;
}

export async function initVideoSources() {
  const redis = getRedisClient();
  if (!redis) return;
  const raw = await redis.get(KEY);
  const stored = raw ? sanitizeList(JSON.parse(raw)) : null;
  if (stored) sources = stored;
  else await saveVideoSources(sources);
}

export function listVideoSources({ includeDisabled = false, includeUrls = false } = {}) {
  return sources
    .filter((source) => includeDisabled || source.enabled)
    .map((source) => ({
      ...(includeUrls ? { url: source.url } : {}),
      id: source.id,
      name: source.name,
      enabled: source.enabled,
      builtIn: source.builtIn,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
      proxyUrl: `/video-source/${source.id}`,
    }));
}

export function getVideoSource(id: string) {
  return sources.find((source) => source.id === id && source.enabled) || null;
}

async function saveVideoSources(next: VideoSource[]) {
  const redis = getRedisClient();
  if (!redis) throw new Error('Redis unavailable');
  await redis.set(KEY, JSON.stringify(next));
  sources = next;
}

export async function upsertVideoSource(input: unknown, id?: string) {
  const next = normalizeVideoSource(input, id);
  const index = sources.findIndex((source) => source.id === next.id);
  const list = [...sources];
  if (index >= 0) list[index] = { ...list[index], ...next, builtIn: list[index].builtIn };
  else list.push(next);
  await saveVideoSources(list);
  return list.find((source) => source.id === next.id)!;
}

export async function removeVideoSource(id: string) {
  const source = sources.find((item) => item.id === id);
  if (!source) return false;
  if (source.builtIn) throw new Error('旧视频源只能停用，不能删除');
  await saveVideoSources(sources.filter((item) => item.id !== id));
  return true;
}
