import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LIGHT_IDS, MUST_SEE, SPOT_R, START_SPOTS, TORCH_PARTS, clampSpot, currentLightStep, freshLightsProgress, hasWhite, lightsHint, lightsPassed, mixName, mixRgb, visibleMixes,
  type LightId, type Spots
} from '../shared/modules/lights.ts';

const ON = (...ids: LightId[]) => new Set<LightId>(ids);
const ALL = ON('R', 'G', 'B');

test('光的加法混色：红+绿=黄，红+蓝=紫红，绿+蓝=青，三种=白', () => {
  assert.deepEqual(mixRgb(['R', 'G']), [1, 1, 0]); assert.equal(mixName(['R', 'G']), '黄色');
  assert.equal(mixName(['B', 'R']), '紫红色'); assert.equal(mixName(['G', 'B']), '青色');
  assert.deepEqual(mixRgb(['R', 'G', 'B']), [1, 1, 1]); assert.equal(mixName(LIGHT_IDS), '白色');
  assert.equal(mixName([]), '黑黑的'); assert.equal(mixName(['R', 'R']), '红色');
});
test('一开始三个光斑分开，看不到新颜色，也没有白光', () => {
  assert.deepEqual(visibleMixes(ALL, START_SPOTS), []);
  assert.equal(hasWhite(ALL, START_SPOTS), false);
});
test('两个光斑叠够了才算出现新颜色；灯没开不算', () => {
  const s: Spots = { R: { x: 0, y: 1.8 }, G: { x: 1.4 * SPOT_R, y: 1.8 }, B: { x: 3.5, y: 1.8 } };
  assert.deepEqual(visibleMixes(ALL, s), ['GR']);
  assert.deepEqual(visibleMixes(ON('R', 'B'), s), []);                  // 绿灯关着，就没有黄
  s.G.x = 1.7 * SPOT_R;                                                 // 只碰到一点边，不算
  assert.deepEqual(visibleMixes(ALL, s), []);
});
test('三个光斑挤在一起才有白光；只亮两盏不会白', () => {
  const s: Spots = { R: { x: 0, y: 2.2 }, G: { x: -0.4, y: 1.6 }, B: { x: 0.4, y: 1.6 } };
  assert.equal(hasWhite(ALL, s), true);
  assert.deepEqual(visibleMixes(ALL, s).sort(), ['BG', 'BR', 'GR']);
  assert.equal(hasWhite(ON('R', 'G'), s), false);
  const far: Spots = { R: { x: 0, y: 3 }, G: { x: -1.2, y: 1 }, B: { x: 1.2, y: 1 } };
  assert.equal(hasWhite(ALL, far), false);
});
test('光斑不能拖出墙外', () => {
  assert.deepEqual(clampSpot({ x: 99, y: -5 }), { x: 3.5, y: 0.3 });
});
test('四步：拆开看 → 开灯 → 叠出三种新颜色 → 变白才过关', () => {
  const p = freshLightsProgress();
  assert.equal(currentLightStep(p), 'look');
  p.seen = ['lens', 'bulb']; assert.equal(currentLightStep(p), 'look');
  p.seen = [...MUST_SEE]; assert.equal(currentLightStep(p), 'light');
  p.lit = ['R', 'G']; assert.equal(currentLightStep(p), 'light');
  p.lit = ['R', 'G', 'B']; assert.equal(currentLightStep(p), 'mix');
  p.found = ['GR', 'BR']; assert.equal(currentLightStep(p), 'mix');
  p.found = ['GR', 'BR', 'BG']; assert.equal(currentLightStep(p), 'white');
  assert.equal(lightsPassed(p), false);
  p.white = true; assert.equal(lightsPassed(p), true);
});
test('零件讲解齐全；提示一层比一层具体', () => {
  for (const t of TORCH_PARTS) assert.ok(t.name && t.says && t.en);
  const p = freshLightsProgress(); p.seen = [...MUST_SEE]; p.lit = ['R', 'G', 'B'];
  const h = [0, 1, 2].map(l => lightsHint(p, ALL, l));
  assert.equal(new Set(h).size, 3);
  assert.match(lightsHint(p, ON('R'), 0), /绿光/);                     // 灯没开先提醒开灯
});
