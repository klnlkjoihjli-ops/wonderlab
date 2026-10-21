import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// 小诺的在线配音：火山引擎 豆包语音合成大模型（HTTP V3 单向流式接口）。
// 返回内容是逐行 JSON：code=0 的行带 base64 音频片段，code=20000000 表示结束，其他 code 是错误。
export type TtsConfig = { appId?: string; token?: string; voice?: string; resourceId?: string };
export const TTS_URL = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional';
export const TTS_MAX_CHARS = 300;

export function ttsConfigured(c: TtsConfig) { return Boolean(c.appId && c.token && c.voice && c.resourceId); }

/** 解析流式返回，拼出完整音频；遇到错误码抛出（只带 code 和 message，不带任何密钥） */
export function parseTtsStream(body: string): Buffer {
  const parts: Buffer[] = [];
  let finished = false;
  for (const line of body.split('\n')) {
    if (!line.trim()) continue;
    const j = JSON.parse(line) as { code?: number; message?: string; data?: string | null };
    if (j.code === 0 || j.code === undefined) { if (j.data) parts.push(Buffer.from(j.data, 'base64')); }
    else if (j.code === 20000000) finished = true;
    else throw new Error(`TTS ${j.code}: ${j.message ?? ''}`.slice(0, 200));
  }
  const audio = Buffer.concat(parts);
  if (!finished || audio.length === 0) throw new Error('TTS returned no audio');
  return audio;
}

export async function synthesize(text: string, c: TtsConfig, requestFetch: typeof fetch = fetch): Promise<Buffer> {
  const res = await requestFetch(TTS_URL, {
    method: 'POST', signal: AbortSignal.timeout(8000),
    headers: { 'Content-Type': 'application/json', 'X-Api-App-Id': c.appId!, 'X-Api-Access-Key': c.token!, 'X-Api-Resource-Id': c.resourceId!, 'X-Api-Request-Id': randomUUID() },
    body: JSON.stringify({ user: { uid: 'wonderlab' }, req_params: { text, speaker: c.voice, audio_params: { format: 'mp3', sample_rate: 24000 } } })
  });
  if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
  return parseTtsStream(await res.text());
}

// —— 缓存：同一音色的同一句话只合成一次（内存 + 磁盘），固定台词不会重复计费 ——
const memory = new Map<string, Buffer>();
const MEMORY_LIMIT = 200;
export function cacheKey(text: string, voice: string) { return createHash('sha256').update(`${voice}\n${text}`).digest('hex').slice(0, 32); }

export function createSpeaker(cacheDir: string, requestFetch: typeof fetch = fetch) {
  return async function speak(text: string, c: TtsConfig): Promise<{ audio: Buffer; cached: boolean }> {
    const key = cacheKey(text, c.voice!);
    const hit = memory.get(key);
    if (hit) return { audio: hit, cached: true };
    const file = path.join(cacheDir, `${key}.mp3`);
    if (existsSync(file)) { const audio = readFileSync(file); remember(key, audio); return { audio, cached: true }; }
    const audio = await synthesize(text, c, requestFetch);
    remember(key, audio);
    try { mkdirSync(cacheDir, { recursive: true }); writeFileSync(file, audio); } catch { /* 磁盘缓存失败不影响播放 */ }
    return { audio, cached: false };
  };
}
function remember(key: string, audio: Buffer) {
  memory.set(key, audio);
  if (memory.size > MEMORY_LIMIT) memory.delete(memory.keys().next().value!);
}
