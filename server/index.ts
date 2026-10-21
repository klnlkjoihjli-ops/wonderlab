import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tutorRequestSchema } from '../shared/game.ts';
import { labTutorRequestSchema } from '../shared/lab.ts';
import { checkConnection, configured, labTutor, tutor } from './tutor.ts';
import { TTS_MAX_CHARS, createSpeaker, ttsConfigured, type TtsConfig } from './speech.ts';

const app = express();
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// 每次请求都重新读 .env：家长改了密钥不用重启服务
function readEnv(): Record<string, string> {
  let local: Record<string, string> = {};
  try { local = dotenv.parse(readFileSync(path.join(ROOT, '.env'))); } catch { /* Environment-only deployments do not need a file. */ }
  return { ...process.env as Record<string, string>, ...local };
}
function getTts(): TtsConfig {
  const e = readEnv();
  return { appId: e.WONDERLAB_TTS_APP_ID, token: e.WONDERLAB_TTS_TOKEN, voice: e.WONDERLAB_TTS_VOICE, resourceId: e.WONDERLAB_TTS_RESOURCE_ID };
}
const speakCached = createSpeaker(path.join(ROOT, 'cache', 'tts'));
function getConfig() {
  let local: Record<string, string> = {};
  try { local = dotenv.parse(readFileSync(path.join(ROOT, '.env'))); } catch { /* Environment-only deployments do not need a file. */ }
  return { baseUrl: local.WONDERLAB_AI_BASE_URL || process.env.WONDERLAB_AI_BASE_URL || 'https://api.deepseek.com', apiKey: local.WONDERLAB_AI_KEY || process.env.WONDERLAB_AI_KEY, model: local.WONDERLAB_AI_MODEL || process.env.WONDERLAB_AI_MODEL || 'deepseek-flash' };
}
app.disable('x-powered-by');
app.use(express.json({ limit: '8kb' }));
app.use((_req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'same-origin'); next(); });
app.get('/api/health', (_req, res) => { const c = getConfig(); res.setHeader('Cache-Control', 'no-store'); const t = getTts(); res.json({ ok: true, aiConfigured: configured(c), provider: 'DeepSeek', model: c.model, ttsConfigured: ttsConfigured(t), ttsVoice: ttsConfigured(t) ? t.voice : null, records: 'browser-only', version: '0.4.0' }); });
const calls = new Map<string, { start: number; count: number }>();
// 只接受同源请求，避免其他网页借用家里的模型额度
function sameOrigin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const origin = req.get('origin');
  if (origin) { try { if (new URL(origin).host !== req.get('host')) { res.status(403).json({ error: 'Origin not allowed' }); return; } } catch { res.status(403).json({ error: 'Invalid origin' }); return; } }
  next();
}
function limit(req: express.Request, res: express.Response, max: number) {
  const key = `${req.path}:${req.ip || 'local'}`; const now = Date.now();
  for (const [id, entry] of calls) if (now - entry.start > 60000) calls.delete(id);
  const entry = calls.get(key) ?? { start: now, count: 0 };
  if (entry.count >= max || calls.size > 1000) { res.status(429).json({ error: 'Please wait a moment' }); return false; }
  entry.count++; calls.set(key, entry); return true;
}
// 小诺的在线配音：返回 MP3。未配置时返回 503，前端改用设备自带的朗读
app.post('/api/speak', sameOrigin, async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text || text.length > TTS_MAX_CHARS) { res.status(400).json({ error: 'Invalid text' }); return; }
  const c = getTts();
  if (!ttsConfigured(c)) { res.status(503).json({ error: 'TTS not configured' }); return; }
  if (!limit(req, res, 60)) return;
  try {
    const { audio, cached } = await speakCached(text, c);
    res.setHeader('Content-Type', 'audio/mpeg'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Tts-Cache', cached ? 'hit' : 'miss');
    res.send(audio);
  } catch (e) {
    console.warn('TTS failed:', e instanceof Error ? e.message : 'unknown');
    res.status(502).json({ error: 'TTS unavailable' });
  }
});
app.post('/api/ai/check', sameOrigin, async (req, res) => {
  if (!limit(req, res, 6)) return;
  res.setHeader('Cache-Control', 'no-store');
  res.json(await checkConnection(getConfig()));
});
app.post('/api/tutor', sameOrigin, async (req, res) => {
  const parsed = tutorRequestSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid task context' }); return; }
  if (!limit(req, res, 25)) return;
  res.setHeader('Cache-Control', 'no-store');
  res.json(await tutor(parsed.data, getConfig()));
});
app.post('/api/lab-tutor', sameOrigin, async (req, res) => {
  const parsed = labTutorRequestSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid lab context' }); return; }
  if (!limit(req, res, 25)) return;
  res.setHeader('Cache-Control', 'no-store');
  res.json(await labTutor(parsed.data, getConfig()));
});
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
if (process.env.NODE_ENV === 'production') {
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
  app.use(express.static(dist));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.status(400).json({ error: 'Invalid request' }); });
// 开发模式热重启时，旧进程可能还没释放端口：遇到 EADDRINUSE 稍等重试，其他错误如实报出
const port = Number(process.env.PORT || 8787);
function start(attempt = 0) {
  const server = app.listen(port, '0.0.0.0');
  server.once('listening', () => console.log(`WonderLab service ready on :${port}. Family records stay in the browser.`));
  server.once('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE' && attempt < 10) { setTimeout(() => start(attempt + 1), 500); return; }
    console.error(`WonderLab service failed to start on :${port}: ${error.code ?? error.message}`);
    process.exitCode = 1;
  });
}
start();
