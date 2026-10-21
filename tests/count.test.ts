import test from 'node:test';
import assert from 'node:assert/strict';
import { checkCount, cnNumber, countFeedback, readNumbers } from '../shared/modules/count.ts';

const seq = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

test('中文数字写法', () => {
  assert.deepEqual([1, 9, 10, 11, 19, 20].map(cnNumber), ['一', '九', '十', '十一', '十九', '二十']);
});
test('阿拉伯数字：有空格、有逗号、全连在一起都能读', () => {
  assert.deepEqual(readNumbers('1 2 3 4 5'), [1, 2, 3, 4, 5]);
  assert.deepEqual(readNumbers('1，2，3。4'), [1, 2, 3, 4]);
  assert.deepEqual(readNumbers(seq(1, 20).join('')), seq(1, 20));
});
test('中文连在一起：十一十二读成 11、12，不读成 10、1', () => {
  assert.deepEqual(readNumbers(seq(1, 20).map(cnNumber).join('')), seq(1, 20));
  assert.deepEqual(readNumbers('九十十一十二'), [9, 10, 11, 12]);
  assert.deepEqual(readNumbers('一两三'), [1, 2, 3]);
});
test('夹着别的字也没关系', () => {
  assert.deepEqual(readNumbers('嗯一二三那个四五'), [1, 2, 3, 4, 5]);
});
test('从 1 数到 20：过关', () => {
  const r = checkCount(seq(1, 20).map(cnNumber).join(''));
  assert.equal(r.ok, true); assert.deepEqual(r.missing, []); assert.equal(r.reached, 20);
  assert.match(countFeedback(r), /一个都没漏/);
});
test('识别漏了两个也算过；漏三个不算', () => {
  const two = seq(1, 20).filter(n => n !== 4 && n !== 14).join(' ');
  assert.equal(checkCount(two).ok, true);
  const three = seq(1, 20).filter(n => ![4, 9, 14].includes(n)).join(' ');
  const r = checkCount(three);
  assert.equal(r.ok, false); assert.deepEqual(r.missing, [4, 9, 14]);
  assert.match(countFeedback(r), /漏了 4、9、14/);
});
test('只数到 12：不过关，告诉他数到哪了', () => {
  const r = checkCount(seq(1, 12).join(' '));
  assert.equal(r.ok, false); assert.equal(r.reached, 12);
  assert.match(countFeedback(r), /数到了 12/);
});
test('跳着说几个数不算：要按顺序', () => {
  assert.equal(checkCount('1 20').ok, false);
  assert.equal(checkCount('20 19 18 17 16 15 14 13 12 11 10 9 8 7 6 5 4 3 2 1').ok, false);
});
test('中间说错一个又接着数，取最长的一串', () => {
  const r = checkCount([...seq(1, 7), 3, ...seq(8, 20)].join(' '));
  assert.equal(r.ok, true); assert.deepEqual(r.got, seq(1, 20));
});
test('没听到数字', () => {
  const r = checkCount('你好呀');
  assert.equal(r.ok, false); assert.match(countFeedback(r), /没听到数字/);
});
