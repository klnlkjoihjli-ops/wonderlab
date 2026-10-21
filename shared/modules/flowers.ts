// 游戏 · 帮小兔子摘花（数和计算 · 小班：点数、按数取物）
// 不是背“一二三四”，而是一朵花对一个数：摘一朵说一朵，摘够了兔子开心，摘多了兔子会说太多啦。
// 中间穿插“篮子里有几朵？”，让孩子从“数出来”走到“知道一共几个”。
// 所有判断都在这里，小诺和兔子只负责说。

import { cnNumber } from './count';

/** 说数量时用“两朵”，不说“二朵”——顺便学会量词 */
export function amount(n: number, unit = '朵'): string {
  return (n === 2 ? '两' : cnNumber(n)) + unit;
}

export type Round =
  | { kind: 'pick'; need: number; who: string; why: string }          // 摘够 need 朵给 who
  | { kind: 'howMany'; have: number; choices: number[] };              // 篮子里已经有 have 朵，选出是几

/** 一轮一轮慢慢加：先 1，再 3、5，中间问“有几朵”，最后摘 7 朵 */
export const ROUNDS: Round[] = [
  { kind: 'pick', need: 1, who: '兔妈妈', why: '今天是兔妈妈的生日' },
  { kind: 'pick', need: 3, who: '三只小兔', why: '一只小兔一朵' },
  { kind: 'howMany', have: 4, choices: [3, 4, 5] },
  { kind: 'pick', need: 5, who: '花瓶', why: '要插满一个花瓶' },
  { kind: 'howMany', have: 6, choices: [5, 6, 8] },
  { kind: 'pick', need: 7, who: '生日蛋糕', why: '蛋糕上要摆一圈花' }
];

export type PickState = 'more' | 'done' | 'tooMany';
/** 摘到 have 朵时的情况 */
export function pickState(need: number, have: number): PickState {
  return have < need ? 'more' : have === need ? 'done' : 'tooMany';
}

/** 摘一朵时只报数：够不够要孩子自己判断，觉得够了再“送给小兔子” */
export function pickSay(have: number): string { return `${amount(have)}！`; }
/** 送给小兔子：不够、刚好、太多，各说各的 */
export function giveSay(r: Extract<Round, { kind: 'pick' }>, have: number): { state: PickState; text: string } {
  const state = pickState(r.need, have);
  if (state === 'done') return { state, text: `${amount(have)}，刚刚好！谢谢你！` };
  if (state === 'more') return { state, text: have ? `现在只有${amount(have)}，${r.who}要${amount(r.need)}，还不够哦，再摘一点。` : `篮子还是空的呢，先去花丛里摘花吧。` };
  return { state, text: `${amount(have)}……太多啦！${r.who}只要${amount(r.need)}。点一下篮子，放回去一朵。` };
}
/** 从篮子里放回一朵时说的话（只报现在几朵，还是让孩子自己判断） */
export function putBackSay(have: number): string { return `放回去一朵，现在是${amount(have)}。`; }

export function roundIntro(r: Round): string {
  if (r.kind === 'pick') return `${r.why}，想要${amount(r.need)}花。帮我摘${amount(r.need)}好不好？一边摘一边数，觉得够了就点“送给小兔子”。`;
  return '小兔子把花摆在地上了。用手指点着数一数，一共有几朵？';
}
export function howManySay(r: Extract<Round, { kind: 'howMany' }>, pick: number): { ok: boolean; text: string } {
  if (pick === r.have) return { ok: true, text: `对啦，一共${amount(r.have)}！` };
  return { ok: false, text: pick < r.have ? `比${cnNumber(pick)}多一点哦，用手指一朵一朵点着数。` : `比${cnNumber(pick)}少一点哦，用手指一朵一朵点着数。` };
}

/** 进度：做到第几轮；全部做完就过关 */
export type FlowersProgress = { round: number; mistakes: number };
export const freshFlowersProgress = (): FlowersProgress => ({ round: 0, mistakes: 0 });
export const flowersPassed = (p: FlowersProgress) => p.round >= ROUNDS.length;
