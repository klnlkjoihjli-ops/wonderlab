import { useEffect, useRef, useState } from 'react';
import type { Decoration, Episode, Progress, Recipient } from '../../shared/game';
import { unlocked } from '../../shared/game';
import { listen, speechSupported, type ListenState } from '../recognizer';
import { DeckArt, LevelIcon } from './Lab';
import { PartArt } from './Workshop';
import {
  ArrowIcon, BagArt, CheckIcon, CloseIcon, FlagsArt, FlowersArt, HatArt, HedgehogFace, KeyboardIcon, LanternsArt, LockIcon,
  MicIcon, PaperStep, ParentIcon, PartyArt, RabbitFace, RetryIcon, SpeakerIcon, SquirrelFace, Stamp
} from './Icons';

export const FACES: Record<Recipient, () => React.JSX.Element> = { rabbit: RabbitFace, squirrel: SquirrelFace, hedgehog: HedgehogFace };

/** 按住 2 秒才打开（家长入口，避免孩子误入） */
export function HoldButton({ onDone, label }: { onDone: () => void; label: string }) {
  const [p, setP] = useState(0);
  const timer = useRef<number>(0);
  const stop = () => { cancelAnimationFrame(timer.current); setP(0); };
  const start = () => {
    const t0 = performance.now();
    const tick = () => { const k = Math.min(1, (performance.now() - t0) / 2000); setP(k); if (k >= 1) { setP(0); onDone(); } else timer.current = requestAnimationFrame(tick); };
    timer.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => cancelAnimationFrame(timer.current), []);
  return (
    <button className="hold-btn" aria-label={`${label}（按住两秒）`} onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onContextMenu={e => e.preventDefault()}>
      <svg viewBox="0 0 48 48" className="hold-ring" aria-hidden><circle cx="24" cy="24" r="21" pathLength={1} strokeDasharray={`${p} 1`} /></svg>
      <ParentIcon />
      <span>{label}</span>
    </button>
  );
}

/** 邮局信件板：三封信 + 纸桥活动 */
export function LetterBoard({ progress, onPick, onActivity, onLab, onWorkshop, onParent }: { progress: Progress; onPick: (e: Episode) => void; onActivity: () => void; onLab: () => void; onWorkshop: () => void; onParent: () => void }) {
  const letters: { ep: Episode; Face: () => React.JSX.Element; gift?: boolean; own?: boolean }[] = [
    { ep: 1, Face: RabbitFace }, { ep: 2, Face: RabbitFace, gift: true }, { ep: 3, Face: progress.party.recipient ? FACES[progress.party.recipient] : SquirrelFace, own: true }
  ];
  const next = ([1, 2, 3] as Episode[]).find(e => unlocked(progress, e) && !progress.chapters[e].completed);
  const activityOpen = progress.chapters[1].completed;
  return (
    <div className="board-wrap">
      <div className="board" role="list" aria-label="邮局信件板">
        {letters.map(({ ep, Face, gift, own }) => {
          const open = unlocked(progress, ep), done = progress.chapters[ep].completed;
          return (
            <button key={ep} role="listitem" className={`letter ${open ? '' : 'is-locked'} ${ep === next ? 'is-next' : ''}`} disabled={!open} onClick={() => onPick(ep)}
              aria-label={`第${ep}封信${done ? '，已经送到' : open ? '' : '，还没打开'}`}>
              <span className="letter-num" aria-hidden>{ep}</span>
              <span className="letter-face"><Face /></span>
              {gift && <span className="letter-gift" aria-hidden />}
              {own && <span className="letter-star" aria-hidden>★</span>}
              {done && <span className="letter-stamp"><Stamp /></span>}
              {!open && <span className="letter-lock"><LockIcon /></span>}
            </button>
          );
        })}
        <button className={`letter activity ${activityOpen ? '' : 'is-locked'}`} disabled={!activityOpen} onClick={onActivity} aria-label="和妈妈做纸桥">
          <span className="letter-face wide"><PaperStep step={2} /></span>
          {progress.activity.done && <span className="letter-stamp"><Stamp /></span>}
          {!activityOpen && <span className="letter-lock"><LockIcon /></span>}
        </button>
        <button className={`letter lab-card ${activityOpen ? '' : 'is-locked'}`} disabled={!activityOpen} onClick={onLab} aria-label="小桥实验室">
          <span className="letter-face wide"><DeckArt deck="folded" /></span>
          <span className="lab-dots" aria-hidden><LevelIcon level="green" /><LevelIcon level="yellow" /><LevelIcon level="red" /></span>
          {!activityOpen && <span className="letter-lock"><LockIcon /></span>}
        </button>
        <button className={`letter ws-card ${activityOpen ? '' : 'is-locked'}`} disabled={!activityOpen} onClick={onWorkshop} aria-label="搭桥工坊">
          <span className="letter-face wide ws-art"><PartArt kind="post" /><PartArt kind="medium" /><PartArt kind="stone" /></span>
          {!activityOpen && <span className="letter-lock"><LockIcon /></span>}
        </button>
      </div>
      <div className="board-corner"><HoldButton label="家长" onDone={onParent} /></div>
    </div>
  );
}

export function OutfitPicker({ value, onPick }: { value: 'hat' | 'bag' | null; onPick: (o: 'hat' | 'bag') => void }) {
  return (
    <div className="picker" role="group" aria-label="选一件邮差装备">
      {(['hat', 'bag'] as const).map(o => (
        <button key={o} className={`pick-card ${value === o ? 'is-on' : ''}`} onClick={() => onPick(o)} aria-label={o === 'hat' ? '邮差帽' : '邮包'}>
          {o === 'hat' ? <HatArt /> : <BagArt />}
        </button>
      ))}
    </div>
  );
}

export function RecipientPicker({ value, onPick, onDone }: { value: Recipient | null; onPick: (r: Recipient) => void; onDone: () => void }) {
  return (
    <div className="picker" role="group" aria-label="选一位收信的朋友">
      {(['rabbit', 'squirrel', 'hedgehog'] as Recipient[]).map(r => { const F = FACES[r]; return (
        <button key={r} className={`pick-card face ${value === r ? 'is-on' : ''}`} onClick={() => onPick(r)} aria-label={{ rabbit: '小兔', squirrel: '小松鼠', hedgehog: '小刺猬' }[r]}><F /></button>
      ); })}
      <button className="go-round" disabled={!value} onClick={onDone} aria-label="就送给它"><CheckIcon /></button>
    </div>
  );
}

const DECOR: { id: Decoration; Art: () => React.JSX.Element; label: string }[] = [
  { id: 'flowers', Art: FlowersArt, label: '花环' }, { id: 'flags', Art: FlagsArt, label: '彩旗' }, { id: 'lanterns', Art: LanternsArt, label: '小灯笼' }
];

/** 第三次：装饰自己的桥，再说一说自己的办法 */
export function ShareStep({ decorations, explanation, speech, onToggle, onExplain, onParty }: {
  decorations: Decoration[]; explanation: string; speech: boolean;
  onToggle: (d: Decoration) => void; onExplain: () => void; onParty: () => void;
}) {
  return (
    <div className="share">
      <div className="picker small" role="group" aria-label="装饰小桥">
        {DECOR.map(({ id, Art, label }) => (
          <button key={id} className={`pick-card ${decorations.includes(id) ? 'is-on' : ''}`} aria-pressed={decorations.includes(id)} onClick={() => onToggle(id)} aria-label={label}><Art /></button>
        ))}
      </div>
      <div className="share-row">
        <button className={`pill ${explanation ? 'ghost' : ''}`} onClick={onExplain}>{speech ? <MicIcon /> : <KeyboardIcon />}{explanation ? '再说一次' : '说说我的办法'}</button>
        <button className="party-btn" onClick={onParty} aria-label="开派对"><PartyArt /></button>
      </div>
    </div>
  );
}

const PAPER_LINES = [
  '和妈妈找两本一样高的书，中间留一点空，把一张纸平平地搭上去。',
  '在纸中间放一块积木。先猜一猜：纸会怎么样？再试试看！',
  '把同样的纸折成小扇子，再放上同一块积木。和刚才一样吗？'
];
export function PaperBridge({ onSay, onRecord, onClose }: { onSay: (t: string) => void; onRecord: () => void; onClose: () => void }) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  useEffect(() => { onSay(PAPER_LINES[step]); }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="paper" role="dialog" aria-label="和妈妈做纸桥">
      <div className="paper-card">
        <div className="paper-steps" aria-hidden>{[0, 1, 2].map(i => <i key={i} className={i === step ? 'on' : ''} />)}</div>
        <PaperStep step={step} />
        <p>{PAPER_LINES[step]}</p>
        <div className="paper-nav">
          <button className="round-btn big" onClick={() => onSay(PAPER_LINES[step])} aria-label="再听一遍"><SpeakerIcon /></button>
          <button className="round-btn big" disabled={step === 0} onClick={() => setStep(s => (s - 1) as 0 | 1 | 2)} aria-label="上一步"><ArrowIcon dir={-1} /></button>
          {step < 2
            ? <button className="round-btn big primary" onClick={() => setStep(s => (s + 1) as 0 | 1 | 2)} aria-label="下一步"><ArrowIcon /></button>
            : <HoldButton label="妈妈记一记" onDone={onRecord} />}
        </div>
        <p className="paper-note">纸桥是真实世界的小实验，屏幕里的小桥只是简化的游戏，结果可能不一样。</p>
      </div>
      <button className="round-btn close" onClick={onClose} aria-label="关闭"><CloseIcon /></button>
    </div>
  );
}

/** 说话面板：开始/结束录音、识别文字可修改或重说；不能用语音时用文字（请妈妈帮忙） */
export function SpeakPanel({ speechOn, title, onSubmit, onClose }: { speechOn: boolean; title: string; onSubmit: (text: string) => void; onClose: () => void }) {
  const supported = speechOn && speechSupported();
  const [state, setState] = useState<ListenState>('idle');
  const [text, setText] = useState('');
  const stopRef = useRef<() => void>(() => {});
  const start = () => { setText(''); stopRef.current = listen(setText, setState); };
  const stop = () => stopRef.current();
  useEffect(() => () => stopRef.current(), []);
  const typing = !supported || state === 'denied' || state === 'error';
  return (
    <div className="speak" role="dialog" aria-label={title}>
      {supported && state !== 'denied' && (
        <button className={`mic-big ${state === 'listening' ? 'is-on' : ''}`} onClick={state === 'listening' ? stop : start} aria-label={state === 'listening' ? '说完了' : '按一下开始说话'}>
          {state === 'listening' ? <span className="stop-square" aria-hidden /> : <MicIcon />}
        </button>
      )}
      <div className="speak-body">
        <p className="speak-status">
          {state === 'listening' ? '我在听……说完按红色按钮' : state === 'denied' ? '麦克风没有打开，请妈妈帮忙打字' : state === 'error' ? '没听清，可以再说一次，或请妈妈打字' : supported ? (text ? '是这样说的吗？' : '按一下话筒，开始说') : '请妈妈帮忙把孩子的话打出来'}
        </p>
        <input className="speak-text" value={text} onChange={e => setText(e.target.value.slice(0, 300))} placeholder={typing ? '在这里输入' : ''} aria-label="识别到的话，可以修改" />
      </div>
      <div className="speak-actions">
        {supported && text && state !== 'listening' && <button className="mini-btn" onClick={start} aria-label="重说一次"><RetryIcon /></button>}
        <button className="mini-btn ok" disabled={!text.trim() || state === 'listening'} onClick={() => onSubmit(text.trim())} aria-label="就是这样"><CheckIcon /></button>
        <button className="mini-btn" onClick={() => { stop(); onClose(); }} aria-label="关闭"><CloseIcon /></button>
      </div>
    </div>
  );
}
