import { useEffect, useRef, useState } from 'react';
import { AREAS, DOMAINS, NODES, THEMES, area as areaOf, dayIndex, newAreas, openAreas, todayPlan, type AreaId, type DomainId, type TodayItem } from '../../shared/platform';
import { PlanetScene } from './PlanetScene';
import { World } from './World';
import { ParentView } from './ParentView';
import { demoOpen, usePlatform } from './platformStore';
import { setMuted, speak, stopSpeaking, unlockAudio } from '../audio';
import { OwlFace } from '../components/Icons';

type Mode = { kind: 'planet' } | { kind: 'region'; a: AreaId; arrived: { id: string; passed: boolean } | null };

/** 从工作台回来时 URL 带着 ?arrived=v3&passed=1：直接回到那块陆地 */
function initialMode(): Mode {
  const q = new URLSearchParams(location.search), id = q.get('arrived');
  const n = id ? NODES.find(x => x.id === id) : undefined;
  if (id) history.replaceState(null, '', location.pathname);
  return n ? { kind: 'region', a: n.a, arrived: { id: n.id, passed: q.get('passed') === '1' } } : { kind: 'planet' };
}

export function App() {
  const { p, update } = usePlatform();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [started, setStarted] = useState(mode.kind === 'region');
  const [parent, setParent] = useState(false);
  const [demo, setDemo] = useState(demoOpen);
  useEffect(() => { setMuted(p.muted); }, [p.muted]);

  const plan = todayPlan(p, new Date(), demo);
  const start = () => {
    unlockAudio(); setStarted(true);
    const todo = plan.filter(x => x.must && x.state === 'todo'), first = todo[0];
    speak(`你好呀，小探险家！今天是“${THEMES[dayIndex(new Date())]}”日。${todo.length ? `今天还有 ${todo.length} 件事要做，先去「${DOMAINS.find(d => d.id === first.d)!.name}」玩「${first.next!.name}」吧！` : '今天的事都做完啦，想玩哪里都可以！'}`);
  };
  /** 进一块大陆：去今天要做的那一关所在的区域；没有就去这块大陆第一个打开的区域 */
  const goTo = (d: DomainId, nodeId: string | null) => {
    const n = nodeId ? NODES.find(x => x.id === nodeId) : undefined;
    const open = openAreas(p, demo), a = n?.a ?? AREAS.find(x => x.d === d && open.has(x.id))!.id;
    setMode({ kind: 'region', a, arrived: n ? { id: n.id, passed: false } : null });
  };
  const goArea = (a: AreaId, nodeId?: string) => setMode({ kind: 'region', a, arrived: nodeId ? { id: nodeId, passed: false } : null });
  // 刚浮出来的新地方：弹一次，看过就记下
  const fresh = started && !parent ? newAreas(p)[0] : undefined;
  const seeArea = (go: boolean) => {
    if (!fresh) return;
    update(d => { if (!d.areasSeen.includes(fresh)) d.areasSeen.push(fresh); });
    if (go) { stopSpeaking(); goArea(fresh); }
  };
  useEffect(() => { if (fresh) speak(`快看！${DOMAINS.find(d => d.id === areaOf(fresh).d)!.name}上冒出了一个新地方：${areaOf(fresh).name}！`); }, [fresh]);

  return (
    <>
      {mode.kind === 'planet'
        ? <Planet started={started} p={p} demo={demo} plan={plan} onEnter={goTo} onStart={start} />
        : <World key={mode.a + (mode.arrived?.id ?? '')} p={p} update={update} area={mode.a} onArea={goArea} arrived={mode.arrived} demo={demo} onBack={() => setMode({ kind: 'planet' })} />}
      {fresh && (
        <div className="new-area" role="dialog" aria-label="新地方浮出来了">
          <div className="new-area-card">
            <div className="new-area-ic" aria-hidden>{areaOf(fresh).icon}</div>
            <small>{DOMAINS.find(d => d.id === areaOf(fresh).d)!.name}上冒出了一个新地方</small>
            <b>{areaOf(fresh).name}</b>
            <div className="new-area-row">
              <button className="pill" onClick={() => seeArea(true)}>去看看</button>
              <button className="pill ghost" onClick={() => seeArea(false)}>等会儿</button>
            </div>
          </div>
        </div>
      )}
      {started && (
        <div className="view-switch" role="tablist" aria-label="切换视角">
          <button role="tab" aria-selected={!parent} className={!parent ? 'on' : ''} onClick={() => setParent(false)}>🧒 孩子</button>
          <button role="tab" aria-selected={parent} className={parent ? 'on' : ''} onClick={() => { stopSpeaking(); setParent(true); }}>👪 家长</button>
        </div>
      )}
      {parent && <ParentView p={p} update={update} demo={demo} setDemo={setDemo} onClose={() => setParent(false)} />}
    </>
  );
}

function Planet({ started, p, demo, plan, onEnter, onStart }: {
  started: boolean; p: ReturnType<typeof usePlatform>['p']; demo: boolean; plan: TodayItem[];
  onEnter: (d: DomainId, nodeId: string | null) => void; onStart: () => void;
}) {
  const [open, setOpen] = useState(() => window.innerWidth >= 760);   // 窄屏默认收起今日任务
  const planRef = useRef(plan); planRef.current = plan;
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<PlanetScene | null>(null);
  const enterRef = useRef(onEnter); enterRef.current = onEnter;
  const startedRef = useRef(started); startedRef.current = started;
  const [hint, setHint] = useState<string | null>(null);
  const fly = async (d: DomainId, nodeId: string | null) => {
    if (!scene.current || scene.current.locked) return;
    const dom = DOMAINS.find(x => x.id === d)!;
    setHint(`出发去「${dom.name}」！`); speak(`出发去${dom.name}！`);
    await scene.current.focus(d);
    enterRef.current(d, nodeId);
  };
  const flyRef = useRef(fly); flyRef.current = fly;

  useEffect(() => {
    const s = new PlanetScene(host.current!, {
      onPick: d => {
        if (!startedRef.current) return;
        // 点陆地：如果这块陆地今天还有要做的关，直接站到那一关前面
        const it = planRef.current.find(x => x.d === d);
        void flyRef.current(d, it?.state === 'todo' ? it.next!.id : null);
      }
    });
    scene.current = s;
    return () => s.dispose();
  }, []);

  // 每块陆地点亮了几关、今天的任务做了没有，写在陆地的牌子上
  // 今日任务打开时星球往右让一让（窄屏不让：面板盖在上面，可以收起）
  useEffect(() => { scene.current?.setShift(open && window.innerWidth >= 760 ? 150 : 0); }, [open]);
  const planKey = plan.map(x => x.d + x.state + x.must).join();
  // 只放今天必做的三件：孩子一次看到的选择不要太多（其余两块大陆在星球上点就能去）
  const must = plan.filter(x => x.must);
  useEffect(() => {
    const done = new Set(p.done), prog = {} as Record<DomainId, { done: number; total: number; today: 'todo' | 'done' | null }>;
    for (const d of DOMAINS) {
      const ns = NODES.filter(n => n.d === d.id), it = plan.find(x => x.d === d.id)!;
      // 小圆章：做过了就打勾；没做的只给今天必做的三块标“!”
      prog[d.id] = { done: ns.filter(n => done.has(n.id)).length, total: ns.length, today: it.state === 'done' ? 'done' : it.must && it.state === 'todo' ? 'todo' : null };
    }
    scene.current?.setProgress(prog);
  }, [p.done, demo, planKey]);

  return (
    <div className="app planet">
      <div className="stage" ref={host} />
      {started && (
        <header className="hud-top">
          <div className="hud-stat" aria-label={`小红花 ${p.flowers} 朵`}><b className="flower">✿ {p.flowers}</b></div>
        </header>
      )}
      {started && (
        <aside className={`today ${open ? 'open' : ''}`} aria-label="今天要做">
          <button className="today-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
            <span>📋 今天要做</span>
            <b>{must.filter(x => x.state === 'done').length}/{must.length}</b>
            <i aria-hidden>{open ? '▾' : '▸'}</i>
          </button>
          {open && (
            <>
              <ul>{must.map(it => <TodayRow key={it.d} it={it} onGo={fly} />)}</ul>
            </>
          )}
        </aside>
      )}
      {started && <div className="planet-hint" role="status"><OwlFace size={40} /><span>{hint ?? '转一转星球，点一块陆地出发'}</span></div>}
      {!started && (
        <div className="title-screen">
          <h1>WonderLab</h1>
          <p className="title-sub">小诺的探险星球</p>
          <button className="start-btn" aria-label="开始" onClick={onStart}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12-7.5z" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}

/** 今日任务里的一行：点一下就飞到那块陆地、站到那一关前面 */
function TodayRow({ it, onGo }: { it: TodayItem; onGo: (d: DomainId, nodeId: string | null) => void }) {
  const dom = DOMAINS.find(d => d.id === it.d)!;
  const what = it.state === 'done' ? `点亮了「${it.doneToday[it.doneToday.length - 1].name}」` : it.state === 'todo' ? `${it.next!.icon} ${it.next!.name}` : '这里全部点亮啦';
  return (
    <li className={it.state}>
      <button onClick={() => void onGo(it.d, it.state === 'todo' ? it.next!.id : null)} style={{ ['--dc' as string]: dom.color }}>
        <span className="today-ic" aria-hidden>{dom.icon}</span>
        <span className="today-txt"><b>{dom.name}{it.theme && <em>探险日</em>}</b><small>{what}</small></span>
        <span className="today-st" aria-label={it.state === 'done' ? '今天做过了' : it.state === 'todo' ? '还没做' : '全部完成'}>{it.state === 'done' ? '✓' : it.state === 'todo' ? '›' : '★'}</span>
      </button>
    </li>
  );
}
