import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_BINS, SORT_LEVELS, isDone, leftCount, place } from '../shared/modules/sort.ts';
import { node } from '../shared/platform.ts';
import { PLAYS } from '../shared/games.ts';

test('分一分：每关都是“分一分”玩法的关，筐数不超过这个年龄的上限，东西都有对应的筐', () => {
  for (const [id, lv] of Object.entries(SORT_LEVELS)) {
    assert.equal(PLAYS[id][0], 'sort', `${id} 不是分一分的关`);
    const age = node(id).age!;
    assert.ok(lv.bins.length <= MAX_BINS[age], `${id} 筐太多（${age} 最多 ${MAX_BINS[age]} 个）`);
    for (const b of lv.bins) assert.ok(lv.items.some(i => i.bin === b.id), `${id} 的筐 ${b.name} 是空的`);
    for (const i of lv.items) assert.ok(lv.bins.some(b => b.id === i.bin), `${id} 的 ${i.name} 没有筐`);
    assert.equal(new Set(lv.items.map(i => i.id)).size, lv.items.length);
  }
});
test('分一分：放对留下、放错弹回、全部放好才完成', () => {
  const lv = SORT_LEVELS.l3;
  let r = place(lv, {}, 'sky0', 'water');
  assert.equal(r.ok, false); assert.deepEqual(r.placed, {}); assert.match(r.say, /不太一样/);
  r = place(lv, {}, 'sky0', 'sky');
  assert.equal(r.ok, true); assert.equal(r.placed.sky0, 'sky'); assert.equal(r.done, false);
  assert.equal(leftCount(lv, r.placed), lv.items.length - 1);
  let placed = r.placed;
  for (const i of lv.items) placed = place(lv, placed, i.id, i.bin).placed;
  assert.ok(isDone(lv, placed));
  assert.equal(place(lv, placed, 'sky0', 'sky').say, '小鸟已经放好啦。');
  assert.equal(place(lv, {}, 'nope', 'sky').ok, false);
});
