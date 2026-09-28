import { randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import type { Express, Request, Response, NextFunction } from 'express';
import { getRedisClient } from './redis.js';
import { getRequestIp } from './clientNetwork.js';
import { getDeviceIdFromCookie } from './deviceIdentity.js';
import { sanitizeDeviceId } from './deviceIdentity.js';

const KEY = 'fishTV:site:bans';
const MAX_BANS = 500;
const MAX_REASON = 160;
type BanType = 'ip' | 'device';
export type SiteBan = { id: string; type: BanType; value: string; reason: string; at: number };
let bans: SiteBan[] = [];

function normalizeIp(value: unknown) {
  const ip = String(value || '').trim().replace(/^::ffff:/, '');
  return isIP(ip) ? ip : '';
}

function normalize(type: BanType, value: unknown) {
  return type === 'ip' ? normalizeIp(value) : sanitizeDeviceId(value);
}

function clean(input: unknown): SiteBan[] {
  if (!Array.isArray(input)) return [];
  return input.map(item => {
    const type = item?.type === 'device' ? 'device' : item?.type === 'ip' ? 'ip' : '';
    const value = type ? normalize(type, item?.value) : '';
    return type && value ? {
      id: String(item.id || randomBytes(8).toString('hex')).slice(0, 32),
      type, value, reason: String(item.reason || '').trim().slice(0, MAX_REASON), at: Number(item.at) || Date.now(),
    } : null;
  }).filter((item): item is SiteBan => Boolean(item)).slice(0, MAX_BANS);
}

async function persist() {
  const redis = getRedisClient();
  if (!redis) throw new Error('Redis 不可用，封禁无法保存');
  await redis.set(KEY, JSON.stringify(bans));
}

export async function initSiteBans() {
  const redis = getRedisClient();
  if (!redis) { bans = []; return; }
  try {
    const raw = await redis.get(KEY);
    bans = raw ? clean(JSON.parse(raw)) : [];
  } catch {
    bans = [];
  }
}

export function listSiteBans() {
  return [...bans].sort((a, b) => b.at - a.at);
}

export function isSiteBanned(input: { ip?: unknown; deviceId?: unknown }) {
  const ip = normalizeIp(input.ip);
  const deviceId = sanitizeDeviceId(input.deviceId);
  return bans.find(item => (item.type === 'ip' && item.value === ip) || (item.type === 'device' && item.value === deviceId)) || null;
}

export async function addSiteBan(input: { type?: unknown; value?: unknown; reason?: unknown }) {
  const type = input.type === 'device' ? 'device' : input.type === 'ip' ? 'ip' : '';
  const value = type ? normalize(type, input.value) : '';
  if (!type) return { success: false, error: '封禁类型无效' };
  if (!value) return { success: false, error: type === 'ip' ? 'IP 地址无效' : '设备标识无效' };
  if (bans.some(item => item.type === type && item.value === value)) return { success: false, error: '该目标已在封禁列表中' };
  if (bans.length >= MAX_BANS) return { success: false, error: '封禁列表已达上限' };
  const ban: SiteBan = { id: randomBytes(8).toString('hex'), type, value, reason: String(input.reason || '').trim().slice(0, MAX_REASON), at: Date.now() };
  bans.unshift(ban);
  try { await persist(); } catch (error) {
    bans = bans.filter(item => item.id !== ban.id);
    return { success: false, error: error instanceof Error ? error.message : '封禁保存失败' };
  }
  return { success: true, ban };
}

export async function removeSiteBan(id: string) {
  const previous = bans;
  bans = bans.filter(item => item.id !== id);
  if (bans.length === previous.length) return { success: false, error: '封禁记录不存在' };
  try { await persist(); } catch (error) {
    bans = previous;
    return { success: false, error: error instanceof Error ? error.message : '解封保存失败' };
  }
  return { success: true };
}

export function mountSiteBanGuard(app: Express) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/admin') || req.path.startsWith('/api/setup') ||
      req.path === '/admin' || req.path.startsWith('/assets/') || req.path === '/favicon.ico') {
      next();
      return;
    }
    const ban = isSiteBanned({
      ip: getRequestIp(req),
      deviceId: getDeviceIdFromCookie(req.headers.cookie),
    });
    if (!ban) {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-store, no-cache, private');
    res.status(503).json({ code: 'SITE_BANNED', error: '当前访问受到限制' });
  });
}
