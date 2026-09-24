import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { getRedisClient, mustRedis, type RedisConnection } from './redis.js';
import { cookie, digest, fail, secureCookie } from './security.js';

const CREDENTIALS_KEY = 'fishTV:admin:credentials';
const SESSION_COOKIE = 'fish_tv_admin_sid';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
type CredentialRecord = { username: string; salt: string; hash: string; updatedAt: number };

export function validCredentials(username: unknown, password: unknown) {
  return typeof username === 'string' && /^[A-Za-z0-9_.@-]{2,32}$/.test(username) &&
    typeof password === 'string' && password.length >= 8 && password.length <= 64;
}

function hashPassword(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 32, (error, key) => error ? reject(error) : resolve(key)));
}

async function buildRecord(username: string, password: string): Promise<CredentialRecord> {
  const salt = randomBytes(16).toString('hex');
  return { username, salt, hash: (await hashPassword(password, salt)).toString('hex'), updatedAt: Date.now() };
}

function parseRecord(raw: string): CredentialRecord {
  const record = JSON.parse(raw);
  if (typeof record.username !== 'string' || !/^[a-f0-9]{32}$/.test(record.salt) || !/^[a-f0-9]{64}$/.test(record.hash)) {
    throw new Error('Invalid credentials');
  }
  return record;
}

async function verify(record: CredentialRecord, username: unknown, password: unknown) {
  if (!validCredentials(username, password)) return false;
  const hash = await hashPassword(password as string, record.salt);
  return timingSafeEqual(hash, Buffer.from(record.hash, 'hex')) && record.username === username;
}

export async function initializeCredentials(redis: RedisConnection, username: unknown, password: unknown) {
  if (!validCredentials(username, password)) throw new Error('账号或密码格式无效');
  const created = await buildRecord(username as string, password as string);
  await redis.set(CREDENTIALS_KEY, JSON.stringify(created), { NX: true });
  const raw = await redis.get(CREDENTIALS_KEY);
  // Retrying a failed installation is allowed only with the existing credentials.
  if (!raw || !(await verify(parseRecord(raw), username, password))) throw new Error('已有管理员凭据不匹配');
}

export async function initAdminCredentials() {
  const redis = getRedisClient();
  if (!redis) return;
  const raw = await redis.get(CREDENTIALS_KEY);
  if (raw) { parseRecord(raw); return; }
  if (validCredentials(process.env.ADMIN_USER || 'admin', process.env.ADMIN_PASSWORD)) {
    await initializeCredentials(redis, process.env.ADMIN_USER || 'admin', process.env.ADMIN_PASSWORD);
  }
}

export async function verifyAdminCredentials(username: unknown, password: unknown) {
  const redis = getRedisClient();
  if (!redis) return false;
  const raw = await redis.get(CREDENTIALS_KEY);
  if (!raw) return false;
  return (await verify(parseRecord(raw), username, password)) ? raw : false;
}

export async function getAdminUsername() {
  const redis = getRedisClient();
  if (!redis) return '';
  const raw = await redis.get(CREDENTIALS_KEY);
  return raw ? parseRecord(raw).username : '';
}

const sessionKey = (sid: string) => `fishTV:admin:session:${digest(sid)}`;

export async function getAdminSession(req: Request) {
  const sid = cookie(req, SESSION_COOKIE);
  if (!/^[A-Za-z0-9_-]{32}$/.test(sid)) return null;
  const redis = getRedisClient();
  if (!redis) return null;
  const [raw, credentials] = await Promise.all([redis.get(sessionKey(sid)), redis.get(CREDENTIALS_KEY)]);
  if (!raw || !credentials) return null;
  const session = JSON.parse(raw) as { username: string; version: string; expiresAt: number };
  if (session.version !== digest(credentials) || session.expiresAt <= Date.now()) return null;
  return { sid, ...session };
}

export async function createAdminSession(username: string, verifiedRecord: string) {
  const redis = mustRedis();
  const raw = await redis.get(CREDENTIALS_KEY);
  if (!raw || raw !== verifiedRecord || parseRecord(raw).username !== username) throw new Error('Credentials changed');
  const sid = randomBytes(24).toString('base64url');
  await redis.set(sessionKey(sid), JSON.stringify({
    username, version: digest(raw), expiresAt: Date.now() + SESSION_TTL_MS,
  }), { EX: SESSION_TTL_MS / 1000 });
  return { sid, expiresInMs: SESSION_TTL_MS };
}

export async function revokeAdminSession(req: Request) {
  const sid = cookie(req, SESSION_COOKIE);
  const redis = getRedisClient();
  if (sid && redis) await redis.del(sessionKey(sid));
}

export function setAdminCookie(res: Response, sid: string, maxAge = SESSION_TTL_MS / 1000) {
  res.cookie(SESSION_COOKIE, sid, { path: '/api', maxAge: maxAge * 1000, httpOnly: true, sameSite: 'lax', secure: secureCookie() });
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const session = await getAdminSession(req);
  if (!session) return fail(res, 401, 'ADMIN_REQUIRED', '未登录或登录已过期');
  res.locals.adminSession = session;
  next();
}

export async function changeAdminCredentials(input: Record<string, unknown>) {
  if (!validCredentials(input.username, input.password)) {
    return { success: false, error: '账号需为 2-32 位字母数字或 _ . @ -，密码需为 8-64 位' };
  }
  const redis = mustRedis();
  const raw = await redis.get(CREDENTIALS_KEY);
  if (!raw || !(await verify(parseRecord(raw), parseRecord(raw).username, input.currentPassword))) {
    return { success: false, error: '当前密码错误' };
  }
  const record = await buildRecord(input.username as string, input.password as string);
  const changed = await redis.eval(
    "if redis.call('GET',KEYS[1]) ~= ARGV[1] then return 0 end redis.call('SET',KEYS[1],ARGV[2]) return 1",
    { keys: [CREDENTIALS_KEY], arguments: [raw, JSON.stringify(record)] },
  );
  return changed === 1 ? { success: true } : { success: false, error: '账号已变更，请重新登录' };
}
