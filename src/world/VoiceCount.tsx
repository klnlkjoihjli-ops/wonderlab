import { useEffect, useRef, useState } from 'react';
import { checkCount, countFeedback, type CountResult } from '../../shared/modules/count';
import { listen, speechSupported, type ListenState } from '../recognizer';
import { sfx, speak, stopSpeaking } from '../audio';
import { CheckIcon, CloseIcon, MicIcon, RetryIcon } from '../components/Icons';
import { HoldButton } from './HoldButton';

type Phase = 'ready' | 'listening' | 'result' | 'unavailable';

/**
 * 语音过关：对小诺从 1 数到 target。
 * 用设备自带的语音识别把声音变成文字（本应用不录音、不存音频），再由 shared/modules/count.ts 的规则判断。
 * 听不了（设备不支持、没开权限、家长没打开语音识别）或者数了没过，都可以让爸爸妈妈按住确认。
 */
export function VoiceCount({ target, allowed, onPass, onParent, onClose }: {
  target: number; allowed: boolean;
  onPass: (r: CountResult) => void; onParent: () => void; onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>(() => (allowed && speechSupported() ? 'ready' : 'unavailable'));
  const [why, setWhy] = useState(!allowed ? 'off' : !speechSupported() ? 'unsupported' : '');
  const [text, setText] = useState('');
  const [result, setResult] = useState<CountResult | null>(null);
  const stopRef = useRef<() => void>(() => {});
  const textRef = useRef(''); textRef.current = text;
  const live = checkCount(text, target);

  useEffect(() => {
    speak(phase === 'unavailable' ? '这台设备现在听不了，请爸爸妈妈听你数，数完按住确认。' : `按下话筒，对小诺从 1 数到 ${target}。数完了按“数完了”。`);
    return () => stopRef.current();
  }, []);

  const finish = (t: string) => {
    const r = checkCount(t, target);
    setResult(r); setPhase('result');
    if (r.ok) { sfx.success(); onPass(r); }
    else sfx.oops();
    speak(countFeedback(r, target));
  };
  const start = () => {
    stopSpeaking(); sfx.tap(); setText(''); setResult(null); setPhase('listening');
    // 等小诺的声音停下再开始听，免得把小诺的话也识别进去
    setTimeout(() => {
      stopRef.current = listen(t => setText(t), (s: ListenState) => {
        if (s === 'denied' || s === 'error') { setWhy(s); setPhase('unavailable'); stopRef.current(); return; }
        if (s === 'done') finish(textRef.current);
      }, { continuous: true, maxMs: 60000 });
    }, 300);
  };
  const done = () => stopRef.current();     // 停下后 onState('done') 会触发 finish

  const reason = why === 'off' ? '爸爸妈妈还没有打开语音识别（家长视角 → 设置）。'
    : why === 'unsupported' ? '这个浏览器不支持语音识别，用 iPad 的 Safari 打开 https 地址就可以。'
      : why === 'denied' ? '没有拿到话筒权限。可以在 Safari 里允许使用麦克风。' : why === 'error' ? '语音识别出了点问题。' : '';

  return (
    <div className="voice-count" role="dialog" aria-label={`对小诺从 1 数到 ${target}`}>
      <button className="mini-btn vc-close" aria-label="关闭" onClick={() => { stopRef.current(); stopSpeaking(); onClose(); }}><CloseIcon /></button>
      <h3>🔢 从 1 数到 {target}</h3>
      {/* 1..target 的小圆点：听到一个亮一个 */}
      <ol className="vc-dots" aria-label={`听到了 ${(result ?? live).got.length} 个数`}>
        {Array.from({ length: target }, (_, i) => i + 1).map(n => <li key={n} className={(result ?? live).got.includes(n) ? 'on' : result && !result.ok && result.missing.includes(n) && n <= result.reached ? 'miss' : ''}>{n}</li>)}
      </ol>

      {phase === 'ready' && (
        <button className="vc-mic" onClick={start} aria-label="开始数"><MicIcon /><span>按一下，开始数</span></button>
      )}
      {phase === 'listening' && (
        <>
          <p className="vc-text" aria-live="polite">{text || '小诺在听……'}</p>
          <button className="vc-mic on" onClick={done} aria-label="数完了"><CheckIcon /><span>数完了</span></button>
        </>
      )}
      {phase === 'result' && result && (
        <>
          <p className={`vc-say ${result.ok ? 'ok' : ''}`}>{countFeedback(result, target)}</p>
          {!result.ok && (
            <div className="vc-row">
              <button className="vc-mic small" onClick={start}><RetryIcon /><span>再数一次</span></button>
              <HoldButton label="爸爸妈妈听过了，按住确认" onDone={onParent} />
            </div>
          )}
        </>
      )}
      {phase === 'unavailable' && (
        <>
          <p className="vc-say">{reason} 请爸爸妈妈听你数，数完按住确认。</p>
          <HoldButton label="爸爸妈妈按住确认" onDone={onParent} />
        </>
      )}
    </div>
  );
}
