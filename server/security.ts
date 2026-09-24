import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { createHash } from 'node:crypto';
import { getConfig } from './config.js';

export function fail(res: Response, status: number, code: string, error: string) {
  return res.status(status).json({ code, error });
}

export function requireSameOrigin(req: Request, res: Response, next: NextFunction) {
  if (!isAllowedOrigin(req)) return fail(res, 403, 'ORIGIN_DENIED', '请求来源不被允许');
  next();
}

function firstForwarded(value: string | undefined) {
  return String(value || '').split(',')[0].trim();
}

export function isAllowedOrigin(req: Request) {
  const origin = String(req.get('origin') || '').trim().replace(/\/$/, '');
  if (!origin) return process.env.NODE_ENV !== 'production';

  const configured = getConfig()?.siteOrigin?.replace(/\/$/, '');
  if (configured && origin === configured) return true;

  // Reverse proxies commonly expose the public host/protocol through these
  // headers while Express sees the internal container address.
  const forwardedHost = firstForwarded(req.get('x-forwarded-host'));
  const forwardedProto = firstForwarded(req.get('x-forwarded-proto'));
  const requestHost = forwardedHost || req.get('host') || '';
  const requestProto = forwardedProto || req.protocol;
  try {
    const parsed = new URL(origin);
    return parsed.host === requestHost
      && parsed.protocol === `${requestProto}:`
      && (parsed.protocol === 'https:' || process.env.NODE_ENV !== 'production');
  } catch {
    return false;
  }
}

const windows = new Map<string, { count: number; until: number }>();
export function limit(name: string, maximum = 10) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${name}:${req.ip}`;
    const now = Date.now();
    let entry = windows.get(key);
    if (!entry || entry.until <= now) {
      if (windows.size >= 10000) return fail(res, 429, 'RATE_LIMITED', '请求过于频繁');
      entry = { count: 0, until: now + 60000 };
      windows.set(key, entry);
    }
    if (++entry.count > maximum) {
      res.set('Retry-After', String(Math.ceil((entry.until - now) / 1000)));
      console.info(`[security] ${name}_limited`);
      return fail(res, 429, 'RATE_LIMITED', '请求过于频繁，请稍后再试');
    }
    next();
  };
}
setInterval(() => {
  for (const [key, entry] of windows) if (entry.until <= Date.now()) windows.delete(key);
}, 60000).unref();

export function cookie(req: Request, name: string) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (part.slice(0, index).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(index + 1).trim()); } catch { return ''; }
  }
  return '';
}

export function secureCookie() {
  return process.env.NODE_ENV === 'production' || Boolean(getConfig()?.siteOrigin.startsWith('https:'));
}

export const digest = (value: string) => createHash('sha256').update(value).digest('hex');

export const apiError: ErrorRequestHandler = (error, _req, res, _next) => {
  const malformed = error?.type === 'entity.parse.failed' || error?.type === 'entity.too.large';
  console.error(`[api] ${malformed ? 'invalid_body' : 'request_failed'}`);
  fail(res, malformed ? 400 : 503, malformed ? 'INVALID_BODY' : 'SERVICE_UNAVAILABLE',
    malformed ? '请求内容无效或过大' : '服务暂不可用，请稍后重试');
};
