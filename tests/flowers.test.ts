import test from 'node:test';
import assert from 'node:assert/strict';
import { ROUNDS, amount, flowersPassed, freshFlowersProgress, giveSay, howManySay, pickSay, pickState, putBackSay, roundIntro } from '../shared/modules/flowers.ts';

test('数量的说法：两朵、三朵、十朵', () => {
  assert.deepEqual([1, 2, 3, 7, 10].map(n => amount(n)), ['一朵', '两朵', '三朵', '七朵', '十朵']);
});
test('摘花只报数；送给小兔子时才判断：不够、刚好、太多', () => {
  assert.equal(pickState(3, 2), 'more'); assert.equal(pickState(3, 3), 'done'); assert.equal(pickState(3, 4), 'tooMany');
  const r = ROUNDS.find(x => x.kind === 'pick' && x.need === 3) as Extract<typeof ROUNDS[number], { kind: 'pick' }>;
  assert.equal(pickSay(2), '两朵！'); assert.equal(pickSay(3), '三朵！');          // 摘到刚好也不提示，让孩子自己判断
  assert.match(giveSay(r, 2).text, /只有两朵.*要三朵.*还不够/);
  assert.match(giveSay(r, 0).text, /空的/);
  assert.equal(giveSay(r, 3).state, 'done'); assert.match(giveSay(r, 3).text, /刚刚好/);
  assert.match(giveSay(r, 4).text, /太多啦.*只要三朵/);
  assert.equal(putBackSay(3), '放回去一朵，现在是三朵。');
});
test('有几朵：选对了夸，选错了给方向（多一点 / 少一点）', () => {
  const r = { kind: 'howMany' as const, have: 4, choices: [3, 4, 5] };
  assert.equal(howManySay(r, 4).ok, true);
  assert.match(howManySay(r, 3).text, /多一点/); assert.match(howManySay(r, 5).text, /少一点/);
});
test('轮次：从少到多，选项里一定有正确答案，每轮都有开场白', () => {
  const picks = ROUNDS.filter(r => r.kind === 'pick').map(r => (r as { need: number }).need);
  assert.deepEqual(picks, [...picks].sort((a, b) => a - b));
  for (const r of ROUNDS) { assert.ok(roundIntro(r)); if (r.kind === 'howMany') assert.ok(r.choices.includes(r.have)); }
  const p = freshFlowersProgress(); assert.equal(flowersPassed(p), false);
  p.round = ROUNDS.length; assert.equal(flowersPassed(p), true);
});
