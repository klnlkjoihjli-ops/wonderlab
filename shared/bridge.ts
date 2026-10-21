import { z } from 'zod';

// 搭桥规则：一个刻意简化的定性模型，不是真实承重预测。
// 结果只由这里的程序规则产生，AI 导师只能读取，不能改写。
//
// 小溪宽度固定。可用材料：
//   短木板：只能盖住半边（左半或右半），里端需要中间桥墩托住。
//   长木板：一块就能连起两岸；载重增加时，中间没有支撑会弯下去。
//   石桥墩：立在小溪中间的石头上，托住木板的中间。

export const bridgeSchema = z.object({
  long: z.boolean(),
  left: z.boolean(),
  right: z.boolean(),
  pier: z.boolean()
}).strict().refine(b => !(b.long && (b.left || b.right)), '长木板和短木板不能叠放');
export type Bridge = z.infer<typeof bridgeSchema>;

export type Material = 'short' | 'long' | 'pier';
export type Slot = 'left' | 'right' | 'span' | 'pier';

export const EMPTY_BRIDGE: Bridge = { long: false, left: false, right: false, pier: false };

// 每种材料一共有几块（孩子的“材料包”）
export const SUPPLY: Record<Material, number> = { short: 2, long: 1, pier: 1 };

export type Reason = 'gap' | 'half' | 'tip' | 'sag' | 'success';
export type Outcome = {
  ok: boolean;
  reason: Reason;
  // 小车最远能开到哪里：0 = 左岸桥头，1 = 右岸桥头。用于动画，由规则决定。
  reach: number;
  // 给孩子的一句观察（朗读用）
  observe: string;
  // 小诺应该飞去指的地方
  focus: 'left' | 'middle' | 'right' | 'cart';
};

export function slotFor(material: Material, bridge: Bridge): Slot[] {
  if (material === 'pier') return bridge.pier ? [] : ['pier'];
  if (material === 'long') return bridge.long || bridge.left || bridge.right ? [] : ['span'];
  if (bridge.long) return [];
  return (['left', 'right'] as const).filter(s => !bridge[s]);
}

export function used(bridge: Bridge): Record<Material, number> {
  return { short: Number(bridge.left) + Number(bridge.right), long: Number(bridge.long), pier: Number(bridge.pier) };
}

export function place(bridge: Bridge, material: Material, slot: Slot): Bridge {
  if (!slotFor(material, bridge).includes(slot)) return bridge;
  if (used(bridge)[material] >= SUPPLY[material]) return bridge;
  if (slot === 'span') return { ...bridge, long: true };
  return { ...bridge, [slot]: true };
}

export function remove(bridge: Bridge, slot: Slot): Bridge {
  if (slot === 'span') return { ...bridge, long: false };
  return { ...bridge, [slot]: false };
}

/** load: 1 = 只有邀请卡，2 = 邀请卡 + 一份礼物 */
export function evaluate(bridge: Bridge, load: 1 | 2): Outcome {
  const { long, left, right, pier } = bridge;
  if (!long && !left) {
    return { ok: false, reason: 'gap', reach: 0, focus: 'left', observe: right ? '车子这边还没有木板，上不去桥。' : '小溪中间空空的，车子开不过去。' };
  }
  if (!long && left && !right) {
    return { ok: false, reason: 'half', reach: 0.45, focus: 'right', observe: '木板只盖住了一半，还够不到对岸。' };
  }
  if (!long && !pier) {
    return { ok: false, reason: 'tip', reach: 0.3, focus: 'middle', observe: '两块短木板在中间没有东西托着，一压就翘下去了。' };
  }
  if (long && !pier && load > 1) {
    return { ok: false, reason: 'sag', reach: 0.42, focus: 'middle', observe: '车子变重了，长木板中间弯下去了。' };
  }
  return { ok: true, reason: 'success', reach: 1, focus: 'right', observe: load > 1 ? '小车带着礼物稳稳地开过去啦！' : '小车开过去啦！' };
}

// 简化的“弯曲程度”，只用于动画表现：0 = 不弯，1 = 弯到失败
export function sagAmount(bridge: Bridge, load: 1 | 2): number {
  if (bridge.long) return bridge.pier ? 0.05 * load : load > 1 ? 1 : 0.35;
  return bridge.pier ? 0.06 * load : 1;
}
