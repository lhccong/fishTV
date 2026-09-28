import type { Express } from 'express';
import { loadConfig } from './config.js';
import { mountSetupApi } from './setupApi.js';
import { mountAdminApi } from './adminApi.js';
import { mountUserAuth } from './userAuth.js';
import { initVideoSources } from './videoSources.js';
import { initSiteBans, mountSiteBanGuard } from './siteBan.js';

export async function mountServices(app: Express) {
  loadConfig();
  app.disable('x-powered-by');
  app.use('/api', (_req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    next();
  });
  mountSetupApi(app);
  await mountAdminApi(app);
  await initSiteBans();
  mountSiteBanGuard(app);
  await initVideoSources();
  mountUserAuth(app);
  app.use('/api', (_req, res) => res.status(404).json({ code: 'NOT_FOUND', error: '接口不存在' }));
}
