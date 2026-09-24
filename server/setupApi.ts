import type { Express, Request, Response, NextFunction } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { acquireConfigLease, persistConfig, setupRequired, validateConfig } from './config.js';
import { adoptRedis, connectRedis, type RedisConnection } from './redis.js';
import { initializeCredentials, validCredentials } from './adminAuth.js';
import { digest, fail, isAllowedOrigin, limit } from './security.js';

let installToken = '';

function requireInstaller(req: Request, res: Response, next: NextFunction) {
  if (!setupRequired()) return fail(res, 409, 'ALREADY_INSTALLED', '安装已完成，请登录后台');
  const submitted = req.get('x-setup-token') || '';
  if (!installToken || !timingSafeEqual(Buffer.from(digest(submitted)), Buffer.from(digest(installToken)))) {
    return fail(res, 403, 'SETUP_TOKEN_REQUIRED', '安装口令错误，请查看服务端启动控制台');
  }
  if (!isAllowedOrigin(req)) return fail(res, 403, 'ORIGIN_DENIED', '请求来源不被允许');
  next();
}

export function mountSetupApi(app: Express) {
  if (setupRequired()) {
    installToken = randomBytes(24).toString('base64url');
    // This one-time bootstrap secret is deliberately console-only, never an API response.
    console.info(`首次网页安装口令（仅限部署者使用）: ${installToken}`);
  }
  app.get('/api/setup/status', (_req, res) => res.json({ setupRequired: setupRequired() }));

  app.post('/api/setup/redis-test', limit('setup', 10), requireInstaller, async (req, res) => {
    let connection: RedisConnection | undefined;
    try {
      const config = validateConfig(req.body);
      connection = await connectRedis(config.redisUrl);
      res.json({ ok: true });
    } catch {
      fail(res, 400, 'REDIS_TEST_FAILED', '连接或配置校验失败，请检查 Redis 地址和安装字段');
    } finally { if (connection?.isOpen) connection.destroy(); }
  });

  app.post('/api/setup/install', limit('setup', 10), requireInstaller, async (req, res) => {
    let release: (() => void) | undefined;
    let connection: RedisConnection | undefined;
    try {
      if (!validCredentials(req.body?.username, req.body?.password)) {
        return fail(res, 400, 'INVALID_CREDENTIALS', '账号需为 2-32 位字母数字或 _ . @ -，密码需为 8-64 位');
      }
      const next = validateConfig(req.body);
      release = acquireConfigLease();
      if (!setupRequired()) {
        return fail(res, 409, 'ALREADY_INSTALLED', '安装已完成');
      }
      connection = await connectRedis(next.redisUrl);
      await initializeCredentials(connection, req.body.username, req.body.password);
      persistConfig(next);
      adoptRedis(connection);
      connection = undefined;
      installToken = '';
      console.info('[setup] installed');
      res.json({ ok: true });
    } catch (error) {
      const busy = (error as NodeJS.ErrnoException).code === 'EEXIST';
      console.error('[setup] install_failed');
      fail(res, busy ? 409 : 400, busy ? 'SETUP_BUSY' : 'SETUP_FAILED',
        busy ? '另一个安装请求正在执行' : '安装失败，请检查配置、目录权限和已有管理员凭据后重试');
    } finally {
      if (connection?.isOpen) connection.destroy();
      release?.();
    }
  });
}
