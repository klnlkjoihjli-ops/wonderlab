import type { Bridge } from '../shared/bridge';
import { guidedReply, type Episode } from '../shared/game';
import { labGuidedReply, type LabSetup, type LabTrial } from '../shared/lab';

export type TutorAnswer = { reply: string; save: boolean; mode: 'online' | 'guided'; reason?: string };
export type Health = { aiConfigured: boolean; model?: string; ttsConfigured?: boolean; ttsVoice?: string | null } | null;

type Ask = { question: string; episode: Episode; bridge: Bridge; attempts: Bridge[]; hintsGiven: number; tested: boolean; consent: boolean };

/** 向服务端问小诺；网络或模型出问题时，立刻用本地基础引导接上，故事不中断 */
export async function askTutor(a: Ask): Promise<TutorAnswer> {
  const local = (reason: string): TutorAnswer => { const g = guidedReply(a.bridge, a.episode, a.question, a.hintsGiven, a.tested); return { reply: g.text, save: g.save, mode: 'guided', reason }; };
  if (!a.consent) return local('consent');
  try {
    const res = await fetch('/api/tutor', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ ...a, attempts: a.attempts.slice(-6) })
    });
    if (!res.ok) return local('network');
    const body = await res.json() as TutorAnswer;
    return typeof body.reply === 'string' && body.reply ? body : local('network');
  } catch { return local('network'); }
}

export async function fetchHealth(): Promise<Health> {
  try { const r = await fetch('/api/health', { signal: AbortSignal.timeout(5000) }); return r.ok ? await r.json() : null; } catch { return null; }
}
export async function checkAi(): Promise<{ ok: boolean; status: string; latencyMs: number }> {
  try { const r = await fetch('/api/ai/check', { method: 'POST', signal: AbortSignal.timeout(12000) }); return r.ok ? await r.json() : { ok: false, status: 'unavailable', latencyMs: 0 }; }
  catch { return { ok: false, status: 'network', latencyMs: 0 }; }
}

type LabAsk = { question: string; setup: LabSetup; trials: LabTrial[]; consent: boolean };
/** 小桥实验室：把孩子真实做过的实验（设置 + 猜测）交给服务端；结果由服务端用规则重算 */
export async function askLabTutor(a: LabAsk): Promise<TutorAnswer> {
  const local = (reason: string): TutorAnswer => { const g = labGuidedReply(a.question, a.setup, a.trials); return { reply: g.text, save: g.save, mode: 'guided', reason }; };
  if (!a.consent) return local('consent');
  try {
    const res = await fetch('/api/lab-tutor', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ ...a, trials: a.trials.slice(-6) })
    });
    if (!res.ok) return local('network');
    const body = await res.json() as TutorAnswer;
    return typeof body.reply === 'string' && body.reply ? body : local('network');
  } catch { return local('network'); }
}
