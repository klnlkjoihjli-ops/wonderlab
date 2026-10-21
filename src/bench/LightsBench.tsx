import { useEffect, useRef, useState } from 'react';
import {
  GUESSES, LIGHT, LIGHT_IDS, LIGHT_STEPS, MIXES, MUST_SEE, START_SPOTS, TORCH_PARTS, currentLightStep, freshLightsProgress, hasWhite, lightsHint, lightsPassed, visibleMixes,
  type Guess, type LightId, type LightStep, type LightsProgress, type Spots, type TorchPartId
} from '../../shared/modules/lights';
import { NODES, nodeState } from '../../shared/platform';
import { LightsScene } from './LightsScene';
import { lightUpNode, onlineVoiceAllowed, worldHref } from './common';
import { loadPlatform } from '../world/platformStore';
import { setOnlineVoice, sfx, speak, stopSpeaking, unlockAudio } from '../audio';
import { CloseIcon, OwlFace, SpeakerIcon, Stamp } from '../components/Icons';

const KEY = 'wonderlab.bench.lights.v1';
function load(): LightsProgress {
  try { const p = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (p && Array.isArray(p.seen)) return { ...freshLightsProgress(), ...p }; } catch { /* 读不出来就重新开始 */ }
  return freshLightsProgress();
}
function save(p: LightsProgress) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* 隐私模式下无法保存 */ } }

const STEP_ICON: Record<LightStep, string> = { look: '🔦', light: '💡', mix: '🎨', white: '⚪' };
const TORCH_CSS: Record<LightId, string> = { R: '#ff3b30', G: '#2ee65a', B: '#3a6bff' };

/** 探索工作台 · 光的三原色 */
export function LightsBench({ nodeId }: { nodeId: string }) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<LightsScene | null>(null);
  const [p, setP] = useState<LightsProgress>(load);
  const pRef = useRef(p); pRef.current = p;
  const [started, setStarted] = useState(false);
  const [bubble, setBubble] = useState<{ text: string; key: number } | null>(null);
  const [card, setCard] = useState<TorchPartId | null>(null);
  const [on, setOn] = useState<Set<LightId>>(new Set());
  const onRef = useRef(on); onRef.current = on;
  const [exploded, setExploded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const step = currentLightStep(p);
  const passed = lightsPassed(p);

  const say = (text: string) => { setBubble({ text, key: Date.now() }); speak(text); };
  const update = (fn: (d: LightsProgress) => void) => {
    const n = structuredClone(pRef.current); fn(n); save(n); pRef.current = n; setP(n); return n;
  };

  useEffect(() => {
    const s = new LightsScene(host.current!, {
      onTorchTap: id => torchRef.current(id),
      onPartTap: id => partRef.current(id),
      onSpotsMove: sp => checkRef.current(sp),
      onSpotsDrop: sp => checkRef.current(sp)
    });
    scene.current = s;
    setOnlineVoice(onlineVoiceAllowed());
    return () => s.dispose();
  }, []);

  const start = () => {
    unlockAudio(); setStarted(true);
    const s = currentLightStep(pRef.current);
    say(s === 'look' ? '嘘，我们把房间的灯关了。桌上有三支手电筒。红色那支为什么会发出红光呢？按下面的按钮，把它拆开看看！'
      : s === 'light' ? '点一点桌上的手电筒，把它们都打开。'
        : s === 'mix' ? '三盏灯都会开啦。这回用手指拖墙上的光斑，让它们叠在一起。'
          : '还差最后一步：让三个光斑全叠在一起！');
  };

  // —— 拆开手电筒 ——
  const explode = async () => {
    setBusy(true); sfx.tap();
    await scene.current!.explode();
    setExploded(true); setBusy(false);
    say('咔哒！手电筒拆开啦。点一点桌上的零件，听听它们是做什么的。');
  };
  const tapPart = (id: TorchPartId) => {
    if (!started || busy) return;
    const part = TORCH_PARTS.find(x => x.id === id)!;
    setCard(id); scene.current?.showPart(id); say(part.says);
    const n = update(d => { if (!d.seen.includes(id)) d.seen.push(id); });
    // 关键的零件都看过了：装回去，进入开灯
    if (currentLightStep(n) !== 'look' && scene.current?.isExploded) {
      setBusy(true);
      setTimeout(async () => {
        await scene.current!.assemble();
        setExploded(false); setBusy(false); setCard(null);
        say('原来颜色是那片彩色玻璃变出来的！手电筒装好啦。现在点一点三支手电筒，把它们都打开。');
      }, 3200);
    }
  };
  const partRef = useRef(tapPart); partRef.current = tapPart;

  // —— 开灯、关灯 ——
  const tapTorch = (id: LightId) => {
    if (!started || busy) return;
    if (currentLightStep(pRef.current) === 'look') {
      say(id === 'R' ? '先按下面的按钮，把红色手电筒拆开看看。' : '先看看红色手电筒里面有什么，再来开灯。');
      return;
    }
    const next = new Set(onRef.current), turnOn = !next.has(id);
    if (turnOn) next.add(id); else next.delete(id);
    setOn(next); onRef.current = next; scene.current?.setOn(id, turnOn); sfx.tap();
    setHintLevel(0);
    if (!turnOn) return;
    const before = currentLightStep(pRef.current);
    const n = update(d => { if (!d.lit.includes(id)) d.lit.push(id); });
    if (before === 'light' && currentLightStep(n) !== 'light') say(`${LIGHT[id].name}照到墙上啦！三盏灯都会开了。考考你：红光和绿光叠在一起，会变成什么颜色？`);
    else if (before === 'light') say(`${LIGHT[id].name}照到墙上啦！`);
    check(scene.current!.getSpots());
  };
  const torchRef = useRef(tapTorch); torchRef.current = tapTorch;

  // —— 光斑叠在一起：看看出现了什么新颜色 ——
  const check = (sp: Spots) => {
    const cur = pRef.current, s = currentLightStep(cur);
    if (s !== 'mix' && s !== 'white') return;
    if (s === 'mix' && !cur.guess) return;                      // 先猜再试
    const lit = onRef.current;
    const fresh = visibleMixes(lit, sp).filter(m => !cur.found.includes(m));
    if (fresh.length) {
      const n = update(d => { d.found.push(...fresh); });
      const m = MIXES.find(x => x.id === fresh[0])!;
      const a = sp[m.a], b = sp[m.b];
      scene.current?.sparkle((a.x + b.x) / 2, (a.y + b.y) / 2, m.css); sfx.success();
      let text = `${LIGHT[m.a].name}加${LIGHT[m.b].name}，变成了${m.name}！`;
      if (m.id === 'GR' && cur.guess && cur.guess !== 'yellow') text += `你猜的是${GUESSES.find(g => g.id === cur.guess)!.name}——颜料混在一起会变暗，可光叠在一起是越加越亮的，所以变成了黄色。`;
      if (m.id === 'GR' && cur.guess === 'yellow') text += '你猜对啦！';
      const left = MIXES.filter(x => !n.found.includes(x.id));
      text += left.length ? ` 还能叠出 ${left.length} 种新颜色，再试试别的两盏。` : ' 三种新颜色都找到了！最后一个挑战：把三个光斑全叠在一起，会变成什么？';
      say(text); setHintLevel(0);
    }
    if (currentLightStep(pRef.current) === 'white' && !pRef.current.white && hasWhite(lit, sp)) {
      update(d => { d.white = true; });
      const c = { x: (sp.R.x + sp.G.x + sp.B.x) / 3, y: (sp.R.y + sp.G.y + sp.B.y) / 3 };
      scene.current?.sparkle(c.x, c.y, '#ffffff'); scene.current?.cheer(); sfx.success();
      lightUpNode(nodeId);
      say('哇，中间变成白色啦！红光、绿光、蓝光三种光叠在一起，就是白光。这就是光的三原色！');
    }
  };
  const checkRef = useRef(check); checkRef.current = check;

  const chooseGuess = (g: Guess) => {
    update(d => { d.guess = g; }); sfx.pick();
    say(`你猜是${GUESSES.find(x => x.id === g)!.name}。我们来试试！用手指按住红色的光斑，把它拖到绿色光斑上面。`);
  };

  const hint = () => {
    const text = lightsHint(pRef.current, onRef.current, Math.min(hintLevel, 2));
    setHintLevel(l => l + 1); say(text);
  };
  const again = () => {
    const fresh = freshLightsProgress(); save(fresh); pRef.current = fresh; setP(fresh);
    for (const id of LIGHT_IDS) scene.current?.setOn(id, false);
    setOn(new Set()); onRef.current = new Set();
    scene.current?.setSpots(START_SPOTS); setCard(null);
    say('我们再玩一次！先把红色手电筒拆开。');
  };

  const me = NODES.find(n => n.id === nodeId)!;
  const next = NODES.find(n => n.a === me.a && n.lv === me.lv + 1);
  const nextOpen = next && nodeState(next.id, new Set(loadPlatform().done)) !== 'lock';

  return (
    <div className="app bench lights">
      <div className="stage" ref={host} />

      {started && (
        <header className="hud-top">
          <a className="round-btn" href={worldHref(nodeId)} aria-label="回到世界"><svg viewBox="0 0 48 48" aria-hidden><path d="M8 24L24 10l16 14M13 21v17h22V21" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg></a>
          <ol className="steps" aria-label="这一关的四步">
            {LIGHT_STEPS.map((s, i) => {
              const idx = LIGHT_STEPS.findIndex(x => x.id === step);
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

      {card && started && exploded && (() => {
        const part = TORCH_PARTS.find(x => x.id === card)!;
        return (
          <div className="part-card" aria-live="polite">
            <b>{part.name}</b><span>{part.en}</span>
            <button className="mini-btn" aria-label="再听一遍" onClick={() => speak(part.says)}><SpeakerIcon /></button>
          </div>
        );
      })()}

      {/* 先猜一猜：红光 + 绿光 = ? */}
      {started && step === 'mix' && !p.guess && (
        <div className="guess-card" role="dialog" aria-label="猜一猜">
          <p><i style={{ background: TORCH_CSS.R }} />红光 + <i style={{ background: TORCH_CSS.G }} />绿光 = ?</p>
          <div className="guess-row">
            {GUESSES.map(g => <button key={g.id} onClick={() => chooseGuess(g.id)}><i style={{ background: g.css }} />{g.name}</button>)}
          </div>
        </div>
      )}

      {started && !passed && (
        <footer className="bench-actions">
          {step === 'look' && !exploded && <button className="big-action" onClick={explode} disabled={busy}><span aria-hidden style={{ fontSize: 40 }}>🔦</span><span>拆开手电筒</span></button>}
          {step === 'look' && exploded && <div className="look-dots" aria-label={`看过 ${MUST_SEE.filter(id => p.seen.includes(id)).length} 个要紧的零件，一共 ${MUST_SEE.length} 个`}>{MUST_SEE.map(id => <i key={id} className={p.seen.includes(id) ? 'on' : ''} />)}</div>}
          {step !== 'look' && (
            <div className="torch-row" role="group" aria-label="三盏灯">
              {LIGHT_IDS.map(id => (
                <button key={id} className={`torch-btn ${on.has(id) ? 'on' : ''}`} style={{ ['--tc' as string]: TORCH_CSS[id] }} aria-pressed={on.has(id)} aria-label={`${LIGHT[id].name}${on.has(id) ? '，开着' : '，关着'}`} onClick={() => tapTorch(id)}>
                  <i />{LIGHT[id].name}
                </button>
              ))}
            </div>
          )}
          {(step === 'mix' || step === 'white') && (
            <div className="mix-found" aria-label="找到的新颜色">
              {MIXES.map(m => <span key={m.id} className={p.found.includes(m.id) ? 'on' : ''} style={{ ['--mc' as string]: m.css }} aria-label={`${m.name}${p.found.includes(m.id) ? '，找到了' : '，还没找到'}`}>{p.found.includes(m.id) ? m.name : '?'}</span>)}
              <span className={`white ${p.white ? 'on' : ''}`} aria-label="白光">{p.white ? '白色' : '?'}</span>
            </div>
          )}
        </footer>
      )}

      {passed && started && (
        <div className="bench-pass" role="dialog" aria-label="过关">
          <Stamp />
          {next && <div className="next-level"><span className="lock-open" aria-hidden>{next.icon}</span><b>下一关：{next.name}</b><small>{nextOpen ? '已经解锁' : '还要先完成别的关卡'}</small></div>}
          <a className="pill" href={worldHref(nodeId, true)}>回到世界</a>
          <button className="pill ghost" onClick={again}>再玩一次</button>
        </div>
      )}

      {!started && (
        <div className="title-screen">
          <h1>探索工作台</h1>
          <p className="title-sub">今天研究：光的三原色</p>
          <button className="start-btn" onClick={start} aria-label="开始"><svg viewBox="0 0 60 60" aria-hidden><path d="M22 16l24 14-24 14z" fill="currentColor" /></svg></button>
          <p className="title-note">拆开手电筒 → 打开三盏灯 → 叠出新颜色 → 变出白光</p>
        </div>
      )}
    </div>
  );
}
