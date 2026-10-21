import { spawn } from 'node:child_process';
// 开发启动：后端（8787）+ 前端（普通版 4177 / HTTPS 版 4178）。
// 后端固定用 8787（vite.config.ts 的 /api 代理指向这里）。不能沿用外部注入的 PORT：
// 预览工具会把 PORT 设成前端端口，导致服务端抢占前端端口启动失败。
const serverPort = process.env.WONDERLAB_SERVER_PORT || '8787';
const serverEnv = { ...process.env, PORT: serverPort };

// 普通版和 HTTPS 版可以同时开：如果 8787 上已经有 WonderLab 后端在跑，就共用它，不再重复启动
async function backendRunning() {
  try { const r = await fetch(`http://127.0.0.1:${serverPort}/api/health`, { signal: AbortSignal.timeout(1500) }); return r.ok && (await r.json()).ok === true; }
  catch { return false; }
}

const children = [];
if (await backendRunning()) console.log(`WonderLab 后端已在 :${serverPort} 运行，直接共用。`);
else children.push(spawn('node', ['--import', 'tsx', '--watch', 'server/index.ts'], { stdio: 'inherit', env: serverEnv }));
children.push(spawn('node', ['node_modules/vite/bin/vite.js'], { stdio: 'inherit' }));

let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; children.forEach(p => p.kill('SIGTERM')); setTimeout(() => process.exit(code), 300).unref(); }
children.forEach(p => p.on('exit', code => stop(code ?? 1)));
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
