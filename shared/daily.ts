// 商用版 P0 小样的规则：孩子档案（年龄 → 阶段）、每天三件事（复习 + 新学 + 动手）、昨天回顾的问题和判断。
// 画面只负责展示；这里的判断都有测试（tests/daily.test.ts）。

import { NODES, THEME_DOMAIN, dayIndex, dayKey, nodeState, openAreas, type DomainId, type Node } from './platform';
import { readNumbers } from './modules/count';

// —— 孩子档案 ——
export const LIKES = [
  { id: 'dino', name: '恐龙', e: '🦖' }, { id: 'car', name: '汽车', e: '🚗' }, { id: 'space', name: '太空', e: '🚀' },
  { id: 'animal', name: '小动物', e: '🐰' }, { id: 'castle', name: '城堡', e: '🏰' }, { id: 'sea', name: '大海', e: '🐳' }
] as const;
export type LikeId = typeof LIKES[number]['id'];
export type Profile = { name: string; birth: string; city: string; likes: LikeId[] };   // birth: 'YYYY-MM'

/** 满几岁几个月 */
export function ageOf(birth: string, now = new Date()) {
  const [y, m] = birth.split('-').map(Number);
  let months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
  if (months < 0) months = 0;
  return { years: Math.floor(months / 12), months: months % 12, total: months };
}
/** 阶段：按年龄（月）大致对应幼儿园和小学；大班最后半年同时是“幼小衔接期” */
export const STAGES = [
  { id: 'k1', name: '小班', from: 36 }, { id: 'k2', name: '中班', from: 48 }, { id: 'k3', name: '大班', from: 60 },
  { id: 'g1', name: '一年级', from: 72 }, { id: 'g2', name: '二年级', from: 84 }, { id: 'g3', name: '三年级以上', from: 96 }
] as const;
export function stageOf(birth: string, now = new Date()) {
  const { total } = ageOf(birth, now);
  const s = [...STAGES].reverse().find(x => total >= x.from) ?? STAGES[0];
  return { ...s, bridge: s.id === 'k3' && total >= 66, tooYoung: total < 36 };
}
export function ageText(birth: string, now = new Date()) {
  const a = ageOf(birth, now), s = stageOf(birth, now);
  return `${a.years} 岁 ${a.months} 个月 · ${s.name}${s.bridge ? '（幼小衔接期）' : ''}`;
}

// —— 每天三件事：复习一个、学一个新的、动手玩一个 ——
type Ev = { at: string; type: string; node?: string };
/** 复习间隔：学会后第 1、3、7、14 天回来看一眼 */
export const REVIEW_DAYS = [1, 3, 7, 14];
const daysBetween = (a: Date, b: Date) => Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);

/** 该复习的那一关：按间隔到期的里面挑最近学的；没有到期的，就挑昨天学的 */
export function reviewPick(events: Ev[], now = new Date()): Node | null {
  const firstDone = new Map<string, Date>();
  for (const e of events) if (e.type === 'complete' && e.node && !firstDone.has(e.node)) firstDone.set(e.node, new Date(e.at));
  const due = [...firstDone.entries()].filter(([, d]) => REVIEW_DAYS.includes(daysBetween(d, now))).sort((a, b) => b[1].getTime() - a[1].getTime());
  const id = due[0]?.[0];
  return id ? NODES.find(n => n.id === id) ?? null : null;
}
/** 昨天点亮过的关（开场时“昨天你……”用） */
export function yesterdayDone(events: Ev[], now = new Date()): Node[] {
  const y = new Date(now); y.setDate(y.getDate() - 1);
  const key = dayKey(y), ids = new Set(events.filter(e => e.type === 'complete' && e.node && dayKey(new Date(e.at)) === key).map(e => e.node!));
  return NODES.filter(n => ids.has(n.id));
}

/** 能在屏幕上动手玩的关卡（有 3D 工作台或小游戏的） */
export const PLAYABLE_MODULES = new Set(['car', 'lights', 'flowers']);

export type DailyThree = { review: Node | null; learn: Node | null; play: Node | null; theme: DomainId | null };
/** review：可以指定要复习的那一关（比如演示时），其余两件会避开它 */
export function dailyThree(p: { done: string[]; events: Ev[]; areas?: Record<string, boolean> }, now = new Date(), review: Node | null = reviewPick(p.events, now)): DailyThree {
  const done = new Set(p.done), open = openAreas(p), theme = THEME_DOMAIN[dayIndex(now)];
  const canLearn = (n: Node) => open.has(n.a) && !done.has(n.id) && nodeState(n.id, done) === 'now';
  // 新学：先在今天的探险日大陆里找，没有就在别的大陆找
  const learnPool = NODES.filter(canLearn);
  const learn = learnPool.find(n => n.d === theme && n.id !== review?.id) ?? learnPool.find(n => n.id !== review?.id) ?? null;
  // 动手：能玩的工作台/小游戏，优先还没玩过的，不和上面两件重复
  const labs = NODES.filter(n => n.module && PLAYABLE_MODULES.has(n.module) && open.has(n.a) && nodeState(n.id, done) !== 'lock' && n.id !== learn?.id && n.id !== review?.id);
  // 没有可玩的工作台时，退而求其次：挑一个现在能做的“动手”关（尽量不和新学的在同一块大陆）
  const handsOn = learnPool.filter(n => n.id !== learn?.id && n.id !== review?.id && n.how.some(h => h === '动手' || h === '3D' || h === '拆解'))
    .sort((a, b) => Number(a.d === learn?.d) - Number(b.d === learn?.d));
  const play = labs.find(n => !done.has(n.id)) ?? labs[0] ?? handsOn[0] ?? null;
  return { review, learn, play, theme };
}

// —— 昨天回顾：小诺问一个问题，孩子用语音回答 ——
export type ReviewQ = { q: string; check: (said: string) => boolean; yes: string; no: string };
const has = (said: string, ...words: string[]) => words.some(w => said.includes(w));
export const REVIEW_QUESTIONS: Record<string, ReviewQ> = {
  m1: {
    q: '你帮小兔子摘花的时候，摘多了怎么办呀？',
    check: s => has(s, '放回', '放回去', '拿走', '拿掉', '还回', '少一'),
    yes: '对啦，多了就放回去一朵！你记得真清楚。', no: '摘多了，就把一朵放回去，这样刚刚好。'
  },
  c2: {
    q: '红光和绿光叠在一起，变成了什么颜色？',
    check: s => has(s, '黄'), yes: '是黄色！光叠在一起会变亮。', no: '是黄色哦！红光加绿光，会变成亮亮的黄色。'
  },
  v3: {
    q: '小车从高高的坡上冲下来，跑得远还是近？',
    check: s => has(s, '远', '快'), yes: '对！坡越高，冲得越远。', no: '坡越高，小车冲得越远哦。'
  }
};
/** 没有专门问题的关卡：请孩子说说做了什么，说了就夸（不判对错） */
export function reviewQuestion(n: Node): ReviewQ {
  return REVIEW_QUESTIONS[n.id] ?? {
    q: `你还记得「${n.name}」吗？说一说你做了什么？`,
    check: s => s.replace(/\s/g, '').length >= 2,
    yes: '说得真好！', no: `「${n.name}」是要${n.goal}。下次你来讲给我听！`
  };
}
/** 数字类的问题也可以直接说数字 */
export const saidNumber = (s: string) => readNumbers(s, 100)[0] ?? null;
