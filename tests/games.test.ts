import test from 'node:test';
import assert from 'node:assert/strict';
import { AREAS, NODES } from '../shared/platform.ts';
import { ENGINES, PLAYS, SCENES } from '../shared/games.ts';

test('玩法：每一关都有玩法，没有多余的，玩法都存在', () => {
  for (const n of NODES) assert.ok(PLAYS[n.id], `${n.id}「${n.name}」还没设计玩法`);
  const ids = new Set(NODES.map(n => n.id));
  for (const id of Object.keys(PLAYS)) assert.ok(ids.has(id), `玩法表里的 ${id} 不是关卡`);
  for (const [id, [e, p]] of Object.entries(PLAYS)) { assert.ok(ENGINES[e], `${id} 的玩法 ${e} 不存在`); assert.ok(p.length >= 8, `${id} 的玩法说明太短`); }
});
test('玩法：每个区域都有场景和角色；写字小工坊只在 1～2 年级', () => {
  for (const a of AREAS) assert.ok(SCENES[a.id]?.npc, `${a.name} 没有角色`);
  for (const n of NODES) if (PLAYS[n.id][0] === 'write') assert.equal(n.age, 'g1', `${n.id} 在幼儿园年龄段用了写字`);
});
test('玩法：已经做好的模块和玩法对得上', () => {
  const want: Record<string, string> = { flowers: 'give', lights: 'lab', car: 'build' };
  for (const n of NODES) if (n.module && want[n.module]) assert.equal(PLAYS[n.id][0], want[n.module], n.id);
});
