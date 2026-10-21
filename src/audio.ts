// 合成音效（不依赖外部音频文件）+ 中文朗读
let ctx: AudioContext | null = null;
let muted = false;
export function setMuted(m: boolean) { muted = m; if (m) stopSpeaking(); }
export function unlockAudio() {
  try { ctx ??= new AudioContext(); if (ctx.state === 'suspended') void ctx.resume(); } catch { ctx = null; }
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.18, when = 0, slide = 0) {
  if (muted || !ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.05);
}
function noiseBurst(dur: number, freq: number, gain = 0.2, when = 0) {
  if (muted || !ctx) return;
  const t = ctx.currentTime + when;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
  const g = ctx.createGain(); g.gain.value = gain;
  src.connect(f).connect(g).connect(ctx.destination); src.start(t);
}

export const sfx = {
  pick: () => tone(520, 0.12, 'triangle', 0.12, 0, 260),
  place: () => { tone(180, 0.18, 'sine', 0.3, 0, -60); noiseBurst(0.08, 900, 0.12); tone(880, 0.12, 'triangle', 0.08, 0.06); },
  remove: () => tone(420, 0.15, 'triangle', 0.12, 0, -200),
  tap: () => tone(660, 0.08, 'triangle', 0.1),
  deny: () => { tone(300, 0.12, 'square', 0.05); tone(240, 0.16, 'square', 0.05, 0.1); },
  engine: () => { for (let i = 0; i < 6; i++) tone(95 + (i % 2) * 12, 0.16, 'sawtooth', 0.035, i * 0.13); },
  honk: () => { tone(523, 0.14, 'square', 0.06); tone(659, 0.18, 'square', 0.06, 0.16); },
  creak: () => { tone(160, 0.6, 'sawtooth', 0.05, 0, 90); tone(240, 0.5, 'sawtooth', 0.03, 0.2, -80); },
  splash: () => { noiseBurst(0.45, 1500, 0.3); noiseBurst(0.3, 600, 0.2, 0.05); },
  oops: () => { tone(500, 0.18, 'sine', 0.14, 0, -180); tone(380, 0.25, 'sine', 0.12, 0.2, -120); },
  success: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'triangle', 0.13, i * 0.11)),
  whoosh: () => noiseBurst(0.35, 2200, 0.08)
};

let voice: SpeechSynthesisVoice | null = null;
function pickVoice() {
  const vs = window.speechSynthesis?.getVoices() ?? [];
  voice = vs.find(v => /zh[-_]CN/i.test(v.lang) && /Tingting|婷婷|Xiaoxiao|晓晓|Meijia/i.test(v.name)) ?? vs.find(v => /zh[-_]CN/i.test(v.lang)) ?? vs.find(v => /^zh/i.test(v.lang)) ?? null;
}
if (typeof window !== 'undefined' && window.speechSynthesis) { pickVoice(); window.speechSynthesis.onvoiceschanged = pickVoice; }

// —— 小诺说话：优先用火山引擎在线配音（家长开启后），失败或超时就用设备自带的朗读 ——
let onlineVoice = false;
let token = 0;                                   // 每次新说话 +1，晚到的旧音频直接丢弃
let current: AudioBufferSourceNode | null = null;
export type VoiceMode = 'online' | 'device' | 'none';
let lastMode: VoiceMode = 'none';
export const lastVoiceMode = () => lastMode;
export function setOnlineVoice(on: boolean) { onlineVoice = on; }

function deviceSpeak(text: string, onEnd?: () => void) {
  const synth = window.speechSynthesis;
  if (!synth) { onEnd?.(); return; }
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN'; u.rate = 0.95; u.pitch = 1.15; if (voice) u.voice = voice;
  u.onend = () => onEnd?.(); u.onerror = () => onEnd?.();
  lastMode = 'device';
  synth.speak(u);
}

async function onlineSpeak(text: string, my: number, onEnd?: () => void) {
  // 用 Web Audio 播放：iPad Safari 不允许在网络请求之后再调用 <audio>.play()，但已解锁的 AudioContext 可以
  const res = await fetch('/api/speak', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`speak ${res.status}`);
  const buffer = await ctx!.decodeAudioData(await res.arrayBuffer());
  if (my !== token || muted) return;             // 已经被新的话或静音打断
  const src = ctx!.createBufferSource();
  src.buffer = buffer; src.connect(ctx!.destination);
  src.onended = () => { if (current === src) { current = null; onEnd?.(); } };
  current = src; lastMode = 'online';
  src.start();
}

export function speak(text: string, onEnd?: () => void) {
  stopSpeaking();
  const my = ++token;
  if (muted) { onEnd?.(); return; }
  if (onlineVoice && ctx && text.length <= 300) {
    onlineSpeak(text, my, onEnd).catch(() => { if (my === token && !muted) deviceSpeak(text, onEnd); });
    return;
  }
  deviceSpeak(text, onEnd);
}
export function stopSpeaking() {
  token++;
  window.speechSynthesis?.cancel();
  if (current) { const c = current; current = null; try { c.stop(); } catch { /* 已经播完 */ } }
}
