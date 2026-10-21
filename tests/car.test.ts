import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_PARTS, CAR_PARTS, PART, assemblyHint, canInstall, compareRamp, currentStep, freshCarProgress, installable, isComplete, isPassed, rollDistance, runRamp, type CarPartId } from '../shared/modules/car.ts';

const S = (...ids: CarPartId[]) => new Set<CarPartId>(ids);

test('十个零件，名字和讲解都齐全', () => {
  assert.equal(ALL_PARTS.length, 10);
  for (const p of CAR_PARTS) { assert.ok(p.name && p.says && p.en); if (p.needs.length) assert.ok(p.why); }
});
test('车轮要先有对应的车轴', () => {
  const r = canInstall(S(), 'WheelFL');
  assert.equal(r.ok, false); assert.deepEqual(!r.ok && r.missing, ['AxleFront']);
  assert.equal(canInstall(S('AxleRear'), 'WheelFL').ok, false);   // 后车轴不能代替前车轴
  assert.equal(canInstall(S('AxleFront'), 'WheelFL').ok, true);
});
test('车壳要等马达、电池和两根车轴都装好，车顶要等车壳', () => {
  assert.equal(canInstall(S('Motor', 'Battery', 'AxleRear'), 'Shell').ok, false);
  assert.equal(canInstall(S('Motor', 'Battery', 'AxleRear', 'AxleFront'), 'Shell').ok, true);
  assert.equal(canInstall(S(), 'Roof').ok, false);
});
test('按依赖顺序一定能装完（不会卡死）', () => {
  const have = S();
  for (let i = 0; i < 20 && !isComplete(have); i++) have.add(installable(have)[0]);
  assert.equal(isComplete(have), true);
});
test('三层提示：方向 → 线索 → 具体下一步，装好后提示开动', () => {
  assert.match(assemblyHint(S(), 0, null), /底盘/);
  assert.match(assemblyHint(S(), 1, 'WheelFL'), /前车轴/);
  assert.match(assemblyHint(S(), 2, null), /试试先点后车轴/);
  assert.match(assemblyHint(new Set(ALL_PARTS), 0, null), /开动/);
});
test('斜坡越高冲得越远，只有最高的坡能到小旗子', () => {
  assert.ok(rollDistance(1) < rollDistance(2) && rollDistance(2) < rollDistance(3));
  assert.deepEqual([1, 2, 3].map(l => runRamp(l as 1 | 2 | 3).reached), [false, false, true]);
  assert.match(compareRamp(runRamp(1), runRamp(3))!, /更远/);
  assert.equal(compareRamp(null, runRamp(1)), null);
});
test('四步进度与过关条件', () => {
  const p = freshCarProgress();
  assert.equal(currentStep(p), 'look');
  p.exploded = true; p.installed = []; p.seen = ['WheelFL', 'WheelFR', 'Motor'];   // 两个车轮名字相同，只算认识了 2 种
  assert.equal(currentStep(p), 'look');
  p.seen.push('Battery');
  assert.equal(currentStep(p), 'assemble');
  p.installed = [...ALL_PARTS];
  assert.equal(currentStep(p), 'drive');
  p.drove = true; assert.equal(currentStep(p), 'ramp');
  assert.equal(isPassed(p), false);
  p.ramps.push(runRamp(2)); assert.equal(isPassed(p), false);
  p.ramps.push(runRamp(3)); assert.equal(isPassed(p), true);
  assert.equal(PART.Shell.needs.length, 4);
});
