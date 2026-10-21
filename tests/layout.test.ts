import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NODES } from '../shared/platform.ts';

const L = JSON.parse(readFileSync(new URL('../src/demo/numberLayout.json', import.meta.url), 'utf8'));
const props = readFileSync(new URL('../art/blender/number_props.py', import.meta.url), 'utf8');

test('数字岛布局：地图上的关卡和“数与形状”区域的关卡一一对应', () => {
  const ids = NODES.filter(n => n.a === 'num').map(n => n.id).sort();
  assert.deepEqual(Object.keys(L.spots).sort(), ids);
  for (const [x, y] of Object.values(L.spots) as [number, number][]) {
    assert.ok(x > 0 && x < L.world.w && y > 0 && y < L.world.h, '关卡点在地图里');
  }
});
test('数字岛布局：每个物件在 Blender 脚本里都有对应的素材', () => {
  for (const p of L.props) {
    const base = p.id.replace(/\d+$/, '');
    const ok = props.includes(`'${p.id}'`) || props.includes(`f'${base}{n}`) || (p.id === 'clocktower' && props.includes("'clocktower_stopped'"));
    assert.ok(ok, `素材 ${p.id} 没有对应的渲染`);
  }
});
