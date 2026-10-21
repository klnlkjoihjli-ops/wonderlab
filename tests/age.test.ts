import test from 'node:test';
import assert from 'node:assert/strict';
import { AGES, DOMAINS, NODES, ageBandOf, ageIndex, nodeState, prereqs, node, visibleFor, type AgeId } from '../shared/platform.ts';
import { dailyThree } from '../shared/daily.ts';

const math = NODES.filter(n => n.d === 'math');
const mon = new Date(2026, 9, 19, 9);   // 周一：数字岛探险日

test('年龄段：按月龄分，衔接期从 5 岁半开始，6 岁上一年级', () => {
  assert.equal(ageBandOf(30), 'k1'); assert.equal(ageBandOf(47), 'k1'); assert.equal(ageBandOf(48), 'k2');
  assert.equal(ageBandOf(60), 'k3'); assert.equal(ageBandOf(65), 'k3'); assert.equal(ageBandOf(66), 'br');
  assert.equal(ageBandOf(71), 'br'); assert.equal(ageBandOf(72), 'g1'); assert.equal(ageBandOf(100), 'g1');
});

const isStd = (src: string) => /^\S+课标 /.test(src);   // 数学课标、语文课标……
test('全部 5 座岛：每关都标了年龄段和依据；每座岛 5 个年龄段都有关卡；每个区域里年龄段从小到大排', () => {
  assert.ok(math.length >= 40, `数字岛只有 ${math.length} 关`);
  for (const n of NODES) {
    assert.ok(n.age, `${n.id} 没标年龄段`);
    assert.ok(n.src && /^(指南 |入学准备 )/.test(n.src) || isStd(n.src ?? ''), `${n.id} 没写依据`);
  }
  for (const d of DOMAINS) for (const a of AGES) assert.ok(NODES.some(n => n.d === d.id && n.age === a.id), `${d.name}没有${a.name}的关卡`);
  for (const area of new Set(NODES.map(n => n.a))) {
    const rows = NODES.filter(n => n.a === area).sort((x, y) => x.lv - y.lv);
    for (let i = 1; i < rows.length; i++) assert.ok(ageIndex(rows[i].age!) >= ageIndex(rows[i - 1].age!), `${rows[i].id} 排在更大年龄段的关后面`);
  }
  // 依据和年龄段对得上：幼儿园三段用《指南》，衔接用《入学准备》，一年级只用课标（幼儿园不提前教小学内容）
  for (const n of NODES) {
    const src = n.src!;
    if (n.age === 'g1') assert.ok(isStd(src), `${n.id} 是一年级的关，依据要是课标`);
    else if (n.age === 'br') assert.ok(src.startsWith('入学准备 '), `${n.id} 是衔接的关，依据要是《入学准备》`);
    else assert.ok(src.startsWith('指南 '), `${n.id} 是幼儿园的关，依据要是《指南》`);
  }
});
test('识字、拼音、英语只在一年级出现（教基厅函〔2018〕57号）', () => {
  for (const n of NODES.filter(x => x.a === 'eng')) assert.equal(n.age, 'g1', `${n.id} 英语出现在幼儿园年龄段`);
  for (const n of NODES.filter(x => /拼音|识字/.test(x.name + x.goal))) assert.equal(n.age, 'g1', `${n.id} 拼音或识字出现在幼儿园年龄段`);
  for (const n of NODES.filter(x => x.src?.startsWith('语文课标') || x.src?.startsWith('英语课标'))) assert.equal(n.age, 'g1');
});

test('能看到哪些关：自己和更小的年龄段；本区域自己这段做完才出挑战关；6 岁前看不到一年级', () => {
  const none = new Set<string>();
  assert.ok(visibleFor(node('m11'), 'k2', none));                  // 小班的关中班能看到
  assert.ok(!visibleFor(node('m16'), 'k2', none));                 // 大班的关中班先看不到
  const k2num = new Set(math.filter(n => n.a === 'num' && n.age === 'k2').map(n => n.id));
  assert.ok(visibleFor(node('m16'), 'k2', k2num));                 // 中班的数和计算都做完 → 出大班挑战关
  assert.ok(!visibleFor(node('m3'), 'k1', new Set(math.filter(n => n.a === 'num' && n.age === 'k1').map(n => n.id))));   // 别的区域不受影响
  const all = new Set(math.map(n => n.id));
  for (const band of ['k1', 'k2', 'k3', 'br'] as AgeId[]) {
    assert.ok(math.filter(n => n.age === 'g1').every(n => !visibleFor(n, band, all)), `${band} 看到了一年级的关`);
  }
  assert.ok(visibleFor(node('m20'), 'g1', none));
});

test('大孩子不用先过小年龄段的关：低于自己年龄段的前置当作已经会了', () => {
  const none = new Set<string>();
  assert.equal(nodeState('m20', none), 'lock');                    // 不看年龄：要一层层走
  assert.equal(nodeState('m20', none, 'g1'), 'now');               // 一年级：前面幼儿园的关当作会了
  assert.equal(nodeState('m21', none, 'g1'), 'lock');              // 同一年龄段里还是要按顺序
  assert.equal(nodeState('m11', none, 'g1'), 'now');               // 小的关也能回去玩
});

test('跨区域依赖不会让幼儿园的关等一年级的关', () => {
  for (const n of NODES) for (const p of prereqs(n)) {
    const pa = node(p).age;
    if (pa) assert.ok(ageIndex(pa) <= ageIndex(n.age ?? 'br'), `${n.id} 要等更大年龄段的 ${p}`);
  }
});

test('每天三件事按年龄出：新学的是自己年龄段的；小班不会出大班以上的关', () => {
  const ev: { at: string; type: string; node?: string }[] = [];
  for (const a of AGES) {
    const t = dailyThree({ done: [], events: ev, band: a.id }, mon);
    assert.equal(t.learn!.d, 'math');
    assert.equal(t.learn!.age, a.id, `${a.name}今天新学的是 ${t.learn!.id}`);
    for (const n of [t.review, t.learn, t.play]) if (n) assert.ok(n.age, `${n.id} 没标年龄`);
    for (const n of [t.review, t.learn, t.play]) if (n?.age) assert.ok(ageIndex(n.age) <= ageIndex(a.id), `${a.name}出了 ${n.id}`);
  }
});
