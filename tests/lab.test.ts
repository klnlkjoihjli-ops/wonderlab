import test from 'node:test';
import assert from 'node:assert/strict';
import { compareLine, guessLine, labSetupSchema, levelOf, runLab, sagOf } from '../shared/lab.ts';
import { freshProgress, parseProgress, progressSchema } from '../shared/game.ts';

const S = (deck: 'thin' | 'thick' | 'paper' | 'folded', boxes = 0, pier = false) => ({ deck, boxes, pier });

test('平纸一放信就过不去，折纸能过：和家里纸桥活动同一个对比', () => {
  assert.equal(runLab(S('paper')).level, 'red');
  assert.equal(runLab(S('folded')).ok, true);
});
test('礼物盒越多弯得越多，弯曲随载重单调增加', () => {
  for (const d of ['thin', 'thick', 'paper', 'folded'] as const) for (let b = 0; b < 4; b++) assert.ok(sagOf(S(d, b + 1)) > sagOf(S(d, b)));
  assert.deepEqual([0, 1, 2, 3].map(b => runLab(S('thin', b)).level), ['green', 'yellow', 'yellow', 'red']);
});
test('桥墩让同样的桥弯得少很多', () => {
  assert.equal(runLab(S('paper', 0, true)).level, 'green');
  assert.ok(sagOf(S('folded', 4, true)) < sagOf(S('folded', 4)) / 5);
});
test('厚木板最结实，装满礼物也能过', () => { assert.equal(runLab(S('thick', 4)).ok, true); });
test('等级分界', () => { assert.equal(levelOf(0.39), 'green'); assert.equal(levelOf(0.4), 'yellow'); assert.equal(levelOf(1), 'red'); });
test('只改一样时说出变化，改了好几样时提醒一次改一样', () => {
  assert.match(compareLine(S('paper'), S('folded'))!, /只换了桥面.*弯得少了/);
  assert.match(compareLine(S('thin', 1), S('thin', 3))!, /只多放了2个礼物盒.*弯得更多了/);
  assert.match(compareLine(S('thin'), S('thin', 0, true))!, /只加了一个桥墩/);
  assert.match(compareLine(S('thin'), S('thick', 2))!, /一次只换一样/);
  assert.equal(compareLine(null, S('thin')), null);
});
test('猜一猜的反馈', () => { assert.equal(guessLine(null, 'red'), null); assert.match(guessLine('red', 'red')!, /一样/); });
test('实验设置不接受超出范围的值', () => { assert.equal(labSetupSchema.safeParse({ deck: 'thin', pier: false, boxes: 9 }).success, false); });
test('旧存档没有实验室字段也能读出，不会被清空', () => {
  const old: any = freshProgress(); delete old.lab; old.chapters[1].completed = true;
  const r = parseProgress(JSON.stringify(old));
  assert.equal(r.recovered, false); assert.equal(r.progress.chapters[1].completed, true); assert.equal(r.progress.lab.records.length, 0);
  assert.ok(progressSchema.parse(freshProgress()).lab);
});

import { labGuidedReply, labTutorRequestSchema } from '../shared/lab.ts';
import { buildLabMessages, labTutor } from '../server/tutor.ts';
const cfg = { baseUrl: 'https://api.deepseek.com', apiKey: 'test-only-not-a-real-key', model: 'deepseek-flash' };
const T = (deck: 'thin' | 'thick' | 'paper' | 'folded', boxes = 0, pier = false, guess: 'green' | 'yellow' | 'red' | null = null) => ({ setup: { deck, boxes, pier }, guess });

test('实验室请求不能自带结果，只能带设置和猜测', () => {
  const ok = { question: '为什么', setup: S('thin'), trials: [T('paper')] };
  assert.equal(labTutorRequestSchema.safeParse(ok).success, true);
  assert.equal(labTutorRequestSchema.safeParse({ ...ok, trials: [{ ...T('paper'), level: 'green' }] }).success, false);
  assert.equal(labTutorRequestSchema.safeParse({ ...ok, result: 'green' }).success, false);
  assert.equal(labTutorRequestSchema.safeParse({ ...ok, trials: Array(7).fill(T('thin')) }).success, false);
});
test('发给模型的结果由规则重算，并带上程序算好的对比结论', () => {
  const msgs = buildLabMessages(labTutorRequestSchema.parse({ question: '为什么折纸不弯了', setup: S('folded'), trials: [T('paper', 0, false, 'green'), T('folded')] }));
  const facts = JSON.parse(String(msgs[1].content).replace('权威场景数据：', ''));
  assert.match(facts.trials[0].result, /红色/);               // 孩子猜绿，但平纸实际是红
  assert.equal(facts.trials[0].guessMatched, false);
  assert.match(facts.lastComparison, /只换了桥面/);
  assert.equal(facts.currentSetupTested, true);
  assert.match(String(msgs[0].content), /小桥实验室/);
  assert.doesNotMatch(String(msgs[0].content), /短木板/);     // 不混入送信关卡的材料
});
test('实验室基础引导：用孩子刚做的对比解释为什么', () => {
  assert.match(labGuidedReply('为什么', S('folded'), [T('paper'), T('folded')]).text, /折痕/);
  assert.match(labGuidedReply('为什么', S('thin', 0, true), [T('thin'), T('thin', 0, true)]).text, /桥墩/);
  assert.match(labGuidedReply('为什么', S('thin', 3), [T('thin', 1), T('thin', 3)]).text, /礼物盒越多/);
  assert.match(labGuidedReply('我该试什么', S('paper'), [T('paper')]).text, /只换一样/);
  assert.equal(labGuidedReply('月亮为什么是圆的', S('thin'), []).save, true);   // 和实验无关的“为什么”收进以后想探索的事
  assert.match(labGuidedReply('为什么纸弯了', S('paper'), [T('paper')]).text, /软/);
  assert.equal(labGuidedReply('恐龙去哪了', S('thin'), []).save, true);
});
test('实验室导师：未同意不联网，模型失败回退', async () => {
  let called = false;
  const req = labTutorRequestSchema.parse({ question: '我该试什么', setup: S('paper'), trials: [T('paper')] });
  const r1 = await labTutor(req, cfg, async () => { called = true; throw new Error(); });
  assert.equal(called, false); assert.equal(r1.mode, 'guided');
  const r2 = await labTutor({ ...req, consent: true }, cfg, async () => { throw new Error('timeout'); });
  assert.equal(r2.mode, 'guided'); assert.match(r2.reply, /只换一样/);
});

test('问真实纸桥时不收藏（服务端规则兜底）', async () => {
  const fake: typeof fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: '【收藏】和妈妈用纸搭一搭吧。' } }] }), { status: 200 });
  const r = await labTutor(labTutorRequestSchema.parse({ question: '真的纸也会这样吗', setup: S('folded'), trials: [], consent: true }), cfg, fake);
  assert.equal(r.mode, 'online'); assert.equal(r.save, false);
});
