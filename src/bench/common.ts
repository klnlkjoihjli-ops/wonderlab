import { completeNode, dayIndex, node } from '../../shared/platform';
import { loadPlatform, logEvent, savePlatform } from '../world/platformStore';

/** 沿用平台存档里家长对“在线配音”的设置 */
export function onlineVoiceAllowed() { return loadPlatform().consent.voice; }
/** 过关：在平台存档里点亮这个知识点（只点亮一次，规则在 shared/platform.ts） */
export function lightUpNode(id: string) {
  const p = loadPlatform();
  if (p.done.includes(id)) return false;
  const r = completeNode(p, id, dayIndex(new Date()));
  logEvent(r.p, 'complete', `工作台过关「${node(id).name}」`, id);
  savePlatform(r.p);
  return true;
}
/** 做完回到哪里：从小样（demo.html）进来的回小样，否则回主程序的世界 */
export function worldHref(id: string, passed = false) {
  const base = new URLSearchParams(location.search).get('back') === 'demo' ? '/demo.html' : '/';
  return `${base}?arrived=${id}${passed ? '&passed=1' : ''}`;
}
