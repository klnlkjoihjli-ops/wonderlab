// 探索工作台 · 模块二：光的三原色（颜色与光 → 光的三原色）
// 拆开手电筒 → 打开三盏灯 → 把光斑叠在一起找新颜色 → 三盏叠在一起变白。
// 混出什么颜色、算不算“叠在一起”，全部由这里的规则决定，小诺只负责讲。

export type LightId = 'R' | 'G' | 'B';
export const LIGHT_IDS: LightId[] = ['R', 'G', 'B'];
export const LIGHT: Record<LightId, { name: string; en: string; rgb: [number, number, number] }> = {
  R: { name: '红光', en: 'red', rgb: [1, 0, 0] },
  G: { name: '绿光', en: 'green', rgb: [0, 1, 0] },
  B: { name: '蓝光', en: 'blue', rgb: [0, 0, 1] }
};

/** 光叠在一起：每种颜色分量相加（加法混色），超过 1 就算 1 */
export function mixRgb(on: Iterable<LightId>): [number, number, number] {
  const c: [number, number, number] = [0, 0, 0];
  for (const id of on) LIGHT[id].rgb.forEach((v, i) => { c[i] = Math.min(1, c[i] + v); });
  return c;
}
/** 混出来的颜色叫什么（孩子听得懂的名字） */
export function mixName(on: Iterable<LightId>): string {
  const k = [...new Set(on)].sort().join('');
  return ({ '': '黑黑的', B: '蓝色', G: '绿色', R: '红色', GR: '黄色', BR: '紫红色', BG: '青色', BGR: '白色' } as Record<string, string>)[k];
}

// —— 墙上的光斑 ——
export const SPOT_R = 1;                                 // 光斑半径（墙面坐标）
export const WALL = { w: 7, h: 3.6 };                    // 光斑中心可以拖动的范围：x ∈ [-w/2, w/2]，y ∈ [0, h]
export type Spot = { x: number; y: number };
export type Spots = Record<LightId, Spot>;
/** 一开始三个光斑分开排在墙上 */
export const START_SPOTS: Spots = { R: { x: -2.4, y: 1.8 }, G: { x: 0, y: 1.8 }, B: { x: 2.4, y: 1.8 } };
export const clampSpot = (s: Spot): Spot => ({ x: Math.max(-WALL.w / 2, Math.min(WALL.w / 2, s.x)), y: Math.max(0.3, Math.min(WALL.h, s.y)) });
const dist = (a: Spot, b: Spot) => Math.hypot(a.x - b.x, a.y - b.y);

/** 两个光斑叠得够多：中心距离小于 1.6 个半径（重叠的那一块足够大，孩子一眼能看到新颜色） */
export const PAIR_OVERLAP = 1.6;
/** 三个光斑有一块共同的地方：三个中心的重心离每个中心都不超过 0.8 个半径 */
export const TRIPLE_OVERLAP = 0.8;

export type Mix = 'GR' | 'BR' | 'BG';                    // 黄、紫红、青
export const MIXES: { id: Mix; a: LightId; b: LightId; name: string; css: string }[] = [
  { id: 'GR', a: 'R', b: 'G', name: '黄色', css: '#ffe600' },
  { id: 'BR', a: 'R', b: 'B', name: '紫红色', css: '#ff2bd6' },
  { id: 'BG', a: 'G', b: 'B', name: '青色', css: '#18e6ff' }
];
/** 现在墙上能看到哪些“两盏叠出来的”新颜色 */
export function visibleMixes(on: ReadonlySet<LightId>, spots: Spots): Mix[] {
  return MIXES.filter(m => on.has(m.a) && on.has(m.b) && dist(spots[m.a], spots[m.b]) < PAIR_OVERLAP * SPOT_R).map(m => m.id);
}
/** 墙上有没有白色：三盏都亮，而且有一块三个光斑都照到的地方 */
export function hasWhite(on: ReadonlySet<LightId>, spots: Spots): boolean {
  if (!LIGHT_IDS.every(id => on.has(id))) return false;
  const c = { x: (spots.R.x + spots.G.x + spots.B.x) / 3, y: (spots.R.y + spots.G.y + spots.B.y) / 3 };
  return LIGHT_IDS.every(id => dist(spots[id], c) <= TRIPLE_OVERLAP * SPOT_R);
}

// —— 手电筒拆开看 ——
export type TorchPartId = 'cap' | 'lens' | 'bulb' | 'battery' | 'body';
export const TORCH_PARTS: { id: TorchPartId; name: string; en: string; says: string }[] = [
  { id: 'lens', name: '彩色玻璃片', en: 'filter', says: '这是一片红色的玻璃片。灯泡的光是白的，穿过它就只剩下红光了。颜色就是它变出来的！' },
  { id: 'bulb', name: '小灯泡', en: 'bulb', says: '这是小灯泡，通上电它就会发出白白的光。' },
  { id: 'battery', name: '电池', en: 'battery', says: '这是电池，它给小灯泡送电。' },
  { id: 'cap', name: '灯头盖', en: 'cap', says: '这是灯头盖，把玻璃片和灯泡固定在前面。' },
  { id: 'body', name: '筒身', en: 'body', says: '这是手电筒的筒身，电池就装在里面，手握着它。' }
];
/** 认识到这几样就可以往下走：最重要的是彩色玻璃片和灯泡 */
export const MUST_SEE: TorchPartId[] = ['lens', 'bulb', 'battery'];

// —— 进度 ——
export type LightStep = 'look' | 'light' | 'mix' | 'white';
export const LIGHT_STEPS: { id: LightStep; title: string }[] = [
  { id: 'look', title: '拆开手电筒' }, { id: 'light', title: '打开三盏灯' }, { id: 'mix', title: '叠出新颜色' }, { id: 'white', title: '变出白光' }
];
export type Guess = 'brown' | 'yellow' | 'black';
export const GUESSES: { id: Guess; name: string; css: string }[] = [
  { id: 'brown', name: '棕色', css: '#8a5a2b' }, { id: 'yellow', name: '黄色', css: '#ffe600' }, { id: 'black', name: '黑色', css: '#222' }
];
export type LightsProgress = {
  seen: TorchPartId[];          // 拆开后点过的零件
  lit: LightId[];               // 打开过的灯（每盏开过一次就算）
  guess: Guess | null;          // 叠之前猜的颜色
  found: Mix[];                 // 找到过的新颜色
  white: boolean;               // 变出过白光
};
export const freshLightsProgress = (): LightsProgress => ({ seen: [], lit: [], guess: null, found: [], white: false });

export function currentLightStep(p: LightsProgress): LightStep {
  if (!MUST_SEE.every(id => p.seen.includes(id))) return 'look';
  if (!LIGHT_IDS.every(id => p.lit.includes(id))) return 'light';
  if (MIXES.some(m => !p.found.includes(m.id))) return 'mix';
  return 'white';
}
export const lightsPassed = (p: LightsProgress) => currentLightStep(p) === 'white' && p.white;

/** 小诺的三层提示：先问、再提醒、最后直接说怎么做 */
export function lightsHint(p: LightsProgress, on: ReadonlySet<LightId>, level: number): string {
  const s = currentLightStep(p);
  if (s === 'look') {
    const miss = MUST_SEE.find(id => !p.seen.includes(id))!, part = TORCH_PARTS.find(x => x.id === miss)!;
    return level === 0 ? '手电筒为什么会发出红光呢？把它拆开找一找。' : level === 1 ? `还有「${part.name}」没看过，点点散开的零件。` : `点一下「${part.name}」，听听它是做什么的。`;
  }
  if (s === 'light') {
    const miss = LIGHT_IDS.filter(id => !p.lit.includes(id)).map(id => LIGHT[id].name);
    return level === 0 ? '房间好黑呀，怎么让墙上亮起来？' : `点一下手电筒就能打开。还没打开：${miss.join('、')}。`;
  }
  if (s === 'mix') {
    const m = MIXES.find(x => !p.found.includes(x.id))!;
    if (!on.has(m.a) || !on.has(m.b)) return `先把${LIGHT[m.a].name}和${LIGHT[m.b].name}的手电筒都打开。`;
    return level === 0 ? '两个光斑碰到一起，会发生什么呢？' : level === 1 ? `用手指拖着${LIGHT[m.a].name}的光斑，慢慢靠近${LIGHT[m.b].name}。` : `把${LIGHT[m.a].name}的光斑拖到${LIGHT[m.b].name}上面，叠住一大半。`;
  }
  const off = LIGHT_IDS.filter(id => !on.has(id));
  if (off.length) return `三盏灯都要打开，还差${off.map(id => LIGHT[id].name).join('、')}。`;
  return level === 0 ? '三种光全叠在一起，会是什么颜色？' : level === 1 ? '把三个光斑都拖到墙的中间，挤在一起。' : '三个光斑叠得越紧，中间越白。再往一起挪一挪！';
}
