// 玩法 · 分一分：一堆东西散在地上，孩子把它们放进几个筐里。
// 不出考试题：放错了东西会“弹回来”，角色说“这个好像不太一样，再看看”；没有红叉、没有扣分。
// 全部分好后，角色问“你是按什么分的？”，让孩子自己说出规则。
// 同一个玩法给很多关用：每关只换筐、东西和角色的话。所有判断都在这里，画面只负责显示。

import type { AgeId } from '../platform';

export type Bin = { id: string; name: string; icon: string; color?: string };
export type Item = { id: string; icon: string; name: string; bin: string };
export type SortLevel = {
  npc: string;                 // 谁在请孩子帮忙
  ask: string;                 // 角色的请求
  bins: Bin[];
  items: Item[];
  why: string;                 // 全部分好后，角色说出这样分的道理
};

/** 每个年龄最多几个筐（小班 2 个、中班 3 个、大班以上 4 个） */
export const MAX_BINS: Record<AgeId, number> = { k1: 2, k2: 3, k3: 4, br: 4, g1: 4 };

export type Placed = Record<string, string>;     // 东西 id → 放进的筐 id
export type PlaceResult = { ok: boolean; placed: Placed; done: boolean; say: string };

/** 把一样东西放进一个筐：对了留在筐里，不对就弹回来；全部放好就算完成 */
export function place(level: SortLevel, placed: Placed, itemId: string, binId: string): PlaceResult {
  const item = level.items.find(i => i.id === itemId);
  const bin = level.bins.find(b => b.id === binId);
  if (!item || !bin) return { ok: false, placed, done: isDone(level, placed), say: '' };
  if (placed[itemId]) return { ok: true, placed, done: isDone(level, placed), say: `${item.name}已经放好啦。` };
  if (item.bin !== binId) return { ok: false, placed, done: false, say: `${item.name}放进“${bin.name}”，好像不太一样，再看看？` };
  const next = { ...placed, [itemId]: binId };
  const done = isDone(level, next);
  return { ok: true, placed: next, done, say: done ? '全部分好啦！' : `${item.name}，放好了！` };
}
export const isDone = (level: SortLevel, placed: Placed) => level.items.every(i => placed[i.id] === i.bin);
export const leftCount = (level: SortLevel, placed: Placed) => level.items.filter(i => !placed[i.id]).length;

const it = (bin: string, list: [string, string][]): Item[] => list.map(([icon, name], k) => ({ id: `${bin}${k}`, icon, name, bin }));

/** 小样先做 5 关，跨 5 座岛、3 个年龄段：同一个玩法换内容 */
export const SORT_LEVELS: Record<string, SortLevel> = {
  l3: {
    npc: '刺猬园丁', ask: '小动物们找不到家了，帮它们回家吧！会飞的回天上，会游的回水里。',
    bins: [{ id: 'sky', name: '天上', icon: '☁️' }, { id: 'water', name: '水里', icon: '🌊' }],
    items: [...it('sky', [['🐦', '小鸟'], ['🦋', '蝴蝶'], ['🦅', '老鹰']]), ...it('water', [['🐟', '小鱼'], ['🐳', '鲸鱼'], ['🐙', '章鱼']])],
    why: '会飞的住在天上，会游的住在水里。'
  },
  m3: {
    npc: '熊师傅', ask: '城堡要用砖啦！帮我把圆的、方的、三角的分开。',
    bins: [{ id: 'round', name: '圆圆的', icon: '⚪' }, { id: 'square', name: '方方的', icon: '🟧' }, { id: 'tri', name: '三角的', icon: '🔺' }],
    items: [...it('round', [['⚽', '足球'], ['🍩', '甜甜圈'], ['🪙', '硬币']]), ...it('square', [['🎁', '礼物盒'], ['📦', '纸箱'], ['🖼️', '画框']]), ...it('tri', [['🍕', '披萨'], ['📐', '三角尺'], ['⛺', '帐篷']])],
    why: '有的边是弯弯的，有的四条边一样长，有的只有三条边。'
  },
  c7: {
    npc: '变色龙彩彩', ask: '我想住进两个房间：暖暖的房间和凉凉的房间，帮我把颜色送进去！',
    bins: [{ id: 'warm', name: '暖暖的', icon: '🔥', color: '#f6a04d' }, { id: 'cool', name: '凉凉的', icon: '❄️', color: '#6aa9e8' }],
    items: [...it('warm', [['☀️', '太阳'], ['🍊', '橘子'], ['🍓', '草莓'], ['🌻', '向日葵']]), ...it('cool', [['🌊', '海浪'], ['🫐', '蓝莓'], ['🍇', '葡萄'], ['🧊', '冰块']])],
    why: '红、橙、黄让人觉得暖暖的，像太阳和火；蓝、绿、紫让人觉得凉凉的，像海和冰。'
  },
  v20: {
    npc: '河狸师傅', ask: '工坊里东西太乱了！哪些是大自然里本来就有的，哪些是人做出来的？',
    bins: [{ id: 'nature', name: '大自然的', icon: '🌳' }, { id: 'made', name: '人做的', icon: '🏭' }],
    items: [...it('nature', [['🪨', '石头'], ['🍂', '树叶'], ['🐚', '贝壳'], ['🌸', '花']]), ...it('made', [['🥤', '杯子'], ['✏️', '铅笔'], ['🧸', '小熊玩具'], ['🚗', '小汽车']])],
    why: '石头、树叶、贝壳、花本来就长在大自然里；杯子、铅笔、玩具、汽车是人用材料做出来的。'
  },
  b24: {
    npc: '河马牙牙', ask: '南京的垃圾要分四类，帮我把垃圾扔进对的桶吧！',
    bins: [
      { id: 'recycle', name: '可回收物', icon: '♻️', color: '#3b7dd8' }, { id: 'harm', name: '有害垃圾', icon: '☠️', color: '#d9534f' },
      { id: 'kitchen', name: '厨余垃圾', icon: '🥬', color: '#4caf50' }, { id: 'other', name: '其他垃圾', icon: '🗑️', color: '#8a8f98' }
    ],
    items: [...it('recycle', [['📰', '旧报纸'], ['📦', '纸箱']]), ...it('harm', [['🔋', '旧电池'], ['💊', '过期药']]), ...it('kitchen', [['🍌', '香蕉皮'], ['🥬', '菜叶']]), ...it('other', [['🧻', '用过的纸巾']])],
    why: '能再做成新东西的是可回收物，对人和环境有危险的是有害垃圾，吃剩的是厨余垃圾，剩下的是其他垃圾。'
  }
};
