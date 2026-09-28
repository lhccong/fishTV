import type { Express, Request, Response, NextFunction } from 'express';
import { randomBytes } from 'node:crypto';
import { getConfig, oauthConfigured, setupRequired } from './config.js';
import { mustRedis } from './redis.js';
import { cookie, digest, fail, limit, requireSameOrigin, secureCookie } from './security.js';
import { listVideoSources } from './videoSources.js';
import { createDeviceId, DEVICE_COOKIE, getDeviceIdFromCookie } from './deviceIdentity.js';

const USER_COOKIE = 'fish_tv_user_sid';
const FLOW_COOKIE = 'fish_tv_oauth_flow';
const SESSION_TTL = 7 * 24 * 60 * 60;
const PROFILE_VERSION = 'avatar-v2';
const stateKey = (state: string) => `fishTV:oauth:state:${digest(state)}`;
const sessionKey = (sid: string) => `fishTV:user:session:${digest(sid)}`;
const validToken = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
type Profile = { id: string; username: string; avatarUrl?: string };
export type UserSession = { profile: Profile; version: string; profileVersion?: string };

function returnPath(value: unknown) {
  if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('/') ||
      value.startsWith('//') || /[\\\r\n\0]/.test(value) || value.startsWith('/api/')) return '/';
  return value;
}

async function fetchJson(url: string, options: RequestInit) {
  const response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(8000) });
  if (!response.ok || !response.body) throw new Error('OAuth upstream failed');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) throw new Error('OAuth response too large');
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { await reader.cancel(); }
}

export async function getUserSession(req: Request): Promise<UserSession | null> {
  const sid = cookie(req, USER_COOKIE);
  if (!validToken(sid)) return null;
  const raw = await mustRedis().get(sessionKey(sid));
  if (!raw) return null;
  const session = JSON.parse(raw) as UserSession;
  return session.version === getConfig()?.authVersion && session.profileVersion === PROFILE_VERSION ? session : null;
}

export async function requireUser(req: Request, res: Response, next: NextFunction) {
  if (setupRequired()) return fail(res, 503, 'SETUP_REQUIRED', '站点尚未完成安装');
  if (!oauthConfigured()) return fail(res, 503, 'AUTH_NOT_CONFIGURED', '请管理员在后台完成登录配置');
  if (!(await getUserSession(req))) return fail(res, 401, 'LOGIN_REQUIRED', '请先登录摸鱼岛');
  next();
}

export function mountUserAuth(app: Express) {
  app.get('/api/video-sources', requireUser, (_req, res) => {
    res.json({ sources: listVideoSources() });
  });
  app.get('/api/auth/moyu/status', async (req, res) => {
    const session = setupRequired() ? null : await getUserSession(req);
    if (!getDeviceIdFromCookie(req.headers.cookie)) {
      res.cookie(DEVICE_COOKIE, createDeviceId(), {
        path: '/', httpOnly: true, sameSite: 'lax', secure: secureCookie(), maxAge: SESSION_TTL * 1000,
      });
    }
    res.json({ authenticated: Boolean(session), enabled: oauthConfigured(), user: session?.profile || null });
  });
  app.post('/api/auth/moyu/logout', requireSameOrigin, async (req, res) => {
    const sid = cookie(req, USER_COOKIE);
    if (validToken(sid)) await mustRedis().del(sessionKey(sid));
    res.clearCookie(USER_COOKIE, { path: '/', httpOnly: true, sameSite: 'lax', secure: secureCookie() });
    res.clearCookie(FLOW_COOKIE, { path: '/api/auth/moyu', httpOnly: true, sameSite: 'lax', secure: secureCookie() });
    res.json({ ok: true });
  });

  app.get('/api/auth/moyu/start', limit('oauth_start', 20), async (req, res) => {
    const config = getConfig();
    if (!config || !oauthConfigured()) return fail(res, 503, 'AUTH_NOT_CONFIGURED', '摸鱼岛登录尚未配置');
    const state = randomBytes(32).toString('base64url');
    const flow = randomBytes(32).toString('base64url');
    await mustRedis().set(stateKey(state), JSON.stringify({
      binding: digest(flow), returnPath: returnPath(req.query.returnPath), version: config.authVersion,
    }), { EX: 600 });
    res.cookie(FLOW_COOKIE, flow, { path: '/api/auth/moyu', httpOnly: true, sameSite: 'lax', secure: secureCookie(), maxAge: 600000 });
    const authorize = new URL('https://yucoder.cn/oauth2/authorize');
    authorize.search = new URLSearchParams({
      client_id: config.clientId, redirect_uri: `${config.siteOrigin}/api/auth/moyu/callback`,
      response_type: 'code', scope: 'read', state,
    }).toString();
    res.redirect(authorize.toString());
  });

  app.get('/api/auth/moyu/callback', limit('oauth_callback', 30), async (req, res) => {
    try {
      const config = getConfig();
      const state = req.query.state;
      const flow = cookie(req, FLOW_COOKIE);
      if (!config || !validToken(state) || !validToken(flow)) throw new Error('Invalid state');
      const redis = mustRedis();
      const raw = await redis.get(stateKey(state));
      if (!raw) throw new Error('Expired state');
      const saved = JSON.parse(raw);
      if (saved.binding !== digest(flow) || saved.version !== config.authVersion) throw new Error('State mismatch');
      if (await redis.getDel(stateKey(state)) !== raw) throw new Error('Replayed state');
      res.clearCookie(FLOW_COOKIE, { path: '/api/auth/moyu', httpOnly: true, sameSite: 'lax', secure: secureCookie() });
      if (typeof req.query.code !== 'string' || !req.query.code || req.query.code.length > 2048 || req.query.error) {
        throw new Error('Authorization declined');
      }
      const tokenData = await fetchJson('https://api.yucoder.cn/api/oauth2/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({
          grant_type: 'authorization_code', client_id: config.clientId, client_secret: config.clientSecret,
          code: req.query.code, redirect_uri: `${config.siteOrigin}/api/auth/moyu/callback`,
        }).toString(),
      });
      const token = tokenData?.data?.access_token || tokenData?.access_token;
      if ((tokenData.code && tokenData.code !== 0) || typeof token !== 'string' || !token || token.length > 8192) throw new Error('Missing token');
      const payload = await fetchJson('https://api.yucoder.cn/api/oauth2/userinfo', {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const data = payload?.data || payload;
      const id = data.id ?? data.sub;
      if ((payload.code && payload.code !== 0) || !['string', 'number'].includes(typeof id) || !String(id).trim() || String(id).length > 256) {
        throw new Error('Invalid profile');
      }
      if (getConfig()?.authVersion !== config.authVersion) throw new Error('Configuration changed');
      let rawAvatar = String(data.avatar || data.avatar_url || data.avatarUrl || '').trim();
      if (!rawAvatar) {
        const template = String(data.avatar_template || data.avatarTemplate || '').trim();
        rawAvatar = template.includes('{size}') ? template.replace('{size}', '96') : template;
      }
      let avatarUrl = '';
      try {
        const avatar = new URL(rawAvatar);
        if (avatar.protocol === 'https:' || (process.env.NODE_ENV !== 'production' && avatar.protocol === 'http:')) {
          avatarUrl = avatar.toString().slice(0, 2048);
        }
      } catch {
        // OAuth profile avatar is optional.
      }
      const profile: Profile = {
        id: String(id),
        username: String(data.name || data.username || '摸鱼用户').trim().slice(0, 80),
        ...(avatarUrl ? { avatarUrl } : {}),
      };
      const sid = randomBytes(32).toString('base64url');
      const old = cookie(req, USER_COOKIE);
      await redis.set(sessionKey(sid), JSON.stringify({
        profile, version: config.authVersion, profileVersion: PROFILE_VERSION,
      }), { EX: SESSION_TTL });
      if (validToken(old)) await redis.del(sessionKey(old));
      res.cookie(USER_COOKIE, sid, { path: '/', httpOnly: true, sameSite: 'lax', secure: secureCookie(), maxAge: SESSION_TTL * 1000 });
      if (!getDeviceIdFromCookie(req.headers.cookie)) {
        res.cookie(DEVICE_COOKIE, createDeviceId(), {
          path: '/', httpOnly: true, sameSite: 'lax', secure: secureCookie(), maxAge: SESSION_TTL * 1000,
        });
      }
      console.info('[auth] oauth_success');
      res.redirect(returnPath(saved.returnPath));
    } catch {
      console.warn('[auth] oauth_failed');
      res.redirect('/?loginError=oauth_failed');
    }
  });
}
