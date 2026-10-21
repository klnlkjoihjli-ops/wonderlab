import test from 'node:test';
import assert from 'node:assert/strict';
import { CROSS, DOMAINS, NODES, award, badges, baseWeek, completeNode, freshPlatform, kidComplete, newlyOpened, nodeState, pickFocus, platformSchema, prereqs, rollover, screenLeftMin, screenOver, streak, unaward, weekKeyOf, node } from '../shared/platform.ts';

test('从零开始：每个领域的第一关开放，其余锁着；没有预填数据', () => {
  const p = freshPlatform();
  assert.equal(p.flowers, 0); assert.equal(p.xp, 0); assert.deepEqual(p.done, []);
  assert.ok(p.week.flat().every(b => !b.done));
  for (const n of NODES) assert.equal(nodeState(n.id, new Set()), n.lv === 0 ? 'now' : 'lock');
  assert.ok(platformSchema.safeParse(p).success);
});
test('依赖解锁：同领域前一关 + 跨领域依赖都要点亮', () => {
  assert.deepEqual(prereqs(node('e5')).sort(), ['c1', 'e4']);   // 英语“颜色单词”要先会认颜色
  const done = new Set(['e10', 'e2', 'e4']);
  assert.equal(nodeState('e5', done), 'lock');           // 还差“认识颜色”
  done.add('c1');
  assert.equal(nodeState('e5', done), 'now');
  assert.deepEqual(newlyOpened('c1', new Set(['e10', 'e2', 'e4'])).map(n => n.id).sort(), ['c7', 'e5']);
});
test('点亮知识点：发花、经验、顺手完成今天的 WonderLab 日程', () => {
  const p = freshPlatform();
  const today = 0;                                       // 周一的日程里有 WonderLab
  const r = completeNode(p, 'c1', today);
  assert.equal(r.p.done.includes('c1'), true);
  assert.equal(r.p.flowers, 2);                          // 点亮 1 + 日程 1
  assert.ok(r.p.week[today].find(b => b.n.startsWith('WonderLab'))!.done);
  assert.deepEqual(r.opened.map(n => n.id), ['c7']);
  assert.equal(completeNode(r.p, 'c1', today).p, r.p);   // 不重复发
});
test('孩子完成任务：需要家长看的进入待确认，确认后才得花', () => {
  let p = freshPlatform();
  const i = p.week[0].findIndex(b => b.chk);
  const k = kidComplete(p, 0, i);
  assert.equal(k.waiting, true); assert.equal(k.p.flowers, 0); assert.equal(k.p.week[0][i].wait, true);
  p = award(k.p, 0, i).p;
  assert.equal(p.flowers, 1); assert.equal(p.week[0][i].wait, false);
});
test('整天完成打卡 +1，撤销会收回；不重复发', () => {
  let p = freshPlatform();
  const work = p.week[0].map((b, i) => ({ b, i })).filter(x => x.b.f > 0);
  for (const x of work) p = award(p, 0, x.i).p;
  const total = work.reduce((s, x) => s + x.b.f, 0);
  assert.equal(p.flowers, total + 1);
  assert.equal(streak(p, 0), 1);
  p = unaward(p, 0, work[0].i);
  assert.equal(p.flowers, total - work[0].b.f);
  p = award(p, 0, work[0].i).p;
  assert.equal(p.flowers, total + 1);
});
test('连续 7 天额外 +5（只发一次）', () => {
  let p = freshPlatform();
  for (let d = 0; d < 7; d++) for (const [i, b] of p.week[d].entries()) if (b.f) p = award(p, d, i).p;
  assert.equal(streak(p, 6), 7);
  assert.ok(p.bonus.some(k => k.endsWith('-s7')));
  assert.ok(badges(p, 6).find(b => b.n === '连续 7 天')!.got);
});
test('首页挑“现在要做的一件事”', () => {
  const day = baseWeek()[0];
  assert.equal(pickFocus(day, 21 * 60 + 5, null).kind, 'bed');
  const f = pickFocus(day, 16 * 60 + 25, null);          // 16:25 → 早上的刷牙还没做，先做它
  assert.equal(f.kind, 'now'); assert.equal(f.kind === 'now' && day[f.index].t, '07:30');
  const done = day.map(b => ({ ...b, done: b.t < '17:00' }));
  const g = pickFocus(done, 16 * 60, null);              // 16:00 时下一件 17:00
  assert.equal(g.kind, 'free');
});
test('换周保留日程结构、清掉完成状态；换天屏幕时间清零', () => {
  const p = freshPlatform(new Date('2026-10-12T10:00:00'));
  p.week[0][0].done = true; p.screen.usedSec = 600;
  const q = rollover(p, new Date('2026-10-20T10:00:00'));
  assert.equal(q.weekKey, weekKeyOf(new Date('2026-10-20T10:00:00')));
  assert.equal(q.week[0][0].done, false); assert.equal(q.screen.usedSec, 0);
  assert.equal(p.week[0][0].done, true);
});
test('屏幕时间', () => {
  const p = freshPlatform(); p.screen.usedSec = 19 * 60;
  assert.equal(screenLeftMin(p), 1); assert.equal(screenOver(p), false);
  p.screen.usedSec = 20 * 60; assert.equal(screenOver(p), true);
  p.screen.extra = 10; assert.equal(screenLeftMin(p), 10);
});
test('关卡表：5 块大陆；每个区域 7–20 关、层级连续；跨区域依赖都存在；全部关卡最终都能解锁', async () => {
  const { AREAS } = await import('../shared/platform.ts');
  assert.equal(DOMAINS.length, 5);
  for (const a of AREAS) {
    const lvs = NODES.filter(n => n.a === a.id).map(n => n.lv).sort((x, y) => x - y);
    assert.ok(lvs.length >= 7 && lvs.length <= 20, `${a.id} 有 ${lvs.length} 关`);
    const max = lvs[lvs.length - 1];
    assert.deepEqual([...new Set(lvs)], Array.from({ length: max + 1 }, (_, i) => i), `${a.id} 层级要连续`);   // 同一层可以有几关并排
    assert.ok(DOMAINS.some(d => d.id === a.d));
  }
  for (const n of NODES) assert.equal(n.d, AREAS.find(a => a.id === n.a)!.d);   // 关卡属于它区域所在的大陆
  for (const d of DOMAINS) assert.ok(AREAS.some(a => a.d === d.id && a.unlock === 0), `${d.id} 一开始至少开一个区域`);
  assert.equal(new Set(NODES.map(n => n.id)).size, NODES.length);
  for (const [a, b] of CROSS) { assert.ok(NODES.some(n => n.id === a), a); assert.ok(NODES.some(n => n.id === b), b); }
  // 一开始就开着的区域里，关卡的前置也必须在一开始就开着的区域里（不然孩子会卡住、却看不到要去哪）
  const startOpen = new Set<string>(AREAS.filter(a => a.unlock === 0).map(a => a.id));
  for (const n of NODES.filter(x => startOpen.has(x.a))) for (const q of prereqs(n)) assert.ok(startOpen.has(node(q).a), `${n.id} 依赖还没浮出来的 ${q}`);
  // 一直点亮“现在能玩”的关卡，最后应该全部点亮（没有死锁）
  const done = new Set<string>();
  for (let open = NODES.filter(n => nodeState(n.id, done) === 'now'); open.length; open = NODES.filter(n => nodeState(n.id, done) === 'now')) open.forEach(n => done.add(n.id));
  assert.equal(done.size, NODES.length);
});
test('区域慢慢浮出来：点亮够了自动出现；玩过的不藏；家长可以打开或关上', async () => {
  const { openAreas, newAreas, nextAreaIn, AREAS } = await import('../shared/platform.ts');
  const fresh = openAreas({ done: [] });
  assert.deepEqual([...fresh].sort(), AREAS.filter(a => a.unlock === 0).map(a => a.id).sort());
  assert.ok(!fresh.has('life'));
  // 发现岛点亮 3 关：还差 1 关浮出“动物与植物”
  const p = { done: ['c1', 'c2', 'v1'], areas: {} as Record<string, boolean>, areasSeen: [] as string[] };
  assert.deepEqual(nextAreaIn('sci', p), { a: AREAS.find(a => a.id === 'life')!, need: 1 });
  p.done.push('v2');
  assert.ok(openAreas(p).has('life')); assert.ok(!openAreas(p).has('sky'));
  assert.deepEqual(newAreas(p), ['life']);
  p.areasSeen.push('life'); assert.deepEqual(newAreas(p), []);       // 看过一次就不再弹
  // 家长打开“天空与地球”、关上“英语”
  p.areas.sky = true; p.areas.eng = false;
  assert.ok(openAreas(p).has('sky')); assert.ok(!openAreas(p).has('eng'));
  // 玩过的区域不藏起来（比如以前点亮过 g2）
  assert.ok(openAreas({ done: ['g2'] }).has('sky'));
  // 演示模式全开
  assert.equal(openAreas({ done: [] }, true).size, AREAS.length);
});
test('今日任务：5 块大陆里每天必做 3 块（探险日第一 + 轮流两块）；只从打开的区域里挑；用本地日期', async () => {
  const { todayPlan, dayKey, TODAY_MUST } = await import('../shared/platform.ts');
  const tue = new Date(2026, 9, 20, 7, 30);                       // 周二早上 7:30（南京时间，UTC 还是前一天）
  assert.equal(dayKey(tue), '2026-10-20');
  const p = { done: [] as string[], events: [] as { at: string; type: string; detail: string; node?: string }[] };
  let plan = todayPlan(p, tue);
  assert.equal(plan.length, 5);
  assert.equal(plan.filter(x => x.must).length, TODAY_MUST);
  assert.equal(plan[0].d, 'lang'); assert.equal(plan[0].theme, true); assert.equal(plan[0].must, true);   // 周二是故事岛
  assert.ok(plan.slice(0, TODAY_MUST).every(x => x.must));
  assert.equal(plan.find(x => x.d === 'math')!.next!.id, 'm1');
  assert.equal(plan.find(x => x.d === 'sci')!.next!.a, 'color');   // 还没浮出来的区域不会被挑中
  assert.ok(plan.every(x => x.state === 'todo'));
  const sets = [20, 21, 22, 23].map(day => todayPlan(p, new Date(2026, 9, day, 9)).filter(x => x.must && !x.theme).map(x => x.d).join());
  assert.ok(new Set(sets).size > 1);
  const sun = todayPlan(p, new Date(2026, 9, 25, 9));
  assert.equal(sun.filter(x => x.must).length, TODAY_MUST); assert.ok(sun.every(x => !x.theme));
  p.done.push('m1'); p.events.push({ at: new Date(2026, 9, 20, 7, 40).toISOString(), type: 'complete', detail: 'x', node: 'm1' });
  plan = todayPlan(p, tue);
  const m = plan.find(x => x.d === 'math')!;
  assert.equal(m.state, 'done'); assert.deepEqual(m.doneToday.map(n => n.id), ['m1']); assert.equal(m.next!.id, 'm11');   // 同一层还有“一样多吗”
  p.done.push('c1'); p.events.push({ at: new Date(2026, 9, 19, 20, 0).toISOString(), type: 'complete', detail: 'x', node: 'c1' });
  assert.equal(todayPlan(p, tue).find(x => x.d === 'sci')!.state, 'todo');
  const allArt = { done: NODES.filter(n => n.d === 'art').map(n => n.id), events: [] };
  const pa = todayPlan(allArt, tue);
  assert.equal(pa.find(x => x.d === 'art')!.state, 'all'); assert.equal(pa.find(x => x.d === 'art')!.must, false);
  assert.equal(pa.filter(x => x.must).length, TODAY_MUST);
});
