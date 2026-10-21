import { useState } from 'react';
import {
  AREAS, CATS, DAYN, DOMAINS, NODES, nextAreaIn, openAreas, SHOP, THEMES, award, badges, dayIndex, freshPlatform, nodeState, petLevel, petOf, streak, unaward,
  type Platform
} from '../../shared/platform';
import { logEvent, setDemoOpen } from './platformStore';
import { setOnlineVoice } from '../audio';
import { CloseIcon } from '../components/Icons';

type Update = (fn: (d: Platform) => Platform | void) => void;
type Tab = 'day' | 'learn' | 'flower' | 'set';
const TABS: [Tab, string][] = [['day', '📅 日程'], ['learn', '🧠 学了什么'], ['flower', '✿ 小红花'], ['set', '⚙️ 设置']];

const fmt = (iso: string) => { const d = new Date(iso); return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

/** 家长视角：同一份存档，换成大人看的样子。直接切换，不用按住 */
export function ParentView({ p, update, demo, setDemo, onClose }: { p: Platform; update: Update; demo: boolean; setDemo: (b: boolean) => void; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('day');
  const today = dayIndex(new Date());
  const waits = p.week.flatMap((day, d) => day.map((b, i) => ({ b, d, i }))).filter(x => x.b.wait && !x.b.done);
  return (
    <div className="parent-view" role="dialog" aria-label="家长视角">
      <header className="pv-head">
        <div>
          <h2>家长视角</h2>
          <small>{DAYN[today]} · 今天的主题「{THEMES[today]}」 · 连续打卡 {streak(p, today)} 天</small>
        </div>
        <div className="pv-sum">
          <span><b>{p.flowers}</b>小红花</span>
          <span><b>{p.done.length}</b>/{NODES.length} 关</span>
          <span><b>{petOf(p.xp)[0]}</b>Lv.{petLevel(p.xp)}</span>
        </div>
        <button className="mini-btn" aria-label="回到孩子视角" onClick={onClose}><CloseIcon /></button>
      </header>
      <nav className="pv-tabs">
        {TABS.map(([k, n]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {n}{k === 'flower' && (p.pending.length + waits.length) > 0 && <i className="pv-dot">{p.pending.length + waits.length}</i>}
          </button>
        ))}
      </nav>
      <div className="pv-body">
        {tab === 'day' && <Schedule p={p} update={update} today={today} />}
        {tab === 'learn' && <Learned p={p} demo={demo} />}
        {tab === 'flower' && <Flowers p={p} update={update} waits={waits} today={today} />}
        {tab === 'set' && <Settings p={p} update={update} demo={demo} setDemo={setDemo} />}
      </div>
    </div>
  );
}

function Schedule({ p, update, today }: { p: Platform; update: Update; today: number }) {
  const [d, setD] = useState(today);
  const day = p.week[d];
  const doneCount = day.filter(b => b.f > 0 && b.done).length, total = day.filter(b => b.f > 0).length;
  return (
    <>
      <div className="pv-days">
        {DAYN.map((n, i) => {
          const items = p.week[i].filter(b => b.f > 0), all = items.length > 0 && items.every(b => b.done);
          return <button key={n} className={`${i === d ? 'on' : ''} ${i === today ? 'today' : ''}`} onClick={() => setD(i)}>{n}{all && <i>✓</i>}</button>;
        })}
      </div>
      <p className="pv-note">{DAYN[d]}主题「{THEMES[d]}」，完成 {doneCount}/{total} 件。点“完成”直接发花；点错了可以撤销。</p>
      <ul className="pv-list">
        {day.map((b, i) => (
          <li key={i} className={b.done ? 'done' : b.wait ? 'wait' : ''}>
            <time>{b.t}</time>
            <span className="pv-name">{b.n}<small>{CATS[b.c]}{b.f ? ` · ✿${b.f}` : ' · 不计花'}{b.chk ? ' · 需大人看' : ''}</small></span>
            {b.done
              ? <button className="pv-btn ghost" onClick={() => update(x => { const n = unaward(x, d, i); logEvent(n, 'undo', `撤销「${b.n}」`); return n; })}>撤销</button>
              : <button className={`pv-btn ${b.wait ? 'hot' : ''}`} onClick={() => update(x => { const r = award(x, d, i); logEvent(r.p, 'task', `家长确认「${b.n}」`); return r.p; })}>{b.wait ? '确认' : '完成'}</button>}
          </li>
        ))}
      </ul>
    </>
  );
}

function Learned({ p, demo }: { p: Platform; demo: boolean }) {
  const done = new Set(p.done);
  const when = (id: string) => p.events.find(e => e.type === 'complete' && e.node === id);
  const recent = p.events.filter(e => e.type === 'complete' || e.type === 'task').slice(-8).reverse();
  const stuck = p.stuck.slice(-5).reverse();
  return (
    <>
      {demo && <p className="pv-note warn">演示模式开着：所有关卡都能进，但只有真的过关才会记在这里。</p>}
      <div className="pv-badges">{badges(p, dayIndex(new Date())).map(b => <span key={b.n} className={b.got ? 'got' : ''}>{b.e} {b.n}</span>)}</div>
      {DOMAINS.map(dom => {
        const ns = NODES.filter(n => n.d === dom.id), k = ns.filter(n => done.has(n.id)).length, open = openAreas(p, demo), up = nextAreaIn(dom.id, p);
        return (
          <section key={dom.id} className="pv-domain" style={{ ['--dc' as string]: dom.color }}>
            <h3>{dom.icon} {dom.name} · {dom.full}<small>{k}/{ns.length}</small><i className="pv-bar"><i style={{ width: `${(k / ns.length) * 100}%` }} /></i></h3>
            {AREAS.filter(a => a.d === dom.id).map(a => {
              const an = ns.filter(n => n.a === a.id), ak = an.filter(n => done.has(n.id)).length;
              if (!open.has(a.id)) return (
                <p key={a.id} className="pv-area closed">{a.icon} {a.name}<small>{up?.a.id === a.id && up.need ? `还没浮出来：这块岛再点亮 ${up.need} 关会自动出现，也可以在“设置”里直接打开` : '还没打开，可以在“设置”里打开'}</small></p>
              );
              return (
                <div key={a.id}>
                  <p className="pv-area">{a.icon} {a.name}<small>{ak}/{an.length}</small></p>
                  <ul>
              {an.map(n => {
                const st = nodeState(n.id, done), e = when(n.id);
                return (
                  <li key={n.id} className={st}>
                    <span className="pv-ic">{n.icon}</span>
                    <span className="pv-name">{n.name}<small>{n.goal}</small></span>
                    <span className="pv-st">{st === 'done' ? `✓ ${e ? fmt(e.at) : '已点亮'}` : st === 'now' ? '可以学了' : '🔒 未开放'}</span>
                  </li>
                );
              })}
                  </ul>
                </div>
              );
            })}
          </section>
        );
      })}
      <section className="pv-domain">
        <h3>最近的记录</h3>
        {recent.length ? <ul>{recent.map((e, i) => <li key={i}><span className="pv-name">{e.detail}<small>{fmt(e.at)}</small></span></li>)}</ul> : <p className="pv-note">还没有记录。孩子过了第一关，这里就会出现。</p>}
        {stuck.length > 0 && <p className="pv-note">最近卡住过：{stuck.map(s => NODES.find(n => n.id === s.node)?.name ?? s.node).join('、')}（可以陪他一起看看）</p>}
      </section>
    </>
  );
}

function Flowers({ p, update, waits, today }: { p: Platform; update: Update; waits: { b: Platform['week'][number][number]; d: number; i: number }[]; today: number }) {
  const g = p.goal;
  const thisWeek = p.week.slice(0, today + 1).flat().filter(b => b.done).reduce((s, b) => s + b.f, 0);
  return (
    <>
      <div className="pv-big">
        <div><b>✿ {p.flowers}</b><small>现在有</small></div>
        <div><b>{thisWeek}</b><small>本周日程挣到</small></div>
        <div><b>{p.done.length}</b><small>点亮的关卡（每关 +1）</small></div>
      </div>
      <section className="pv-domain">
        <h3>大目标：{g.n}<small>{Math.min(g.have, g.need)}/{g.need}</small><i className="pv-bar"><i style={{ width: `${Math.min(1, g.have / g.need) * 100}%` }} /></i></h3>
      </section>
      <section className="pv-domain">
        <h3>等你点头</h3>
        {waits.length === 0 && p.pending.length === 0 && <p className="pv-note">暂时没有要确认的事。孩子做完“练字”“收拾玩具”这类要大人看的事，或者想换奖励时，会出现在这里。</p>}
        <ul>
          {waits.map(({ b, d, i }) => (
            <li key={`w${d}-${i}`}>
              <span className="pv-name">{DAYN[d]} · {b.n} 做完了<small>确认后得 ✿{b.f}</small></span>
              <button className="pv-btn hot" onClick={() => update(x => { const r = award(x, d, i); logEvent(r.p, 'task', `家长确认「${b.n}」`); return r.p; })}>确认</button>
            </li>
          ))}
          {p.pending.map((r, i) => (
            <li key={r.id + r.at}>
              <span className="pv-name">想兑换「{r.n}」<small>✿{r.cost} · {fmt(r.at)}</small></span>
              <span className="pv-row">
                <button className="pv-btn hot" onClick={() => update(x => { const [q] = x.pending.splice(i, 1); x.history.unshift({ n: q.n, cost: q.cost, at: new Date().toISOString(), st: '已兑换' }); x.history.splice(100); })}>同意</button>
                <button className="pv-btn ghost" onClick={() => update(x => { const [q] = x.pending.splice(i, 1); x.flowers += q.cost; x.history.unshift({ n: q.n, cost: q.cost, at: new Date().toISOString(), st: '没同意' }); x.history.splice(100); })}>退回</button>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="pv-domain">
        <h3>奖励清单</h3>
        <ul>{SHOP.map(s => <li key={s.id}><span className="pv-ic">{s.e}</span><span className="pv-name">{s.n}</span><span className="pv-st">✿ {s.cost}</span></li>)}</ul>
      </section>
      {p.history.length > 0 && (
        <section className="pv-domain">
          <h3>兑换记录</h3>
          <ul>{p.history.slice(0, 10).map((h, i) => <li key={i}><span className="pv-name">{h.n}<small>{fmt(h.at)}</small></span><span className="pv-st">✿{h.cost} · {h.st}</span></li>)}</ul>
        </section>
      )}
    </>
  );
}

function Settings({ p, update, demo, setDemo }: { p: Platform; update: Update; demo: boolean; setDemo: (b: boolean) => void }) {
  const exportData = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `wonderlab-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const Row = ({ label, sub, on, set }: { label: string; sub: string; on: boolean; set: (b: boolean) => void }) => (
    <li><span className="pv-name">{label}<small>{sub}</small></span>
      <button className={`pv-toggle ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)}><i /></button></li>
  );
  const open = openAreas(p);
  return (
    <>
    <section className="pv-domain">
      <h3>每块岛上开放哪些地方</h3>
      <p className="pv-note">关着的地方会在孩子点亮够关卡后自动浮出来；也可以在这里直接打开或关上。孩子一次只会看到 5 块岛。</p>
      {DOMAINS.map(dom => (
        <div key={dom.id}>
          <p className="pv-area">{dom.icon} {dom.name} · {dom.full}</p>
          <ul>
            {AREAS.filter(a => a.d === dom.id).map(a => (
              <Row key={a.id} label={`${a.icon} ${a.name}`} sub={a.unlock === 0 ? '一开始就有' : `这块岛点亮 ${a.unlock} 关后自动出现`} on={open.has(a.id)} set={b => update(x => { x.areas[a.id] = b; })} />
            ))}
          </ul>
        </div>
      ))}
    </section>
    <section className="pv-domain">
      <ul>
        <Row label="演示：所有关卡开放" sub="方便先看看每一关；不会记成完成" on={demo} set={b => { setDemoOpen(b); setDemo(b); }} />
        <Row label="在线语音（火山引擎）" sub="更自然的声音；关掉就用设备自带的声音" on={p.consent.voice} set={b => { setOnlineVoice(b); update(x => { x.consent.voice = b; }); }} />
        <Row label="语音识别（设备自带）" sub="孩子可以对小诺数数过关。本应用不录音、不存音频；声音由 iPad 自带的识别服务（Apple）转成文字" on={p.consent.speech} set={b => update(x => { x.consent.speech = b; })} />
        <Row label="小诺 AI 回答（DeepSeek）" sub="孩子问“为什么”时由 AI 回答；关掉只用固定提示" on={p.consent.ai} set={b => update(x => { x.consent.ai = b; })} />
        <Row label="静音" sub="关掉所有声音" on={p.muted} set={b => update(x => { x.muted = b; })} />
      </ul>
      <p className="pv-note">所有记录只存在这台设备的浏览器里。</p>
      <div className="pv-row">
        <button className="pv-btn" onClick={exportData}>导出记录</button>
        <button className="pv-btn danger" onClick={() => { if (confirm('清空这台设备上的全部记录？小红花、关卡、日程都会归零，不能恢复。')) update(() => freshPlatform()); }}>清空记录</button>
      </div>
    </section>
    </>
  );
}
