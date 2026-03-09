import express from 'express';
import { createServer as createViteServer } from 'vite';
import compression from 'compression';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';

async function createServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // 中间件
  app.use(compression());
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

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
    app.use(path, createProxyMiddleware(config));
  });

  // 创建 Vite 服务器（开发模式）
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  // 使用 Vite 的中间件
  app.use(vite.middlewares);

  // 启动服务器
  app.listen(PORT, () => {
    console.log(`🚀 Dev server is running on http://localhost:${PORT}`);
    console.log(`📡 API proxies configured:`);
    Object.keys(proxyConfig).forEach(path => {
      console.log(`   ${path} -> ${proxyConfig[path].target}`);
    });
  });
}

createServer();
