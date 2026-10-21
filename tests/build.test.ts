import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_BUILD, addPart, buildSchema, canPlace, describeBuild, evaluateBuild, removePart, supportCols, type Build, type PartKind } from '../shared/build.ts';

let n = 0;
const make = (items: [PartKind, number][], boxes = 0): Build => items.reduce((b, [k, c]) => addPart(b, k, c, `p${n++}`), { ...EMPTY_BUILD, boxes });
// 一种标准搭法：四个桥墩 + 四块中木板 + 一块短木板
const posts: [PartKind, number][] = [['post', 1], ['post', 3], ['post', 5], ['post', 7]];
const mediums: [PartKind, number][] = [['medium', -1], ['medium', 1], ['medium', 3], ['medium', 5], ['short', 7]];

test('空桥：第一格就断开', () => {
  const r = evaluateBuild(EMPTY_BUILD);
  assert.equal(r.reason, 'gap'); assert.equal(r.col, 0);
});
test('四个木桩 + 中木板能稳稳过去，换成叠满的石墩也一样', () => {
  const a = make([...posts, ...mediums]);
  assert.equal(a.parts.length, 9);
  assert.deepEqual(evaluateBuild(a), { ...evaluateBuild(a), ok: true, reason: 'success', level: 'green' });
  const stones: [PartKind, number][] = [1, 3, 5, 7].flatMap(c => [['stone', c], ['stone', c]] as [PartKind, number][]);
  assert.equal(evaluateBuild(make([...stones, ...mediums])).ok, true);
});
test('不同搭法也能成功：长木板跨过两个桥墩', () => {
  const b = make([['post', 1], ['post', 3], ['post', 5], ['post', 7], ['long', -1], ['long', 3], ['short', 7]]);
  assert.equal(evaluateBuild(b).ok, true);
});
test('礼物盒越多越弯：同一座桥从绿到黄再到红', () => {
  const levels = [0, 1, 2, 3].map(boxes => evaluateBuild(make([...posts, ...mediums], boxes)));
  assert.deepEqual(levels.map(r => r.level), ['green', 'yellow', 'yellow', 'red']);
  assert.equal(levels[3].reason, 'sag');
});
test('桥墩间距决定能扛多重：隔两格只能放信，再加礼物就压弯', () => {
  // 木桩在 2、4、6；长木板 -2..2 的支撑是 -2、-1、2，最大一跨隔了 3 格，其余各跨 2 格
  const b = make([['post', 2], ['post', 4], ['post', 6], ['long', -2], ['medium', 2], ['medium', 4], ['medium', 6]]);
  const r = evaluateBuild(b);
  assert.equal(r.ok, true); assert.equal(r.level, 'yellow');
  const heavy = evaluateBuild({ ...b, boxes: 1 });
  assert.equal(heavy.reason, 'sag'); assert.equal(heavy.partId, b.parts.find(p => p.kind === 'long')!.id);
});
test('桥墩太少：长木板中间没有托住就被压弯，并指出是哪一块', () => {
  const b = make([['post', 3], ['post', 7], ['long', -1], ['long', 3], ['short', 7]]);
  const r = evaluateBuild(b);
  assert.equal(r.reason, 'sag'); assert.equal(r.partId, b.parts.find(p => p.kind === 'long' && p.col === -1)!.id);
});
test('少一个桥墩：木板一头悬空会翘起，定位到那块木板', () => {
  const b = make([['post', 3], ['post', 5], ['post', 7], ...mediums]);
  const r = evaluateBuild(b);
  assert.equal(r.reason, 'tip'); assert.equal(r.col, 0); assert.equal(r.low, false);
  assert.equal(r.partId, b.parts.find(p => p.kind === 'medium' && p.col === -1)!.id);
});
test('石墩只叠了一块：够不到桥面，提示“还不够高”', () => {
  const r = evaluateBuild(make([['stone', 1], ['post', 3], ['post', 5], ['post', 7], ...mediums]));
  assert.equal(r.reason, 'tip'); assert.equal(r.low, true); assert.match(r.observe, /不够高/);
  assert.equal(supportCols(make([['stone', 1]])).has(1), false);
});
test('两头都悬空的木板会掉下去，定位到那块木板', () => {
  assert.equal(evaluateBuild(make([['medium', 2]])).reason, 'gap');   // 小车先遇到第 0 格的断口
  const b = make([['post', 1], ['medium', -1], ['medium', 2]]);       // 第二块占 2..4，两头都没有桥墩
  const r = evaluateBuild(b);
  assert.equal(r.reason, 'fall'); assert.equal(r.col, 2);
  assert.equal(r.partId, b.parts.find(p => p.kind === 'medium' && p.col === 2)!.id);
});
test('放置限制：石块最多叠两块、不能和木桩同列、只能放在溪上', () => {
  let b = make([['stone', 2], ['stone', 2]]);
  assert.equal(canPlace(b, 'stone', 2), false);
  assert.equal(canPlace(b, 'post', 2), false);
  assert.equal(canPlace(EMPTY_BUILD, 'stone', -1), false);
  assert.equal(canPlace(EMPTY_BUILD, 'post', 8), false);
});
test('木板只能在端头和别的木板共用一格，不能叠在一起', () => {
  const b = make([['medium', -1]]);                   // 占 -1,0,1
  assert.equal(canPlace(b, 'medium', 1), true);      // 1,2,3：端头对端头
  assert.equal(canPlace(b, 'medium', 0), false);     // 0,1,2：重叠两格
  assert.equal(canPlace(b, 'long', -2), false);      // 端头 -2 和 2，共用的 -1/0/1 不是端头
  assert.equal(canPlace(EMPTY_BUILD, 'short', 8), false);   // 全在岸上
  assert.equal(canPlace(EMPTY_BUILD, 'long', 6), false);    // 超出右岸
});
test('拿走石块时只能先拿最上面那一块', () => {
  const b = make([['stone', 4], ['stone', 4]]);
  const [bottom, top] = b.parts;
  const after = removePart(b, bottom.id);
  assert.equal(after.parts.length, 1); assert.equal(after.parts[0].id, bottom.id);
  assert.equal(removePart(after, top.id), after);     // 已经不在了
});
test('存档格式校验与描述', () => {
  assert.equal(buildSchema.safeParse({ parts: [{ id: 'x', kind: 'post', col: 3 }], boxes: 1 }).success, true);
  assert.equal(buildSchema.safeParse({ parts: [{ id: 'x', kind: 'bomb', col: 3 }], boxes: 1 }).success, false);
  assert.match(describeBuild(make([...posts, ...mediums])), /4个中木板.*够高的桥墩 4 个/);
});
import { buildHint } from '../shared/build.ts';
test('小诺的提示针对实际问题', () => {
  assert.match(buildHint(evaluateBuild(EMPTY_BUILD), EMPTY_BUILD), /拖一块木板/);
  const tipLow = make([['stone', 1], ['post', 3], ['post', 5], ['post', 7], ...mediums]);
  assert.match(buildHint(evaluateBuild(tipLow), tipLow), /再叠一块/);
  const sag = make([['post', 3], ['post', 7], ['long', -1], ['long', 3], ['short', 7]]);
  assert.match(buildHint(evaluateBuild(sag), sag), /中间加一个桥墩/);
});
