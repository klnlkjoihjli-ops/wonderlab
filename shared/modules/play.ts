// 发现岛竖切用到的另外五种玩法：配一配、放大镜（也用来做地图找一找）、小剧场、排顺序、生活任务卡。
// 和“分一分”一样：不出考试题，错了世界“不对劲”，角色温和提醒；所有判断都在这里，画面只负责显示。

// —— 配一配：左边一个、右边一个，配成一对 ——
export type Pair = { a: [string, string]; b: [string, string] };        // [图标, 名字]
export type MatchLevel = { npc: string; ask: string; pairs: Pair[]; ok: string; outro: string };
/** 把第 i 个左边的和第 j 个右边的配在一起：对了返回 true */
export const matchOk = (lv: MatchLevel, i: number, j: number) => i === j && i >= 0 && i < lv.pairs.length;
/** 右边一列打乱顺序（固定打乱，测试可重复）：返回原来的下标 */
export function shuffled(n: number, seed = 7): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  let s = seed;
  for (let i = n - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor((s / 233280) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  if (n > 1 && a.every((v, i) => v === i)) a.push(a.shift()!);   // 不能正好是原来的顺序
  return a;
}

// —— 放大镜 / 找一找：每一轮一个问题，从几样东西里找到对的 ——
export type SpotTile = { icon: string; name: string; ok?: boolean; say?: string };
export type SpotRound = { ask: string; tiles: SpotTile[]; hidden?: boolean; hint: string; found: string };
export type SpotLevel = { npc: string; intro: string; rounds: SpotRound[]; outro: string };
/** 点了一样东西：找到了，或者角色说一句（不是它也没关系） */
export function spotTap(r: SpotRound, k: number): { ok: boolean; say: string } {
  const t = r.tiles[k];
  if (!t) return { ok: false, say: '' };
  if (t.ok) return { ok: true, say: r.found };
  return { ok: false, say: t.say ?? `这是${t.name}，再找找看？` };
}

// —— 小剧场：一个场景几个选择；不安全/不合适的会“倒带”再选 ——
export type Choice = { t: string; good: boolean; then: string };
export type Scene = { set: string; ask: string; choices: Choice[] };
export type SceneLevel = { npc: string; intro: string; scenes: Scene[]; outro: string };
export function choose(s: Scene, k: number): { good: boolean; say: string; rewind: boolean } {
  const c = s.choices[k];
  if (!c) return { good: false, say: '', rewind: false };
  return { good: c.good, say: c.then, rewind: !c.good };
}

// —— 排顺序：把打乱的卡片按顺序一张张放进格子 ——
export type OrderLevel = { npc: string; ask: string; steps: [string, string][]; loop?: boolean; outro: string };
/** 第 slot 个格子放第 k 张卡：只有该放的那张才放得进去 */
export const orderOk = (slot: number, k: number) => slot === k;

// —— 生活任务卡：线下去做，回来汇报；需要几天的每天记一次，最后家长确认 ——
export type MissionLevel = {
  npc: string; title: string; todo: string[];          // 任务卡上写什么
  days: number;                                        // 要做几天（1 = 做一次）
  report: string;                                      // 回来怎么汇报
  choices?: string[];                                  // 汇报时可以选的（比如天气）
  sum?: { pick: string; say: (n: number, days: number) => string };   // 做完以后数一数（比如晴天有几天）
  outro: string;
};
export type MissionRecord = { day: string; pick?: string };
/** 今天能不能再记一次：一天只能记一次（线框版演示可以跳过这条） */
export const canRecord = (recs: MissionRecord[], today: string, lv: MissionLevel) => recs.length < lv.days && !recs.some(r => r.day === today);
/** 记够了天数就等家长确认 */
export const needsParent = (recs: MissionRecord[], lv: MissionLevel) => recs.length >= lv.days;

// ===================== 发现岛（幼儿园段）的内容 =====================

export const MATCH_LEVELS: Record<string, MatchLevel> = {
  l6: {
    npc: '刺猬园丁', ask: '动物宝宝走丢啦，帮它们找到妈妈！先点宝宝，再点妈妈。',
    pairs: [{ a: ['🐔', '鸡妈妈'], b: ['🐥', '小鸡'] }, { a: ['🐕', '狗妈妈'], b: ['🐶', '小狗'] }, { a: ['🐈', '猫妈妈'], b: ['🐱', '小猫'] }],
    ok: '宝宝跑回妈妈身边啦！', outro: '三个宝宝都回家了，农场里热闹起来了。'
  },
  l4: {
    npc: '刺猬园丁', ask: '农场的动物饿了，帮它们找到爱吃的东西！先点动物，再点食物。',
    pairs: [
      { a: ['🐼', '大熊猫'], b: ['🎋', '竹子'] }, { a: ['🐯', '老虎'], b: ['🥩', '肉'] }, { a: ['🐿️', '松鼠'], b: ['🌰', '坚果'] },
      { a: ['🐄', '奶牛'], b: ['🌾', '青草'] }, { a: ['🐒', '猴子'], b: ['🍌', '香蕉'] }
    ],
    ok: '吃得好香！', outro: '吃草的动物牙齿平平的，像磨盘；吃肉的老虎牙齿尖尖的，像小刀。'
  }
};

export const SPOT_LEVELS: Record<string, SpotLevel> = {
  c9: {
    npc: '变色龙彩彩', intro: '用放大镜看看，这些东西上藏着眼睛看不清的秘密！点一下就能放大。',
    rounds: [
      { ask: '放大一片树叶，找到给叶子送水的“小路”。', hidden: true, tiles: [{ icon: '🌿', name: '叶脉', ok: true }, { icon: '🟩', name: '叶子的绿色', say: '绿绿的，再找找细细的线？' }, { icon: '💧', name: '一颗露珠', say: '是露珠！不过我们在找“小路”。' }], hint: '找一找叶子上细细的线。', found: '找到了！这叫叶脉，像小路一样把水送到叶子的每个地方。' },
      { ask: '放大你的手指，找到一圈一圈的花纹。', hidden: true, tiles: [{ icon: '👆', name: '指纹', ok: true }, { icon: '💅', name: '指甲', say: '这是指甲，花纹在手指肚上哦。' }, { icon: '✋', name: '手心', say: '手心也有纹路，再看看手指尖？' }], hint: '看手指尖那一面。', found: '找到了！这是指纹，每个人的指纹都不一样。' },
      { ask: '放大一块布，找到一根一根交叉的线。', hidden: true, tiles: [{ icon: '🧵', name: '交叉的线', ok: true }, { icon: '🎨', name: '布上的颜色', say: '颜色很好看，再看看布是用什么做的？' }, { icon: '🔘', name: '纽扣', say: '是纽扣！我们在找布里面的线。' }], hint: '布是用线织出来的。', found: '找到了！布是很多线一上一下织起来的。' }
    ],
    outro: '放大镜让小东西变大，你发现了三个秘密！'
  },
  l9: {
    npc: '刺猬园丁', intro: '农场里这棵树，一年四季样子都不一样。',
    rounds: [
      { ask: '哪一张是春天的树？', tiles: [{ icon: '🌸', name: '开满了花', ok: true }, { icon: '🍂', name: '叶子变黄掉下来', say: '叶子变黄掉下来，是秋天。' }, { icon: '🌳', name: '叶子又绿又密', say: '又绿又密，像夏天。' }, { icon: '🌲❄️', name: '枝上盖着雪', say: '下雪了，是冬天。' }], hint: '春天会开花。', found: '对，春天树上开满了花。' },
      { ask: '哪一张是秋天的树？', tiles: [{ icon: '🌳', name: '叶子又绿又密', say: '这是夏天的样子。' }, { icon: '🍂', name: '叶子变黄掉下来', ok: true }, { icon: '🌸', name: '开满了花', say: '这是春天的样子。' }], hint: '秋天叶子会变颜色。', found: '对，秋天叶子变黄，一片片掉下来。' },
      { ask: '春天和秋天的树，哪里不一样？找到秋天才有的东西。', tiles: [{ icon: '🍁', name: '落在地上的叶子', ok: true }, { icon: '🌸', name: '花', say: '花是春天的。' }, { icon: '🐝', name: '小蜜蜂', say: '小蜜蜂春天最忙。' }], hint: '看看树下的地上。', found: '对，秋天地上铺满了落叶。' }
    ],
    outro: '一棵树，一年转一圈：开花、长叶、叶黄、落叶。'
  },
  g2: {
    npc: '小熊猫望望', intro: '天文台的地球仪转起来啦！我们一起找到中国。',
    rounds: [
      { ask: '地球上蓝色的是海，其他颜色的是陆地。找到一块陆地！', tiles: [{ icon: '🌊', name: '大海', say: '这是海，蓝蓝的。' }, { icon: '🟩', name: '陆地', ok: true }, { icon: '☁️', name: '云', say: '这是云，飘在天上。' }], hint: '找不是蓝色、也不是云的地方。', found: '对！我们就住在陆地上。' },
      { ask: '中国是大熊猫的家，找到大熊猫住的地方！', tiles: [{ icon: '🦘', name: '袋鼠住的地方', say: '袋鼠住在澳大利亚，离中国很远。' }, { icon: '🐼', name: '大熊猫住的地方', ok: true }, { icon: '🐧', name: '企鹅住的地方', say: '企鹅住在很冷很冷的南极。' }], hint: '黑白相间、爱吃竹子的动物。', found: '找到中国啦！它在地球上亮起来了。' },
      { ask: '我们是哪国人？', tiles: [{ icon: '🇨🇳', name: '中国人', ok: true }, { icon: '🐼', name: '大熊猫', say: '大熊猫是中国的宝贝，我们是……？' }], hint: '我们住在中国。', found: '对，我们是中国人！' }
    ],
    outro: '地球仪上的中国亮起来了，下次我们去找南京！'
  }
};

export const SCENE_LEVELS: Record<string, SceneLevel> = {
  l11: {
    npc: '刺猬园丁', intro: '农场的小生命遇到了一些事，你会怎么做？',
    scenes: [
      { set: '🌼 小路边开着一朵小花。', ask: '你会怎么做？', choices: [
        { t: '摘下来带回家', good: false, then: '花离开了土，很快就会枯掉。留在这里，大家都能看到它。我们再选一次？' },
        { t: '蹲下来闻一闻、看一看', good: true, then: '好香！小花还在路边开着，明天你还能来看它。' },
        { t: '踩过去', good: false, then: '小花被踩倒了，它会疼的。我们绕开它，再选一次？' }] },
      { set: '🐦 一只小鸟从树上的窝里掉下来了。', ask: '你会怎么做？', choices: [
        { t: '抓回家自己养', good: false, then: '小鸟宝宝要鸟妈妈喂，在家里很难养活。我们再想想？' },
        { t: '告诉大人，请大人帮忙', good: true, then: '大人戴上手套，把小鸟轻轻放回了窝里，鸟妈妈飞回来了。' },
        { t: '用树枝戳一戳', good: false, then: '小鸟吓坏了。它已经很害怕，我们换个办法？' }] }
    ],
    outro: '小花、小鸟也是生命，爱护它们，农场就会越来越热闹。'
  },
  g12: {
    npc: '小熊猫望望', intro: '天文台的地球“生病了”，我们来帮帮它！',
    scenes: [
      { set: '🚰 刷牙的时候，水龙头一直哗哗地开着。', ask: '怎么办？', choices: [
        { t: '先关上水龙头，要用水再开', good: true, then: '省下了一大杯水！地球笑了一下。' },
        { t: '开着没关系', good: false, then: '水哗哗地流走了，很多地方缺水呢。再选一次？' }] },
      { set: '🥤 喝完了一瓶饮料，瓶子空了。', ask: '瓶子放哪儿？', choices: [
        { t: '扔在草地上', good: false, then: '瓶子在草地上很久都不会烂掉。我们换个地方？' },
        { t: '放进可回收物的桶', good: true, then: '瓶子会被做成新的东西！' }] },
      { set: '💡 出门的时候，房间里的灯还亮着。', ask: '怎么办？', choices: [
        { t: '随手关灯', good: true, then: '关灯省电，地球又好一点了。' },
        { t: '开着吧，回来还要用', good: false, then: '没人的时候灯也一直在用电哦。再选一次？' }] }
    ],
    outro: '地球是我们和动植物共同的家，你帮它变好了！'
  }
};

export const ORDER_LEVELS: Record<string, OrderLevel> = {
  l5: {
    npc: '刺猬园丁', ask: '一只毛毛虫是怎么变成蝴蝶的？把卡片按顺序放好。',
    steps: [['🥚', '卵'], ['🐛', '毛毛虫'], ['🟫', '蛹'], ['🦋', '蝴蝶']],
    outro: '卵 → 毛毛虫 → 蛹 → 蝴蝶，蝴蝶飞出来啦！'
  },
  g11: {
    npc: '小熊猫望望', ask: '一年有四季，从春天开始，把它们按顺序排成一圈。', loop: true,
    steps: [['🌸', '春'], ['☀️', '夏'], ['🍂', '秋'], ['⛄', '冬']],
    outro: '冬天过完，又回到了春天——四季就这样一年转一圈。'
  }
};

export const MISSION_LEVELS: Record<string, MissionLevel> = {
  l1: { npc: '刺猬园丁', title: '种一颗豆子', todo: ['找一个杯子，铺上湿纸巾', '放一颗豆子，放在有阳光的地方', '每天看一看，加一点水'], days: 5, report: '今天豆子有什么变化？', choices: ['还没变化', '鼓起来了', '冒出小芽', '长出叶子'], outro: '你的豆子发芽了，农场里的豆子也跟着长高了！' },
  l7: { npc: '刺猬园丁', title: '捡三种树叶', todo: ['和爸爸妈妈去公园或小区', '捡三片不一样的树叶', '比一比：颜色、形状、大小'], days: 1, report: '你的三片叶子哪里不一样？', choices: ['颜色不一样', '形状不一样', '大小不一样'], outro: '三片叶子收进了农场图鉴！' },
  l8: { npc: '刺猬园丁', title: '看蚂蚁五分钟', todo: ['找到一队蚂蚁，蹲下来', '安静地看五分钟，不打扰它们', '回来画一画蚂蚁在做什么'], days: 1, report: '蚂蚁在做什么？', choices: ['排队走路', '搬东西', '碰碰触角'], outro: '你是认真的小观察员！' },
  l12: { npc: '刺猬园丁', title: '照顾一盆植物', todo: ['选家里的一盆植物', '每天看看土干不干，干了就浇一点水', '坚持一周'], days: 7, report: '今天给植物浇水了吗？', choices: ['浇了水', '土还是湿的，没浇'], outro: '坚持了一周！你的植物有你照顾真幸福。' },
  v12: { npc: '河狸师傅', title: '我的小发明', todo: ['找纸盒、瓶盖、吸管、胶带', '做一个会动的小玩具（车、风车都行）', '做不出来就换个办法，不放弃'], days: 1, report: '你做了什么？', choices: ['会跑的小车', '会转的风车', '别的小发明'], outro: '你的小发明放进了工坊展台！' },
  g13: {
    npc: '小熊猫望望', title: '天气记录表', todo: ['每天看看窗外的天气', '在记录表上画一画（选一个天气）', '记满一周，数一数晴天有几天'], days: 7, report: '今天是什么天气？', choices: ['☀️ 晴', '☁️ 阴', '🌧️ 雨', '❄️ 雪'],
    sum: { pick: '☀️ 晴', say: (n, d) => `这 ${d} 天里，晴天有 ${n} 天${n > d / 2 ? '，大多数是晴天！' : n === 0 ? '，一天都没有，这周天气不太好。' : '。'}` },
    outro: '你做了一张自己的天气记录表！'
  }
};
