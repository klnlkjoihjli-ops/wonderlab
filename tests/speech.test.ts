import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { cacheKey, createSpeaker, parseTtsStream, synthesize, ttsConfigured, TTS_URL } from '../server/speech.ts';
import { freshProgress, parseProgress } from '../shared/game.ts';

const cfg = { appId: 'test-app', token: 'test-only-not-a-real-token', voice: 'zh_female_vv_uranus_bigtts', resourceId: 'seed-tts-2.0' };
const chunk = (s: string) => Buffer.from(s).toString('base64');
const okBody = [JSON.stringify({ code: 0, message: '', data: chunk('ab') }), JSON.stringify({ code: 0, message: '', data: chunk('cd') }), JSON.stringify({ code: 20000000, message: 'OK', data: null })].join('\n');

test('解析流式返回：拼接所有音频片段，以 20000000 结束', () => {
  assert.equal(parseTtsStream(okBody).toString(), 'abcd');
});
test('错误码、没有结束标记或没有音频都会报错（交给前端回退到设备朗读）', () => {
  assert.throws(() => parseTtsStream(JSON.stringify({ code: 45000000, message: 'quota exceeded' })), /45000000/);
  assert.throws(() => parseTtsStream(JSON.stringify({ code: 0, data: chunk('ab') })), /no audio/);
  assert.throws(() => parseTtsStream(JSON.stringify({ code: 20000000, message: 'OK' })), /no audio/);
});
test('请求带上 V3 所需的请求头和音色，错误信息里不含密钥', async () => {
  let url = '', headers: Record<string, string> = {}, body: any;
  const fake: typeof fetch = async (u, o) => { url = String(u); headers = o?.headers as Record<string, string>; body = JSON.parse(String(o?.body)); return new Response(okBody, { status: 200 }); };
  await synthesize('你好', cfg, fake);
  assert.equal(url, TTS_URL);
  assert.equal(headers['X-Api-Resource-Id'], 'seed-tts-2.0');
  assert.equal(headers['X-Api-App-Id'], 'test-app');
  assert.ok(headers['X-Api-Request-Id']);
  assert.equal(body.req_params.speaker, 'zh_female_vv_uranus_bigtts');
  await assert.rejects(synthesize('你好', cfg, async () => new Response('denied', { status: 403 })), (e: Error) => !e.message.includes('test-only'));
});
test('同一句话只合成一次：第二次走缓存，换音色会重新合成', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'wl-tts-'));
  let calls = 0;
  const speak = createSpeaker(dir, async () => { calls++; return new Response(okBody, { status: 200 }); });
  const a = await speak('小车停在小溪边了', cfg), b = await speak('小车停在小溪边了', cfg);
  assert.equal(a.cached, false); assert.equal(b.cached, true); assert.equal(calls, 1);
  assert.equal(readdirSync(dir).length, 1);
  await speak('小车停在小溪边了', { ...cfg, voice: 'other_voice' });
  assert.equal(calls, 2);
  assert.notEqual(cacheKey('x', 'a'), cacheKey('x', 'b'));
});
test('缺任何一项配置都视为未配置', () => {
  assert.equal(ttsConfigured(cfg), true);
  assert.equal(ttsConfigured({ ...cfg, resourceId: '' }), false);
});
test('旧存档没有配音开关也能读出，默认关闭', () => {
  const old: any = freshProgress(); delete old.consent.voice;
  const r = parseProgress(JSON.stringify(old));
  assert.equal(r.recovered, false); assert.equal(r.progress.consent.voice, false);
});
