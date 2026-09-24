import express from 'express';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { mountServices } from './server/bootstrap.js';
import { requireUser } from './server/userAuth.js';
import { apiError } from './server/security.js';
import { videoSourceProxy } from './server/videoProxy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(compression()); // 启用 gzip 压缩
app.use(express.json({ limit: '16kb' }));

await mountServices(app);

app.use('/video-source/:sourceId', ...videoSourceProxy);

// API 反向代理配置
const proxyConfig = {
  '/ikun': {
    target: 'https://api.ffzyapi.com',
    changeOrigin: true,
    pathRewrite: { '^/ikun': '' },
  },
  '/modu': {
    target: 'http://mdzyapi.com',
    changeOrigin: true,
    pathRewrite: { '^/modu': '' },
  },
  '/subocaiji': {
    target: 'http://subocaiji.com',
    changeOrigin: true,
    pathRewrite: { '^/subocaiji': '' },
  },
  '/wpon': {
    target: 'http://tucdn.wpon.cn',
    changeOrigin: true,
    pathRewrite: { '^/wpon': '' },
  },
  '/youzhi': {
    target: 'http://api.yzzy-api.com',
    changeOrigin: true,
    pathRewrite: { '^/youzhi': '' },
  },
};

// 应用反向代理
Object.entries(proxyConfig).forEach(([path, config]) => {
  app.use(path, requireUser, (req, _res, next) => {
    delete req.headers.cookie;
    delete req.headers.authorization;
    next();
  }, createProxyMiddleware({ ...config, proxyTimeout: 15000, timeout: 20000 }));
});
app.use(apiError);

// 静态文件服务
app.use(express.static(path.join(__dirname, 'dist'), {
  maxAge: '1y', // 静态资源缓存 1 年
  etag: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-store');
  },
}));

// SPA 路由处理 - 所有路由都返回 index.html
app.use((req, res) => {
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📁 Serving static files from: ${path.join(__dirname, 'dist')}`);
  console.log(`📡 API proxies configured:`);
  Object.entries(proxyConfig).forEach(([path, config]) => {
    console.log(`   ${path} -> ${config.target}`);
  });
});
