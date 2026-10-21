// 玩法 · 猜一猜·试一试：先猜会怎样，再动手试，看结果，和猜的比一比。
// 一关是几次小实验（trial）。小班只做不猜（没有选项，直接“试一试”）；中班起先猜再试。
// 猜错不算错：结果出来后角色说“和你猜的不一样，科学家就是这样发现的”。判断都在这里，画面只负责显示。

export type Trial = {
  ask: string;              // 角色的问题（或小班的动作说明）
  show: string;             // 实验前画面上的东西（emoji + 文字）
  act: string;              // 动手按钮上写什么：搅一搅、放进水里……
  options?: string[];       // 可以猜的答案；没有就是只做不猜
  answer?: number;          // 正确答案在 options 里的位置
  result: string;           // 实验后画面变成什么
  explain: string;          // 角色解释为什么
};
export type LabLevel = { npc: string; intro: string; trials: Trial[]; outro: string };

export type Guess = { trial: number; pick: number | null };
/** 看完结果，角色怎么回应孩子的猜测：猜对、猜错（不算错）、或者没猜（小班） */
export function react(t: Trial, pick: number | null): { same: boolean | null; say: string } {
  if (!t.options || t.answer === undefined || pick === null) return { same: null, say: t.explain };
  if (pick === t.answer) return { same: true, say: `和你猜的一样！${t.explain}` };
  return { same: false, say: `和你猜的不一样——没关系，科学家就是这样发现的！${t.explain}` };
}
/** 下一步：还有实验就继续，没有就完成 */
export const nextTrial = (lv: LabLevel, i: number) => (i + 1 < lv.trials.length ? i + 1 : null);
/** 这一关有没有“先猜”环节 */
export const hasGuess = (t: Trial) => Boolean(t.options && t.options.length >= 2 && t.answer !== undefined);

/** 发现岛（幼儿园段）的实验内容 */
export const LAB_LEVELS: Record<string, LabLevel> = {
  // —— 颜色、光和材料 ——
  c3: {
    npc: '变色龙彩彩', intro: '我想变出新颜色！帮我把两种颜料搅在一起。',
    trials: [
      { ask: '红色加黄色，会变成什么颜色？', show: '🟥 ＋ 🟨', act: '搅一搅', options: ['🟧 橙色', '🟩 绿色', '🟪 紫色'], answer: 0, result: '🟧 橙色', explain: '红和黄混在一起变成了橙色，像橘子一样。' },
      { ask: '蓝色加黄色呢？', show: '🟦 ＋ 🟨', act: '搅一搅', options: ['🟧 橙色', '🟩 绿色', '🟥 红色'], answer: 1, result: '🟩 绿色', explain: '蓝和黄混出了绿色，像小草。' },
      { ask: '红色加蓝色呢？', show: '🟥 ＋ 🟦', act: '搅一搅', options: ['🟪 紫色', '🟨 黄色', '🟩 绿色'], answer: 0, result: '🟪 紫色', explain: '红和蓝混出了紫色，像葡萄。' }
    ],
    outro: '三种新颜色都变出来啦！我的身上多了橙色、绿色和紫色。'
  },
  c8: {
    npc: '变色龙彩彩', intro: '这是一杯紫甘蓝泡的水，它会变魔术哦！（真做的时候请爸爸妈妈帮忙）',
    trials: [
      { ask: '往紫甘蓝水里倒一点醋，会变成什么颜色？', show: '🟪 紫甘蓝水 ＋ 🍶 醋', act: '倒进去', options: ['变红', '变蓝绿', '不变'], answer: 0, result: '🟥 变成了红色', explain: '醋是酸的，紫甘蓝水碰到酸的东西就变红。' },
      { ask: '换一杯，加一点小苏打呢？', show: '🟪 紫甘蓝水 ＋ 🧂 小苏打', act: '加进去', options: ['变红', '变蓝绿', '不变'], answer: 1, result: '🟩 变成了蓝绿色', explain: '小苏打和醋相反，紫甘蓝水碰到它就变成蓝绿色。' },
      { ask: '再换一杯，倒一点清水呢？', show: '🟪 紫甘蓝水 ＋ 💧 清水', act: '倒进去', options: ['变红', '变蓝绿', '还是紫色'], answer: 2, result: '🟪 还是紫色', explain: '清水不酸也不像小苏打，所以颜色没变。' }
    ],
    outro: '紫甘蓝水像一个“颜色侦探”，能看出东西是酸的还是不酸的。'
  },
  c5: {
    npc: '变色龙彩彩', intro: '工作台上有一盏台灯和一只小熊，我们来找影子。',
    trials: [
      { ask: '打开台灯照着小熊，小熊后面会有影子吗？', show: '💡 → 🧸', act: '开灯', options: ['有影子', '没有影子'], answer: 0, result: '🧸 后面出现了一块黑黑的 ⬛', explain: '光被小熊挡住了，照不到的地方就是影子。' },
      { ask: '把台灯挪得离小熊近一点，影子会怎样？', show: '💡→🧸', act: '挪近', options: ['变大', '变小', '不变'], answer: 0, result: '⬛⬛ 影子变大了', explain: '灯越近，小熊挡住的光越多，影子就越大。' },
      { ask: '把灯关掉，影子还在吗？', show: '🌑 → 🧸', act: '关灯', options: ['还在', '不见了'], answer: 1, result: '影子不见了', explain: '没有光，就没有影子。' }
    ],
    outro: '记住啦：有光、有东西挡住，才有影子。'
  },
  c4: {
    npc: '变色龙彩彩', intro: '白白的光里藏着一个秘密，我们用三棱镜把它找出来。',
    trials: [
      { ask: '让白光穿过三棱镜，墙上会出现什么？', show: '⚪ 白光 → 🔺 三棱镜', act: '照过去', options: ['🌈 一道彩虹', '⚪ 还是白光', '⚫ 变黑了'], answer: 0, result: '🌈 墙上出现了一道彩虹', explain: '白光里藏着红、橙、黄、绿、蓝、紫好多颜色，三棱镜把它们分开了。' },
      { ask: '下过雨，太阳出来了，背对太阳看天空，可能看到什么？', show: '🌧️ → ☀️', act: '转过身', options: ['🌈 彩虹', '⭐ 星星'], answer: 0, result: '🌈 天上挂着彩虹', explain: '空中的小水滴像很多小三棱镜，把阳光分成了彩虹。' }
    ],
    outro: '下次下完雨，记得找一找彩虹！'
  },
  c6: {
    npc: '变色龙彩彩', intro: '手电筒和镜子是好朋友，我们来玩“弹光”游戏。',
    trials: [
      { ask: '手电筒照到镜子上，光会怎样？', show: '🔦 → 🪞', act: '照过去', options: ['弹回来', '穿过镜子', '消失了'], answer: 0, result: '光从镜子上弹了回来 ✨', explain: '镜子很光滑，光照上去会被“弹”回来。' },
      { ask: '把镜子转一转，墙上的光点会怎样？', show: '🪞 ↻', act: '转镜子', options: ['跟着动', '不动'], answer: 0, result: '光点在墙上跑来跑去 ✨', explain: '镜子转了，光弹出去的方向也跟着变。' },
      { ask: '转动镜子，把光弹到墙角的小熊身上！', show: '🪞 ✨ → 🧸', act: '转到小熊', result: '✨ 照到小熊啦', explain: '你会控制光的方向了！' }
    ],
    outro: '你是弹光高手！'
  },
  // —— 东西怎么动（小车工坊）——
  v1: {
    npc: '河狸师傅', intro: '工坊里的东西要用力才会动，我们来推一推、拉一拉。',
    trials: [
      { ask: '推一推小车。', show: '🛒', act: '推一推', result: '🛒 → 小车往前走了', explain: '推，东西就往前走。' },
      { ask: '拉一拉抽屉。', show: '🗄️', act: '拉一拉', result: '抽屉被拉出来了', explain: '拉，东西就朝你过来。' },
      { ask: '推一推大石头。', show: '🪨', act: '推一推', result: '🪨 石头一动不动', explain: '太重的东西要很大的力气，可以请大人一起帮忙。' }
    ],
    outro: '用力推、用力拉，东西才会动起来！'
  },
  v2: {
    npc: '河狸师傅', intro: '我给小车换了几种轮子，看看哪种能跑。',
    trials: [
      { ask: '方方的轮子，推一推能滚起来吗？', show: '🟥 轮子的小车', act: '推一推', options: ['能滚', '滚不动'], answer: 1, result: '车子一颠一颠，滚不动', explain: '方轮子有角，一推就卡住了。' },
      { ask: '三角形的轮子呢？', show: '🔺 轮子的小车', act: '推一推', options: ['能滚', '滚不动'], answer: 1, result: '车子卡住了', explain: '三角形也有角，滚不起来。' },
      { ask: '圆圆的轮子呢？', show: '⚪ 轮子的小车', act: '推一推', options: ['能滚', '滚不动'], answer: 0, result: '🚗 呼——跑得很顺', explain: '圆的轮子没有角，一推就滚起来，所以车轮都是圆的。' }
    ],
    outro: '原来车轮做成圆的，是为了滚得顺！'
  },
  v8: {
    npc: '河狸师傅', intro: '这块磁铁有魔力，先猜它会不会吸住，再试试。',
    trials: [
      { ask: '回形针会被磁铁吸住吗？', show: '🧲 ＋ 📎', act: '靠近', options: ['会', '不会'], answer: 0, result: '📎 啪！吸住了', explain: '回形针是铁做的，磁铁吸铁。' },
      { ask: '木头积木呢？', show: '🧲 ＋ 🟫 积木', act: '靠近', options: ['会', '不会'], answer: 1, result: '积木不动', explain: '木头不是铁，磁铁吸不住。' },
      { ask: '塑料勺子呢？', show: '🧲 ＋ 🥄 塑料勺', act: '靠近', options: ['会', '不会'], answer: 1, result: '勺子不动', explain: '塑料也不是铁，吸不住。' },
      { ask: '铁钉呢？', show: '🧲 ＋ 🔩 铁钉', act: '靠近', options: ['会', '不会'], answer: 0, result: '🔩 啪！吸住了', explain: '铁钉是铁做的，被吸住了。' }
    ],
    outro: '磁铁吸铁，不吸木头和塑料！'
  },
  v11: {
    npc: '河狸师傅', intro: '有些东西会“不见”，我们来看看它们去哪了。',
    trials: [
      { ask: '把冰块放在太阳底下，过一会儿会怎样？', show: '🧊 ☀️', act: '等一等', options: ['变成水', '变得更大', '不变'], answer: 0, result: '💧 冰块变成了一摊水', explain: '冰块热了就会化成水。' },
      { ask: '把一勺糖放进水里搅一搅，糖会怎样？', show: '🍬 ＋ 🥛', act: '搅一搅', options: ['不见了', '浮在上面', '把水变红'], answer: 0, result: '🥛 糖看不见了', explain: '糖化在水里了，尝一尝，水变甜了，说明糖还在里面。' },
      { ask: '把一杯水放进冰箱冷冻，第二天会怎样？', show: '🥛 → ❄️', act: '放进去', options: ['变成冰', '变成糖', '不见了'], answer: 0, result: '🧊 变成了冰', explain: '水冷了就会冻成冰，冰热了又会化成水。' }
    ],
    outro: '冰、水、化在水里的糖，它们都没有真的消失！'
  },
  v5: {
    npc: '河狸师傅', intro: '两条滑梯，一条低、一条高，比比哪辆车滑得快。',
    trials: [
      { ask: '同样的小车，从低坡和高坡上放下去，哪辆更快？', show: '📐 低坡 🚗   📐 高坡 🚗', act: '放车', options: ['低坡快', '高坡快', '一样快'], answer: 1, result: '🚗💨 高坡的车冲得更快更远', explain: '坡越陡，车滑得越快。' },
      { ask: '在高坡上铺一条毛巾，车会怎样？', show: '📐 高坡 ＋ 🧣 毛巾', act: '放车', options: ['更快', '变慢'], answer: 1, result: '🚗 慢慢地滑下来', explain: '毛巾毛毛的，会挡住车轮，车就慢了。' }
    ],
    outro: '坡的高低和路面，都会让车变快或变慢。'
  },
  v6: {
    npc: '河狸师傅', intro: '水槽里装满了水，先猜每样东西会浮起来还是沉下去。',
    trials: [
      { ask: '木块放进水里，会怎样？', show: '🪵 → 🌊', act: '放进水里', options: ['浮起来', '沉下去'], answer: 0, result: '🪵 浮在水面上', explain: '木头比水轻，会浮起来。' },
      { ask: '石头呢？', show: '🪨 → 🌊', act: '放进水里', options: ['浮起来', '沉下去'], answer: 1, result: '🪨 沉到水底', explain: '石头又小又重，沉下去了。' },
      { ask: '苹果呢？', show: '🍎 → 🌊', act: '放进水里', options: ['浮起来', '沉下去'], answer: 0, result: '🍎 浮着呢', explain: '苹果里有很多空气，所以能浮起来。' },
      { ask: '钥匙呢？', show: '🔑 → 🌊', act: '放进水里', options: ['浮起来', '沉下去'], answer: 1, result: '🔑 沉下去了', explain: '钥匙是金属做的，很重，沉下去了。' }
    ],
    outro: '有的浮、有的沉——你猜对了几个？没猜对的也记住啦！'
  },
  v7: {
    npc: '河狸师傅', intro: '大熊和小兔要玩跷跷板，帮它们想想办法。',
    trials: [
      { ask: '大熊和小兔坐在两边，离中间一样远，哪边会沉下去？', show: '🐻 ⚖️ 🐰', act: '坐上去', options: ['大熊那边', '小兔那边', '一样平'], answer: 0, result: '🐻 大熊那边沉下去了，小兔翘到天上', explain: '大熊比小兔重，重的那边就沉下去。' },
      { ask: '让小兔坐到最远的那头，大熊往中间挪一挪，会怎样？', show: '🐻 ⚖️ ——— 🐰', act: '挪一挪', options: ['能变平', '还是大熊那边低'], answer: 0, result: '⚖️ 跷跷板平了！', explain: '离中间越远越“有力气”，小兔坐远一点，就能和大熊一样平。' }
    ],
    outro: '轻的坐远一点，重的坐近一点，跷跷板就能玩起来！'
  },
  v4: {
    npc: '河狸师傅', intro: '两个齿轮咬在一起，转一个，另一个会怎么转？',
    trials: [
      { ask: '左边的齿轮往右转（顺着钟表的方向），右边的齿轮会怎么转？', show: '⚙️↻ ⚙️', act: '转一转', options: ['往左转', '往右转', '不转'], answer: 0, result: '⚙️↻ ⚙️↺ 右边的往反方向转', explain: '咬在一起的两个齿轮，转的方向是相反的。' },
      { ask: '三个齿轮排成一排，第一个往右转，第三个会怎么转？', show: '⚙️↻ ⚙️ ⚙️', act: '转一转', options: ['往左转', '往右转'], answer: 1, result: '⚙️↻ ⚙️↺ ⚙️↻ 第三个也往右转', explain: '每多一个齿轮就反一次方向，反两次又回来了。' }
    ],
    outro: '齿轮一个带一个，钟表和自行车里都有它们！'
  },
  v9: {
    npc: '河狸师傅', intro: '工坊二楼要吊一桶零件上去，我们装一个滑轮试试。',
    trials: [
      { ask: '绳子绕过上面的滑轮，往下拉绳子，桶会往哪走？', show: '🛞 滑轮 ＋ 🪣', act: '往下拉', options: ['往上走', '往下走'], answer: 0, result: '🪣 桶慢慢升上去了', explain: '滑轮让我们往下拉，东西就往上走，站在地上就能把东西吊上去。' },
      { ask: '再加一个跟着桶一起走的滑轮，拉起来会怎样？', show: '🛞🛞 ＋ 🪣', act: '再拉', options: ['更轻松', '更费劲'], answer: 0, result: '🪣 拉起来轻松多了', explain: '跟着桶走的滑轮能帮我们分担重量，就更省力了。' }
    ],
    outro: '滑轮能改变用力的方向，用对了还能省力气！'
  },
  // —— 动物与植物（小农场）——
  l2: {
    npc: '刺猬园丁', intro: '这三盆花种下去一样大，过一周看看它们怎么样了。',
    trials: [
      { ask: '第一盆一直没浇水，一周后会怎样？', show: '🌱 不浇水', act: '过一周', options: ['长得好', '蔫了'], answer: 1, result: '🥀 蔫蔫的', explain: '植物要喝水才能活。' },
      { ask: '第二盆放在黑黑的柜子里，会怎样？', show: '🌱 放在柜子里', act: '过一周', options: ['长得好', '又黄又弱'], answer: 1, result: '🌿 叶子发黄、长得细细的', explain: '植物要晒太阳才能长得绿绿的。' },
      { ask: '第三盆有水、有太阳，会怎样？', show: '🌱 有水有太阳', act: '过一周', options: ['长得好', '蔫了'], answer: 0, result: '🪴 长高了好多', explain: '有水、有阳光、有空气，植物就能长大。' }
    ],
    outro: '照顾植物要记住：水、阳光和空气一样都不能少。'
  }
};
