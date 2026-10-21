import { useCallback, useState } from 'react';
import { parseProgress, type Episode, type ExplorationEvent, type Progress } from '../shared/game';

// 所有家庭记录只保存在这台设备的浏览器里
export const SAVE_KEY = 'wonderlab.forest-post.v3';

function load(): { progress: Progress; recovered: boolean } {
  try { return parseProgress(localStorage.getItem(SAVE_KEY)); } catch { return parseProgress(null); }
}
export function persist(p: Progress) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(p)); return true; } catch { return false; }
}
export function wipe() { try { localStorage.removeItem(SAVE_KEY); } catch { /* 无法访问存储时无需处理 */ } }

export function useProgress() {
  const [initial] = useState(load);
  const [progress, setProgress] = useState<Progress>(initial.progress);
  const update = useCallback((fn: (p: Progress) => void) => {
    setProgress(prev => { const next = structuredClone(prev); fn(next); persist(next); return next; });
  }, []);
  const replace = useCallback((p: Progress) => { persist(p); setProgress(p); }, []);
  const log = useCallback((episode: Episode, type: ExplorationEvent['type'], detail: string) => {
    update(p => { p.events.push({ at: new Date().toISOString(), episode, type, detail: detail.slice(0, 400) }); if (p.events.length > 1000) p.events.splice(0, p.events.length - 1000); });
  }, [update]);
  return { progress, update, replace, log, recovered: initial.recovered };
}
