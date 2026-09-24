import { createProxyMiddleware } from 'http-proxy-middleware';
import { getVideoSource } from './videoSources.js';
import { requireUser } from './userAuth.js';

function sourceId(req: { originalUrl?: string; url?: string }) {
  const match = String(req.originalUrl || req.url || '').match(/^\/video-source\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export const videoSourceProxy = [
  requireUser,
  createProxyMiddleware({
    target: 'http://127.0.0.1',
    changeOrigin: true,
    proxyTimeout: 15000,
    timeout: 20000,
    router: (req) => {
      const source = getVideoSource(sourceId(req));
      if (!source) return 'http://127.0.0.1';
      return new URL(source.url).origin;
    },
    pathRewrite: (incomingPath, req) => {
      const source = getVideoSource(sourceId(req));
      if (!source) return incomingPath;
      return `${new URL(source.url).pathname.replace(/\/$/, '')}${incomingPath}`;
    },
    on: {
      proxyReq: (proxyReq) => {
        proxyReq.removeHeader('cookie');
        proxyReq.removeHeader('authorization');
      },
    },
  }),
];
