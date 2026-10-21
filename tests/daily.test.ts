import test from 'node:test';
import assert from 'node:assert/strict';
import { ageOf, ageText, dailyThree, reviewPick, reviewQuestion, stageOf, yesterdayDone } from '../shared/daily.ts';
import { NODES } from '../shared/platform.ts';

const at = (y: number, m: number, d: number, h = 18) => new Date(y, m - 1, d, h).toISOString();

test('年龄和阶段：5 岁 8 个月是大班，在幼小衔接期', () => {
  const now = new Date(2026, 9, 21);
  assert.deepEqual(ageOf('2021-02', now), { years: 5, months: 8, total: 68 });
  const s = stageOf('2021-02', now);
  assert.equal(s.name, '大班'); assert.equal(s.bridge, true);
  assert.equal(ageText('2021-02', now), '5 岁 8 个月 · 大班（幼小衔接期）');
  assert.equal(stageOf('2022-03', now).name, '中班');
  assert.equal(stageOf('2020-08', now).name, '一年级');
  assert.equal(stageOf('2024-01', now).tooYoung, true);
});
test('复习：学会后第 1、3、7、14 天到期；昨天学的就是今天要复习的', () => {
  const now = new Date(2026, 9, 21, 9);
  const ev = [{ at: at(2026, 10, 20), type: 'complete', node: 'm1' }, { at: at(2026, 10, 16), type: 'complete', node: 'c1' }];
  assert.equal(reviewPick(ev, now)!.id, 'm1');                      // 1 天前
  assert.equal(reviewPick([ev[1]], now), null);                      // 5 天前：不到期
  assert.equal(reviewPick([{ at: at(2026, 10, 14), type: 'complete', node: 'c1' }], now)!.id, 'c1');   // 7 天前
  assert.deepEqual(yesterdayDone(ev, now).map(n => n.id), ['m1']);
});
test('每天三件事：复习 + 新学（优先探险日的大陆）+ 动手，三件互不重复', () => {
  const tue = new Date(2026, 9, 20, 9);                              // 周二：故事岛
  const fresh = dailyThree({ done: [], events: [] }, tue);
  assert.equal(fresh.review, null);                                  // 第一天没有可复习的
  assert.equal(fresh.learn!.d, 'lang');
  assert.ok(fresh.play && fresh.play.module);
  const p = { done: ['m1'], events: [{ at: at(2026, 10, 19), type: 'complete', node: 'm1' }] };
  const d = dailyThree(p, tue);
  assert.equal(d.review!.id, 'm1');
  const ids = [d.review, d.learn, d.play].filter(Boolean).map(n => n!.id);
  assert.equal(new Set(ids).size, ids.length);
  // 指定复习“数到 20”：动手玩会换成别的
  const forced = dailyThree({ done: [], events: [] }, tue, NODES.find(n => n.id === 'm1')!);
  assert.equal(forced.review!.id, 'm1'); assert.notEqual(forced.play!.id, 'm1'); assert.notEqual(forced.learn!.id, 'm1');
});
test('回顾问题：有专门问题的按关键词判断；没有的说了就夸', () => {
  const m1 = reviewQuestion(NODES.find(n => n.id === 'm1')!);
  assert.equal(m1.check('多了就放回去一朵'), true); assert.equal(m1.check('不知道'), false);
  const c2 = reviewQuestion(NODES.find(n => n.id === 'c2')!);
  assert.equal(c2.check('黄色'), true); assert.equal(c2.check('棕色'), false);
  const any = reviewQuestion(NODES.find(n => n.id === 's1')!);
  assert.match(any.q, /看图说故事/); assert.equal(any.check('我讲了小兔子'), true); assert.equal(any.check(''), false);
});
