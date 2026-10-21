// 探索工作台 · 模块一：拼装小车（东西怎么动 → 小车拆装 → 斜坡实验）
// 这是“探索模块”格式的第一个实例：零件 + 装配依赖 + 三层提示 + 实验规则 + 过关条件。
// 结果全部由这里的程序规则决定，小诺只负责讲。

export type CarPartId = 'AxleRear' | 'AxleFront' | 'WheelFL' | 'WheelFR' | 'WheelRL' | 'WheelRR' | 'Motor' | 'Battery' | 'Shell' | 'Roof';

export type PartInfo = {
  id: CarPartId;
  name: string;        // 孩子听到的名字
  en: string;          // 顺带一个英文词
  says: string;        // 点它时小诺说的一句话
  needs: CarPartId[];  // 装它之前必须已经装好的零件
  why: string;         // 装不上时的理由（一句）
};

export const CAR_PARTS: PartInfo[] = [
  { id: 'AxleRear', name: '后车轴', en: 'axle', says: '这是车轴，一根结实的长杆。车轮穿在它两头，绕着它转。', needs: [], why: '' },
  { id: 'AxleFront', name: '前车轴', en: 'axle', says: '这是前车轴。前面两个车轮要靠它才能装上。', needs: [], why: '' },
  { id: 'WheelRL', name: '车轮', en: 'wheel', says: '车轮是圆圆的，所以能滚起来。', needs: ['AxleRear'], why: '车轮要穿在车轴上，先把后车轴装好。' },
  { id: 'WheelRR', name: '车轮', en: 'wheel', says: '车轮是圆圆的，所以能滚起来。', needs: ['AxleRear'], why: '车轮要穿在车轴上，先把后车轴装好。' },
  { id: 'WheelFL', name: '车轮', en: 'wheel', says: '车轮是圆圆的，所以能滚起来。', needs: ['AxleFront'], why: '车轮要穿在车轴上，先把前车轴装好。' },
  { id: 'WheelFR', name: '车轮', en: 'wheel', says: '车轮是圆圆的，所以能滚起来。', needs: ['AxleFront'], why: '车轮要穿在车轴上，先把前车轴装好。' },
  { id: 'Motor', name: '马达', en: 'motor', says: '这是马达。通上电，它就会转，带着小车往前跑。', needs: [], why: '' },
  { id: 'Battery', name: '电池', en: 'battery', says: '这是电池，它给马达送电。没有电，马达就不会转。', needs: [], why: '' },
  { id: 'Shell', name: '车壳', en: 'body', says: '这是车壳，它像衣服一样，把马达和电池包在里面保护起来。', needs: ['Motor', 'Battery', 'AxleRear', 'AxleFront'], why: '车壳要盖住马达、电池和车轴，它们要先装好。' },
  { id: 'Roof', name: '车顶', en: 'roof', says: '这是车顶，小司机就坐在它下面。', needs: ['Shell'], why: '车顶要放在车壳上面，先装车壳。' }
];
export const PART = Object.fromEntries(CAR_PARTS.map(p => [p.id, p])) as Record<CarPartId, PartInfo>;
export const ALL_PARTS = CAR_PARTS.map(p => p.id);

export type InstallCheck = { ok: true } | { ok: false; missing: CarPartId[]; why: string };

/** 这个零件现在能不能装上 */
export function canInstall(installed: ReadonlySet<CarPartId>, id: CarPartId): InstallCheck {
  if (installed.has(id)) return { ok: false, missing: [], why: '它已经装好啦。' };
  const missing = PART[id].needs.filter(n => !installed.has(n));
  return missing.length ? { ok: false, missing, why: PART[id].why } : { ok: true };
}

/** 现在可以装的零件（用于第三层提示） */
export function installable(installed: ReadonlySet<CarPartId>): CarPartId[] {
  return ALL_PARTS.filter(id => canInstall(installed, id).ok);
}
export const isComplete = (installed: ReadonlySet<CarPartId>) => ALL_PARTS.every(id => installed.has(id));

/** 三层提示：先给方向，再给线索，最后给一个具体的下一步（仍由孩子自己点） */
export function assemblyHint(installed: ReadonlySet<CarPartId>, level: number, lastBlocked: CarPartId | null): string {
  if (isComplete(installed)) return '小车装好啦！按“开动”试试它能不能跑。';
  if (level <= 0) return '先想一想：哪些零件要直接装在木头底盘上？';
  if (level === 1) {
    if (lastBlocked) return PART[lastBlocked].why;
    return '车轮要穿在车轴上，车壳要盖住马达和电池。';
  }
  const next = installable(installed)[0];
  return `试试先点${PART[next].name}，把它装回去。`;
}

// —— 斜坡实验：坡越高，小车冲得越远吗？——
// 刻意简化：冲出的距离只和坡的高度有关（1~3 块积木），不是真实力学计算。
export const RAMP_LEVELS = [1, 2, 3] as const;
export type RampLevel = typeof RAMP_LEVELS[number];
export const FLAG_DISTANCE = 3.0;              // 小旗子离坡底的距离（工作台上的单位）

export function rollDistance(level: RampLevel): number { return Math.round((0.9 + level * 0.85) * 100) / 100; }
export type RampResult = { level: RampLevel; distance: number; reached: boolean; observe: string };
export function runRamp(level: RampLevel): RampResult {
  const distance = rollDistance(level), reached = distance >= FLAG_DISTANCE;
  const observe = reached ? '冲到小旗子啦！坡最高的时候，小车冲得最远。'
    : level === 1 ? '坡很矮，小车只滑了一小段。' : '比刚才远一些了，还差一点点到小旗子。';
  return { level, distance, reached, observe };
}

/** 和上一次比较：帮孩子看到“坡变高 → 冲得更远” */
export function compareRamp(prev: RampResult | null, cur: RampResult): string | null {
  if (!prev || prev.level === cur.level) return null;
  return cur.level > prev.level ? '坡变高了，小车冲得更远了。' : '坡变矮了，小车冲得更近了。';
}

// —— 模块进度：四步，全部完成才过关 ——
export type Step = 'look' | 'assemble' | 'drive' | 'ramp';
export const STEPS: { id: Step; title: string }[] = [
  { id: 'look', title: '拆开看看' }, { id: 'assemble', title: '装回去' }, { id: 'drive', title: '开动' }, { id: 'ramp', title: '斜坡实验' }
];
export type CarProgress = { seen: CarPartId[]; installed: CarPartId[]; exploded: boolean; drove: boolean; ramps: RampResult[]; passed: boolean };
export const freshCarProgress = (): CarProgress => ({ seen: [], installed: [...ALL_PARTS], exploded: false, drove: false, ramps: [], passed: false });
export const LOOK_TARGET = 3;                  // 至少认识 3 个零件，才算“看过”

export function currentStep(p: CarProgress): Step {
  if (!p.exploded || new Set(p.seen.map(id => PART[id].name)).size < LOOK_TARGET) return 'look';
  if (!isComplete(new Set(p.installed))) return 'assemble';
  if (!p.drove) return 'drive';
  return 'ramp';
}
export const isPassed = (p: CarProgress) => p.drove && isComplete(new Set(p.installed)) && p.ramps.some(r => r.reached);
