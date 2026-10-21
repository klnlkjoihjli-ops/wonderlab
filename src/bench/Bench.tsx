import { useEffect, useRef, useState } from 'react';
import {
  ALL_PARTS, LOOK_TARGET, PART, RAMP_LEVELS, STEPS, assemblyHint, canInstall, compareRamp, currentStep, freshCarProgress, isComplete, isPassed, runRamp,
  type CarPartId, type CarProgress, type RampLevel, type Step
} from '../../shared/modules/car';
import { BenchScene } from './BenchScene';
import { setOnlineVoice, sfx, speak, stopSpeaking, unlockAudio } from '../audio';
import { CartGo, CloseIcon, OwlFace, SpeakerIcon, Stamp } from '../components/Icons';
import { ExplodeIcon } from '../components/Workshop';
import { lightUpNode as lightUp, onlineVoiceAllowed, worldHref } from './common';

const KEY = 'wonderlab.bench.car.v1';
function load(): CarProgress {
  try { const p = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (p && Array.isArray(p.installed)) return { ...freshCarProgress(), ...p }; } catch { /* 读不出来就重新开始 */ }
  return freshCarProgress();
}
function save(p: CarProgress) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* 隐私模式下无法保存 */ } }
/** 从世界进来时带着关卡号（知识点 id）；直接打开工作台时默认是“小车拆装” */
const NODE_ID = new URLSearchParams(location.search).get('node') ?? 'v3';
const lightUpNode = () => lightUp(NODE_ID);

const STEP_ICON: Record<Step, string> = { look: '🔍', assemble: '🔧', drive: '🚗', ramp: '⛰️' };

export function Bench() {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<BenchScene | null>(null);
  const [p, setP] = useState<CarProgress>(load);
  const pRef = useRef(p); pRef.current = p;
  const [started, setStarted] = useState(false);
  const [bubble, setBubble] = useState<{ text: string; key: number } | null>(null);
  const [card, setCard] = useState<CarPartId | null>(null);
  const [rampLevel, setRampLevel] = useState<RampLevel>(1);
  const [busy, setBusy] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const lastBlocked = useRef<CarPartId | null>(null);
  const step = currentStep(p);
  const passed = isPassed(p);

  const say = (text: string) => { setBubble({ text, key: Date.now() }); speak(text); };
  const update = (fn: (d: CarProgress) => void) => setP(prev => { const n = structuredClone(prev); fn(n); save(n); return n; });

  useEffect(() => {
    const s = new BenchScene(host.current!, { onPartTap: id => tapRef.current(id) });
    scene.current = s;
    void s.ready.then(() => s.setInstalled(new Set(pRef.current.installed)));
    setOnlineVoice(onlineVoiceAllowed());
    return () => s.dispose();
  }, []);
  useEffect(() => { if (step === 'ramp' && started) scene.current?.showRamp(true); }, [step, started]);

  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };

  const start = () => {
    unlockAudio(); setStarted(true);
    const s = currentStep(pRef.current);
    say(s === 'look' ? '这是我们的工作台！今天要研究一辆小车。按下面的按钮，把它一下全拆开看看。'
      : s === 'assemble' ? '零件还散在垫子上，我们接着把小车装回去吧。'
        : s === 'drive' ? '小车装好啦，按“开动”试试它能不能跑。' : '斜坡已经搭好了，试试小车能不能冲到小旗子。');
  };

  // —— 点零件 ——
  const tap = (id: CarPartId) => {
    if (busy || !started) return;
    const cur = pRef.current, installed = new Set(cur.installed), s = currentStep(cur);
    setHintLevel(0); scene.current?.clearGlow();
    // 认识零件：拆开后点零件，零件飞到眼前转一圈
    if (s === 'look' || (installed.has(id) && s !== 'assemble')) {
      if (!cur.exploded && s === 'look') { say('先按下面的按钮，把小车一下全拆开。'); return; }
      setCard(id); say(PART[id].says);
      update(d => { if (!d.seen.includes(id)) d.seen.push(id); });
      void run(() => scene.current!.inspect(id));
      return;
    }
    // 装回去
    if (installed.has(id)) { say(`${PART[id].name}已经装好啦。`); return; }
    const check = canInstall(installed, id);
    if (!check.ok) {
      lastBlocked.current = id;
      say(check.why);
      void scene.current?.reject(id, check.missing);
      return;
    }
    setCard(id);
    void run(async () => {
      await scene.current!.install(id);
      update(d => { if (!d.installed.includes(id)) d.installed.push(id); if (!d.seen.includes(id)) d.seen.push(id); });
      const done = isComplete(new Set([...installed, id]));
      say(done ? '全部装好啦！按“开动”，看看小车能不能跑。' : `装上了${PART[id].name}！`);
    });
  };
  const tapRef = useRef(tap); tapRef.current = tap;

  const explode = () => run(async () => {
    sfx.tap(); setCard(null);
    await scene.current!.explode();
    update(d => { d.exploded = true; d.installed = []; });
    say('砰！小车拆成了 10 个零件。点一点它们，听听它们叫什么、是做什么的。');
  });
  const drive = () => run(async () => {
    stopSpeaking(); setBubble(null); setCard(null);
    await scene.current!.drive();
    update(d => { d.drove = true; });
    say('小车跑起来啦！马达转，车轮就滚。下面我们做个实验：把小车放到斜坡上。');
  });
  const chooseRamp = (l: RampLevel) => { setRampLevel(l); scene.current?.setRampLevel(l); sfx.place(); };
  const roll = () => run(async () => {
    stopSpeaking(); setBubble(null); setCard(null);
    const result = runRamp(rampLevel);
    const prev = pRef.current.ramps[pRef.current.ramps.length - 1] ?? null;
    await scene.current!.rollRamp(result);
    update(d => { d.ramps.push(result); if (d.ramps.length > 20) d.ramps.shift(); if (result.reached) d.passed = true; });
    if (result.reached) lightUpNode();
    say([result.observe, compareRamp(prev, result)].filter(Boolean).join(''));
    await scene.current!.homeCar();
  });
  const again = () => {
    const fresh = freshCarProgress(); save(fresh); setP(fresh);
    scene.current?.showRamp(false); scene.current?.setInstalled(new Set(ALL_PARTS));
    setCard(null); setRampLevel(1); scene.current?.setRampLevel(1);
    say('我们再玩一次！先把小车一下全拆开。');
  };

  const hint = () => {
    const installed = new Set(p.installed);
    let text: string;
    if (step === 'look') text = !p.exploded ? '按下面那个按钮，小车就会一下全拆开。' : `点一点垫子上的零件。再认识 ${Math.max(0, LOOK_TARGET - new Set(p.seen.map(id => PART[id].name)).size)} 种就可以装回去啦。`;
    else if (step === 'assemble') { text = assemblyHint(installed, hintLevel, lastBlocked.current); setHintLevel(l => l + 1); }
    else if (step === 'drive') text = '按绿色的“开动”按钮。';
    else {
      const last = p.ramps[p.ramps.length - 1];
      text = !last ? '先选几块积木把坡垫高，再按“放车出发”。' : last.reached ? '冲到啦！你也可以试试矮一点的坡，比比看。'
        : hintLevel === 0 ? '想一想：坡高一点，小车会冲得更远还是更近？' : hintLevel === 1 ? '坡越高，小车滑下来越快，冲得越远。' : '试试用三块积木把坡垫到最高。';
      if (!last?.reached) setHintLevel(l => l + 1);
    }
    say(text);
  };

  const seenKinds = new Set(p.seen.map(id => PART[id].name)).size;

  return (
    <div className="app bench">
      <div className="stage" ref={host} />

      {started && (
        <header className="hud-top">
          <a className="round-btn" href={worldHref(NODE_ID)} aria-label="回到世界"><svg viewBox="0 0 48 48" aria-hidden><path d="M8 24L24 10l16 14M13 21v17h22V21" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg></a>
          <ol className="steps" aria-label="这一关的四步">
            {STEPS.map(s => {
              const idx = STEPS.findIndex(x => x.id === step), i = STEPS.findIndex(x => x.id === s.id);
              const state = passed || i < idx ? 'done' : i === idx ? 'now' : 'todo';
              return <li key={s.id} className={state} aria-label={`${s.title}${state === 'done' ? '，完成' : state === 'now' ? '，正在做' : ''}`}><span aria-hidden>{state === 'done' ? '✓' : STEP_ICON[s.id]}</span></li>;
            })}
          </ol>
          <div className="spacer" />
          <button className="owl-btn" aria-label="请小诺帮忙" onClick={hint} disabled={busy}><OwlFace size={70} /></button>
        </header>
      )}

      {bubble && started && (
        <div className="bubble" key={bubble.key} role="status">
          <OwlFace size={46} />
          <p>{bubble.text}</p>
          <button className="mini-btn" aria-label="再听一遍" onClick={() => speak(bubble.text)}><SpeakerIcon /></button>
          <button className="mini-btn" aria-label="关闭" onClick={() => { setBubble(null); stopSpeaking(); }}><CloseIcon /></button>
        </div>
      )}

      {card && started && (step === 'look' || step === 'assemble') && (
        <div className="part-card" aria-live="polite">
          <b>{PART[card].name}</b><span>{PART[card].en}</span>
          <button className="mini-btn" aria-label="再听一遍" onClick={() => speak(PART[card].says)}><SpeakerIcon /></button>
        </div>
      )}

      {started && !passed && (
        <footer className="bench-actions">
          {step === 'look' && !p.exploded && <button className="big-action" onClick={explode} disabled={busy}><ExplodeIcon on={false} /><span>一下全拆开</span></button>}
          {step === 'look' && p.exploded && <div className="look-dots" aria-label={`认识了 ${seenKinds} 种零件`}>{Array.from({ length: LOOK_TARGET }, (_, i) => <i key={i} className={i < seenKinds ? 'on' : ''} />)}</div>}
          {step === 'assemble' && <div className="assemble-count" aria-label={`装好了 ${p.installed.length} 个零件，一共 10 个`}>{ALL_PARTS.map(id => <i key={id} className={p.installed.includes(id) ? 'on' : ''} />)}</div>}
          {step === 'drive' && <button className="go-btn is-ready" onClick={drive} disabled={busy} aria-label="开动"><CartGo /></button>}
          {step === 'ramp' && (
            <div className="ramp-controls">
              <div className="ramp-levels" role="radiogroup" aria-label="坡的高度">
                {RAMP_LEVELS.map(l => (
                  <button key={l} role="radio" aria-checked={rampLevel === l} aria-label={`${l} 块积木高`} className={`ramp-level ${rampLevel === l ? 'is-on' : ''}`} onClick={() => chooseRamp(l)} disabled={busy}>
                    {Array.from({ length: l }, (_, i) => <i key={i} style={{ background: ['#ee5a4f', '#ffcf4a', '#3d5fc4'][i] }} />)}
                  </button>
                ))}
              </div>
              <button className="go-btn is-ready" onClick={roll} disabled={busy} aria-label="放车出发"><CartGo /></button>
            </div>
          )}
        </footer>
      )}

      {passed && started && (
        <div className="bench-pass" role="dialog" aria-label="过关">
          <Stamp />
          <div className="next-level"><span className="lock-open" aria-hidden>⚙️</span><b>下一关：齿轮咬合</b><small>已经解锁</small></div>
          <a className="pill" href={worldHref(NODE_ID, true)}>回到世界</a>
          <button className="pill ghost" onClick={again}>再玩一次</button>
        </div>
      )}

      {!started && (
        <div className="title-screen">
          <h1>探索工作台</h1>
          <p className="title-sub">今天研究：会跑的小车</p>
          <button className="start-btn" onClick={start} aria-label="开始"><svg viewBox="0 0 60 60" aria-hidden><path d="M22 16l24 14-24 14z" fill="currentColor" /></svg></button>
          <p className="title-note">小样：拆开看看 → 装回去 → 开动 → 斜坡实验</p>
        </div>
      )}
    </div>
  );
}
