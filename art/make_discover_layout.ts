// 生成发现岛的布局表 src/proto/discoverLayout.json（地图像素坐标，60 像素/米）。
// 四个区域各有一栋建筑、一个角色和一条弯弯的小路；关卡点按顺序沿小路均匀排开。
// 关卡从 shared/platform.ts 读：每个区域里到“幼小衔接”为止的关（1～2 年级的关以后再加点）。
// 运行：npx tsx art/make_discover_layout.ts
import { writeFileSync } from 'node:fs';
import { NODES, ageIndex, type AreaId } from '../shared/platform.ts';

type P = [number, number];
const W = 4000, H = 2800;
const island = { cx: 2000, cy: 1420, rx: 1820, ry: 1180, seed: 23 };
const dock: P = [2000, 2600], gate: P = [2000, 2520], plaza: P = [2000, 1600];

/** 每个区域：建筑放哪、角色站哪、小路从广场往外怎么弯 */
const ZONES: { a: AreaId; name: string; prop: string; npc: string; at: P; npcAt: P; path: P[] }[] = [
  { a: 'color', name: '彩虹实验室', prop: 'lab', npc: 'chameleon_idle', at: [930, 720], npcAt: [1130, 880],
    path: [[1880, 1520], [1650, 1450], [1450, 1300], [1600, 1150], [1400, 1000], [1150, 1050], [1020, 930]] },
  { a: 'move', name: '小车工坊', prop: 'workshop', npc: 'beaver_idle', at: [620, 1760], npcAt: [800, 1720],
    path: [[1870, 1680], [1650, 1800], [1420, 1720], [1250, 1900], [1450, 2080], [1200, 2200], [950, 2100], [860, 1920]] },
  { a: 'life', name: '小农场', prop: 'barn', npc: 'hedgehog_idle', at: [3380, 1760], npcAt: [3200, 1720],
    path: [[2130, 1680], [2350, 1800], [2580, 1720], [2750, 1900], [2550, 2080], [2800, 2200], [3050, 2100], [3140, 1920]] },
  { a: 'sky', name: '星星天文台', prop: 'observatory', npc: 'redpanda_idle', at: [3080, 640], npcAt: [2900, 820],
    path: [[2120, 1520], [2350, 1400], [2550, 1250], [2750, 1100], [2880, 960]] }
];

/** 把折线变成平滑曲线（和 Blender 底图画小路用的一样） */
function catmull(pts: P[], steps = 16): P[] {
  const out: P[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      out.push([0, 1].map(k => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t ** 3)) as P);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
/** 沿平滑后的小路均匀取 n 个点（开头留一段，两头各留半个间距） */
function along(raw: P[], n: number): P[] {
  const path = catmull(raw);
  const seg = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1]));
  const lead = 180;                                   // 离广场太近的一段不放关卡点，免得四条路的第一关挤在一起
  const total = seg.reduce((s, x) => s + x, 0), step = (total - lead) / n, out: P[] = [];
  for (let k = 0; k < n; k++) {
    let d = lead + step * (k + 0.5), i = 0;
    while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
    const t = Math.min(1, d / seg[i]), a = path[i], b = path[i + 1];
    out.push([Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t)]);
  }
  return out;
}

const zones = ZONES.map(z => {
  const ids = NODES.filter(n => n.a === z.a && ageIndex(n.age!) <= ageIndex('br')).sort((x, y) => x.lv - y.lv).map(n => n.id);
  const pts = along(z.path, ids.length);
  return { id: z.a, name: z.name, prop: z.prop, npc: z.npc, at: z.at, npcAt: z.npcAt, path: z.path, spots: Object.fromEntries(ids.map((id, i) => [id, pts[i]])) };
});

// 树：随机撒，避开小路、建筑、关卡点、池塘和码头
const routes: P[][] = [[gate, [2000, 2150], plaza], ...ZONES.map(z => [plaza, ...z.path])];
const segDist = (x: number, y: number, pts: P[]) => {
  let best = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
};
const pond = { cx: 1080, cy: 1430, rx: 150, ry: 80 };
const garden: P = [3300, 2060];
const blocked: P[] = [plaza, dock, garden, ...zones.flatMap(z => [z.at, z.npcAt, ...Object.values(z.spots)])];
let seed = 31;
const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
const onLand = (x: number, y: number, m = 0.14) => ((x - island.cx) / island.rx) ** 2 + ((y - island.cy) / island.ry) ** 2 < 1 - m;
const trees: { id: string; at: P }[] = [];
for (let k = 0; k < 6000 && trees.length < 60; k++) {
  const x = 250 + rnd() * (W - 500), y = 420 + rnd() * (H - 650);
  if (!onLand(x, y)) continue;
  if (routes.some(r => segDist(x, y, r) < 115)) continue;
  if (blocked.some(([bx, by]) => Math.hypot(x - bx, y - by) < 170)) continue;
  if (zones.some(z => Math.hypot(x - z.at[0], (y - z.at[1]) * 1.3) < 330)) continue;
  if (Math.hypot(x - pond.cx, (y - pond.cy) * 1.6) < 240) continue;
  if (trees.some(t => Math.hypot(x - t.at[0], y - t.at[1]) < 100)) continue;
  const r = rnd();   // 大多是绿树，少量塔形树和橙色秋树点缀
  trees.push({ id: `tree${r < 0.15 ? 2 : r < 0.4 ? 1 : 0}`, at: [Math.round(x), Math.round(y)] });
}

const layout = {
  _说明: '发现岛布局（地图像素坐标，世界 4000×2800，60 像素/米）。Blender 渲染底图、网页摆物件，都读这一份。由 art/make_discover_layout.ts 生成。',
  world: { w: W, h: H, pxPerMeter: 60 }, island, gate, dock, plaza, pond, garden,
  hills: [[700, 430, 300], [1250, 380, 240], [2650, 430, 260], [3150, 470, 330], [3420, 1080, 200], [620, 1220, 190]],
  routes, zones,
  props: [
    { id: 'rainbow', dir: 'number', at: [1300, 760] }, { id: 'sign', dir: 'number', at: [2110, 1700] },
    { id: 'dock', dir: 'number', at: [1960, 2620] }, { id: 'balloon', dir: 'number', at: [2500, 1180], fly: true },
    { id: 'telescope', dir: 'discover', at: [3330, 860] }, { id: 'greenhouse', dir: 'discover', at: [3330, 2090] },
    { id: 'flasks', dir: 'discover', at: [760, 960] }, { id: 'toycar', dir: 'discover', at: [880, 1560] },
    ...trees.map(t => ({ id: t.id, dir: 'number', at: t.at }))
  ],
  boats: [[700, 2450], [3350, 2500]]
};
writeFileSync(new URL('../src/proto/discoverLayout.json', import.meta.url), JSON.stringify(layout, null, 1));
console.log('layout ok', zones.map(z => `${z.name} ${Object.keys(z.spots).length} 关`).join('，'), `树 ${trees.length}`);
