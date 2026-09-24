import type { Express } from 'express';
import {
  changeAdminCredentials, createAdminSession, getAdminSession, getAdminUsername,
  initAdminCredentials, requireAdmin, revokeAdminSession, setAdminCookie, verifyAdminCredentials,
} from './adminAuth.js';
import { initRedis, isRedisConnected, mustRedis } from './redis.js';
import { fail, limit, requireSameOrigin } from './security.js';
import { acquireConfigLease, getConfig, persistConfig, setupRequired, validateConfig } from './config.js';
import { listVideoSources, removeVideoSource, upsertVideoSource } from './videoSources.js';

export async function mountAdminApi(app: Express) {
  if (!setupRequired() && await initRedis()) await initAdminCredentials();

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/ready', async (_req, res) => {
    if (setupRequired() || !isRedisConnected()) return fail(res, 503, 'NOT_READY', '服务尚未就绪');
    await mustRedis().ping();
    res.json({ ok: true });
  });
  app.get('/api/admin/session', async (req, res) => {
    const session = await getAdminSession(req);
    if (!session) return fail(res, 401, 'ADMIN_REQUIRED', '未登录或登录已过期');
    res.json({ ok: true, username: session.username, expiresInMs: session.expiresAt - Date.now() });
  });
  app.post('/api/admin/login', requireSameOrigin, limit('admin_login', 5), async (req, res) => {
    const record = await verifyAdminCredentials(req.body?.username, req.body?.password);
    if (!record) {
      console.info('[admin] login_denied');
      return fail(res, 403, 'INVALID_CREDENTIALS', '账号或密码错误');
    }
    const session = await createAdminSession(req.body.username, record);
    setAdminCookie(res, session.sid);
    console.info('[admin] login_success');
    res.json({ ok: true });
  });
  app.post('/api/admin/logout', requireSameOrigin, async (req, res) => {
    await revokeAdminSession(req);
    setAdminCookie(res, '', 0);
    res.json({ ok: true });
  });
  app.get('/api/admin/overview', requireAdmin, async (_req, res) => {
    await mustRedis().ping();
    res.json({
      username: await getAdminUsername(), redis: { connected: true },
      server: { node: process.version, uptimeSeconds: Math.floor(process.uptime()) },
    });
  });
  app.put('/api/admin/credentials', requireSameOrigin, requireAdmin, limit('admin_credentials', 5), async (req, res) => {
    const result = await changeAdminCredentials(req.body || {});
    if (!result.success) return fail(res, 400, 'CREDENTIALS_REJECTED', result.error || '更新失败');
    setAdminCookie(res, '', 0);
    console.info('[admin] credentials_changed');
    res.json({ ok: true });
  });
  app.get('/api/admin/config', requireAdmin, (_req, res) => {
    const config = getConfig();
    res.json({
      siteOrigin: config?.siteOrigin || '', clientId: config?.clientId || '',
      clientSecretConfigured: Boolean(config?.clientSecret),
      callbackUrl: config?.siteOrigin ? `${config.siteOrigin}/api/auth/moyu/callback` : '',
      redisConfigured: Boolean(config?.redisUrl),
    });
  });
  app.get('/api/admin/video-sources', requireAdmin, (_req, res) => {
    res.json({ sources: listVideoSources({ includeDisabled: true, includeUrls: true }) });
  });
  app.post('/api/admin/video-sources', requireSameOrigin, requireAdmin, limit('admin_video_source', 30), async (req, res) => {
    try {
      const source = await upsertVideoSource(req.body);
      console.info('[admin] video_source_created');
      res.json({ source });
    } catch (error) {
      fail(res, 400, 'VIDEO_SOURCE_REJECTED', error instanceof Error ? error.message : '视频源地址无效');
    }
  });
  app.put('/api/admin/video-sources/:id', requireSameOrigin, requireAdmin, limit('admin_video_source', 30), async (req, res) => {
    try {
      const source = await upsertVideoSource(req.body, String(req.params.id));
      console.info('[admin] video_source_updated');
      res.json({ source });
    } catch (error) {
      fail(res, 400, 'VIDEO_SOURCE_REJECTED', error instanceof Error ? error.message : '视频源地址无效');
    }
  });
  app.delete('/api/admin/video-sources/:id', requireSameOrigin, requireAdmin, limit('admin_video_source', 30), async (req, res) => {
    try {
      await removeVideoSource(String(req.params.id));
      console.info('[admin] video_source_deleted');
      res.json({ ok: true });
    } catch (error) {
      fail(res, 400, 'VIDEO_SOURCE_REJECTED', error instanceof Error ? error.message : '内置视频源只能停用');
    }
  });
  app.put('/api/admin/config', requireSameOrigin, requireAdmin, limit('admin_config', 5), async (req, res) => {
    // Configuration changes require password confirmation, not just a stolen session.
    if (!(await verifyAdminCredentials(res.locals.adminSession.username, req.body?.currentPassword))) {
      return fail(res, 403, 'INVALID_CREDENTIALS', '当前管理员密码错误');
    }
    const config = getConfig();
    if (!config) return fail(res, 409, 'SETUP_REQUIRED', '请先安装');
    let next;
    try {
      next = validateConfig({
        redisUrl: config.redisUrl, siteOrigin: req.body.siteOrigin, clientId: req.body.clientId,
        clientSecret: req.body.clientSecret === '' ? config.clientSecret : req.body.clientSecret,
      });
    } catch { return fail(res, 400, 'INVALID_CONFIG', '请检查站点地址、Client ID 和 Secret'); }
    const release = acquireConfigLease();
    try { persistConfig(next); } finally { release(); }
    console.info('[admin] oauth_config_changed');
    res.json({ ok: true });
  });
}
