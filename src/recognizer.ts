// 浏览器语音识别（Safari / Chrome 的 Web Speech API）。本应用不录制、不保存原始音频；
// 但浏览器可能把声音交给系统的识别服务（如 Apple / Google）转成文字，这一点在家长端写明。
type SR = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };

function ctor(): (new () => SR) | null {
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
export const speechSupported = () => Boolean(ctor());

export type ListenState = 'idle' | 'listening' | 'done' | 'denied' | 'error';

/** continuous：一直听，直到调用返回的 stop()（或到 maxMs）；用来听孩子从 1 数到 20 这种长一点的话 */
export function listen(onText: (t: string) => void, onState: (s: ListenState) => void, opts: { continuous?: boolean; maxMs?: number } = {}) {
  const C = ctor();
  if (!C) { onState('error'); return () => {}; }
  const rec = new C();
  rec.lang = 'zh-CN'; rec.interimResults = true; rec.continuous = !!opts.continuous;
  let failed = false, stopped = false, before = '', cur = '';
  rec.onresult = e => { cur = Array.from(e.results).map(r => r[0].transcript).join(''); onText(before + cur); };
  rec.onerror = e => {
    if (opts.continuous && !stopped && e.error === 'no-speech') return;             // 孩子停顿一下：接着听
    failed = true; onState(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'denied' : e.error === 'no-speech' ? 'done' : 'error');
  };
  rec.onend = () => {
    if (failed) return;
    // iPad 的 Safari 遇到停顿会自己结束；还没说“数完了”就重新开始听，前面听到的字留着
    if (opts.continuous && !stopped) { before += cur; cur = ''; try { rec.start(); return; } catch { /* 重开失败就按结束处理 */ } }
    onState('done');
  };
  const cap = setTimeout(() => { stopped = true; rec.stop(); }, opts.maxMs ?? 15000);   // 默认最长 15 秒
  try { rec.start(); onState('listening'); } catch { onState('error'); }
  return () => { stopped = true; clearTimeout(cap); try { rec.stop(); } catch { /* 已经停止 */ } };
}
