import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NODES } from '../shared/platform.ts';

const L = JSON.parse(readFileSync(new URL('../src/demo/numberLayout.json', import.meta.url), 'utf8'));
const props = readFileSync(new URL('../art/blender/number_props.py', import.meta.url), 'utf8') + readFileSync(new URL('../art/blender/landmarks.py', import.meta.url), 'utf8');

test('数字岛布局：地图上的每个关卡点都是数字岛（数学）的关卡', () => {
  // 目录按年龄扩充后，数字岛的关卡比地图上的 10 个点多；地图等目录定下来再重画
  for (const id of Object.keys(L.spots)) assert.equal(NODES.find(n => n.id === id)?.d, 'math', `${id} 不是数学关卡`);
  for (const [x, y] of Object.values(L.spots) as [number, number][]) {
    assert.ok(x > 0 && x < L.world.w && y > 0 && y < L.world.h, '关卡点在地图里');
  }
});
test('数字岛布局：每个物件在 Blender 脚本里都有对应的素材', () => {
  for (const p of L.props) {
    const base = p.id.replace(/\d+$/, '');
    const ok = props.includes(`'${p.id}'`) || props.includes(`f'${base}{n}`) || (p.id === 'clocktower' && props.includes("'clocktower_stopped'")) || (p.id === 'windmill' && props.includes("'windmill_blades'"));
    assert.ok(ok, `素材 ${p.id} 没有对应的渲染`);
  }
});
test('数字岛布局：关卡、小人上岸点都在岛上，关卡之间不挤在一起', () => {
  const I = L.island, inIsland = ([x, y]: number[]) => ((x - I.cx) / I.rx) ** 2 + ((y - I.cy) / I.ry) ** 2 < 1.05;
  const pts = Object.values(L.spots) as number[][];
  for (const p of [...pts, L.gate]) assert.ok(inIsland(p), `${p} 不在岛上`);
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) assert.ok(Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) > 200, '关卡太挤');
});
