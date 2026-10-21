import { z } from 'zod';

// WonderLab 平台：从 Claude work 原型（index.html v6）搬过来的产品骨架。
// 规则保持原型的设计（孩子端只走一步、知识树依赖解锁、小红花与打卡、成长伙伴、屏幕时间、家长确认），
// 但所有数字从零开始、只记录真实发生的事——不再预填“已完成”、掌握度和示例统计。

// —— 知识树：5 块大陆（对应《3-6 岁儿童学习与发展指南》五大领域，也能接上小学科目），大陆里再分区域 ——
// 孩子一次只看到 5 块大陆；区域一开始每块开 1–2 个，其余靠点亮关卡“浮出来”，或家长在设置里打开。
export const DOMAINS = [
  { id: 'math', name: '数字岛', full: '数学', icon: '🔢', color: '#4fb39b' },
  { id: 'lang', name: '故事岛', full: '语言', icon: '📖', color: '#e0567a' },
  { id: 'sci', name: '发现岛', full: '科学', icon: '🔬', color: '#5b8fe0' },
  { id: 'grow', name: '健康快乐岛', full: '健康与社会', icon: '💗', color: '#f08a4b' },
  { id: 'art', name: '艺术岛', full: '艺术', icon: '🎨', color: '#9b7fe0' }
] as const;
export type DomainId = typeof DOMAINS[number]['id'];

/** unlock：这块大陆一共点亮几关后，这个区域自动浮出来（0 = 一开始就有） */
export const AREAS = [
  { id: 'num', d: 'math', name: '数与形状', icon: '🔢', unlock: 0 },
  { id: 'story', d: 'lang', name: '汉字与故事', icon: '📖', unlock: 0 },
  { id: 'eng', d: 'lang', name: '英语', icon: '🔤', unlock: 0 },
  { id: 'color', d: 'sci', name: '颜色与光', icon: '🌈', unlock: 0 },
  { id: 'move', d: 'sci', name: '东西怎么动', icon: '🚗', unlock: 0 },
  { id: 'life', d: 'sci', name: '动物与植物', icon: '🌱', unlock: 4 },
  { id: 'sky', d: 'sci', name: '天空与地球', icon: '🌏', unlock: 8 },
  { id: 'body', d: 'grow', name: '身体与安全', icon: '💪', unlock: 0 },
  { id: 'heart', d: 'grow', name: '心情与朋友', icon: '😊', unlock: 0 },
  { id: 'home', d: 'grow', name: '我的家和南京', icon: '🏠', unlock: 4 },
  { id: 'art', d: 'art', name: '音乐与画画', icon: '🎵', unlock: 0 }
] as const;
export type AreaId = typeof AREAS[number]['id'];
export const area = (id: AreaId) => AREAS.find(a => a.id === id)!;

/** module：这个知识点在工作台上用哪个 3D 模块（没有的先不能玩，只在家长端显示“待做”） */
export type ModuleId = 'car' | 'lights' | 'cube' | 'ten' | 'words' | 'flowers';
export type Node = { id: string; a: AreaId; d: DomainId; lv: number; name: string; icon: string; how: string[]; goal: string; module?: ModuleId };
type RawNode = Omit<Node, 'd'>;
const RAW_NODES: RawNode[] = [
  { id: 'c1', a: 'color', lv: 0, name: '认识颜色', icon: '🖍️', how: ['动手'], goal: '能说出 6 种常见颜色' },
  { id: 'c2', a: 'color', lv: 1, name: '光的三原色', icon: '💡', how: ['3D', '动手'], goal: '知道红绿蓝三种光叠在一起会变白', module: 'lights' },
  { id: 'c3', a: 'color', lv: 2, name: '颜料调色', icon: '🎨', how: ['动手', '线下'], goal: '知道颜料越混越暗，和光相反' },
  { id: 'c4', a: 'color', lv: 3, name: '彩虹与棱镜', icon: '🌈', how: ['3D', '线下'], goal: '看见白光被拆成七种颜色' },
  { id: 'c5', a: 'color', lv: 4, name: '影子从哪来', icon: '🔦', how: ['3D', '动手'], goal: '知道光被挡住就有影子，灯越近影子越大' },
  { id: 'c6', a: 'color', lv: 5, name: '镜子反光', icon: '🪞', how: ['动手'], goal: '用镜子把光“弹”到墙角' },
  { id: 'c7', a: 'color', lv: 6, name: '冷色和暖色', icon: '🔥', how: ['动手'], goal: '分清暖色（红橙黄）和冷色（蓝绿紫）' },
  { id: 'c8', a: 'color', lv: 7, name: '会变色的紫甘蓝', icon: '🥬', how: ['线下', '动手'], goal: '紫甘蓝水加醋变红、加小苏打变蓝绿' },
  { id: 'c9', a: 'color', lv: 8, name: '放大镜', icon: '🔍', how: ['3D', '动手'], goal: '用放大镜看清树叶上的纹路' },
  { id: 'm1', a: 'num', lv: 0, name: '数到 20', icon: '🔢', how: ['3D', '动手'], goal: '帮小兔子摘花，一朵一朵数清楚', module: 'flowers' },
  { id: 'm2', a: 'num', lv: 1, name: '凑十', icon: '🔟', how: ['动手'], goal: '知道哪两个数合起来是 10', module: 'ten' },
  { id: 'm3', a: 'num', lv: 2, name: '认识形状', icon: '🔺', how: ['动手'], goal: '分清圆形、正方形、三角形' },
  { id: 'm4', a: 'num', lv: 3, name: '立方体展开', icon: '🎲', how: ['3D', '拆解'], goal: '知道立方体有 6 个正方形面，能拆开再折回去', module: 'cube' },
  { id: 'm5', a: 'num', lv: 4, name: '积木三视图', icon: '🧱', how: ['3D'], goal: '从前面、上面、侧面看积木' },
  { id: 'm6', a: 'num', lv: 5, name: '比多少', icon: '🍬', how: ['动手'], goal: '一个对一个，比出哪边多、多几个' },
  { id: 'm7', a: 'num', lv: 6, name: '认识钟表', icon: '🕗', how: ['动手'], goal: '看懂整点和半点' },
  { id: 'm8', a: 'num', lv: 7, name: '找规律', icon: '🔁', how: ['动手'], goal: '红黄红黄……猜出下一个是什么' },
  { id: 'm9', a: 'num', lv: 8, name: '20 以内加减', icon: '➕', how: ['动手'], goal: '会算 20 以内的进位加法' },
  { id: 'm10', a: 'num', lv: 9, name: '认识人民币', icon: '💴', how: ['线下'], goal: '认识 1 元、5 角、1 角，能凑出 1 元' },
  { id: 'v1', a: 'move', lv: 0, name: '推和拉', icon: '🤲', how: ['线下'], goal: '知道东西要用力才会动' },
  { id: 'v2', a: 'move', lv: 1, name: '轮子为什么是圆的', icon: '⭕', how: ['动手'], goal: '知道圆的东西才能滚' },
  { id: 'v3', a: 'move', lv: 2, name: '小车拆装', icon: '🚗', how: ['3D', '拆解'], goal: '认识小车零件，按顺序装回去；坡越高冲得越远', module: 'car' },
  { id: 'v4', a: 'move', lv: 3, name: '齿轮咬合', icon: '⚙️', how: ['3D', '拆解'], goal: '看懂一个齿轮怎么带动另一个' },
  { id: 'v5', a: 'move', lv: 4, name: '斜坡和滑梯', icon: '🛝', how: ['3D', '动手'], goal: '坡越陡，滑得越快' },
  { id: 'v6', a: 'move', lv: 5, name: '浮起来还是沉下去', icon: '🛟', how: ['动手', '线下'], goal: '先猜再试：哪些东西会浮在水上' },
  { id: 'v7', a: 'move', lv: 6, name: '跷跷板', icon: '🪵', how: ['3D', '动手'], goal: '离中间越远，越容易把对面翘起来' },
  { id: 'v8', a: 'move', lv: 7, name: '磁铁吸什么', icon: '🧲', how: ['动手'], goal: '磁铁吸铁，不吸木头和塑料' },
  { id: 'v9', a: 'move', lv: 8, name: '滑轮吊东西', icon: '🏗️', how: ['3D', '拆解'], goal: '用滑轮把重东西吊上去更省力' },
  { id: 'e1', a: 'eng', lv: 0, name: '字母 ABC', icon: '🔠', how: ['动手'], goal: '认识 26 个字母' },
  { id: 'e2', a: 'eng', lv: 1, name: '身边的单词', icon: '🍎', how: ['动手'], goal: '听懂身边常见东西的英文名', module: 'words' },
  { id: 'e3', a: 'eng', lv: 2, name: '自然拼读', icon: '🔤', how: ['动手'], goal: 'c-a-t 拼成 cat' },
  { id: 'e4', a: 'eng', lv: 3, name: '打招呼对话', icon: '👋', how: ['语音'], goal: '和小诺用英语打招呼' },
  { id: 'e5', a: 'eng', lv: 4, name: '颜色单词', icon: '🖌️', how: ['动手'], goal: '用英语说出 6 种颜色' },
  { id: 'e6', a: 'eng', lv: 5, name: '数字 one 到 ten', icon: '✋', how: ['动手', '语音'], goal: '用英语从 one 数到 ten' },
  { id: 'e7', a: 'eng', lv: 6, name: '动物单词', icon: '🐼', how: ['动手'], goal: '说出 8 种动物的英文名' },
  { id: 'e8', a: 'eng', lv: 7, name: '英文儿歌', icon: '🎵', how: ['语音'], goal: '跟着唱完一首英文儿歌' },
  { id: 'e9', a: 'eng', lv: 8, name: '英文小绘本', icon: '📖', how: ['线下'], goal: '和爸爸妈妈读完一本英文小绘本' },
  { id: 'g2', a: 'sky', lv: 0, name: '中国在哪里', icon: '🗺️', how: ['3D'], goal: '在地球上找到中国和大海' },
  { id: 'g3', a: 'sky', lv: 1, name: '七大洲', icon: '🌍', how: ['3D'], goal: '知道地球上有七块大陆' },
  { id: 'g4', a: 'sky', lv: 2, name: '把地球切开看', icon: '🌋', how: ['3D', '拆解'], goal: '看见地壳、地幔、地核三层' },
  { id: 'g5', a: 'sky', lv: 3, name: '白天和黑夜', icon: '🌗', how: ['3D'], goal: '地球自己转一圈，就是一天' },
  { id: 'g6', a: 'sky', lv: 4, name: '春夏秋冬', icon: '🍂', how: ['3D'], goal: '地球绕着太阳转，有了四季' },
  { id: 'g7', a: 'sky', lv: 5, name: '月亮变脸', icon: '🌙', how: ['3D', '线下'], goal: '连着看一周月亮，知道月亮自己不发光' },
  { id: 'g8', a: 'sky', lv: 6, name: '天气和云', icon: '⛅', how: ['线下'], goal: '认识晴、阴、雨、雪，会看天气预报' },
  { id: 's1', a: 'story', lv: 0, name: '看图说故事', icon: '📚', how: ['线下'], goal: '看着图说出：谁、在哪里、做了什么' },
  { id: 's2', a: 'story', lv: 1, name: '像画一样的字', icon: '🏞️', how: ['动手'], goal: '认识日、月、山、水、火、木这些象形字' },
  { id: 's3', a: 'story', lv: 2, name: '我的名字', icon: '✍️', how: ['线下'], goal: '认出自己的名字，试着写一写' },
  { id: 's4', a: 'story', lv: 3, name: '人口手大小', icon: '🖐️', how: ['动手'], goal: '认识人、口、手、大、小这些简单的字' },
  { id: 's5', a: 'story', lv: 4, name: '背一首古诗', icon: '🦢', how: ['语音'], goal: '背出《咏鹅》这样的短古诗' },
  { id: 's6', a: 'story', lv: 5, name: '找一样的字', icon: '🔎', how: ['动手'], goal: '在一堆字里找出长得一样的字' },
  { id: 's7', a: 'story', lv: 6, name: '故事接龙', icon: '🐉', how: ['语音', '线下'], goal: '和爸爸妈妈一人一句，编一个故事' },
  { id: 's8', a: 'story', lv: 7, name: '指着字读绘本', icon: '📗', how: ['线下'], goal: '自己指着字，读一本简单的绘本' },
  { id: 's9', a: 'story', lv: 8, name: '我来讲故事', icon: '🎙️', how: ['语音'], goal: '把一个故事从头到尾讲给家人听' },
  { id: 'l1', a: 'life', lv: 0, name: '种一颗豆子', icon: '🫘', how: ['线下'], goal: '种一颗豆子，每天看看它有没有发芽' },
  { id: 'l2', a: 'life', lv: 1, name: '植物要什么', icon: '☀️', how: ['3D', '动手'], goal: '知道植物要水、阳光和空气才能长大' },
  { id: 'l3', a: 'life', lv: 2, name: '动物的家', icon: '🪺', how: ['动手'], goal: '把小鸟、兔子、小鱼送回它们的家' },
  { id: 'l4', a: 'life', lv: 3, name: '谁吃什么', icon: '🥕', how: ['动手'], goal: '知道兔子吃草、老虎吃肉、熊猫吃竹子' },
  { id: 'l5', a: 'life', lv: 4, name: '毛毛虫变蝴蝶', icon: '🦋', how: ['3D'], goal: '看懂毛毛虫怎么一步步变成蝴蝶' },
  { id: 'l6', a: 'life', lv: 5, name: '动物宝宝', icon: '🐣', how: ['动手'], goal: '把动物妈妈和它的宝宝配成一对' },
  { id: 'l7', a: 'life', lv: 6, name: '捡树叶', icon: '🍁', how: ['线下'], goal: '去公园捡三种不一样的叶子，比一比' },
  { id: 'l8', a: 'life', lv: 7, name: '看蚂蚁', icon: '🐜', how: ['线下'], goal: '蹲下来看蚂蚁怎么排队、怎么搬东西' },
  { id: 'l9', a: 'life', lv: 8, name: '四季的树', icon: '🌳', how: ['3D'], goal: '一棵树春夏秋冬分别是什么样子' },
  { id: 'b1', a: 'body', lv: 0, name: '我的身体', icon: '🧍', how: ['动手'], goal: '指出头、肩膀、膝盖、脚，说出它们的名字' },
  { id: 'b2', a: 'body', lv: 1, name: '五种感觉', icon: '👂', how: ['动手'], goal: '眼睛看、耳朵听、鼻子闻、舌头尝、手摸' },
  { id: 'b3', a: 'body', lv: 2, name: '洗手七步', icon: '🧼', how: ['线下'], goal: '学会把手心、手背、指缝都洗干净' },
  { id: 'b4', a: 'body', lv: 3, name: '刷牙', icon: '🪥', how: ['线下'], goal: '早晚刷牙，每次刷满两分钟' },
  { id: 'b5', a: 'body', lv: 4, name: '吃得壮壮', icon: '🥦', how: ['动手'], goal: '知道哪些食物让身体长得壮' },
  { id: 'b6', a: 'body', lv: 5, name: '过马路', icon: '🚦', how: ['3D', '动手'], goal: '红灯停、绿灯行，走斑马线' },
  { id: 'b7', a: 'body', lv: 6, name: '不跟陌生人走', icon: '🙅', how: ['动手'], goal: '知道陌生人给东西、叫你走时该怎么做' },
  { id: 'b8', a: 'body', lv: 7, name: '记住电话', icon: '📞', how: ['线下'], goal: '记住爸爸或妈妈的电话号码' },
  { id: 'b9', a: 'body', lv: 8, name: '早睡长高高', icon: '😴', how: ['线下'], goal: '知道早点睡觉，身体才会长高' },
  { id: 'h1', a: 'heart', lv: 0, name: '认识心情', icon: '😊', how: ['动手'], goal: '认出开心、难过、生气、害怕的样子' },
  { id: 'h2', a: 'heart', lv: 1, name: '我现在的心情', icon: '🌤️', how: ['线下'], goal: '用一个词说出自己现在的心情' },
  { id: 'h3', a: 'heart', lv: 2, name: '生气了怎么办', icon: '🌬️', how: ['动手'], goal: '学会深呼吸、数到五，让自己平静下来' },
  { id: 'h4', a: 'heart', lv: 3, name: '谢谢和对不起', icon: '🙏', how: ['线下'], goal: '在该说的时候说“谢谢”“对不起”' },
  { id: 'h5', a: 'heart', lv: 4, name: '轮流和分享', icon: '🧸', how: ['线下'], goal: '和小朋友轮流玩，一起分享玩具' },
  { id: 'h6', a: 'heart', lv: 5, name: '帮帮家人', icon: '🤝', how: ['线下'], goal: '今天主动帮家人做一件事' },
  { id: 'h7', a: 'heart', lv: 6, name: '交新朋友', icon: '🫂', how: ['线下'], goal: '会问：“我可以和你一起玩吗？”' },
  { id: 'h9', a: 'heart', lv: 7, name: '我很棒', icon: '⭐', how: ['线下'], goal: '说出自己的三个优点' },
  { id: 'a1', a: 'art', lv: 0, name: '拍拍节奏', icon: '🥁', how: ['动手'], goal: '跟着拍子拍手：快、慢、轻、重' },
  { id: 'a2', a: 'art', lv: 1, name: '高音和低音', icon: '🎹', how: ['3D', '动手'], goal: '听出哪个声音高、哪个声音低' },
  { id: 'a3', a: 'art', lv: 2, name: '唱一首歌', icon: '🎶', how: ['语音'], goal: '从头到尾唱完一首儿歌' },
  { id: 'a4', a: 'art', lv: 3, name: '认识乐器', icon: '🎺', how: ['动手'], goal: '听声音认出鼓、钢琴和小号' },
  { id: 'a5', a: 'art', lv: 4, name: '涂色不出线', icon: '🖼️', how: ['线下'], goal: '给一幅画涂色，尽量不涂到线外面' },
  { id: 'a6', a: 'art', lv: 5, name: '画一个人', icon: '🧑‍🎨', how: ['线下'], goal: '画出有头、身体、手和脚的小人' },
  { id: 'a7', a: 'art', lv: 6, name: '折纸飞机', icon: '✈️', how: ['线下'], goal: '折一只纸飞机，看谁飞得远' },
  { id: 'a8', a: 'art', lv: 7, name: '捏小动物', icon: '🐌', how: ['线下'], goal: '用橡皮泥捏出一只小动物' },
  { id: 'a9', a: 'art', lv: 8, name: '家里的音乐会', icon: '🎭', how: ['线下'], goal: '给家人表演一个节目' },
  { id: 'g1', a: 'home', lv: 0, name: '我住在南京', icon: '🏠', how: ['3D'], goal: '在地球上找到南京' },
  { id: 'hm1', a: 'home', lv: 1, name: '我家在哪里', icon: '🏘️', how: ['线下'], goal: '说出自己住的小区和楼号，迷路时能告诉警察' },
  { id: 'h8', a: 'home', lv: 2, name: '我的家人', icon: '🏡', how: ['动手'], goal: '说出家里有谁，他们喜欢什么' },
  { id: 'hm2', a: 'home', lv: 3, name: '南京的好吃的', icon: '🦆', how: ['线下'], goal: '尝一尝盐水鸭、鸭血粉丝汤，说说是什么味道' },
  { id: 'hm3', a: 'home', lv: 4, name: '坐地铁', icon: '🚇', how: ['线下'], goal: '和爸爸妈妈坐一次地铁，认识站名和“先下后上”' },
  { id: 'hm4', a: 'home', lv: 5, name: '去超市', icon: '🛒', how: ['线下'], goal: '帮家里在超市找到三样东西，排队付钱' },
  { id: 'hm5', a: 'home', lv: 6, name: '南京的名胜', icon: '🏯', how: ['线下'], goal: '去夫子庙或中山陵，说说看到了什么' },
  { id: 'g9', a: 'home', lv: 7, name: '长江流过南京', icon: '🌊', how: ['3D', '线下'], goal: '知道长江从南京流过，去江边看一看' },
  { id: 'hm6', a: 'home', lv: 8, name: '我是中国人', icon: '🇨🇳', how: ['线下'], goal: '认识国旗，会唱国歌的第一句' }
];
/** 每一关属于哪块大陆，由它的区域决定 */
export const NODES: Node[] = RAW_NODES.map(n => ({ ...n, d: area(n.a).d }));
/** 跨区域依赖：[前置, 后续] */
export const CROSS: [string, string][] = [['m3', 'v2'], ['m3', 'm4'], ['e2', 'v3'], ['c2', 'c4'], ['v2', 'v3'], ['c1', 'e5'], ['m1', 'e6'], ['c5', 'g5'], ['m6', 'v7'], ['m7', 'g5'], ['g6', 'l9'], ['c1', 'a5'], ['b1', 'a6']];

export const node = (id: string) => NODES.find(n => n.id === id)!;
export function prereqs(n: Node): string[] {
  const p = NODES.filter(x => x.a === n.a && x.lv === n.lv - 1).map(x => x.id);
  for (const [a, b] of CROSS) if (b === n.id && !p.includes(a)) p.push(a);
  return p;
}
export type NodeState = 'done' | 'now' | 'lock';
/** 节点状态完全由“已点亮”的集合推出：前置都点亮了就开放 */
export function nodeState(id: string, done: ReadonlySet<string>): NodeState {
  if (done.has(id)) return 'done';
  return prereqs(node(id)).every(p => done.has(p)) ? 'now' : 'lock';
}
/** 点亮一个节点后，新开放的节点 */
export function newlyOpened(id: string, doneBefore: ReadonlySet<string>): Node[] {
  const after = new Set(doneBefore); after.add(id);
  return NODES.filter(n => !after.has(n.id) && nodeState(n.id, doneBefore) === 'lock' && nodeState(n.id, after) === 'now');
}
export const playable = (n: Node) => Boolean(n.module);

// —— 日程（家长规划一周，孩子只看眼前一件）——
export const CATS = { class: '课程', study: '学习', sport: '运动', family: '亲子', chore: '自理', play: '玩' } as const;
export type Cat = keyof typeof CATS;
export const blockSchema = z.object({
  t: z.string().regex(/^\d{2}:\d{2}$/), n: z.string().max(40), c: z.enum(['class', 'study', 'sport', 'family', 'chore', 'play']),
  f: z.number().int().min(0).max(5),        // 做完得几朵小红花（0 = 玩，不计花）
  chk: z.boolean(),                         // 需要家长确认
  done: z.boolean(), wait: z.boolean()
});
export type Block = z.infer<typeof blockSchema>;
export const DAYN = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
export const THEMES = ['数字岛', '故事岛', '发现岛', '健康快乐岛', '艺术岛', '发现岛 · 去户外', '复盘休息'];
export const THEME_DOMAIN: (DomainId | null)[] = ['math', 'lang', 'sci', 'grow', 'art', 'sci', null];
const mk = (t: string, n: string, c: Cat, f = 1, chk = false): Block => ({ t, n, c, f, chk, done: false, wait: false });
/** 原型里的默认一周（全部未完成；家长可在周计划里改） */
export function baseWeek(): Block[][] {
  const w: Block[][] = [];
  for (let d = 0; d < 7; d++) {
    const a: Block[] = [];
    if (d < 5) a.push(mk('07:30', '自己穿衣刷牙', 'chore'), mk('16:30', '练字一页', 'study', 1, true), mk('17:00', 'WonderLab：' + THEMES[d], 'study'));
    if (d === 1) a.push(mk('18:30', '英语课', 'class'));
    if (d === 2) a.push(mk('18:00', '篮球课', 'class'));
    if (d === 5) a.push(mk('07:30', '和爸妈一起跑步', 'sport'), mk('10:00', '英语课', 'class'), mk('15:00', 'WonderLab：' + THEMES[5], 'study'), mk('16:00', '公园自由玩', 'play', 0));
    if (d === 6) a.push(mk('10:00', '练字课', 'class'), mk('16:00', '和爸妈一起跑步', 'sport'), mk('19:00', '和小诺复盘本周', 'family'));
    a.push(mk('19:30', '亲子阅读 · 历史故事', 'family'), mk('20:00', 'Switch 时间', 'play', 0), mk('20:30', '自己收拾玩具', 'chore', 1, true));
    a.sort((x, y) => x.t.localeCompare(y.t));
    w.push(a);
  }
  return w;
}
export const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const BEDTIME = 21 * 60;

export type Focus =
  | { kind: 'bed' }
  | { kind: 'now'; index: number; early: boolean; left: number }
  | { kind: 'free'; next: number; wait: number }
  | { kind: 'waiting'; indices: number[] }
  | { kind: 'alldone' };
/** 孩子端首页：根据时间挑出“现在要做的一件事”（原型 home() 的规则） */
export function pickFocus(day: Block[], nowMin: number, chosen: number | null): Focus {
  if (nowMin >= BEDTIME) return { kind: 'bed' };
  const work = day.map((b, i) => ({ b, i })).filter(x => x.b.f > 0);
  const avail = work.filter(x => !x.b.done && !x.b.wait);
  if (chosen != null && avail.some(x => x.i === chosen)) return { kind: 'now', index: chosen, early: toMin(day[chosen].t) > nowMin + 10, left: avail.length };
  const started = avail.filter(x => toMin(x.b.t) <= nowMin + 10);
  if (started.length) return { kind: 'now', index: started[0].i, early: false, left: avail.length };
  if (avail.length) return { kind: 'free', next: avail[0].i, wait: toMin(avail[0].b.t) - nowMin };
  const waiting = work.filter(x => x.b.wait).map(x => x.i);
  return waiting.length ? { kind: 'waiting', indices: waiting } : { kind: 'alldone' };
}

// —— 小红花、打卡、成长伙伴 ——
export const SHOP = [
  { id: 'sw', e: '🎮', n: 'Switch 多玩 10 分钟', cost: 3 },
  { id: 'mv', e: '🎬', n: '周末选一部电影', cost: 5 },
  { id: 'pk', e: '🌳', n: '去公园玩一下午', cost: 8 },
  { id: 'bk', e: '📚', n: '挑一本新书', cost: 10 },
  { id: 'dt', e: '🏀', n: '和爸爸单独去打球', cost: 15 }
];
export const PET = [['🥚', '小蛋蛋', '还在蛋里睡觉'], ['🐣', '破壳啦', '刚刚出生'], ['🦕', '小恐龙', '会走路了'], ['🦖', '大恐龙', '会吼叫了'], ['🐉', '小飞龙', '会飞了']] as const;
export const XP_PER_LEVEL = 6;
export const petLevel = (xp: number) => Math.floor(xp / XP_PER_LEVEL) + 1;
export const petOf = (xp: number) => PET[Math.min(petLevel(xp) - 1, PET.length - 1)];

export const eventSchema = z.object({ at: z.string(), type: z.string().max(30), detail: z.string().max(300), node: z.string().max(10).optional(), sec: z.number().int().min(0).optional() });
export type PlatformEvent = z.infer<typeof eventSchema>;

export const platformSchema = z.object({
  version: z.literal(1),
  done: z.array(z.string()),                          // 已点亮的知识点
  flowers: z.number().int().min(0), xp: z.number().int().min(0),
  goal: z.object({ n: z.string().max(40), need: z.number().int().min(1), have: z.number().int().min(0) }),
  weekKey: z.string(), week: z.array(z.array(blockSchema)).length(7),
  bonus: z.array(z.string()),                         // 已发过的打卡奖励（防止重复发）
  pending: z.array(z.object({ id: z.string(), n: z.string(), cost: z.number().int(), at: z.string() })),
  history: z.array(z.object({ n: z.string(), cost: z.number().int(), at: z.string(), st: z.enum(['已兑换', '没同意']) })).max(100),
  screen: z.object({ limit: z.number().int().min(0).max(240), extra: z.number().int().min(0), usedSec: z.number().int().min(0), day: z.string() }),
  auto: z.boolean(), muted: z.boolean(),
  consent: z.object({ ai: z.boolean(), speech: z.boolean(), voice: z.boolean() }),
  stuck: z.array(z.object({ at: z.string(), node: z.string(), level: z.number().int() })).max(200),
  events: z.array(eventSchema).max(2000),
  modules: z.record(z.string(), z.unknown()),         // 各模块自己的进度（如小车拆装）
  areas: z.record(z.string(), z.boolean()).default({}),   // 家长手动打开（true）/ 关上（false）的区域；没写就按规则自动
  areasSeen: z.array(z.string()).default([])        // 已经给孩子看过“浮出来”动画的区域
});
export type Platform = z.infer<typeof platformSchema>;

export function weekKeyOf(date: Date) { const d = new Date(date); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); }
export const dayIndex = (date: Date) => (date.getDay() + 6) % 7;
/** 本地日期（南京时间），不能用 toISOString：那是 UTC，早上 8 点前会算成前一天 */
export const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function freshPlatform(now = new Date()): Platform {
  return {
    version: 1, done: [], flowers: 0, xp: 0, goal: { n: '全家一起去动物园', need: 30, have: 0 },
    weekKey: weekKeyOf(now), week: baseWeek(), bonus: [], pending: [], history: [],
    screen: { limit: 20, extra: 0, usedSec: 0, day: dayKey(now) },
    auto: true, muted: false, consent: { ai: false, speech: false, voice: false }, stuck: [], events: [], modules: {}, areas: {}, areasSeen: []
  };
}
/** 新的一周：保留家长排好的日程结构，清掉完成状态；新的一天：屏幕时间清零 */
export function rollover(p: Platform, now = new Date()): Platform {
  const n = structuredClone(p);
  const wk = weekKeyOf(now);
  if (n.weekKey !== wk) { n.weekKey = wk; n.week = n.week.map(day => day.map(b => ({ ...b, done: false, wait: false }))); }
  const dk = dayKey(now);
  if (n.screen.day !== dk) n.screen = { ...n.screen, day: dk, usedSec: 0, extra: 0 };
  return n;
}

const dayItems = (day: Block[]) => day.filter(b => b.f > 0);
export const dayDone = (day: Block[]) => dayItems(day).length > 0 && dayItems(day).every(b => b.done);
/** 连续打卡天数：只算本周里真实完成的天（不预填历史） */
export function streak(p: Platform, today: number): number {
  let s = 0;
  if (dayDone(p.week[today])) s++;
  for (let d = today - 1; d >= 0; d--) { if (dayDone(p.week[d])) s++; else break; }
  return s;
}

/** 完成一件事：发花、长经验、整天完成再奖 1 朵、连续 7 天再奖 5 朵（每种奖励只发一次） */
export function award(p: Platform, d: number, i: number): { p: Platform; notes: string[] } {
  const n = structuredClone(p), b = n.week[d][i], notes: string[] = [];
  if (b.done) return { p, notes };
  b.done = true; b.wait = false;
  if (b.f) { n.flowers += b.f; n.xp += b.f; notes.push(`完成「${b.n}」，得到 ${b.f} 朵小红花 ✿`); }
  const k = `${n.weekKey}-${d}`;
  if (dayDone(n.week[d]) && !n.bonus.includes(k)) {
    n.bonus.push(k); n.flowers += 1; notes.push(`${DAYN[d]}全部完成，打卡成功！额外 +1 ✿`);
    const s7 = `${n.weekKey}-s7`;
    if (streak(n, d) >= 7 && !n.bonus.includes(s7)) { n.bonus.push(s7); n.flowers += 5; notes.push('连续 7 天，再 +5 ✿'); }
  }
  return { p: n, notes };
}
/** 家长撤销误点：收回花和当天打卡奖励 */
export function unaward(p: Platform, d: number, i: number): Platform {
  const n = structuredClone(p), b = n.week[d][i];
  if (!b.done) return p;
  const k = `${n.weekKey}-${d}`, was = dayDone(n.week[d]);
  b.done = false;
  if (b.f) { n.flowers = Math.max(0, n.flowers - b.f); n.xp = Math.max(0, n.xp - b.f); }
  if (was && n.bonus.includes(k)) { n.bonus = n.bonus.filter(x => x !== k); n.flowers = Math.max(0, n.flowers - 1); }
  return n;
}
/** 孩子点“我做完了”：需要家长看的进入待确认，其余直接发花 */
export function kidComplete(p: Platform, d: number, i: number): { p: Platform; notes: string[]; waiting: boolean } {
  const b = p.week[d][i];
  if (b.done) return { p, notes: ['这件已经做完啦 ✓'], waiting: false };
  if (b.chk) { const n = structuredClone(p); n.week[d][i].wait = true; return { p: n, notes: ['做完啦！请爸爸妈妈来看一眼，确认后得 ✿'], waiting: true }; }
  return { ...award(p, d, i), waiting: false };
}

/** 点亮一个知识点：+1 朵花、+2 经验，并顺手完成今天的 WonderLab 日程 */
export function completeNode(p: Platform, id: string, today: number): { p: Platform; opened: Node[]; notes: string[] } {
  if (p.done.includes(id)) return { p, opened: [], notes: ['这一关已经点亮过啦'] };
  const before = new Set(p.done);
  let n = structuredClone(p);
  n.done.push(id); n.flowers += 1; n.xp += 2;
  const notes = [`点亮「${node(id).name}」，得到一朵小红花 ✿`];
  const wl = n.week[today].findIndex(b => b.n.startsWith('WonderLab') && !b.done);
  if (wl >= 0) { const r = award(n, today, wl); n = r.p; notes.push(...r.notes); }
  const opened = newlyOpened(id, before);
  if (opened.length) notes.push(`新开放：${opened.map(o => o.name).join('、')}`);
  return { p: n, opened, notes };
}

export function badges(p: Platform, today: number) {
  const st = streak(p, today), done = new Set(p.done);
  const lianzi = p.week.slice(0, today + 1).flat().filter(b => b.n.includes('练字'));
  return [
    { e: '🔥', n: '连续 3 天', got: st >= 3 }, { e: '🏆', n: '连续 7 天', got: st >= 7 },
    { e: '💡', n: '光的魔法师', got: done.has('c2') }, { e: '🎲', n: '骰子大师', got: done.has('m4') },
    { e: '🔧', n: '小小修车工', got: done.has('v3') }, { e: '✍️', n: '练字不断线', got: lianzi.length > 0 && lianzi.every(b => b.done) },
    { e: '🌏', n: '找到南京', got: done.has('g1') }
  ];
}

// —— 屏幕时间 ——
export const screenLeftMin = (p: Platform) => Math.max(0, Math.ceil(p.screen.limit + p.screen.extra - p.screen.usedSec / 60));
export const screenOver = (p: Platform) => p.screen.limit > 0 && screenLeftMin(p) <= 0;

// —— 区域：一开始每块大陆开 1–2 个，其余慢慢浮出来 ——
type AreaInput = { done: string[]; areas?: Record<string, boolean> };
/** 现在打开的区域：一开始就有的、家长打开的、这块大陆点亮够了关的、已经玩过的（不把孩子的进度藏起来）；家长关上的不算 */
export function openAreas(p: AreaInput, demo = false): Set<AreaId> {
  const done = new Set(p.done), out = new Set<AreaId>();
  for (const a of AREAS) {
    const forced = p.areas?.[a.id];
    if (forced === false) continue;
    const lit = NODES.filter(n => n.d === a.d && done.has(n.id)).length;
    const played = NODES.some(n => n.a === a.id && done.has(n.id));
    if (demo || forced === true || a.unlock === 0 || lit >= a.unlock || played) out.add(a.id);
  }
  return out;
}
/** 这块大陆还要再点亮几关，下一个区域才浮出来（没有就是 null） */
export function nextAreaIn(d: DomainId, p: AreaInput): { a: typeof AREAS[number]; need: number } | null {
  const open = openAreas(p), done = new Set(p.done);
  const lit = NODES.filter(n => n.d === d && done.has(n.id)).length;
  const next = AREAS.filter(a => a.d === d && !open.has(a.id) && p.areas?.[a.id] !== false).sort((x, y) => x.unlock - y.unlock)[0];
  return next ? { a: next, need: Math.max(0, next.unlock - lit) } : null;
}
/** 刚浮出来、还没给孩子看过的区域（一开始就有的不算） */
export function newAreas(p: AreaInput & { areasSeen?: string[] }): AreaId[] {
  const open = openAreas(p), seen = new Set(p.areasSeen ?? []);
  return AREAS.filter(a => a.unlock > 0 && open.has(a.id) && !seen.has(a.id)).map(a => a.id);
}

// —— 今日任务：5 块大陆里每天必做 3 块（探险日那块 + 轮流的两块） ——
export const TODAY_MUST = 3;
export type TodayItem = {
  d: DomainId;
  theme: boolean;            // 今天是这块大陆的探险日
  must: boolean;             // 今天必做的三件之一
  doneToday: Node[];         // 今天已经点亮的关卡
  next: Node | null;         // 今天要做的那一关（打开的区域里，现在能玩、还没点亮、最靠前的）
  state: 'done' | 'todo' | 'all';   // 今天做过了 / 还没做 / 打开的区域全部完成
};
/** 从 1970 年起的第几天（按本地日期），用来每天轮换 */
const dayNumber = (now: Date) => Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);

/** 每块大陆今天做什么；必做的排前面（探险日第一），其余按原来的顺序 */
export function todayPlan(p: AreaInput & { events: { at: string; type: string; node?: string }[] }, now = new Date(), demo = false): TodayItem[] {
  const today = dayKey(now), theme = THEME_DOMAIN[dayIndex(now)], done = new Set(p.done), open = openAreas(p, demo);
  const doneTodayIds = new Set(p.events.filter(e => e.type === 'complete' && e.node && dayKey(new Date(e.at)) === today).map(e => e.node!));
  const areaOrder = (a: AreaId) => AREAS.findIndex(x => x.id === a);
  const items: TodayItem[] = DOMAINS.map(dm => {
    const ns = NODES.filter(n => n.d === dm.id).sort((a, b) => areaOrder(a.a) - areaOrder(b.a) || a.lv - b.lv);
    const doneToday = ns.filter(n => doneTodayIds.has(n.id) && done.has(n.id));
    const next = ns.find(n => open.has(n.a) && !done.has(n.id) && (demo || nodeState(n.id, done) === 'now')) ?? null;
    const state: TodayItem['state'] = doneToday.length ? 'done' : next ? 'todo' : 'all';
    return { d: dm.id, theme: dm.id === theme, must: false, doneToday, next, state };
  });
  // 必做：探险日那块（还有关可做时），再从其余大陆里按日期轮流挑，凑够 3 块
  const usable = (it: TodayItem) => it.state !== 'all';
  const themeItem = items.find(it => it.theme && usable(it));
  if (themeItem) themeItem.must = true;
  const others = items.filter(it => !it.theme && usable(it));
  const need = Math.min(TODAY_MUST - (themeItem ? 1 : 0), others.length);
  const start = others.length ? (dayNumber(now) * 2) % others.length : 0;
  for (let k = 0; k < need; k++) others[(start + k) % others.length].must = true;
  return [...items].sort((a, b) => Number(b.must) - Number(a.must) || Number(b.theme) - Number(a.theme));
}
