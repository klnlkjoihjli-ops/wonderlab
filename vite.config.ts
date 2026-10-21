import { existsSync, readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// /api 代理保留原始 Host（changeOrigin: false），服务端的同源检查才能对上浏览器的 Origin。
// 简写 '/api': 'http://…' 会把 Host 改成 127.0.0.1:8787，导致浏览器请求全部 403、悄悄退回基础提示。

// 普通版（npm run dev）用 4177，HTTPS 版（npm run dev:https）用 4178，两个可以同时开。
// npm run dev:https 时用 certs/ 下的局域网证书（mkcert 生成），iPad 上才能用麦克风做语音识别
const wantHttps = process.env.WONDERLAB_HTTPS === '1';
const certFile = 'certs/dev.pem', keyFile = 'certs/dev-key.pem';
if (wantHttps && !(existsSync(certFile) && existsSync(keyFile))) {
  throw new Error('缺少 certs/dev.pem 或 certs/dev-key.pem，请先按 README 用 mkcert 生成局域网证书');
}
const https = wantHttps ? { cert: readFileSync(certFile), key: readFileSync(keyFile) } : undefined;

export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: wantHttps ? 4178 : 4177, strictPort: true, https, proxy: { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: false } } },
  build: { chunkSizeWarningLimit: 800, rollupOptions: { input: { main: 'index.html', bench: 'bench.html', demo: 'demo.html', proto: 'proto.html' }, output: { manualChunks: { three: ['three'] } } } }
});
