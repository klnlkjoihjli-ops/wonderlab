import { ART_SCALE, LAYOUT, SpriteImg, type Art, type Sprite } from './MapArt';

// 让地图“活”起来的东西：海浪、瀑布、风车、灯塔的光、热气球、帆船、云和云影、小鸟、蝴蝶、下一关的光柱。
// 都用 SVG 自带的动画（SMIL），iPad 的 Safari 支持，不用每一帧跑代码，省电。

type Pt = [number, number];
const W = LAYOUT.world.w, H = LAYOUT.world.h;
const rnd = (i: number) => ((Math.sin(i * 127.1) * 43758.5453) % 1 + 1) % 1;

/** 素材上标记点（比如风车轴心）在地图上的位置 */
export function markOn(s: Sprite | undefined, at: Pt, name: string): Pt {
  const p = (s as Sprite & { pts?: Record<string, Pt> })?.pts?.[name];
  if (!s || !p) return at;
  return [at[0] + (p[0] - s.ax) * ART_SCALE, at[1] + (p[1] - s.ay) * ART_SCALE];
}

/** 海浪：一道道白色的浪花慢慢漂 */
export function Waves() {
  const items = Array.from({ length: 40 }, (_, i) => {
    let x = rnd(i) * (W + 400) - 200, y = rnd(i + 99) * (H + 300) - 150;
    const I = LAYOUT.island, dx = (x - I.cx) / I.rx, dy = (y - I.cy) / I.ry;
    if (dx * dx + dy * dy < 1.15) { x = x < I.cx ? x - I.rx * 0.5 : x + I.rx * 0.5; y = y < I.cy ? Math.min(y, 120) : Math.max(y, H - 80); }
    return { x, y, d: 5 + rnd(i + 7) * 5, k: i };
  });
  return (
    <g className="waves fx">
      {items.map(w => (
        <path key={w.k} d={`M${w.x},${w.y} q16,-10 32,0 q16,10 32,0`}>
          <animateTransform attributeName="transform" type="translate" values={`0,0; 26,4; 0,0`} dur={`${w.d}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;0.8;0" dur={`${w.d}s`} repeatCount="indefinite" />
        </path>
      ))}
    </g>
  );
}

/** 瀑布：从山上落下来的白色水流 + 底下的水花 */
export function Waterfall() {
  const [x, y] = LAYOUT.waterfall as Pt;
  return (
    <g className="fx" pointerEvents="none">
      {[-14, 0, 14].map((dx, i) => (
        <line key={i} x1={x + dx} y1={y - 70} x2={x + dx} y2={y + 30} stroke="#ffffff" strokeWidth={6} strokeLinecap="round" strokeDasharray="14 18" opacity={0.85}>
          <animate attributeName="stroke-dashoffset" from="0" to="-64" dur={`${0.7 + i * 0.15}s`} repeatCount="indefinite" />
        </line>
      ))}
      {[0, 1, 2].map(i => (
        <circle key={i} cx={x - 20 + i * 20} cy={y + 34} r={8} fill="#ffffff" opacity={0.7}>
          <animate attributeName="r" values="4;12;4" dur={`${1 + i * 0.3}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </g>
  );
}

/** 风车：塔身 + 一直在转的叶片（点一下转得更快） */
export function Windmill({ A, at, fast, onTap }: { A: Art; at: Pt; fast: boolean; onTap: () => void }) {
  const body = A.props.windmill, blades = A.props.windmill_blades;
  const hub = markOn(body, at, 'hub');
  return (
    <g className="tappable" onClick={onTap}>
      <SpriteImg s={body} dir="number" x={at[0]} y={at[1]} />
      <g transform={`translate(${hub[0]},${hub[1]})`}>
        <g>
          <animateTransform key={fast ? 'f' : 's'} attributeName="transform" type="rotate" from="0" to="360" dur={fast ? '1.4s' : '7s'} repeatCount="indefinite" />
          <SpriteImg s={blades} dir="number" x={0} y={0} />
        </g>
      </g>
    </g>
  );
}

/** 灯塔顶上一闪一闪的光 */
export function LighthouseGlow({ A, at }: { A: Art; at: Pt }) {
  const [x, y] = markOn(A.props.lighthouse, at, 'lamp');
  return (
    <g pointerEvents="none" className="fx">
      <circle cx={x} cy={y} r={46} fill="url(#lampGlow)">
        <animate attributeName="opacity" values="0.25;1;0.25" dur="2.4s" repeatCount="indefinite" />
      </circle>
      <path d={`M${x},${y} L${x + 260},${y - 40} L${x + 260},${y + 40} Z`} fill="url(#beam)" opacity={0.5}>
        <animateTransform attributeName="transform" type="rotate" values={`-25 ${x} ${y}; 25 ${x} ${y}; -25 ${x} ${y}`} dur="6s" repeatCount="indefinite" />
      </path>
    </g>
  );
}

/** 热气球：在岛的上空慢慢飘，地上跟着一个影子 */
export function Balloon({ A }: { A: Art }) {
  const s = A.props.balloon;
  if (!s) return null;
  const path = 'M2600,980 C2900,820 3200,1000 3000,1250 C2800,1450 2400,1300 2600,980 Z';
  return (
    <g pointerEvents="none">
      <ellipse rx={46} ry={14} fill="#000" opacity={0.12}>
        <animateMotion dur="60s" repeatCount="indefinite" path={path} />
      </ellipse>
      <g>
        <animateMotion dur="60s" repeatCount="indefinite" path={path} />
        <g>
          <animateTransform attributeName="transform" type="translate" values="0,-260; 0,-280; 0,-260" dur="5s" repeatCount="indefinite" />
          <SpriteImg s={s} dir="number" x={0} y={0} />
        </g>
      </g>
    </g>
  );
}

/** 帆船：在海上轻轻晃 */
export function Boats({ A }: { A: Art }) {
  return (
    <g pointerEvents="none">
      {(LAYOUT.boats as Pt[]).map(([x, y], i) => (
        <g key={i} transform={`translate(${x},${y})`}>
          <g>
            <animateTransform attributeName="transform" type="rotate" values="-4;4;-4" dur={`${3.5 + i}s`} repeatCount="indefinite" />
            <SpriteImg s={A.props.boat} dir="number" x={0} y={0} flip={i % 2 === 1} />
          </g>
        </g>
      ))}
    </g>
  );
}

/** 云和云影：从左往右慢慢飘过整座岛 */
export function Clouds() {
  return (
    <g pointerEvents="none">
      {Array.from({ length: 6 }, (_, i) => {
        const y = 200 + i * 380 + rnd(i + 3) * 120, dur = 70 + rnd(i) * 50, s = 0.9 + rnd(i + 5) * 0.8, begin = -rnd(i + 11) * dur;
        return (
          <g key={i}>
            <animateTransform attributeName="transform" type="translate" from={`-500,0`} to={`${W + 500},0`} dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" />
            <ellipse cx={60} cy={y + 260} rx={150 * s} ry={50 * s} fill="#1a3a20" opacity={0.08} />
            <g transform={`translate(0,${y}) scale(${s})`} opacity={0.95}>
              <ellipse cx={0} cy={0} rx={110} ry={44} fill="#fff" /><circle cx={-46} cy={-20} r={46} fill="#fff" /><circle cx={34} cy={-32} r={56} fill="#fff" /><circle cx={84} cy={-6} r={36} fill="#fff" />
            </g>
          </g>
        );
      })}
    </g>
  );
}

/** 小鸟：一群小鸟飞过，翅膀一扇一扇 */
export function Birds() {
  return (
    <g pointerEvents="none" className="fx">
      {Array.from({ length: 3 }, (_, f) => (
        <g key={f}>
          <animateTransform attributeName="transform" type="translate" from={`-300,${300 + f * 600}`} to={`${W + 300},${100 + f * 500}`} dur={`${38 + f * 9}s`} begin={`${-f * 13}s`} repeatCount="indefinite" />
          {Array.from({ length: 4 }, (_, k) => (
            <path key={k} transform={`translate(${-k * 40 + (k % 2) * 12},${(k % 2) * 26})`} fill="none" stroke="#3a4a5a" strokeWidth={4} strokeLinecap="round" d="M-14,0 Q-7,-8 0,0 Q7,-8 14,0">
              <animate attributeName="d" values="M-14,0 Q-7,-8 0,0 Q7,-8 14,0; M-14,-4 Q-7,4 0,0 Q7,4 14,-4; M-14,0 Q-7,-8 0,0 Q7,-8 14,0" dur={`${0.5 + k * 0.07}s`} repeatCount="indefinite" />
            </path>
          ))}
        </g>
      ))}
    </g>
  );
}

/** 花园里的蝴蝶 */
export function Butterflies() {
  const [gx, gy] = LAYOUT.garden as Pt;
  return (
    <g pointerEvents="none">
      {['#ff8fb0', '#ffcf4a', '#b48cff'].map((c, i) => (
        <g key={i}>
          <animateMotion dur={`${7 + i * 2}s`} repeatCount="indefinite" path={`M${gx - 60 + i * 40},${gy - 40} c40,-40 80,30 40,50 c-40,20 -90,-10 -40,-50 z`} />
          <g>
            <animateTransform attributeName="transform" type="scale" values="1,1; 0.3,1; 1,1" dur="0.35s" repeatCount="indefinite" />
            <ellipse cx={-7} cy={0} rx={8} ry={6} fill={c} /><ellipse cx={7} cy={0} rx={8} ry={6} fill={c} />
          </g>
        </g>
      ))}
    </g>
  );
}

/** 下一关的光柱：一道从地面升起的光，加上往上飘的小星星 */
export function Beacon({ at }: { at: Pt }) {
  const [x, y] = at;
  return (
    <g pointerEvents="none">
      <rect x={x - 34} y={y - 420} width={68} height={420} fill="url(#beaconGrad)" opacity={0.55}>
        <animate attributeName="opacity" values="0.35;0.7;0.35" dur="2s" repeatCount="indefinite" />
      </rect>
      {[0, 1, 2, 3, 4].map(i => (
        <path key={i} d="M0,-9 L2.5,-2.5 L9,0 L2.5,2.5 L0,9 L-2.5,2.5 L-9,0 L-2.5,-2.5 Z" fill="#fff6b0">
          <animateMotion dur={`${2.2 + i * 0.35}s`} begin={`${-i * 0.5}s`} repeatCount="indefinite" path={`M${x - 24 + i * 12},${y - 10} L${x - 30 + i * 15},${y - 320}`} />
          <animate attributeName="opacity" values="0;1;0" dur={`${2.2 + i * 0.35}s`} begin={`${-i * 0.5}s`} repeatCount="indefinite" />
        </path>
      ))}
    </g>
  );
}

/** 共用的渐变 */
export function FxDefs() {
  return (
    <defs>
      <radialGradient id="lampGlow"><stop offset="0%" stopColor="#fff6c0" stopOpacity="1" /><stop offset="100%" stopColor="#ffd86a" stopOpacity="0" /></radialGradient>
      <linearGradient id="beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#fff6c0" stopOpacity="0.9" /><stop offset="100%" stopColor="#fff6c0" stopOpacity="0" /></linearGradient>
      <linearGradient id="beaconGrad" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor="#fff3a0" stopOpacity="0.95" /><stop offset="100%" stopColor="#fff3a0" stopOpacity="0" /></linearGradient>
    </defs>
  );
}
