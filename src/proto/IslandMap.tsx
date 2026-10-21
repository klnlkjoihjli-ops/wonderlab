import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { AGES, nextAreaIn, node, nodeState, openAreas, visibleFor, type AgeId, type AreaId, type NodeState } from '../../shared/platform';
import { SCENES } from '../../shared/games';
import { sfx, speak, stopSpeaking, unlockAudio } from '../audio';
import L from './discoverLayout.json';

// 发现岛的大地图（风格 A：暖色黏土 2.5D）。底图和物件都是 Blender 渲染的（art/make_discover_layout.ts → art/blender/*.py）。
// 一开始看整座岛；点一个区域，镜头飞过去，出现这一片的关卡点；点关卡点，小人走过去，弹出关卡卡片。
// 只画这个年龄能看到的关；没浮出来的区域盖着云。

type P = [number, number];
type Sprite = { file: string; w: number; h: number; ax: number; ay: number };
type Art = { number: Record<string, Sprite>; discover: Record<string, Sprite>; chars: Record<string, Sprite>; v: number };
const K = L.world.pxPerMeter / 110;            // 素材 110 像素/米，地图 60 像素/米
const W = L.world.w, H = L.world.h;
const FULL = { x: 0, y: -300, w: W, h: H + 300 };   // 上面多留一条海，小诺的气泡不挡住建筑名字
/** 玩完一关回到地图时，回到刚才的区域和位置 */
const memo: { zone: string | null; kid: P } = { zone: null, kid: L.gate as P };

function useArt() {
  const [art, setArt] = useState<Art | null | 'missing'>(null);
  useEffect(() => {
    const get = (u: string) => fetch(u, { cache: 'no-store' }).then(r => (r.ok ? r.json() : Promise.reject(r.status)));
    Promise.all([get('art/number/manifest.json'), get('art/discover/manifest.json'), get('art/chars/manifest.json'), get('art/version.json').catch(() => ({ v: 0 }))])
      .then(([number, discover, chars, ver]) => setArt({ number, discover, chars, v: ver.v }))
      .catch(() => setArt('missing'));
  }, []);
  return art;
}
function Img({ art, dir, id, at, scale = 1, flip = false, onClick, className }: { art: Art; dir: 'number' | 'discover' | 'chars'; id: string; at: P; scale?: number; flip?: boolean; onClick?: () => void; className?: string }) {
  const s = art[dir][id];
  if (!s) return null;
  const k = K * scale;
  return (
    <g transform={`translate(${at[0]},${at[1]})${flip ? ' scale(-1,1)' : ''}`} onClick={onClick} className={className}>
      <image href={`art/${dir}/${s.file}?v=${art.v}`} x={-s.ax * k} y={-s.ay * k} width={s.w * k} height={s.h * k} />
    </g>
  );
}

type Zone = (typeof L.zones)[number];
const zoneBox = (z: Zone) => {
  const pts = [z.at, z.npcAt, ...Object.values(z.spots)] as P[];
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs) - 260, x1 = Math.max(...xs) + 260, y0 = Math.min(...ys) - 560, y1 = Math.max(...ys) + 200;
  // 按屏幕比例（4:3 左右）放大，不要太扁
  let w = x1 - x0, h = y1 - y0;
  if (w / h < 1.4) w = h * 1.4; else h = w / 1.4;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return { x: Math.max(0, Math.min(W - w, cx - w / 2)), y: Math.max(0, Math.min(H - h, cy - h / 2)), w, h };
};

export function IslandMap({ done, band, areas, onPlay, onDetail }: {
  done: ReadonlySet<string>; band: AgeId; areas: Record<string, boolean>;
  onPlay: (id: string) => void; onDetail: (id: string) => void;
}) {
  const art = useArt();
  const open = openAreas({ done: [...done], areas });
  const z0 = L.zones.find(z => z.id === memo.zone) ?? null;
  const [view, setView] = useState(z0 ? zoneBox(z0) : FULL);
  const [zone, setZone] = useState<Zone | null>(z0);
  const [kid, setKid] = useState<{ at: P; walking: boolean; frame: number }>({ at: memo.kid, walking: false, frame: 0 });
  useEffect(() => { memo.zone = zone?.id ?? null; memo.kid = kid.at; }, [zone, kid.at]);
  const [card, setCard] = useState<string | null>(null);
  const [say, setSay] = useState(z0 ? `回到${z0.name}啦，接着玩吧！` : '欢迎来到发现岛！点一个地方去看看吧。');
  const anim = useRef<number>(0);
  useEffect(() => () => { cancelAnimationFrame(anim.current); stopSpeaking(); }, []);
  const talk = (t: string) => { setSay(t); speak(t); };

  /** 镜头平滑移动到某个范围 */
  function fly(to: typeof FULL, ms = 900) {
    cancelAnimationFrame(anim.current);
    const from = view, t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms), e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      setView({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, w: from.w + (to.w - from.w) * e, h: from.h + (to.h - from.h) * e });
      if (t < 1) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  }
  function enterZone(z: Zone) {
    unlockAudio();
    if (!open.has(z.id as AreaId)) {
      const nx = nextAreaIn('sci', { done: [...done], areas });
      sfx.deny(); talk(`${z.name}还在云里。${nx && nx.a.id === z.id ? `再点亮 ${nx.need} 关，云就会散开。` : '先去别的地方玩一玩吧。'}`);
      return;
    }
    sfx.whoosh(); setZone(z); setCard(null); fly(zoneBox(z));
    const sc = SCENES[z.id as AreaId];
    talk(`这里是${z.name}，${sc.npc}在等你！点一个圆台子开始吧。`);
  }
  function backToIsland() { setZone(null); setCard(null); fly(FULL); talk('点一个地方去看看吧。'); }

  /** 小人走到关卡点，到了弹出卡片 */
  function walkTo(id: string, to: P) {
    unlockAudio(); sfx.tap();
    cancelAnimationFrame(anim.current);
    const from = kid.at, dist = Math.hypot(to[0] - from[0], to[1] - from[1]), ms = Math.min(1600, 300 + dist * 1.2), t0 = performance.now();
    setCard(null);
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      setKid({ at: [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t], walking: t < 1, frame: Math.floor((now - t0) / 160) % 2 });
      if (t < 1) anim.current = requestAnimationFrame(step);
      else { sfx.place(); setCard(id); const n = node(id), st = nodeState(id, done, band); talk(st === 'lock' ? `「${n.name}」还没开，先点亮前面的关吧。` : st === 'done' ? `「${n.name}」你已经点亮啦，想再玩一次吗？` : `这里是「${n.name}」：${n.goal}。`); }
    };
    anim.current = requestAnimationFrame(step);
  }

  const spots = useMemo(() => {
    const out: { id: string; at: P; st: NodeState; zone: string }[] = [];
    for (const z of L.zones) for (const [id, at] of Object.entries(z.spots)) {
      if (!open.has(z.id as AreaId) || !visibleFor(node(id), band, done)) continue;
      out.push({ id, at: at as P, st: nodeState(id, done, band), zone: z.id });
    }
    return out;
  }, [done, band, open]);

  if (art === null) return <div className="im-wrap"><p className="im-loading">发现岛正在浮出水面……</p></div>;
  if (art === 'missing') return <div className="im-wrap"><p className="im-loading">地图素材没找到（需要先在 Mac 上渲染）。</p></div>;

  const vb = `${view.x} ${view.y} ${view.w} ${view.h}`;
  const items: { y: number; key: string; el: ReactElement }[] = [];
  for (const p of L.props) if (!(p as { fly?: boolean }).fly) items.push({ y: p.at[1], key: `p${p.id}${p.at}`, el: <Img art={art} dir={p.dir as 'number'} id={p.id} at={p.at as P} /> });
  for (const z of L.zones) {
    const locked = !open.has(z.id as AreaId);
    items.push({ y: z.at[1], key: `b${z.id}`, el: <Img art={art} dir="discover" id={z.prop} at={z.at as P} onClick={() => enterZone(z)} className="im-tap" /> });
    if (!locked) items.push({ y: z.npcAt[1], key: `n${z.id}`, el: <Img art={art} dir="chars" id={z.npc} at={z.npcAt as P} scale={1.15} onClick={() => enterZone(z)} className="im-tap" /> });
  }
  // 只让“下一关”一闪一闪：这个区域里第一个能玩、还没点亮的关（先找自己年龄段的）
  const zs = zone ? spots.filter(s => s.zone === zone.id) : [];
  const next = (zs.find(s => s.st === 'now' && node(s.id).age === band) ?? zs.find(s => s.st === 'now'))?.id;
  if (zone) for (const s of zs) {
    const n = node(s.id);
    items.push({ y: s.at[1], key: `s${s.id}`, el: (
      <g className="im-tap" onClick={() => walkTo(s.id, s.at)}>
        <Img art={art} dir="number" id={`spot_${s.st}`} at={s.at} scale={0.8} />
        <text x={s.at[0]} y={s.at[1] - 12} textAnchor="middle" fontSize="44" style={{ opacity: s.st === 'lock' ? 0.45 : 1 }}>{s.st === 'lock' ? '🔒' : n.icon}</text>
        {s.id === next && <circle cx={s.at[0]} cy={s.at[1] - 10} r="62" fill="none" stroke="#fff6b0" strokeWidth="6"><animate attributeName="r" values="52;70;52" dur="1.6s" repeatCount="indefinite" /><animate attributeName="opacity" values="0.9;0.2;0.9" dur="1.6s" repeatCount="indefinite" /></circle>}
      </g>
    ) });
  }
  items.push({ y: kid.at[1] + 1, key: 'kid', el: <Img art={art} dir="chars" id={kid.walking ? `kid_walk${kid.frame + 1}` : 'kid_idle'} at={kid.at} scale={1.1} /> });
  items.sort((a, b) => a.y - b.y);

  const cardNode = card ? node(card) : null, cardSt = card ? nodeState(card, done, band) : null;
  return (
    <div className="im-wrap">
      <svg className="im-svg" viewBox={vb} preserveAspectRatio="xMidYMid meet" role="img" aria-label="发现岛地图">
        <rect x={-500} y={-500} width={W + 1000} height={H + 1000} fill="#35a8c7" />
        <image href={`art/discover/base.jpg?v=${art.v}`} x={0} y={0} width={W} height={H} />
        {(L.boats as P[]).map((b, i) => (
          <g key={i} transform={`translate(${b[0]},${b[1]})`}><g><animateTransform attributeName="transform" type="rotate" values="-4;4;-4" dur={`${3.5 + i}s`} repeatCount="indefinite" /><Img art={art} dir="number" id="boat" at={[0, 0]} flip={i % 2 === 1} /></g></g>
        ))}
        {items.map(it => <g key={it.key}>{it.el}</g>)}
        {L.zones.map(z => {
          const locked = !open.has(z.id as AreaId);
          return (
            <g key={`lab${z.id}`} className="im-tap" onClick={() => enterZone(z)}>
              {locked && <g opacity="0.92">{[[-160, 0, 150], [0, -60, 190], [170, 10, 150], [40, 90, 160]].map(([dx, dy, r], i) => <ellipse key={i} cx={z.at[0] + dx} cy={z.at[1] - 120 + dy} rx={r} ry={r * 0.62} fill="#f4f6fa" />)}</g>}
              {(!zone || zone.id === z.id) && <g transform={`translate(${z.at[0]},${z.at[1] - 300})`}>
                <rect x={-150} y={-40} width={300} height={70} rx={35} fill={locked ? '#9aa3b0' : '#fffaf0'} stroke={locked ? '#7d8592' : '#e0c58a'} strokeWidth={5} />
                <text x={0} y={8} textAnchor="middle" fontSize="38" fontWeight="700" fill={locked ? '#fff' : '#6b4a2a'}>{locked ? `☁️ ${z.name}` : z.name}</text>
              </g>}
            </g>
          );
        })}
        <g pointerEvents="none">
          {[0, 1, 2, 3].map(i => (
            <g key={i}><animateTransform attributeName="transform" type="translate" from="-600,0" to={`${W + 600},0`} dur={`${80 + i * 25}s`} begin={`${-i * 22}s`} repeatCount="indefinite" />
              <g transform={`translate(0,${300 + i * 600})`} opacity="0.9"><ellipse rx="140" ry="50" fill="#fff" /><circle cx="-55" cy="-25" r="55" fill="#fff" /><circle cx="40" cy="-38" r="66" fill="#fff" /></g>
            </g>
          ))}
        </g>
      </svg>
      <div className="im-bubble"><span>🦉 小诺</span><p key={say}>{say}</p></div>
      {zone && <button className="im-back pf-btn" onClick={backToIsland}>🏝️ 看整座岛</button>}
      {cardNode && cardSt && (
        <div className="im-card">
          <span className="pf-big">{cardSt === 'lock' ? '🔒' : cardNode.icon}</span>
          <div>
            <b>{cardNode.name}</b>
            <small>{cardNode.goal}</small>
            <small className="im-age">{AGES.find(a => a.id === cardNode.age)?.name}</small>
          </div>
          <div className="im-card-btns">
            {cardSt !== 'lock' && <button className="pf-cta" onClick={() => { stopSpeaking(); onPlay(cardNode.id); }}>{cardSt === 'done' ? '🔁 再玩一次' : '▶ 开始玩'}</button>}
            <button className="pf-btn" onClick={() => onDetail(cardNode.id)}>说明</button>
          </div>
        </div>
      )}
    </div>
  );
}
