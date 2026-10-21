import { z } from 'zod';
import { levelOf, type Level } from './lab.ts';

// 搭桥工坊：用零件自由搭桥。刻意简化的结构规则（侧面看的二维格子），只用于让孩子比较，不是真实力学计算。
//
//  格子：小溪上方 8 列（0..7），两岸各 2 列路面（-2,-1 和 8,9）。
//  石块：放在小溪上方，从河底往上叠，叠满 2 块才够到桥面；木桩：一根就等于叠满的石墩。
//  木板：铺在桥面那一层，短 2 格 / 中 3 格 / 长 5 格。两块木板可以在端头共用一格（一起搭在同一个桥墩上）。
//  支撑点：两岸路面 + 叠满的石墩 + 木桩。每块木板的两头都要落在支撑点上。
//  弯曲：sag = 载重 × (相邻支撑点之间的最大格数)³ ÷ 30，按 lab 的绿/黄/红三档判断。
//    隔一格一个桥墩：最多扛 2 个礼物盒；隔两格：只放邀请卡会晃但能过；隔三格以上：过不去。

export const GAP_COLS = 8;
export const MIN_COL = -2, MAX_COL = 9;
export const PILLAR_STONES = 2;
export const MAX_PARTS = 40;

export const partKindSchema = z.enum(['stone', 'post', 'short', 'medium', 'long']);
export type PartKind = z.infer<typeof partKindSchema>;
export const PLANK_LEN = { short: 2, medium: 3, long: 5 } as const;
export type PlankKind = keyof typeof PLANK_LEN;
export const isPlank = (k: PartKind): k is PlankKind => k in PLANK_LEN;

export const PART_NAMES: Record<PartKind, string> = { stone: '石块', post: '木桩', short: '短木板', medium: '中木板', long: '长木板' };

export const partSchema = z.object({ id: z.string().min(1).max(20), kind: partKindSchema, col: z.number().int().min(MIN_COL).max(MAX_COL) }).strict();
export type Part = z.infer<typeof partSchema>;
export const buildSchema = z.object({ parts: z.array(partSchema).max(MAX_PARTS), boxes: z.number().int().min(0).max(4) }).strict();
export type Build = z.infer<typeof buildSchema>;
export const EMPTY_BUILD: Build = { parts: [], boxes: 0 };

const inGap = (c: number) => c >= 0 && c < GAP_COLS;
export const plankCells = (p: Part) => (isPlank(p.kind) ? { a: p.col, b: p.col + PLANK_LEN[p.kind] - 1 } : { a: p.col, b: p.col });
export const stonesAt = (b: Build, col: number) => b.parts.filter(p => p.kind === 'stone' && p.col === col).length;
export const postAt = (b: Build, col: number) => b.parts.some(p => p.kind === 'post' && p.col === col);

export function supportCols(b: Build): Set<number> {
  const s = new Set<number>();
  for (let c = MIN_COL; c <= MAX_COL; c++) if (!inGap(c) || postAt(b, c) || stonesAt(b, c) >= PILLAR_STONES) s.add(c);
  return s;
}

/** 某个零件能不能放在这一列（木板的 col 是最左边那一格） */
export function canPlace(b: Build, kind: PartKind, col: number): boolean {
  if (b.parts.length >= MAX_PARTS) return false;
  if (kind === 'stone') return inGap(col) && !postAt(b, col) && stonesAt(b, col) < PILLAR_STONES;
  if (kind === 'post') return inGap(col) && !postAt(b, col) && stonesAt(b, col) === 0;
  const a = col, z = col + PLANK_LEN[kind] - 1;
  if (a < MIN_COL || z > MAX_COL) return false;
  // 必须碰到小溪（全放在岸上没有意义）
  if (z < 0 || a > GAP_COLS - 1) return false;
  for (const p of b.parts) {
    if (!isPlank(p.kind)) continue;
    const q = plankCells(p);
    const lo = Math.max(a, q.a), hi = Math.min(z, q.b);
    if (lo > hi) continue;                          // 不重叠
    // 只允许端头对端头共用一格
    if (lo !== hi) return false;
    const sharedIsEndOfNew = lo === a || lo === z, sharedIsEndOfOld = lo === q.a || lo === q.b;
    if (!sharedIsEndOfNew || !sharedIsEndOfOld) return false;
  }
  return true;
}

let seq = 0;
export function newId(kind: PartKind) { seq = (seq + 1) % 100000; return `${kind[0]}${Date.now().toString(36).slice(-5)}${seq}`; }

export function addPart(b: Build, kind: PartKind, col: number, id = newId(kind)): Build {
  return canPlace(b, kind, col) ? { ...b, parts: [...b.parts, { id, kind, col }] } : b;
}

/** 拿走一个零件。石墩只能先拿最上面那块（列里最后放的石块） */
export function removePart(b: Build, id: string): Build {
  const p = b.parts.find(x => x.id === id);
  if (!p) return b;
  let target = p;
  if (p.kind === 'stone') target = [...b.parts].reverse().find(x => x.kind === 'stone' && x.col === p.col)!;
  return { ...b, parts: b.parts.filter(x => x !== target) };
}

export type PlankState = { id: string; status: 'ok' | 'tip' | 'fall'; freeEnd: 'a' | 'b' | 'both' | null; span: number; sag: number; level: Level | null; supports: number[] };
export type BuildReason = 'gap' | 'tip' | 'fall' | 'sag' | 'success';
export type BuildResult = {
  ok: boolean; reason: BuildReason; level: Level | null;
  col: number | null;          // 出问题的那一格（小车停在它前面）
  partId: string | null;       // 出问题的零件
  low: boolean;                // 悬空的一头下面有石块但没叠够高
  planks: PlankState[];
  observe: string;
};

export const loadOfBuild = (b: Build) => 1 + b.boxes;

export function analyzePlanks(b: Build): PlankState[] {
  const S = supportCols(b), load = loadOfBuild(b);
  return b.parts.filter(p => isPlank(p.kind)).map(p => {
    const { a, b: z } = plankCells(p);
    const sa = S.has(a), sz = S.has(z);
    const supports: number[] = [];
    for (let c = a; c <= z; c++) if (S.has(c)) supports.push(c);
    if (!sa || !sz) return { id: p.id, status: sa || sz ? 'tip' : 'fall', freeEnd: !sa && !sz ? 'both' : !sa ? 'a' : 'b', span: 0, sag: 0, level: null, supports };
    let span = 0;
    for (let i = 1; i < supports.length; i++) span = Math.max(span, supports[i] - supports[i - 1]);
    const sag = Math.round(load * span ** 3 / 30 * 1000) / 1000;
    return { id: p.id, status: 'ok', freeEnd: null, span, sag, level: levelOf(sag), supports };
  });
}

/** 小车从左岸开到右岸，遇到的第一个问题就是结果 */
export function evaluateBuild(b: Build): BuildResult {
  const planks = analyzePlanks(b);
  const byId = new Map(planks.map(p => [p.id, p]));
  const plankParts = b.parts.filter(p => isPlank(p.kind));
  let worst: Level = 'green';
  for (let c = 0; c < GAP_COLS; c++) {
    const covering = plankParts.filter(p => { const r = plankCells(p); return r.a <= c && c <= r.b; });
    if (!covering.length) return { ok: false, reason: 'gap', level: null, col: c, partId: null, low: false, planks, observe: '桥面在这里断开了，小车开不过去。' };
    // 共用一格时，先看小车即将开上去的那块（左端在这里的）
    const ordered = [...covering].sort((x, y) => plankCells(y).a - plankCells(x).a);
    for (const p of ordered) {
      const st = byId.get(p.id)!;
      if (st.status === 'fall') return { ok: false, reason: 'fall', level: null, col: c, partId: p.id, low: lowUnder(b, p, 'both'), planks, observe: '这块木板两头都悬空，一下子掉进小溪了。' };
      if (st.status === 'tip') {
        const low = lowUnder(b, p, st.freeEnd!);
        return { ok: false, reason: 'tip', level: null, col: c, partId: p.id, low, planks, observe: low ? '石墩还不够高，木板碰不到它，一压就翘起来了。' : '这块木板有一头没有搭在东西上，一压就翘起来了。' };
      }
      if (st.level === 'red') return { ok: false, reason: 'sag', level: 'red', col: c, partId: p.id, low: false, planks, observe: '这块木板中间没有东西托着，太长了，被压弯了。' };
      if (st.level === 'yellow') worst = 'yellow';
    }
  }
  return { ok: true, reason: 'success', level: worst, col: null, partId: null, low: false, planks, observe: worst === 'green' ? '桥稳稳的，小车开过去啦！' : '桥有点晃，小车还是开过去了！' };
}

function lowUnder(b: Build, p: Part, end: 'a' | 'b' | 'both') {
  const { a, b: z } = plankCells(p);
  const cols = end === 'both' ? [a, z] : [end === 'a' ? a : z];
  return cols.some(c => inGap(c) && stonesAt(b, c) > 0 && stonesAt(b, c) < PILLAR_STONES);
}

/** 用孩子能懂的话描述现在的桥（给小诺和家长记录用） */
export function describeBuild(b: Build): string {
  const count = (k: PartKind) => b.parts.filter(p => p.kind === k).length;
  const piers = [...supportCols(b)].filter(inGap).length;
  const items = (['short', 'medium', 'long', 'post', 'stone'] as PartKind[]).filter(k => count(k)).map(k => `${count(k)}个${PART_NAMES[k]}`);
  return items.length ? `${items.join('、')}（够高的桥墩 ${piers} 个），车上${b.boxes}个礼物盒` : '还什么都没搭';
}

/** 小诺的基础提示：只说一个观察点或一个可以试的办法，不替孩子搭 */
export function buildHint(r: BuildResult, b: Build): string {
  if (!b.parts.length) return '从零件箱里拖一块木板到小溪上试试。木板两头要搭在岸上或者桥墩上哦。';
  switch (r.reason) {
    case 'gap': return '看看桥面哪里断开了，找一块木板把它连起来。';
    case 'tip': return r.low ? '石墩还差一块就够高了，再叠一块石头试试。' : '这块木板有一头悬空。在那头下面立个木桩，或者叠两块石头吧。';
    case 'fall': return '这块木板两头都没有搭住。先在它两头下面搭好桥墩。';
    case 'sag': return '这块木板太长了，中间没东西托着。在它中间加一个桥墩试试。';
    default: return b.boxes < 4 ? '桥能用了！试试多放一个礼物盒，桥还撑得住吗？' : '桥真结实！你也可以拆掉一个桥墩，看看会怎么样。';
  }
}
