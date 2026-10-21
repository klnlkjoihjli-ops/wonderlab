import { useEffect, useMemo, useRef, useState } from 'react';
import { NODES, completeNode, dayIndex, node as nodeOf, nodeState, prereqs, type Node, type Platform } from '../../shared/platform';
import type { Profile } from '../../shared/daily';
import { logEvent } from '../world/platformStore';
import { sfx, speak, stopSpeaking } from '../audio';
import { CloseIcon, OwlFace } from '../components/Icons';
import { HoldButton } from '../world/HoldButton';

// 数字岛 2D 大地图（小样）：一张能拖、能缩放的插画地图。
// 地图上的东西都是“数据”：关卡点、小路、居民、彩蛋的位置写在下面的表里，以后加内容不用改画法。

const WORLD = { w: 2400, h: 1500 };
type Pt = [number, number];
/** 小路：从码头出发，经过 10 个关卡 */
const GATE: Pt = [300, 1270];
const SPOTS: Record<string, Pt> = {
  m1: [520, 1150], m2: [740, 1215], m3: [930, 1100], m4: [1040, 950], m5: [860, 820],
  m6: [1060, 690], m7: [1300, 760], m8: [1480, 650], m9: [1420, 470], m10: [1640, 390]
};
const ORDER = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10'];
const READY = new Set(['m1']);                   // 小样里能直接玩的关（摘花游戏）
const RABBIT_LINES = [
  '我是数数兔！我在数花园里的花，可是灰灰雾一来，我就数乱了……',
  '听说一朵一朵地点着数，就不会数乱。你能帮帮我吗？',
  '钟楼被灰灰雾盖住了，学会看钟表，它就会重新敲响！',
  '那边雾里还有一个集市，等你点亮更多的关，它就会浮出来。'
];

/** 平滑曲线：Catmull-Rom 转三次贝塞尔 */
function smoothPath(pts: Pt[]) {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}
const ROUTE: Pt[] = [GATE, ...ORDER.map(id => SPOTS[id])];
const ROUTE_D = smoothPath(ROUTE);

type Cam = { x: number; y: number; z: number };

export function NumberMap({ p, update, profile, focus, onBack }: {
  p: Platform; update: (fn: (d: Platform) => Platform | void) => void; profile: Profile; focus: string | null; onBack: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [size, setSize] = useState({ w: 1024, h: 768 });
  const [cam, setCam] = useState<Cam>({ x: 900, y: 950, z: 0.9 });
  const camRef = useRef(cam); camRef.current = cam;
  const [kid, setKid] = useState<{ at: string; pos: Pt; walking: boolean; face: 1 | -1 }>(() => {
    const start = focus && SPOTS[focus] ? focus : 'gate';
    return { at: start, pos: start === 'gate' ? GATE : SPOTS[start], walking: false, face: 1 };
  });
  const [card, setCard] = useState<string | null>(focus && SPOTS[focus] ? focus : null);
  const [bubble, setBubble] = useState<{ x: number; y: number; text: string; key: number } | null>(null);
  const [story, setStory] = useState(false);
  const [eggs, setEggs] = useState<Set<string>>(new Set());
  const [apple, setApple] = useState(0); const [fish, setFish] = useState(0);
  const [rabbitLine, setRabbitLine] = useState(0);
  const lengths = useRef<number[]>([]);           // 每个点在小路上的位置（长度）

  const done = useMemo(() => new Set(p.done), [p.done]);
  const state = (id: string) => nodeState(id, done);
  const nextId = ORDER.find(id => state(id) === 'now');

  // —— 尺寸、小路长度 ——
  useEffect(() => {
    const ro = new ResizeObserver(() => { const r = box.current!.getBoundingClientRect(); if (r.width && r.height) setSize({ w: r.width, h: r.height }); });
    ro.observe(box.current!); return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const path = pathRef.current!; const total = path.getTotalLength();
    lengths.current = ROUTE.map(pt => {
      let best = 0, bd = Infinity;
      for (let l = 0; l <= total; l += 3) { const q = path.getPointAtLength(l), d = (q.x - pt[0]) ** 2 + (q.y - pt[1]) ** 2; if (d < bd) { bd = d; best = l; } }
      return best;
    });
  }, []);
  // 一开始：镜头对准小人；从工作台回来时对准那一关
  useEffect(() => { const t = kid.pos; flyTo(t[0] + 200, t[1] - 120, 0.8); }, []);
  useEffect(() => {
    if (focus && SPOTS[focus]) return;
    speak(`欢迎来到数字岛！${profile.name}，拖一拖地图，到处看看。发光的地方就是现在能玩的关卡。`);
  }, []);

  // —— 镜头 ——
  const clampCam = (c: Cam): Cam => {
    const z = Math.min(1.8, Math.max(Math.max(size.w / WORLD.w, size.h / WORLD.h), c.z));
    const hw = size.w / z / 2, hh = size.h / z / 2;
    return { z, x: Math.min(WORLD.w - hw, Math.max(hw, c.x)), y: Math.min(WORLD.h - hh, Math.max(hh, c.y)) };
  };
  const anim = useRef(0);
  function flyTo(x: number, y: number, z = camRef.current.z) {
    cancelAnimationFrame(anim.current);
    const from = camRef.current, t0 = performance.now(), dur = 700;
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      setCam(clampCam({ x: from.x + (x - from.x) * e, y: from.y + (y - from.y) * e, z: from.z + (z - from.z) * e }));
      if (k < 1) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  }
  const vb = `${cam.x - size.w / cam.z / 2} ${cam.y - size.h / cam.z / 2} ${size.w / cam.z} ${size.h / cam.z}`;

  // —— 拖动、双指缩放、滚轮 ——
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ moved: boolean; d0: number; z0: number; sx: number; sy: number } | null>(null);
  // 注意：不用 setPointerCapture，否则松手时的 click 会落到外框上，地图上的东西就点不到了
  const onDown = (e: React.PointerEvent) => {
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    cancelAnimationFrame(anim.current);
    const ps = [...ptrs.current.values()];
    if (ps.length === 1) drag.current = { moved: false, d0: 0, z0: camRef.current.z, sx: e.clientX, sy: e.clientY };
    else if (drag.current) { drag.current.d0 = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y); drag.current.z0 = camRef.current.z; drag.current.moved = true; }
  };
  const onMove = (e: React.PointerEvent) => {
    const prev = ptrs.current.get(e.pointerId); if (!prev || !drag.current) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const ps = [...ptrs.current.values()], c = camRef.current;
    if (ps.length > 1) {
      const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
      setCam(clampCam({ ...c, z: drag.current.z0 * (d / Math.max(1, drag.current.d0)) }));
      return;
    }
    // 手指移动超过 6 像素才算拖动（小手点按时会抖一下）
    if (!drag.current.moved && Math.hypot(e.clientX - drag.current.sx, e.clientY - drag.current.sy) < 6) return;
    drag.current.moved = true;
    setCam(clampCam({ ...c, x: c.x - (e.clientX - prev.x) / c.z, y: c.y - (e.clientY - prev.y) / c.z }));
  };
  const onUp = (e: React.PointerEvent) => { ptrs.current.delete(e.pointerId); };
  const onWheel = (e: React.WheelEvent) => { const c = camRef.current; setCam(clampCam({ ...c, z: c.z * (e.deltaY < 0 ? 1.1 : 0.9) })); };
  /** 点击（拖过就不算点） */
  const tapOk = () => !drag.current?.moved;

  // —— 小人沿小路走 ——
  function walkTo(id: string) {
    const from = kid.at === 'gate' ? 0 : ORDER.indexOf(kid.at) + 1, to = ORDER.indexOf(id) + 1;
    if (from === to) { arrive(id); return; }
    const path = pathRef.current!, L = lengths.current, l0 = L[from], l1 = L[to];
    const dur = Math.min(3200, Math.abs(l1 - l0) * 2.2), t0 = performance.now();
    setCard(null); sfx.tap();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / dur), l = l0 + (l1 - l0) * k;
      const q = path.getPointAtLength(l), q2 = path.getPointAtLength(l + (l1 > l0 ? 4 : -4));
      setKid({ at: id, pos: [q.x, q.y], walking: k < 1, face: q2.x >= q.x ? 1 : -1 });
      const c = camRef.current; setCam(clampCam({ ...c, x: c.x + (q.x - c.x) * 0.08, y: c.y + (q.y - 60 - c.y) * 0.08 }));
      if (k < 1) requestAnimationFrame(step); else arrive(id);
    };
    requestAnimationFrame(step);
  }
  function arrive(id: string) {
    setCard(id); sfx.place();
    const n = nodeOf(id), st = state(id);
    if (st === 'lock') { const need = prereqs(n).map(nodeOf).filter(x => !done.has(x.id)); speak(`「${n.name}」还被灰灰雾挡着。先去点亮「${need.map(x => x.name).join('」和「')}」吧。`); }
    else if (st === 'done') speak(`「${n.name}」你已经点亮啦！`);
    else speak(`这里是「${n.name}」。${n.goal}。`);
  }
  const tapSpot = (id: string) => { if (!tapOk()) return; stopSpeaking(); walkTo(id); };

  // —— 线下关卡：爸爸妈妈确认 ——
  const confirm = (id: string) => {
    let notes: string[] = [];
    update(d => { const r = completeNode(d, id, dayIndex(new Date())); notes = r.notes; logEvent(r.p, 'complete', `家长确认完成「${nodeOf(id).name}」`, id); return r.p; });
    sfx.success(); setTimeout(() => speak(notes.join('')), 60);
  };

  // —— 居民和彩蛋 ——
  const pop = (x: number, y: number, text: string) => { setBubble({ x, y, text, key: Date.now() }); speak(text); };
  const findEgg = (id: string) => setEggs(s => { if (s.has(id)) return s; const n = new Set(s); n.add(id); setTimeout(() => sfx.success(), 300); return n; });
  const tapRabbit = () => { if (!tapOk()) return; const line = RABBIT_LINES[rabbitLine % RABBIT_LINES.length]; setRabbitLine(i => i + 1); pop(330, 1000, line); };
  const tapTree = () => { if (!tapOk()) return; setApple(a => a + 1); sfx.pick(); findEgg('apple'); pop(620, 820, '咚！一个苹果掉下来了。数一数，树上还剩几个？'); };
  const tapPond = () => { if (!tapOk()) return; setFish(f => f + 1); sfx.splash(); findEgg('fish'); pop(1230, 1150, '一条小鱼跳了出来！池塘里一共有 3 条鱼哦。'); };
  const tapClock = () => { if (!tapOk()) return; findEgg('clock'); pop(1900, 420, '钟楼被灰灰雾盖住了，指针不走了。学会看钟表，它就会“当——”地重新响起来！'); };
  const tapFog = (name: string, x: number, y: number) => { if (!tapOk()) return; pop(x, y, `☁️ 这里是「${name}」，还在灰灰雾里。正式版里，点亮更多关卡它就会浮出来。`); };

  const cardNode: Node | null = card ? nodeOf(card) : null;

  return (
    <div className="demo-page map">
      <div className="map-box" ref={box} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}>
        <svg className="map-svg" viewBox={vb} preserveAspectRatio="xMidYMid slice">
          <MapDefs />
          {/* 海和岛 */}
          <rect x={-400} y={-400} width={WORLD.w + 800} height={WORLD.h + 800} fill="url(#sea)" />
          <g className="waves">{Array.from({ length: 18 }, (_, i) => <path key={i} d={`M${(i * 137) % 2300 + 40},${(i * 211) % 1400 + 60} q12,-8 24,0 q12,8 24,0`} />)}</g>
          <path d="M210,1330 C120,1150 140,900 230,720 C300,560 220,380 360,250 C520,110 800,150 1000,120 C1250,80 1450,130 1650,110 C1900,90 2150,170 2230,360 C2310,560 2260,760 2200,930 C2140,1120 2210,1260 2060,1370 C1880,1490 1560,1420 1300,1450 C1000,1480 760,1430 520,1440 C380,1445 270,1420 210,1330 Z" fill="url(#sand)" filter="url(#soft)" />
          <path d="M260,1300 C180,1140 200,920 280,750 C350,590 280,410 400,290 C550,160 820,195 1010,165 C1250,125 1450,175 1650,155 C1880,135 2110,210 2180,380 C2250,570 2200,760 2145,925 C2090,1100 2150,1240 2020,1330 C1850,1440 1560,1380 1300,1405 C1000,1435 760,1385 530,1395 C400,1400 300,1380 260,1300 Z" fill="url(#grass)" />
          {/* 远处的小山 */}
          <g filter="url(#sh)">
            <path d="M380,420 Q520,250 660,420 Z" fill="#8fc96a" /><path d="M560,430 Q720,230 880,430 Z" fill="#7dbb5c" />
            <path d="M1020,330 Q1160,170 1300,330 Z" fill="#8fc96a" /><path d="M1180,340 Q1350,150 1520,340 Z" fill="#7dbb5c" />
          </g>
          {/* 小河和桥 */}
          <path d="M1190,170 C1160,350 1280,480 1200,620 C1130,750 1240,860 1180,980 C1140,1070 1250,1200 1200,1400" fill="none" stroke="#7fd3e8" strokeWidth={46} strokeLinecap="round" />
          <path d="M1190,170 C1160,350 1280,480 1200,620 C1130,750 1240,860 1180,980 C1140,1070 1250,1200 1200,1400" fill="none" stroke="#b8ecf5" strokeWidth={14} strokeLinecap="round" strokeDasharray="18 40" className="river-flow" />
          {/* 池塘（彩蛋：小鱼） */}
          <g onClick={tapPond} className="tappable">
            <ellipse cx={1330} cy={1200} rx={110} ry={62} fill="#7fd3e8" stroke="#5fb9d0" strokeWidth={6} />
            <ellipse cx={1300} cy={1185} rx={40} ry={12} fill="#c9f2fa" opacity={0.7} />
            <g key={fish} className={fish ? 'fish-jump' : ''} transform="translate(1330,1200)"><path d="M-22,0 Q0,-16 22,0 Q0,16 -22,0 Z M22,0 L36,-10 L36,10 Z" fill="#ff9a5c" /></g>
            {[[1250, 1230], [1395, 1215]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx={22} ry={10} fill="#5fbf6a" />)}
          </g>
          {/* 灰灰雾里的地方（还没浮出来） */}
          <Fog x={560} y={330} label="比一比集市" sub="正式版会浮出来" onTap={() => tapFog('比一比集市', 560, 330)} />
          <g onClick={tapClock} className="tappable"><ClockTower x={1900} y={560} /></g>
          <Fog x={1900} y={520} label="钟楼广场" sub="时间与钱" onTap={tapClock} light />
          {/* 数字小镇：房子上写着数字 */}
          {[[880, 1345, 1, '#ee7a5f'], [1010, 1330, 2, '#4fb39b'], [1430, 945, 3, '#f0b62a'], [1590, 830, 4, '#9b7fe0']].map(([x, y, n, c]) =>
            <House key={n as number} x={x as number} y={y as number} n={n as number} color={c as string} />)}
          {/* 苹果树（彩蛋） */}
          <g onClick={tapTree} className="tappable"><AppleTree x={600} y={880} fallen={apple} /></g>
          {/* 小树林 */}
          {[[330, 640], [430, 700], [270, 760], [1720, 1120], [1820, 1180], [1950, 1080], [2000, 860], [1530, 1260], [760, 640], [1100, 1220]].map(([x, y], i) => <Tree key={i} x={x} y={y} s={0.8 + (i % 3) * 0.15} />)}
          {/* 兔子的花园（第 1 关的地方） */}
          <g>{Array.from({ length: 9 }, (_, i) => <Flower key={i} x={420 + (i % 5) * 34} y={1080 + Math.floor(i / 5) * 30} c={['#ff6b8a', '#ffcf4a', '#b48cff', '#ff8f4a', '#fff'][i % 5]} />)}</g>
          {/* 小路 */}
          <path d={ROUTE_D} fill="none" stroke="#c99560" strokeWidth={50} strokeLinecap="round" strokeLinejoin="round" opacity={0.35} />
          <path ref={pathRef} d={ROUTE_D} fill="none" stroke="#f3dcb0" strokeWidth={36} strokeLinecap="round" strokeLinejoin="round" />
          <path d={ROUTE_D} fill="none" stroke="#fff6e2" strokeWidth={6} strokeDasharray="2 26" strokeLinecap="round" />
          {/* 小路过河的木桥 */}
          <g transform="translate(1205,722) rotate(14)" filter="url(#sh)">
            {Array.from({ length: 6 }, (_, i) => <rect key={i} x={-66 + i * 22} y={-30} width={19} height={60} rx={4} fill="#d9a066" />)}
            <rect x={-70} y={-36} width={140} height={8} rx={4} fill="#a8703c" /><rect x={-70} y={28} width={140} height={8} rx={4} fill="#a8703c" />
          </g>
          {/* 码头 */}
          <g transform={`translate(${GATE[0] - 60},${GATE[1] + 10})`} filter="url(#sh)">
            {Array.from({ length: 5 }, (_, i) => <rect key={i} x={i * 26} y={0} width={22} height={80} rx={4} fill="#c98f55" />)}
            <rect x={-6} y={-8} width={140} height={14} rx={6} fill="#a8703c" />
          </g>
          {/* 关卡点 */}
          {ORDER.map((id, i) => <Spot key={id} id={id} n={nodeOf(id)} at={SPOTS[id]} st={state(id)} next={id === nextId} idx={i + 1} onTap={() => tapSpot(id)} />)}
          {/* 守护者：数数兔 */}
          <g onClick={tapRabbit} className="tappable rabbit"><Rabbit x={330} y={1075} /></g>
          {/* 区域牌子 */}
          <Sign x={560} y={1340} text="🔢 数字小镇" color="#4fb39b" />
          {/* 小人 */}
          {/* 走路时踩在小路中间；停下来站在关卡旁边，不挡住关卡图标 */}
          <Kid x={kid.pos[0] - (kid.walking || kid.at === 'gate' ? 0 : 62)} y={kid.pos[1] + (kid.walking || kid.at === 'gate' ? 0 : 14)} walking={kid.walking} face={kid.face} />
          {/* 飘着的云 */}
          <g className="clouds">{[[300, 160], [1500, 240], [2050, 1250], [900, 90]].map(([x, y], i) => <Cloud key={i} x={x} y={y} s={1 + (i % 2) * 0.4} i={i} />)}</g>
          {/* 气泡 */}
          {bubble && (
            <g key={bubble.key} transform={`translate(${bubble.x},${bubble.y - 140})`} className="map-bubble">
              <foreignObject x={-170} y={-70} width={340} height={150}><div className="mb-inner">{bubble.text}</div></foreignObject>
            </g>
          )}
        </svg>
      </div>

      {/* 顶部 */}
      <header className="map-top">
        <button className="round-btn" aria-label="回到今天" onClick={onBack}>←</button>
        <div className="map-title"><b>🔢 数字岛</b><small>数与形状</small></div>
        <button className="map-chapter" onClick={() => { setStory(true); speak('第 1 章，钟楼不响了。灰灰雾飘到了数字岛，钟楼的指针停了，数数兔也数乱了。帮数数兔一关一关把数字找回来，钟楼就会重新敲响！'); }}>📖 第 1 章 · 钟楼不响了</button>
        <div className="spacer" />
        <div className="hud-stat" aria-label={`小红花 ${p.flowers} 朵`}><b className="flower">✿ {p.flowers}</b></div>
        <div className="map-eggs" aria-label={`找到彩蛋 ${eggs.size} 个，一共 3 个`}>🥚 {eggs.size}/3</div>
      </header>
      <div className="map-zoom">
        <button onClick={() => setCam(c => clampCam({ ...c, z: c.z * 1.25 }))} aria-label="放大">＋</button>
        <button onClick={() => setCam(c => clampCam({ ...c, z: c.z / 1.25 }))} aria-label="缩小">－</button>
        <button onClick={() => flyTo(kid.pos[0], kid.pos[1] - 60, 1)} aria-label="回到小人身边">🧒</button>
      </div>

      {story && (
        <div className="map-story" role="dialog" aria-label="第 1 章">
          <div className="ms-card">
            <OwlFace size={70} />
            <h3>第 1 章 · 钟楼不响了</h3>
            <p>灰灰雾飘到了数字岛。钟楼的指针停了，花园里的花也数不清了。数数兔急得团团转：“谁能帮我一朵一朵数清楚？”</p>
            <p>沿着小路一关一关走，每点亮一关，灰灰雾就散开一点。走到第 7 关学会看钟表，钟楼就会“当——”地重新响起来！</p>
            <button className="pill" onClick={() => { setStory(false); stopSpeaking(); if (nextId) walkTo(nextId); }}>出发！</button>
          </div>
        </div>
      )}

      {cardNode && !kid.walking && (() => {
        const st = state(cardNode.id), ready = READY.has(cardNode.id);
        const need = prereqs(cardNode).map(nodeOf).find(x => !done.has(x.id));
        return (
          <div className="task-card map-card" role="dialog" aria-label={cardNode.name} style={{ ['--dc' as string]: '#4fb39b' }}>
            <div className="task-icon" aria-hidden>{cardNode.icon}</div>
            <div className="task-body">
              <b>{cardNode.name}</b><span>{cardNode.goal}</span>
              <div className="task-tags">{cardNode.how.map(h => <i key={h}>{h}</i>)}{st === 'done' && <i className="done">已点亮</i>}</div>
            </div>
            <div className="task-act">
              {st === 'lock' && need && <button className="pill" onClick={() => walkTo(need.id)}>带我去「{need.name}」</button>}
              {st !== 'lock' && ready && <a className="go-btn is-ready" href={`/bench.html?node=${cardNode.id}&back=demo`} aria-label="开始"><span className="go-label">开始</span></a>}
              {st === 'now' && !ready && (
                <div className="offline">
                  <small>小样里这一关还没做成游戏，先和爸爸妈妈一起完成：{cardNode.goal}</small>
                  <HoldButton label="爸爸妈妈按住确认" onDone={() => confirm(cardNode.id)} />
                </div>
              )}
            </div>
            <button className="mini-btn task-close" aria-label="关闭" onClick={() => setCard(null)}><CloseIcon /></button>
          </div>
        );
      })()}
    </div>
  );
}

// ===================== 画画的小零件（全是 SVG） =====================
function MapDefs() {
  return (
    <defs>
      <radialGradient id="sea" cx="50%" cy="45%" r="75%"><stop offset="0%" stopColor="#8ee4ef" /><stop offset="60%" stopColor="#53c3df" /><stop offset="100%" stopColor="#3a9fcf" /></radialGradient>
      <linearGradient id="sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffe9b8" /><stop offset="100%" stopColor="#f3d18f" /></linearGradient>
      <radialGradient id="grass" cx="45%" cy="55%" r="70%"><stop offset="0%" stopColor="#c6ea8a" /><stop offset="70%" stopColor="#a8db74" /><stop offset="100%" stopColor="#93cc63" /></radialGradient>
      <radialGradient id="fog" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#eef0f6" stopOpacity="0.97" /><stop offset="70%" stopColor="#dfe3ee" stopOpacity="0.9" /><stop offset="100%" stopColor="#dfe3ee" stopOpacity="0" /></radialGradient>
      <filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#5a3a1a" floodOpacity="0.22" /></filter>
      <filter id="soft"><feGaussianBlur stdDeviation="3" /></filter>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
  );
}
function Tree({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`} filter="url(#sh)">
      <rect x={-8} y={-10} width={16} height={46} rx={6} fill="#8a5b3c" />
      <circle cx={0} cy={-40} r={42} fill="#5fa84a" /><circle cx={-26} cy={-22} r={28} fill="#6fbb54" /><circle cx={24} cy={-24} r={30} fill="#6fbb54" />
      <circle cx={-12} cy={-58} r={14} fill="#8fd16a" opacity={0.8} />
    </g>
  );
}
function AppleTree({ x, y, fallen }: { x: number; y: number; fallen: number }) {
  const apples: Pt[] = [[-30, -60], [20, -78], [34, -30], [-10, -24], [6, -52]];
  const left = Math.max(0, apples.length - fallen);
  return (
    <g transform={`translate(${x},${y})`} filter="url(#sh)">
      <rect x={-12} y={-10} width={24} height={70} rx={8} fill="#8a5b3c" />
      <circle cx={0} cy={-50} r={68} fill="#5fa84a" /><circle cx={-40} cy={-28} r={40} fill="#6fbb54" /><circle cx={40} cy={-30} r={42} fill="#6fbb54" />
      {apples.slice(0, left).map(([ax, ay], i) => <circle key={i} cx={ax} cy={ay} r={11} fill="#ee4b3e" />)}
      {Array.from({ length: Math.min(fallen, apples.length) }, (_, i) => <circle key={`f${i}`} cx={-46 + i * 22} cy={64} r={11} fill="#ee4b3e" className={i === fallen - 1 ? 'apple-drop' : ''} />)}
    </g>
  );
}
function House({ x, y, n, color }: { x: number; y: number; n: number; color: string }) {
  return (
    <g transform={`translate(${x},${y})`} filter="url(#sh)">
      <rect x={-46} y={-56} width={92} height={70} rx={10} fill="#fff4dc" />
      <path d="M-58,-52 L0,-104 L58,-52 Z" fill={color} />
      <rect x={-14} y={-24} width={28} height={38} rx={6} fill="#b97a33" />
      <circle cx={0} cy={-74} r={17} fill="#fffaf0" /><text x={0} y={-67} textAnchor="middle" fontSize={22} fontWeight={800} fill={color}>{n}</text>
      <rect x={24} y={-44} width={16} height={16} rx={3} fill="#ffe3a1" />
    </g>
  );
}
function Flower({ x, y, c }: { x: number; y: number; c: string }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={-2} y={0} width={4} height={18} fill="#4f9a45" />
      {[0, 72, 144, 216, 288].map(a => <circle key={a} cx={Math.cos(a * Math.PI / 180) * 8} cy={Math.sin(a * Math.PI / 180) * 8} r={7} fill={c} />)}
      <circle r={5} fill="#ffd23f" />
    </g>
  );
}
function Cloud({ x, y, s, i }: { x: number; y: number; s: number; i: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`} opacity={0.92}>
      <g className={`cloud c${i}`}>{/* 动画放在里面一层，不会覆盖外面的位置 */}
        <ellipse cx={0} cy={0} rx={70} ry={30} fill="#fff" /><circle cx={-30} cy={-14} r={30} fill="#fff" /><circle cx={22} cy={-22} r={36} fill="#fff" />
      </g>
    </g>
  );
}
function Fog({ x, y, label, sub, onTap, light }: { x: number; y: number; label: string; sub: string; onTap: () => void; light?: boolean }) {
  return (
    <g className="tappable fog" onClick={onTap}>
      <ellipse cx={x} cy={y} rx={300} ry={190} fill="url(#fog)" opacity={light ? 0.75 : 1} />
      {[[-150, -40], [-60, -90], [60, -80], [150, -20], [-100, 50], [40, 40], [140, 70]].map(([dx, dy], i) => <circle key={i} cx={x + dx} cy={y + dy} r={70 + (i % 3) * 14} fill="#eef0f6" opacity={light ? 0.6 : 0.95} />)}
      <g transform={`translate(${x},${y + 20})`}>
        <rect x={-110} y={-34} width={220} height={68} rx={34} fill="#fffaf0" opacity={0.95} />
        <text x={0} y={-4} textAnchor="middle" fontSize={26} fontWeight={700} fill="#6b6b80">☁️ {label}</text>
        <text x={0} y={22} textAnchor="middle" fontSize={17} fill="#9a9aab">{sub}</text>
      </g>
    </g>
  );
}
function ClockTower({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`} filter="url(#sh)">
      <rect x={-60} y={-260} width={120} height={300} rx={12} fill="#f3d9b0" />
      <path d="M-76,-256 L0,-360 L76,-256 Z" fill="#c96a4a" />
      <circle cx={0} cy={-190} r={46} fill="#fffaf0" stroke="#8a5b3c" strokeWidth={6} />
      <line x1={0} y1={-190} x2={0} y2={-220} stroke="#2a3a33" strokeWidth={6} strokeLinecap="round" />
      <line x1={0} y1={-190} x2={22} y2={-180} stroke="#2a3a33" strokeWidth={5} strokeLinecap="round" />
      <rect x={-22} y={-40} width={44} height={80} rx={20} fill="#b97a33" />
    </g>
  );
}
function Sign({ x, y, text, color }: { x: number; y: number; text: string; color: string }) {
  return (
    <g transform={`translate(${x},${y})`} filter="url(#sh)">
      <rect x={-6} y={0} width={12} height={60} fill="#8a5b3c" />
      <rect x={-120} y={-44} width={240} height={56} rx={14} fill="#fffaf0" stroke={color} strokeWidth={6} />
      <text x={0} y={-6} textAnchor="middle" fontSize={28} fontWeight={800} fill="#2a3a33">{text}</text>
    </g>
  );
}
function Spot({ id, n, at, st, next, idx, onTap }: { id: string; n: Node; at: Pt; st: 'done' | 'now' | 'lock'; next: boolean; idx: number; onTap: () => void }) {
  const fill = st === 'done' ? '#ffd23f' : st === 'now' ? '#4fb39b' : '#c8c2b6';
  return (
    <g transform={`translate(${at[0]},${at[1]})`} className={`tappable spot ${st} ${next ? 'next' : ''}`} onClick={onTap} data-id={id}>
      {next && <circle r={64} fill="#fff3a0" opacity={0.6} className="spot-pulse" />}
      <ellipse cx={0} cy={18} rx={52} ry={20} fill="#000" opacity={0.12} />
      <circle r={46} fill="#fffaf0" stroke={fill} strokeWidth={10} filter="url(#sh)" />
      <text y={14} textAnchor="middle" fontSize={44} opacity={st === 'lock' ? 0.45 : 1}>{n.icon}</text>
      <g transform="translate(34,-34)"><circle r={18} fill={fill} /><text y={7} textAnchor="middle" fontSize={20} fontWeight={800} fill="#fff">{st === 'done' ? '✓' : st === 'lock' ? '🔒' : idx}</text></g>
      <g transform="translate(0,78)"><rect x={-80} y={-20} width={160} height={36} rx={18} fill="#fffaf0" opacity={0.95} /><text y={6} textAnchor="middle" fontSize={20} fontWeight={700} fill="#2a3a33">{n.name}</text></g>
    </g>
  );
}
function Rabbit({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`} filter="url(#sh)">
      <g className="rabbit-bob">
        <ellipse cx={-16} cy={-118} rx={12} ry={40} fill="#fffaf2" /><ellipse cx={16} cy={-118} rx={12} ry={40} fill="#fffaf2" />
        <ellipse cx={-16} cy={-116} rx={6} ry={28} fill="#ffb7c5" /><ellipse cx={16} cy={-116} rx={6} ry={28} fill="#ffb7c5" />
        <ellipse cx={0} cy={-20} rx={40} ry={44} fill="#fffaf2" />
        <circle cx={0} cy={-74} r={34} fill="#fffaf2" />
        <circle cx={-12} cy={-78} r={5} fill="#24262e" /><circle cx={12} cy={-78} r={5} fill="#24262e" />
        <circle cx={-20} cy={-66} r={6} fill="#ffc3cf" /><circle cx={20} cy={-66} r={6} fill="#ffc3cf" />
        <circle cx={0} cy={-68} r={4} fill="#ff8fa3" />
        <path d="M-14,-30 L14,-30 L10,-6 L-10,-6 Z" fill="#4fb39b" />
        <text x={0} y={-12} textAnchor="middle" fontSize={16} fontWeight={800} fill="#fff">123</text>
      </g>
      <g transform="translate(0,-170)"><rect x={-62} y={-18} width={124} height={34} rx={17} fill="#4fb39b" /><text y={6} textAnchor="middle" fontSize={18} fontWeight={700} fill="#fff">数数兔 💬</text></g>
    </g>
  );
}
function Kid({ x, y, walking, face }: { x: number; y: number; walking: boolean; face: 1 | -1 }) {
  return (
    <g transform={`translate(${x},${y - 20}) scale(${face},1)`} className={walking ? 'kid walking' : 'kid'} filter="url(#sh)">
      <ellipse cx={0} cy={24} rx={26} ry={8} fill="#000" opacity={0.15} />
      <g className="kid-body">
        <rect x={-16} y={-26} width={32} height={40} rx={12} fill="#ffcf4a" />
        <rect x={-14} y={8} width={10} height={16} rx={4} fill="#3d5fc4" className="leg l" /><rect x={4} y={8} width={10} height={16} rx={4} fill="#3d5fc4" className="leg r" />
        <rect x={-26} y={-22} width={12} height={22} rx={6} fill="#ee5a4f" />
        <circle cx={0} cy={-50} r={24} fill="#ffd9bf" />
        <path d="M-25,-56 Q0,-86 25,-56 Z" fill="#3d5fc4" /><rect x={-4} y={-60} width={26} height={8} rx={4} fill="#2e4aa0" />
        <circle cx={-8} cy={-48} r={3} fill="#24262e" /><circle cx={8} cy={-48} r={3} fill="#24262e" />
        <path d="M-6,-38 Q0,-33 6,-38" stroke="#2a3a33" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      </g>
    </g>
  );
}
