import express from 'express';
import compression from 'compression';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(compression()); // 启用 gzip 压缩
app.use(cors()); // 启用 CORS
app.use(express.json()); // 解析 JSON 请求体
app.use(express.urlencoded({ extended: true })); // 解析 URL 编码的请求体

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

// 静态文件服务
app.use(express.static(path.join(__dirname, 'dist'), {
  maxAge: '1y', // 静态资源缓存 1 年
  etag: true,
}));

// SPA 路由处理 - 所有路由都返回 index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📁 Serving static files from: ${path.join(__dirname, 'dist')}`);
  console.log(`📡 API proxies configured:`);
  Object.keys(proxyConfig).forEach(path => {
    console.log(`   ${path} -> ${proxyConfig[path].target}`);
  });
});
