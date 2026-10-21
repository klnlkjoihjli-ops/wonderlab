import { useEffect, useState } from 'react';
import { leftCount, place, type Placed, type SortLevel } from '../../shared/modules/sort';
import { sfx, speak, stopSpeaking, unlockAudio } from '../audio';

// 分一分（小样）：点一样东西，再点一个筐。放对了留在筐里，放错了弹回来，角色温和地提醒；没有红叉、没有分数。
// 判断全部在 shared/modules/sort.ts，这里只负责显示和声音。

export function SortGame({ level, onFinish }: { level: SortLevel; onFinish: () => void }) {
  const [placed, setPlaced] = useState<Placed>({});
  const [pick, setPick] = useState<string | null>(null);
  const [bounce, setBounce] = useState<string | null>(null);
  const [say, setSay] = useState(level.ask);
  const [done, setDone] = useState(false);
  const talk = (t: string) => { setSay(t); speak(t); };
  useEffect(() => () => stopSpeaking(), []);

  function choose(id: string) {
    if (done || placed[id]) return;
    unlockAudio(); sfx.pick();
    setPick(p => (p === id ? null : id));
  }
  function drop(binId: string) {
    if (!pick || done) { if (!done) talk('先点一样东西，再点筐哦。'); return; }
    const r = place(level, placed, pick, binId);
    if (!r.ok) {
      sfx.oops(); setBounce(pick); setTimeout(() => setBounce(null), 500);
      talk(r.say); setPick(null); return;
    }
    sfx.place(); setPlaced(r.placed); setPick(null);
    if (r.done) { setDone(true); sfx.success(); talk(`全部分好啦！你是按什么分的呢？${level.why}`); }
    else setSay(`${r.say}还剩 ${leftCount(level, r.placed)} 样。`);
  }

  const loose = level.items.filter(i => !placed[i.id]);
  return (
    <div className="sg">
      <div className="sg-npc">
        <span className="sg-who">{level.npc}</span>
        <p key={say}>{say}</p>
        <button className="pf-btn small" aria-label="再听一遍" onClick={() => { unlockAudio(); speak(say); }}>🔊</button>
      </div>
      <div className="sg-floor" aria-label="还没分的东西">
        {loose.map(i => (
          <button key={i.id} className={`sg-item ${pick === i.id ? 'on' : ''} ${bounce === i.id ? 'bounce' : ''}`} onClick={() => choose(i.id)} aria-label={i.name}>
            <span>{i.icon}</span><small>{i.name}</small>
          </button>
        ))}
        {loose.length === 0 && <p className="sg-empty">地上空了！</p>}
      </div>
      <div className="sg-bins" style={{ gridTemplateColumns: `repeat(${level.bins.length}, minmax(0, 1fr))` }}>
        {level.bins.map(b => (
          <button key={b.id} className={`sg-bin ${pick ? 'ready' : ''}`} style={b.color ? { borderColor: b.color } : undefined} onClick={() => drop(b.id)}>
            <span className="sg-bin-h" style={b.color ? { background: b.color, color: '#fff' } : undefined}>{b.icon} {b.name}</span>
            <span className="sg-in">{level.items.filter(i => placed[i.id] === b.id).map(i => <span key={i.id} title={i.name}>{i.icon}</span>)}</span>
          </button>
        ))}
      </div>
      {done && <button className="pf-cta" onClick={() => { stopSpeaking(); onFinish(); }}>✓ 分好啦，去领小红花</button>}
    </div>
  );
}
