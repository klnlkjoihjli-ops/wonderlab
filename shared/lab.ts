import { z } from 'zod';

// 小桥实验室：可以反复改变量的自由实验。
// 刻意简化的定性模型，只用于比较“哪样弯得多”，不预测真实纸桥或木桥的承重。
//   弯曲程度 sag = 载重 ÷ 桥面硬度 × 跨度系数（有桥墩时跨度减半，弯曲大幅减小）
//   sag < 0.4 绿色：几乎不弯；0.4–1 黄色：会晃但能过；≥ 1 红色：弯太多，过不去

export const deckSchema = z.enum(['thin', 'thick', 'paper', 'folded']);
export type Deck = z.infer<typeof deckSchema>;

export const labSetupSchema = z.object({
  deck: deckSchema,
  pier: z.boolean(),
  boxes: z.number().int().min(0).max(4)
}).strict();
export type LabSetup = z.infer<typeof labSetupSchema>;

export const DEFAULT_SETUP: LabSetup = { deck: 'thin', pier: false, boxes: 0 };
export const MAX_BOXES = 4;

export const DECKS: Record<Deck, { name: string; stiffness: number }> = {
  paper: { name: '平平的纸', stiffness: 0.5 },
  folded: { name: '折成扇子的纸', stiffness: 3 },
  thin: { name: '薄木板', stiffness: 4 },
  thick: { name: '厚木板', stiffness: 12 }
};

export const PIER_FACTOR = 0.15;
export type Level = 'green' | 'yellow' | 'red';
export type Guess = Level;

/** 载重：一张邀请卡算 1，每个礼物盒再加 1 */
export const loadOf = (s: LabSetup) => 1 + s.boxes;

export function sagOf(s: LabSetup): number {
  return Math.round((loadOf(s) / DECKS[s.deck].stiffness) * (s.pier ? PIER_FACTOR : 1) * 1000) / 1000;
}

export function levelOf(sag: number): Level {
  return sag >= 1 ? 'red' : sag >= 0.4 ? 'yellow' : 'green';
}

export type LabResult = { sag: number; level: Level; ok: boolean; reach: number; observe: string };

export function runLab(s: LabSetup): LabResult {
  const sag = sagOf(s), level = levelOf(sag);
  const observe = level === 'green' ? `${DECKS[s.deck].name}几乎没弯，小车稳稳开过去了。`
    : level === 'yellow' ? `${DECKS[s.deck].name}弯到了黄色，小车晃了晃，还是过去了。`
      : `${DECKS[s.deck].name}弯到了红色，小车开不过去。`;
  // 红色时，越弯越早停下（只影响动画）
  return { sag, level, ok: level !== 'red', reach: level === 'red' ? Math.max(0.2, 0.5 - (sag - 1) * 0.1) : 1, observe };
}

export function guessLine(guess: Guess | null, level: Level): string | null {
  if (!guess) return null;
  return guess === level ? '和你猜的一样！' : '和你猜的不一样，真有意思！';
}

const DIFF_NAME = { deck: '桥面', pier: '桥墩', boxes: '礼物盒' } as const;

/** 和上一次比较：只改了一样时，说出这一样带来的变化；改了好几样时温和提醒 */
export function compareLine(prev: LabSetup | null, cur: LabSetup): string | null {
  if (!prev) return null;
  const diffs = (Object.keys(DIFF_NAME) as (keyof typeof DIFF_NAME)[]).filter(k => prev[k] !== cur[k]);
  if (diffs.length === 0) return '和上次一模一样，结果也一样。再试一次，看看是不是每次都这样。';
  if (diffs.length > 1) return '这次换了好几样。一次只换一样，更容易看出是谁的功劳哦。';
  const a = sagOf(prev), b = sagOf(cur);
  const change = Math.abs(a - b) < 0.05 ? '弯的程度差不多' : b < a ? '弯得少了' : '弯得更多了';
  const what = diffs[0] === 'deck' ? `只换了桥面，从${DECKS[prev.deck].name}换成${DECKS[cur.deck].name}`
    : diffs[0] === 'pier' ? (cur.pier ? '只加了一个桥墩' : '只拿掉了桥墩')
      : (cur.boxes > prev.boxes ? `只多放了${cur.boxes - prev.boxes}个礼物盒` : `只拿走了${prev.boxes - cur.boxes}个礼物盒`);
  return `你${what}，${change}。`;
}

export const labRecordSchema = z.object({
  at: z.string(),
  setup: labSetupSchema,
  guess: z.enum(['green', 'yellow', 'red']).nullable(),
  level: z.enum(['green', 'yellow', 'red']),
  thumb: z.string().max(40000).nullable()          // 小照片（JPEG data URL），只存在本机
});
export type LabRecord = z.infer<typeof labRecordSchema>;

// —— 给小诺的实验室上下文：只收孩子的设置和猜测，结果由服务端重新计算 ——
export const labTrialSchema = z.object({ setup: labSetupSchema, guess: z.enum(['green', 'yellow', 'red']).nullable() }).strict();
export type LabTrial = z.infer<typeof labTrialSchema>;
export const labTutorRequestSchema = z.object({
  question: z.string().trim().min(1).max(300),
  setup: labSetupSchema,                       // 现在台子上的设置（可能还没试）
  trials: z.array(labTrialSchema).max(6).default([]),   // 最近几次试车，旧的在前
  consent: z.boolean().default(false)
}).strict();
export type LabTutorRequest = z.infer<typeof labTutorRequestSchema>;

const LEVEL_WORD: Record<Level, string> = { green: '绿色（几乎不弯，稳稳过去）', yellow: '黄色（会晃，但能过）', red: '红色（弯太多，过不去）' };
export const levelWord = (l: Level) => LEVEL_WORD[l];

/** 用孩子能懂的话描述一次设置 */
export function describeSetup(s: LabSetup) {
  return `${DECKS[s.deck].name}${s.pier ? '加桥墩' : ''}，车上${s.boxes ? `${s.boxes}个礼物盒` : '没有礼物盒'}`;
}

/** 讲“为什么”：优先用孩子刚做的对比来解释，否则按当前结果解释 */
export function labWhy(s: LabSetup, prev: LabSetup | null): string {
  const diffs = prev ? (['deck', 'pier', 'boxes'] as const).filter(k => prev[k] !== s[k]) : [];
  const factor = diffs.length === 1 ? diffs[0] : null;
  if (factor === 'pier' || (!factor && s.pier)) return '桥墩从中间托住桥面，桥就短了一半，不容易弯。';
  if (factor === 'boxes') return '礼物盒越多，车越重，压得桥越弯。';
  if (factor === 'deck' || !factor) {
    if (s.deck === 'paper') return '平平的纸很软，一压就弯下去了。';
    if (s.deck === 'folded') return '纸折成扇子以后，一道道折痕撑着它，就变硬了。';
    if (s.deck === 'thick') return '厚木板又厚又硬，很难压弯。';
    return '薄木板比纸硬，但东西一多也会弯。';
  }
  return '桥面、桥墩和礼物盒都会影响桥弯多少。';
}

/** 实验室的基础引导（不联网时用，也是模型失败时的兜底） */
export function labGuidedReply(question: string, setup: LabSetup, trials: LabTrial[]): { text: string; save: boolean } {
  const last = trials[trials.length - 1] ?? null;
  const prev = trials.length > 1 ? trials[trials.length - 2].setup : null;
  if (/休息|再见|不玩|结束/.test(question)) return { text: '好呀，我们先休息。你的实验照片我都收好了。', save: false };
  // 提到实验里的东西，或者只是一句很短的“为什么？”（刚试完车时多半在问实验）
  const aboutLab = /桥|纸|弯|车|木板|盒|礼物|桥墩|过|颜色|红|黄|绿/.test(question) || question.replace(/[？?！!。，\s]/g, '').length <= 6;
  if (/为什么|怎么回事|怎么会/.test(question) && aboutLab) {
    if (!last) return { text: '我们还没试过呢。先按绿色按钮试一次，看看桥会弯到哪里。', save: false };
    return { text: labWhy(last.setup, prev), save: false };
  }
  if (/帮|不会|怎么办|试什么|提示|卡住|过不去|哪个/.test(question)) {
    if (!last) return { text: '先选一种桥面，再按绿色按钮试一试。', save: false };
    const r = runLab(last.setup);
    if (r.level === 'red') return { text: '桥弯到红色了。只换一样试试：换个桥面，或者放上桥墩。', save: false };
    if (last.setup.boxes < MAX_BOXES) return { text: '这次能过！试试只多放一个礼物盒，看看会弯到哪个颜色。', save: false };
    return { text: '你也可以只换一种桥面，比比哪种最结实。', save: false };
  }
  return { text: '这个问题真有意思！我把它收进“以后想探索的事”，等会儿和妈妈一起找答案。', save: true };
}
