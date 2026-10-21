import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AREAS, DOMAINS, NODES, THEME_DOMAIN, area as areaOf, completeNode, dayIndex, nextAreaIn, openAreas, kidComplete, node, nodeState, petLevel, petOf, pickFocus, prereqs, XP_PER_LEVEL,
  type NodeState
} from '../../shared/platform';
import { WorldScene } from './WorldScene';
import { logEvent } from './platformStore';
import type { AreaId, Platform } from '../../shared/platform';
import { setMuted, setOnlineVoice, sfx, speak, stopSpeaking } from '../audio';
import { CloseIcon, OwlFace, SpeakerIcon, Stamp } from '../components/Icons';
import { HoldButton } from './HoldButton';
import { VoiceCount } from './VoiceCount';

// 有 3D 工作台的模块（其余的还在布置，先用线下任务完成）
const READY_MODULES = new Set(['car', 'lights', 'flowers']);
// 可以用语音过关的关卡：数到几（听不清时仍由爸爸妈妈确认）
const VOICE_COUNT: Record<string, number> = { m1: 20 };

type Props = {
  p: Platform; update: (fn: (d: Platform) => Platform | void) => void;
  area: AreaId;                                       // 进入的是哪块大陆的哪个区域
  onArea: (a: AreaId, nodeId?: string) => void;        // 换到同一块大陆的另一个区域
  arrived: { id: string; passed: boolean } | null;    // 从工作台回来时站在哪一关
  demo: boolean;
  onBack: () => void;                                 // 回到星球
};

/** 星球上的一块陆地：小人沿小路走到关卡，到了就开启任务 */
export function World({ p, update, area, onArea, arrived, demo, onBack }: Props) {
  const ar = areaOf(area), domain = ar.d, dom = DOMAINS.find(x => x.id === domain)!;
  const open = openAreas(p, demo), mine = AREAS.filter(a => a.d === domain && open.has(a.id)), upcoming = nextAreaIn(domain, p);
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<WorldScene | null>(null);
  const pRef = useRef(p); pRef.current = p;
  const started = true;
  const [bubble, setBubble] = useState<{ text: string; key: number } | null>(null);
  const [card, setCard] = useState<string | null>(null);       // 到达后弹出的任务卡（知识点 id）
  const [walkingTo, setWalkingTo] = useState<string | null>(null);
  const [overview, setOverview] = useState(false);
  const [voice, setVoice] = useState<string | null>(null);     // 正在语音过关的关卡
  const [celebrate, setCelebrate] = useState<string | null>(arrived?.passed ? arrived.id : null);
  const today = dayIndex(new Date());

  const states = useMemo(() => {
    const done = new Set(p.done), out: Record<string, NodeState> = {};
    for (const n of NODES) { const s = nodeState(n.id, done); out[n.id] = demo && s === 'lock' ? 'now' : s; }
    return out;
  }, [p.done, demo]);
  const statesRef = useRef(states); statesRef.current = states;

  const say = (text: string) => { setBubble({ text, key: Date.now() }); speak(text); };

  // —— 3D 世界 ——
  useEffect(() => {
    const s = new WorldScene(host.current!, area, {
      onTap: id => tapRef.current(id),
      onArrive: id => arriveRef.current(id)
    });
    scene.current = s;
    setOnlineVoice(!!pRef.current.consent.voice);
    // 从工作台回来：站在刚才那一关前面；否则站在这块陆地的桥头
    if (arrived && NODES.some(n => n.id === arrived.id)) s.placeAt(arrived.id); else s.placeAt(`gate:${area}`);
    greet();
    return () => s.dispose();
  }, []);
  useEffect(() => { scene.current?.setStates(states); }, [states]);
  useEffect(() => { setMuted(p.muted); }, [p.muted]);

  function greet() {
    if (arrived?.passed) { const n = node(arrived.id); say(`你点亮了「${n.name}」！看看哪里又亮起来了。`); setCard(arrived.id); return; }
    // 从今日任务（或工作台没过关）回来：直接站在那一关前面，弹出任务卡
    if (arrived) { const n = node(arrived.id); setCard(arrived.id); say(`这里是「${n.name}」。${n.goal}。`); return; }
    say(`欢迎来到${dom.name}的「${ar.name}」！点一个发光的关卡，我们走过去。${THEME_DOMAIN[today] === domain ? '今天正好是这里的探险日。' : ''}`);
  }

  // —— 点任务点：小人走过去 ——
  const tap = (id: string) => {
    if (!started) return;
    setCard(null); stopSpeaking(); setOverview(false); scene.current?.overview(false);
    const dist = scene.current!.walkTo(id);
    if (dist > 0) { setWalkingTo(id); setBubble(null); }
  };
  const tapRef = useRef(tap); tapRef.current = tap;
  const arrive = (id: string) => {
    setWalkingTo(null); sfx.place();
    setCard(id);
    const n = NODES.find(x => x.id === id); if (!n) { setCard(null); return; }   // 走回码头：没有任务卡
    const st = statesRef.current[id];
    if (st === 'lock') {
      const need = prereqs(n).map(node).filter(x => statesRef.current[x.id] !== 'done');
      const away = need.find(x => x.a !== area);
      const where = away && (away.d === domain ? `这块岛上的「${areaOf(away.a).name}」` : `「${DOMAINS.find(x => x.id === away.d)!.name}」`);
      say(`「${n.name}」还锁着。先去点亮「${need.map(x => x.name).join('」和「')}」吧。${away ? `「${away.name}」在${where}。` : ''}`);
    } else if (st === 'done') say(`「${n.name}」你已经点亮啦！${n.module && READY_MODULES.has(n.module) ? '想再玩一次也可以。' : ''}`);
    else say(`这里是「${n.name}」。${n.goal}。`);
    update(d => { logEvent(d, 'arrive', n.name, id); });
  };
  const arriveRef = useRef(arrive); arriveRef.current = arrive;

  // —— 完成线下任务（爸爸妈妈按住确认）——
  const confirmOffline = (id: string, how = '家长确认完成') => {
    let notes: string[] = [];
    update(d => { const r = completeNode(d, id, today); notes = r.notes; logEvent(r.p, 'complete', `${how}「${node(id).name}」`, id); return r.p; });
    sfx.success(); setCelebrate(id); setVoice(null);
    setTimeout(() => say(notes.join('')), how === '家长确认完成' ? 50 : 3500);   // 语音过关时先让小诺说完评语
  };
  const openBench = (id: string) => { sfx.tap(); location.href = `/bench.html?node=${id}`; };

  // —— 现在要做的一件事（原网站首页的规则）——
  const day = p.week[today];
  const focus = pickFocus(day, new Date().getHours() * 60 + new Date().getMinutes(), null);
  const doneTask = (i: number) => {
    let notes: string[] = [];
    update(d => { const r = kidComplete(d, today, i); notes = r.notes; logEvent(r.p, 'task', d.week[today][i].n); return r.p; });
    setTimeout(() => say(notes.join('')), 50);
  };

  const pet = petOf(p.xp);
  const cardNode = card ? NODES.find(n => n.id === card) ?? null : null;

  return (
    <div className="app world">
      <div className="stage" ref={host} />

      {started && (
        <header className="hud-top">
          <button className="round-btn" aria-label="回到星球" onClick={() => { stopSpeaking(); onBack(); }}>🪐</button>
          <div className="hud-stat" aria-label={`小红花 ${p.flowers} 朵`}><b className="flower">✿ {p.flowers}</b></div>
          <div className="hud-stat pet" aria-label={`伙伴${pet[1]}，再做 ${XP_PER_LEVEL - (p.xp % XP_PER_LEVEL)} 件事就长大`}>
            <span className="pet-e">{pet[0]}</span><i className="pet-bar"><i style={{ width: `${((p.xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100}%` }} /></i><small>Lv.{petLevel(p.xp)}</small>
          </div>
          {focus.kind === 'now' && !day[focus.index].n.startsWith('WonderLab') && (
            <div className="now-task" aria-label={`现在要做：${day[focus.index].n}`}>
              <span className="now-k">现在要做</span><b>{day[focus.index].n}</b>
              <button className="pill small" onClick={() => doneTask(focus.index)}>{day[focus.index].chk ? '做完了，请爸妈看' : '我做完了'}</button>
            </div>
          )}
          <div className="spacer" />
          <button className="round-btn" aria-label={overview ? '回到小人身边' : '看看整个世界'} onClick={() => { const o = !overview; setOverview(o); scene.current?.overview(o); }}>{overview ? '🧒' : '🗺️'}</button>
        </header>
      )}

      {/* 这块大陆上的区域：打开的可以直接换过去；还没浮出来的只露一朵云，告诉孩子再点亮几关就会出现 */}
      {started && (
        <nav className="area-tabs" aria-label={`${dom.name}上的地方`} style={{ ['--dc' as string]: dom.color }}>
          {mine.map(a => (
            <button key={a.id} className={a.id === area ? 'on' : ''} aria-current={a.id === area} onClick={() => { if (a.id !== area) { stopSpeaking(); onArea(a.id); } }}>
              <span aria-hidden>{a.icon}</span>{a.name}
            </button>
          ))}
          {upcoming && <span className="area-cloud" aria-label={upcoming.need ? `再点亮 ${upcoming.need} 关，会浮出一个新地方` : '新地方马上浮出来'}>☁️ {upcoming.need ? `再点亮 ${upcoming.need} 关，有新地方` : '新地方要来啦'}</span>}
        </nav>
      )}

      {bubble && started && (
        <div className="bubble" key={bubble.key} role="status">
          <OwlFace size={46} />
          <p>{bubble.text}</p>
          <button className="mini-btn" aria-label="再听一遍" onClick={() => speak(bubble.text)}><SpeakerIcon /></button>
          <button className="mini-btn" aria-label="关闭" onClick={() => { setBubble(null); stopSpeaking(); }}><CloseIcon /></button>
        </div>
      )}

      {walkingTo && <div className="walking-hint" aria-live="polite">🚶 正在走过去……</div>}

      {/* 到达任务点后的任务卡 */}
      {started && cardNode && !walkingTo && !voice && (() => {
        const st = states[cardNode.id], dom = DOMAINS.find(d => d.id === cardNode.d)!;
        const ready = !!cardNode.module && READY_MODULES.has(cardNode.module);
        return (
          <div className="task-card" style={{ ['--dc' as string]: dom.color }} role="dialog" aria-label={cardNode.name}>
            <div className="task-icon" aria-hidden>{cardNode.icon}</div>
            <div className="task-body">
              <b>{cardNode.name}</b>
              <span>{cardNode.goal}</span>
              <div className="task-tags">{cardNode.how.map(h => <i key={h}>{h}</i>)}{st === 'done' && <i className="done">已点亮</i>}</div>
            </div>
            <div className="task-act">
              {st === 'lock' && (() => { const need = prereqs(cardNode).map(node).find(x => states[x.id] !== 'done'); if (!need) return null;
                if (need.a === area) return <button className="pill" onClick={() => tap(need.id)}>带我去「{need.name}」</button>;
                if (need.d === domain && open.has(need.a)) return <button className="pill" onClick={() => { stopSpeaking(); onArea(need.a, need.id); }}>{areaOf(need.a).icon} 去「{areaOf(need.a).name}」</button>;
                return <button className="pill" onClick={() => { stopSpeaking(); onBack(); }}>🪐 回星球去「{DOMAINS.find(x => x.id === need.d)!.name}」</button>; })()}
              {st !== 'lock' && ready && <button className="go-btn is-ready" onClick={() => openBench(cardNode.id)} aria-label="去工作台开始"><span className="go-label">开始</span></button>}
              {st === 'now' && !ready && VOICE_COUNT[cardNode.id] && (
                <div className="offline">
                  <button className="pill" onClick={() => { stopSpeaking(); setVoice(cardNode.id); }}>🎤 对小诺数一数</button>
                  <HoldButton label="爸爸妈妈按住确认" onDone={() => confirmOffline(cardNode.id)} />
                </div>
              )}
              {st === 'now' && !ready && !VOICE_COUNT[cardNode.id] && (
                <div className="offline">
                  <small>{cardNode.module ? '3D 工作台还在布置，先和爸爸妈妈一起完成：' : '和爸爸妈妈一起完成：'}{cardNode.goal}</small>
                  <HoldButton label="爸爸妈妈按住确认" onDone={() => confirmOffline(cardNode.id)} />
                </div>
              )}
            </div>
            <button className="mini-btn task-close" aria-label="关闭" onClick={() => setCard(null)}><CloseIcon /></button>
          </div>
        );
      })()}

      {voice && (
        <VoiceCount target={VOICE_COUNT[voice]} allowed={p.consent.speech}
          onPass={r => { const id = voice; setTimeout(() => confirmOffline(id, r.missing.length ? '语音数数过关（有几个没听清）' : '语音数数过关'), 2200); }}
          onParent={() => confirmOffline(voice)} onClose={() => setVoice(null)} />
      )}

      {celebrate && started && card === celebrate && states[celebrate] === 'done' && (
        <div className="celebrate" aria-hidden><Stamp /></div>
      )}

    </div>
  );
}
