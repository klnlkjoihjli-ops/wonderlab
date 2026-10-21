import { z } from 'zod';
import { EMPTY_BRIDGE, bridgeSchema, evaluate, type Bridge } from './bridge.ts';
import { DEFAULT_SETUP, labRecordSchema, labSetupSchema } from './lab.ts';
import { buildSchema } from './build.ts';

export const episodeSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type Episode = z.infer<typeof episodeSchema>;

export const recipientSchema = z.enum(['rabbit', 'squirrel', 'hedgehog']);
export type Recipient = z.infer<typeof recipientSchema>;
export const decorationSchema = z.enum(['flowers', 'flags', 'lanterns']);
export type Decoration = z.infer<typeof decorationSchema>;

export const RECIPIENTS: Record<Recipient, string> = { rabbit: '小兔', squirrel: '小松鼠', hedgehog: '小刺猬' };

export const EPISODES = {
  1: { title: '第一封邀请卡', load: 1 as const },
  2: { title: '再送一封信', load: 2 as const },
  3: { title: '自己的小邮局', load: 2 as const }
};
export function loadOf(episode: Episode) { return EPISODES[episode].load; }

/** 用孩子能听懂的话描述一座真实搭过的桥（只读存档，不编造） */
export function describeBridge(b: Bridge): string {
  const parts: string[] = [];
  if (b.long) parts.push('一块长木板');
  const shorts = Number(b.left) + Number(b.right);
  if (shorts) parts.push(shorts === 2 ? '两块短木板' : '一块短木板');
  if (b.pier) parts.push('一个石桥墩');
  return parts.length ? parts.join('和') : '空空的小溪';
}

// —— 小诺的开场白：根据真实存档决定说什么 ——
export function introLine(episode: Episode, p: Progress, returning: boolean): string {
  if (returning) return '欢迎回来！你的桥还在这里，接着试试吧。';
  if (episode === 1) return '小车停在小溪边了。我们一起想办法，让它开过去吧！';
  if (episode === 2) {
    const prev = p.chapters[1].bridge;
    return `还记得吗？上次你用${describeBridge(prev)}搭的桥送到了邀请卡。这次车上多了一份礼物，先试试原来的桥吧！`;
  }
  return '今天的邮局由你做主！先选一位朋友，把信送给它吧。';
}

// —— 基础引导（不联网时使用，也是 AI 的兜底）——
// level 0：指一个观察点；level 1：讲一句为什么；level 2：给一个可以试的办法（不替孩子放）。
export function guidedHint(bridge: Bridge, episode: Episode, level: number, tested: boolean): string {
  const r = evaluate(bridge, loadOf(episode));
  if (!tested && r.reason !== 'gap') return '桥搭好了吗？按绿色的车子按钮，看看会怎么样。';
  if (r.ok) return '这座桥能用！按绿色按钮，让小车再开一次吧。';
  const lines: Record<string, string[]> = {
    gap: ['看看小溪中间，车子能踩在哪里呢？', '车轮要踩在木板上才能过河。', '从材料包里拖一块木板，放到小溪上试试。'],
    half: ['看看木板的另一头，碰到对岸了吗？', '一块短木板只够半边，另一半还空着。', '再找一块木板，把剩下的一半也连上。'],
    tip: ['看看两块木板碰头的地方，下面有什么？', '木板中间没有东西托着，压上去就会翘下去。', '小溪中间有一块大石头，可以在那里立个桥墩。'],
    sag: ['看看木板的正中间，发生了什么？', '车子更重了，长木板中间被压弯了。', '想一想，怎样从下面托住木板的中间？']
  };
  const list = lines[r.reason];
  return list[Math.min(level, list.length - 1)];
}

export type TutorReply = { text: string; save: boolean };
export function guidedReply(bridge: Bridge, episode: Episode, question: string, level: number, tested: boolean): TutorReply {
  if (/休息|再见|不玩|结束/.test(question)) return { text: '好呀，我们先休息。你的桥我帮你留着。', save: false };
  if (/你是谁|你好|名字/.test(question)) return { text: '我是小诺，森林邮局的小猫头鹰。今天你是小小邮差！', save: false };
  if (/为什么|怎么回事/.test(question) && /桥|木板|车|过|翘|弯|掉/.test(question)) return { text: guidedHint(bridge, episode, 1, true), save: false };
  if (/帮|不会|怎么办|提示|卡住|过不去/.test(question)) return { text: guidedHint(bridge, episode, level, tested), save: false };
  return { text: '这个问题真有意思！我把它收进“以后想探索的事”，等会儿可以和妈妈一起找答案。', save: true };
}

// —— AI 导师请求：只带可检查的事实，实验结果由服务端用规则重新计算 ——
export const tutorRequestSchema = z.object({
  question: z.string().trim().min(1).max(300),
  episode: episodeSchema,
  bridge: bridgeSchema,
  attempts: z.array(bridgeSchema).max(6).default([]),
  hintsGiven: z.number().int().min(0).max(50).default(0),
  tested: z.boolean().default(false),
  consent: z.boolean().default(false)
}).strict();
export type TutorRequest = z.infer<typeof tutorRequestSchema>;

// —— 存档 ——
export const eventTypes = ['start', 'outfit', 'place', 'remove', 'undo', 'test', 'hint', 'question', 'reply', 'complete', 'recipient', 'decorate', 'explain', 'activity', 'feedback', 'pause', 'lab', 'workshop'] as const;
const eventSchema = z.object({ at: z.string(), episode: episodeSchema, type: z.enum(eventTypes), detail: z.string().max(400) });
export type ExplorationEvent = z.infer<typeof eventSchema>;

export const chapterSchema = z.object({ bridge: bridgeSchema, completed: z.boolean(), attempts: z.number().int().min(0), started: z.boolean() });

export const progressSchema = z.object({
  version: z.literal(3),
  outfit: z.enum(['hat', 'bag']).nullable(),
  chapters: z.object({ '1': chapterSchema, '2': chapterSchema, '3': chapterSchema }),
  party: z.object({ recipient: recipientSchema.nullable(), decorations: z.array(decorationSchema).max(3), explanation: z.string().max(500) }),
  events: z.array(eventSchema).max(1000),
  questions: z.array(z.object({ at: z.string(), episode: episodeSchema, text: z.string().max(300) })).max(60),
  feedback: z.array(z.object({ at: z.string(), episode: episodeSchema, joy: z.string().max(500), help: z.string().max(500), idea: z.string().max(500) })).max(60),
  activity: z.object({ guess: z.string().max(300), flat: z.string().max(300), folded: z.string().max(300), words: z.string().max(800), done: z.boolean() }),
  muted: z.boolean(),
  consent: z.object({ ai: z.boolean(), speech: z.boolean(), voice: z.boolean().default(false) }),   // voice：小诺用在线配音（后加，带默认值）
  // 小桥实验室（后加的字段，带默认值，旧存档读取时自动补上）
  lab: z.object({ setup: labSetupSchema, records: z.array(labRecordSchema).max(12) }).default({ setup: DEFAULT_SETUP, records: [] }),
  // 搭桥工坊里正在搭的桥（后加，带默认值）
  workshop: buildSchema.default({ parts: [], boxes: 0 })
});
export type Progress = z.infer<typeof progressSchema>;

export function freshProgress(): Progress {
  const ch = () => ({ bridge: { ...EMPTY_BRIDGE }, completed: false, attempts: 0, started: false });
  return {
    version: 3, outfit: null, chapters: { 1: ch(), 2: ch(), 3: ch() },
    party: { recipient: null, decorations: [], explanation: '' },
    events: [], questions: [], feedback: [],
    activity: { guess: '', flat: '', folded: '', words: '', done: false },
    muted: false, consent: { ai: false, speech: false, voice: false },
    lab: { setup: { ...DEFAULT_SETUP }, records: [] },
    workshop: { parts: [], boxes: 0 }
  };
}

export function parseProgress(raw: string | null): { progress: Progress; recovered: boolean } {
  if (!raw) return { progress: freshProgress(), recovered: false };
  try { return { progress: progressSchema.parse(JSON.parse(raw)), recovered: false }; }
  catch { return { progress: freshProgress(), recovered: true }; }
}

export function unlocked(p: Progress, episode: Episode) { return episode === 1 || p.chapters[(episode - 1) as Episode].completed; }

/** 进入某一次体验：首次进入时沿用上一次真实搭好的桥（作品留在世界里） */
export function enterEpisode(p: Progress, episode: Episode): Progress {
  if (!unlocked(p, episode)) return p;
  const next = structuredClone(p);
  const ch = next.chapters[episode];
  if (!ch.started) {
    ch.started = true;
    if (episode > 1) ch.bridge = { ...p.chapters[(episode - 1) as Episode].bridge };
  }
  return next;
}
