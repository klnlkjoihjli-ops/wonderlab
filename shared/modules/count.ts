// 语音过关 · 数到 20：把语音识别出来的文字变成数字，再按规则判断数得对不对。
// 比的是“文字”，不是声音：孩子的发音各不相同，直接比声音很不可靠；识别成文字后按顺序对数字最稳。
// 识别结果可能是“1 2 3 … 20”，也可能是“一二三……十九二十”连在一起，两种都要认。

const CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
/** 1–99 的中文写法：十、十一、二十、二十一 */
export function cnNumber(n: number): string {
  if (n < 10) return CN[n];
  const t = Math.floor(n / 10), o = n % 10;
  return (t === 1 ? '十' : CN[t] + '十') + CN[o];
}
/** 一个数可能被识别成的样子：阿拉伯数字、中文；“二”也常被识别成“两” */
function forms(n: number): string[] {
  const f = [String(n), cnNumber(n)];
  if (n === 2) f.push('两');
  return f;
}

/**
 * 从识别文字里按顺序读出数字。
 * 做法：一边往后读，一边“期待”下一个数；先试下一个数，对不上再试其它数（最长的写法优先），都不是就跳过这个字。
 * 这样“十一十二”会读成 11、12，而不是 10、1、10、2。
 */
export function readNumbers(text: string, max = 20): number[] {
  const s = text.replace(/[\s,，、。.!！?？;；]+/g, '');
  const all: [number, string][] = [];
  for (let n = 1; n <= max; n++) for (const f of forms(n)) all.push([n, f]);
  all.sort((a, b) => b[1].length - a[1].length);
  const out: number[] = [];
  let i = 0, expect = 1;
  while (i < s.length) {
    const exp = forms(expect).sort((a, b) => b.length - a.length).find(f => s.startsWith(f, i));
    if (exp) { out.push(expect); i += exp.length; expect++; continue; }
    const any = all.find(([, f]) => s.startsWith(f, i));
    if (any) { out.push(any[0]); i += any[1].length; expect = any[0] + 1; continue; }
    i++;
  }
  return out;
}

export type CountResult = {
  ok: boolean;
  got: number[];          // 按顺序数对了的数（用来在屏幕上点亮）
  missing: number[];      // 1..target 里没听到的
  reached: number;        // 顺着数到的最大的数
};
/** 允许漏掉的个数：识别偶尔会听错一两个（比如把“四”听成“是”），不能因为这个就不让孩子过关 */
export const COUNT_SLACK = 2;

/**
 * 判断有没有从 1 数到 target。
 * 取“按顺序变大”的最长一串数，看它覆盖了 1..target 的多少；要数到 target，并且最多漏 COUNT_SLACK 个。
 */
export function checkCount(text: string, target = 20): CountResult {
  const nums = readNumbers(text, target).filter(n => n >= 1 && n <= target);
  // 最长严格递增子序列（数字最多几十个，用简单的 O(n²) 就够）
  const len = nums.map(() => 1), prev = nums.map(() => -1);
  for (let i = 0; i < nums.length; i++) for (let j = 0; j < i; j++) if (nums[j] < nums[i] && len[j] + 1 > len[i]) { len[i] = len[j] + 1; prev[i] = j; }
  let best = -1; for (let i = 0; i < nums.length; i++) if (best < 0 || len[i] > len[best] || (len[i] === len[best] && nums[i] > nums[best])) best = i;
  const got: number[] = []; for (let i = best; i >= 0; i = prev[i]) got.unshift(nums[i]);
  const have = new Set(got);
  const missing = Array.from({ length: target }, (_, k) => k + 1).filter(n => !have.has(n));
  const reached = got.length ? got[got.length - 1] : 0;
  return { ok: reached === target && missing.length <= COUNT_SLACK, got, missing, reached };
}

/** 小诺怎么说：过了就夸；没过就说清楚卡在哪，下一次怎么做 */
export function countFeedback(r: CountResult, target = 20): string {
  if (r.ok) return r.missing.length ? `数到 ${target} 啦！小诺有 ${r.missing.length} 个没听清，不过你一定数对了。` : `1 到 ${target}，一个都没漏！太棒了！`;
  if (r.got.length === 0) return '小诺没听到数字。靠近一点，大声一点，从 1 开始数吧。';
  if (r.reached < target) return `你数到了 ${r.reached}，再往后数，一直数到 ${target}！`;
  return `中间好像漏了 ${r.missing.slice(0, 4).join('、')}，我们慢慢地再数一次。`;
}
