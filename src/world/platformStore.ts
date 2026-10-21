import { useCallback, useState } from 'react';
import { freshPlatform, platformSchema, rollover, type Platform, type PlatformEvent } from '../../shared/platform';

// 平台存档：世界和工作台共用同一份，只存在这台设备的浏览器里
export const PLATFORM_KEY = 'wonderlab.platform.v1';
const DEMO_KEY = 'wonderlab.demo-open';

export function loadPlatform(): Platform {
  try {
    const raw = localStorage.getItem(PLATFORM_KEY);
    if (raw) { const r = platformSchema.safeParse(JSON.parse(raw)); if (r.success) return rollover(r.data); }
  } catch { /* 读不出来就从头开始 */ }
  return freshPlatform();
}
export function savePlatform(p: Platform) { try { localStorage.setItem(PLATFORM_KEY, JSON.stringify(p)); } catch { /* 隐私模式下无法保存 */ } }
export function logEvent(p: Platform, type: string, detail: string, node?: string) {
  p.events.push({ at: new Date().toISOString(), type, detail: detail.slice(0, 300), ...(node ? { node } : {}) } as PlatformEvent);
  if (p.events.length > 2000) p.events.splice(0, p.events.length - 2000);
}
/** 家长的“演示：所有关卡开放”——只是打开关卡，不会记成完成 */
export const demoOpen = () => { try { return localStorage.getItem(DEMO_KEY) === '1'; } catch { return false; } };
export const setDemoOpen = (on: boolean) => { try { if (on) localStorage.setItem(DEMO_KEY, '1'); else localStorage.removeItem(DEMO_KEY); } catch { /* 忽略 */ } };

export function usePlatform() {
  const [p, setP] = useState<Platform>(loadPlatform);
  const update = useCallback((fn: (d: Platform) => Platform | void) => {
    setP(prev => { const draft = structuredClone(prev); const next = fn(draft) ?? draft; savePlatform(next); return next; });
  }, []);
  return { p, update };
}
