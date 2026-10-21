import { useEffect, useMemo, useState } from 'react';
import { hasGuess, nextTrial, react, type LabLevel } from '../../shared/modules/lab';
import { canRecord, choose, matchOk, needsParent, orderOk, shuffled, spotTap, type MatchLevel, type MissionLevel, type MissionRecord, type OrderLevel, type SceneLevel, type SpotLevel } from '../../shared/modules/play';
import { sfx, speak, stopSpeaking, unlockAudio } from '../audio';

// 发现岛竖切用到的六种玩法画面。判断全部在 shared/modules，这里只负责显示、声音和动画。
// 共同的样子：上面是角色说话的气泡，中间是要动手的东西，最后出现“完成”按钮。

function useTalk(first: string) {
  const [say, setSay] = useState(first);
  useEffect(() => () => stopSpeaking(), []);
  const talk = (t: string) => { setSay(t); speak(t); };
  return { say, setSay, talk };
}
function Bubble({ npc, say }: { npc: string; say: string }) {
  return (
    <div className="sg-npc">
      <span className="sg-who">{npc}</span>
      <p key={say}>{say}</p>
      <button className="pf-btn small" aria-label="再听一遍" onClick={() => { unlockAudio(); speak(say); }}>🔊</button>
    </div>
  );
}
function Finish({ label = '✓ 完成，去领小红花', onFinish }: { label?: string; onFinish: () => void }) {
  return <button className="pf-cta" onClick={() => { stopSpeaking(); onFinish(); }}>{label}</button>;
}

// —— 猜一猜·试一试 ——
export function LabGame({ level, onFinish }: { level: LabLevel; onFinish: () => void }) {
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [phase, setPhase] = useState<'guess' | 'try' | 'seen'>('guess');
  const [end, setEnd] = useState(false);
  const t = level.trials[i];
  const guess = hasGuess(t);
  const { say, talk } = useTalk(`${level.intro}${t.ask}`);
  useEffect(() => { setPhase(guess ? 'guess' : 'try'); setPick(null); }, [i, guess]);

  function choosePick(k: number) { unlockAudio(); sfx.pick(); setPick(k); setPhase('try'); talk(`你猜是“${t.options![k]}”。我们来${t.act}！`); }
  function run() { unlockAudio(); sfx.whoosh(); setPhase('seen'); const r = react(t, pick); talk(r.say); if (r.same !== false) sfx.success(); }
  function next() {
    const n = nextTrial(level, i);
    if (n === null) { setEnd(true); sfx.success(); talk(level.outro); return; }
    setI(n); talk(level.trials[n].ask);
  }
  return (
    <div className="sg">
      <Bubble npc={level.npc} say={say} />
      <div className="lab-steps">{level.trials.map((_, k) => <span key={k} className={k < i || end ? 'done' : k === i ? 'on' : ''} />)}</div>
      {!end && (
        <div className="lab-bench">
          <div className={`lab-show ${phase === 'seen' ? 'gone' : ''}`}>{t.show}</div>
          {phase === 'seen' && <div className="lab-result">{t.result}</div>}
          {phase === 'guess' && guess && (
            <div className="lab-opts">{t.options!.map((o, k) => <button key={k} className="sg-item wide" onClick={() => choosePick(k)}><span className="txt">{o}</span></button>)}</div>
          )}
          {phase === 'try' && <button className="pf-cta" onClick={run}>👉 {t.act}</button>}
          {phase === 'seen' && pick !== null && t.options && <p className="lab-cmp">你猜：{t.options[pick]} · 结果：{t.options[t.answer!]}</p>}
          {phase === 'seen' && <button className="pf-cta alt" onClick={next}>{nextTrial(level, i) === null ? '实验做完啦' : '下一个实验 →'}</button>}
        </div>
      )}
      {end && <Finish onFinish={onFinish} />}
    </div>
  );
}

// —— 配一配 ——
export function MatchGame({ level, onFinish }: { level: MatchLevel; onFinish: () => void }) {
  const order = useMemo(() => shuffled(level.pairs.length), [level]);
  const [done, setDone] = useState<number[]>([]);
  const [left, setLeft] = useState<number | null>(null);
  const [shake, setShake] = useState<number | null>(null);
  const { say, talk } = useTalk(level.ask);
  const all = done.length === level.pairs.length;
  function tapLeft(i: number) { if (done.includes(i)) return; unlockAudio(); sfx.pick(); setLeft(i); }
  function tapRight(j: number) {
    if (done.includes(j)) return;
    if (left === null) { talk('先点左边的，再点右边的哦。'); return; }
    if (matchOk(level, left, j)) {
      sfx.place(); const d = [...done, j]; setDone(d); setLeft(null);
      if (d.length === level.pairs.length) { sfx.success(); talk(level.outro); } else talk(`${level.ok}还有 ${level.pairs.length - d.length} 对。`);
    } else { sfx.oops(); setShake(j); setTimeout(() => setShake(null), 450); talk(`${level.pairs[left].a[1]}和${level.pairs[j].b[1]}好像不是一对，再看看？`); setLeft(null); }
  }
  return (
    <div className="sg">
      <Bubble npc={level.npc} say={say} />
      <div className="mt-cols">
        <div>{level.pairs.map((p, i) => (
          <button key={i} className={`sg-item row ${left === i ? 'on' : ''} ${done.includes(i) ? 'ok' : ''}`} onClick={() => tapLeft(i)}><span>{p.a[0]}</span><small>{p.a[1]}</small></button>
        ))}</div>
        <div>{order.map(j => (
          <button key={j} className={`sg-item row ${done.includes(j) ? 'ok' : ''} ${shake === j ? 'bounce' : ''}`} onClick={() => tapRight(j)}><span>{level.pairs[j].b[0]}</span><small>{level.pairs[j].b[1]}</small></button>
        ))}</div>
      </div>
      {all && <Finish onFinish={onFinish} />}
    </div>
  );
}

// —— 放大镜 / 找一找 ——
export function SpotGame({ level, onFinish }: { level: SpotLevel; onFinish: () => void }) {
  const [r, setR] = useState(0);
  const [seen, setSeen] = useState<number[]>([]);
  const [found, setFound] = useState(false);
  const [end, setEnd] = useState(false);
  const round = level.rounds[r];
  const { say, talk } = useTalk(`${level.intro}${round.ask}`);
  function tap(k: number) {
    if (found) return;
    unlockAudio();
    if (round.hidden && !seen.includes(k)) { sfx.whoosh(); setSeen([...seen, k]); }
    const res = spotTap(round, k);
    if (res.ok) { sfx.success(); setFound(true); talk(res.say); } else talk(res.say);
  }
  function next() {
    if (r + 1 >= level.rounds.length) { setEnd(true); talk(level.outro); return; }
    setR(r + 1); setSeen([]); setFound(false); talk(level.rounds[r + 1].ask);
  }
  return (
    <div className="sg">
      <Bubble npc={level.npc} say={say} />
      <div className="lab-steps">{level.rounds.map((_, k) => <span key={k} className={k < r || end ? 'done' : k === r ? 'on' : ''} />)}</div>
      {!end && <>
        <div className="sg-floor">
          {round.tiles.map((t, k) => {
            const show = !round.hidden || seen.includes(k) || found;
            return (
              <button key={k} className={`sg-item big ${found && t.ok ? 'ok' : ''}`} onClick={() => tap(k)} aria-label={show ? t.name : '放大看看'}>
                <span>{show ? t.icon : '🔍'}</span><small>{show ? t.name : '点一下放大'}</small>
              </button>
            );
          })}
        </div>
        <div className="pf-row">
          {!found && <button className="pf-btn" onClick={() => talk(`提示：${round.hint}`)}>💡 给我一点提示</button>}
          {found && <button className="pf-cta alt" onClick={next}>{r + 1 >= level.rounds.length ? '找完啦' : '下一个 →'}</button>}
        </div>
      </>}
      {end && <Finish onFinish={onFinish} />}
    </div>
  );
}

// —— 小剧场 ——
export function SceneGame({ level, onFinish }: { level: SceneLevel; onFinish: () => void }) {
  const [s, setS] = useState(0);
  const [result, setResult] = useState<{ good: boolean; k: number } | null>(null);
  const [end, setEnd] = useState(false);
  const scene = level.scenes[s];
  const { say, talk } = useTalk(`${level.intro}${scene.set}${scene.ask}`);
  function pick(k: number) {
    unlockAudio();
    const r = choose(scene, k);
    if (r.good) sfx.success(); else sfx.whoosh();
    setResult({ good: r.good, k }); talk(r.say);
  }
  function after() {
    if (!result) return;
    if (!result.good) { setResult(null); talk(`${scene.set}${scene.ask}`); return; }       // 倒带：回到场景开头再选
    if (s + 1 >= level.scenes.length) { setEnd(true); talk(level.outro); return; }
    setS(s + 1); setResult(null); talk(`${level.scenes[s + 1].set}${level.scenes[s + 1].ask}`);
  }
  return (
    <div className="sg">
      <Bubble npc={level.npc} say={say} />
      <div className="lab-steps">{level.scenes.map((_, k) => <span key={k} className={k < s || end ? 'done' : k === s ? 'on' : ''} />)}</div>
      {!end && (
        <div className={`sc-stage ${result ? (result.good ? 'good' : 'rewind') : ''}`}>
          <p className="sc-set">{scene.set}</p>
          {!result && <div className="sc-choices">{scene.choices.map((c, k) => <button key={k} className="sg-item wide" onClick={() => pick(k)}><span className="txt">{c.t}</span></button>)}</div>}
          {result && <p className="sc-then">{result.good ? '🎬 ' : '⏪ 倒带…… '}{scene.choices[result.k].then}</p>}
          {result && <button className="pf-cta alt" onClick={after}>{result.good ? (s + 1 >= level.scenes.length ? '演完啦' : '下一幕 →') : '⏪ 倒回去再选一次'}</button>}
        </div>
      )}
      {end && <Finish onFinish={onFinish} />}
    </div>
  );
}

// —— 排顺序 ——
export function OrderGame({ level, onFinish }: { level: OrderLevel; onFinish: () => void }) {
  const order = useMemo(() => shuffled(level.steps.length, 11), [level]);
  const [placed, setPlaced] = useState(0);
  const [shake, setShake] = useState<number | null>(null);
  const { say, talk } = useTalk(level.ask);
  const all = placed === level.steps.length;
  function tap(k: number) {
    if (k < placed) return;
    unlockAudio();
    if (orderOk(placed, k)) {
      sfx.place(); const n = placed + 1; setPlaced(n);
      if (n === level.steps.length) { sfx.success(); talk(level.outro); } else talk(`${level.steps[k][1]}，放好了！下一个是什么？`);
    } else { sfx.oops(); setShake(k); setTimeout(() => setShake(null), 450); talk(`${level.steps[k][1]}好像还不是这一格，再想想前面是什么？`); }
  }
  return (
    <div className="sg">
      <Bubble npc={level.npc} say={say} />
      <div className={`od-slots ${level.loop && all ? 'loop' : ''}`}>
        {level.steps.map((st, i) => <div key={i} className={`od-slot ${i < placed ? 'ok' : ''}`}>{i < placed ? <><span>{st[0]}</span><small>{st[1]}</small></> : <small>第 {i + 1} 个</small>}</div>)}
        {level.loop && all && <div className="od-slot back"><span>↩︎</span><small>又回到{level.steps[0][1]}</small></div>}
      </div>
      <div className="sg-floor">
        {order.filter(k => k >= placed).map(k => (
          <button key={k} className={`sg-item ${shake === k ? 'bounce' : ''}`} onClick={() => tap(k)}><span>{level.steps[k][0]}</span><small>{level.steps[k][1]}</small></button>
        ))}
        {all && <p className="sg-empty">都排好啦！</p>}
      </div>
      {all && <Finish onFinish={onFinish} />}
    </div>
  );
}

// —— 生活任务卡 ——
export function MissionGame({ level, recs, today, onRecord, onFinish }: {
  level: MissionLevel; recs: MissionRecord[]; today: string; onRecord: (r: MissionRecord) => void; onFinish: () => void;
}) {
  const [pick, setPick] = useState<string | null>(null);
  const can = canRecord(recs, today, level);
  const ready = needsParent(recs, level);
  const { say, talk } = useTalk(ready ? '都记好啦！请爸爸妈妈来看一眼，点下面的确认。' : can ? `任务卡：${level.title}！做完了回来告诉我。` : `今天记好啦（第 ${recs.length} 天，还要 ${level.days - recs.length} 天），明天再来！`);
  function record() {
    if (!pick) { talk(level.report); return; }
    unlockAudio(); sfx.place(); onRecord({ day: today, pick }); setPick(null);
    const n = recs.length + 1;
    talk(n >= level.days ? '记满啦！请爸爸妈妈来看一眼。' : `记下来了！这是第 ${n} 天，还要 ${level.days - n} 天。`);
  }
  const sum = ready && level.sum ? level.sum.say(recs.filter(r => r.pick === level.sum!.pick).length, recs.length) : null;
  return (
    <div className="sg">
      <Bubble npc={level.npc} say={say} />
      <div className="ms-card">
        <b>📋 {level.title}</b>
        <ol>{level.todo.map((t, k) => <li key={k}>{t}</li>)}</ol>
        {level.days > 1 && (
          <div className="ms-days">{Array.from({ length: level.days }, (_, k) => <span key={k} className={recs[k] ? 'ok' : ''}>{recs[k]?.pick?.split(' ')[0] ?? (k + 1)}</span>)}</div>
        )}
      </div>
      {!ready && can && (
        <div className="ms-report">
          <p>{level.report}</p>
          <div className="lab-opts">{(level.choices ?? ['做完了']).map(c => <button key={c} className={`sg-item wide ${pick === c ? 'on' : ''}`} onClick={() => { unlockAudio(); sfx.pick(); setPick(c); }}><span className="txt">{c}</span></button>)}</div>
          <button className="pf-cta" onClick={record}>{level.days > 1 ? '✓ 记下今天' : '✓ 我做完了'}</button>
        </div>
      )}
      {sum && <p className="ms-sum">📊 {sum}</p>}
      {ready && <Finish label="👨‍👩‍👧 家长确认：孩子真的做了" onFinish={onFinish} />}
    </div>
  );
}
