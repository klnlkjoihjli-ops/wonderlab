import test from 'node:test';
import assert from 'node:assert/strict';
import { NODES, ageIndex, node } from '../shared/platform.ts';
import { PLAYS } from '../shared/games.ts';
import { LAB_LEVELS, hasGuess, nextTrial, react } from '../shared/modules/lab.ts';
import { MATCH_LEVELS, MISSION_LEVELS, ORDER_LEVELS, SCENE_LEVELS, SPOT_LEVELS, canRecord, choose, matchOk, needsParent, orderOk, shuffled, spotTap } from '../shared/modules/play.ts';
import { SORT_LEVELS } from '../shared/modules/sort.ts';

const BUILT = new Set(['c2', 'v3']);   // 已经有 3D 工作台的关
const CONTENT: Record<string, Record<string, unknown>> = { lab: LAB_LEVELS, sort: SORT_LEVELS, match: MATCH_LEVELS, spot: SPOT_LEVELS, map: SPOT_LEVELS, scene: SCENE_LEVELS, build: ORDER_LEVELS, mission: MISSION_LEVELS };

test('发现岛竖切：幼儿园段（到幼小衔接）每一关都能玩，内容和设计的玩法对得上', () => {
  const slice = NODES.filter(n => n.d === 'sci' && ageIndex(n.age!) <= ageIndex('br'));
  assert.equal(slice.length, 39);
  for (const n of slice) {
    if (BUILT.has(n.id)) continue;
    const e = PLAYS[n.id][0];
    assert.ok(CONTENT[e]?.[n.id], `${n.id}「${n.name}」（${e}）还没有内容`);
  }
});

test('猜一猜·试一试：小班只做不猜，其余先猜；答案在选项里；猜错不算错', () => {
  for (const [id, lv] of Object.entries(LAB_LEVELS)) {
    assert.equal(PLAYS[id][0], 'lab', id);
    assert.ok(lv.trials.length >= 2, `${id} 至少两次小实验`);
    for (const t of lv.trials) {
      if (t.options) { assert.ok(t.answer! >= 0 && t.answer! < t.options.length, `${id} 的答案不在选项里`); assert.ok(t.options.length <= 3, `${id} 选项太多`); }
      if (node(id).age === 'k1') assert.equal(hasGuess(t), false, `${id} 是小班，不该先猜`);
    }
  }
  const t = LAB_LEVELS.c3.trials[0];
  assert.equal(react(t, 0).same, true);
  const wrong = react(t, 1); assert.equal(wrong.same, false); assert.match(wrong.say, /科学家/);
  assert.equal(react(LAB_LEVELS.v1.trials[0], null).same, null);
  assert.equal(nextTrial(LAB_LEVELS.c3, 0), 1); assert.equal(nextTrial(LAB_LEVELS.c3, 2), null);
});

test('配一配、放大镜、小剧场、排顺序：规则和内容', () => {
  for (const [id, lv] of Object.entries(MATCH_LEVELS)) {
    assert.equal(PLAYS[id][0], 'match', id);
    const sh = shuffled(lv.pairs.length);
    assert.deepEqual([...sh].sort(), lv.pairs.map((_, i) => i)); assert.ok(sh.some((v, i) => v !== i), `${id} 右边没打乱`);
    assert.ok(matchOk(lv, 1, 1)); assert.ok(!matchOk(lv, 0, 1));
  }
  for (const [id, lv] of Object.entries(SPOT_LEVELS)) {
    assert.ok(['spot', 'map'].includes(PLAYS[id][0]), id);
    for (const r of lv.rounds) {
      assert.equal(r.tiles.filter(t => t.ok).length, 1, `${id}「${r.ask}」要正好一个对的`);
      const k = r.tiles.findIndex(t => t.ok); assert.equal(spotTap(r, k).ok, true);
      const w = r.tiles.findIndex(t => !t.ok); assert.equal(spotTap(r, w).ok, false); assert.ok(spotTap(r, w).say.length > 0);
    }
  }
  for (const [id, lv] of Object.entries(SCENE_LEVELS)) {
    assert.equal(PLAYS[id][0], 'scene', id);
    for (const s of lv.scenes) {
      assert.ok(s.choices.some(c => c.good) && s.choices.some(c => !c.good), `${id} 每个场景要有好的和要倒带的选择`);
      const bad = s.choices.findIndex(c => !c.good); assert.equal(choose(s, bad).rewind, true);
    }
  }
  for (const [id, lv] of Object.entries(ORDER_LEVELS)) { assert.equal(PLAYS[id][0], 'build', id); assert.ok(lv.steps.length >= 3); }
  assert.ok(orderOk(2, 2)); assert.ok(!orderOk(0, 1));
});

test('生活任务卡：一天只记一次，记够天数等家长确认；天气记录表最后数晴天', () => {
  const lv = MISSION_LEVELS.g13;
  assert.equal(PLAYS.g13[0], 'mission');
  const recs = [{ day: '2026-10-20', pick: '☀️ 晴' }];
  assert.equal(canRecord(recs, '2026-10-20', lv), false);              // 今天已经记过
  assert.equal(canRecord(recs, '2026-10-21', lv), true);
  const full = Array.from({ length: 7 }, (_, i) => ({ day: `d${i}`, pick: i < 5 ? '☀️ 晴' : '🌧️ 雨' }));
  assert.equal(needsParent(full, lv), true); assert.equal(canRecord(full, 'd9', lv), false);
  assert.match(lv.sum!.say(5, 7), /晴天有 5 天/);
  for (const [id, m] of Object.entries(MISSION_LEVELS)) { assert.equal(PLAYS[id][0], 'mission', id); assert.ok(m.todo.length >= 2 && m.days >= 1); }
});
