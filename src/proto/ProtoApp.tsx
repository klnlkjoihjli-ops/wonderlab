import { useEffect, useState, type ReactNode } from 'react';
import { AGES, AREAS, DOMAINS, NODES, PET, SHOP, ageBandOf, ageIndex, isChallenge, nextAreaIn, node, nodeState, openAreas, petOf, prereqs, visibleFor, type AgeId, type AreaId, type DomainId, type Node } from '../../shared/platform';
import { ageOf, dailyThree } from '../../shared/daily';
import { ENGINES, PLAYS, SCENES } from '../../shared/games';
import { SORT_LEVELS } from '../../shared/modules/sort';
import { LAB_LEVELS } from '../../shared/modules/lab';
import { MATCH_LEVELS, MISSION_LEVELS, ORDER_LEVELS, SCENE_LEVELS, SPOT_LEVELS, type MissionRecord } from '../../shared/modules/play';
import { SortGame } from './SortGame';
import { LabGame, MatchGame, MissionGame, OrderGame, SceneGame, SpotGame } from './Games';

/** 这一关现在能不能玩：有小样内容，或者已经有 3D 工作台 */
const BENCH = new Set(['c2', 'v3']);
const playable = (id: string) => Boolean(SORT_LEVELS[id] || LAB_LEVELS[id] || MATCH_LEVELS[id] || SPOT_LEVELS[id] || SCENE_LEVELS[id] || ORDER_LEVELS[id] || MISSION_LEVELS[id] || BENCH.has(id));
/** 本地日期（线框版可以“当作过了一天”来演示生活任务卡） */
const dayOf = (shift: number) => { const d = new Date(); d.setDate(d.getDate() + shift); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

// 线框版：不放美术，只用方块、文字和 emoji，把“怎么点、怎么进去、怎么分类、不同年龄看到什么”走通。
// 分类、关卡、年龄段、解锁规则、每天三件事都直接用 shared/ 里的真规则，和正式版保持一致。
// 进度只存在这个页面自己的 localStorage 里，不影响小样和正式版。

type Route =
  | { s: 'home' } | { s: 'world' } | { s: 'island'; d: DomainId } | { s: 'area'; a: AreaId }
  | { s: 'level'; id: string } | { s: 'play'; id: string } | { s: 'done'; id: string; opened: string[] }
  | { s: 'reward' } | { s: 'parent' } | { s: 'map' };
type Ev = { at: string; type: string; node: string };
type State = { done: string[]; events: Ev[]; flowers: number; xp: number; areas: Record<string, boolean>; band: AgeId; missions: Record<string, MissionRecord[]>; dayShift: number };

const KEY = 'wonderlab.proto.v1';
/** 默认按演示孩子豆豆（2021 年 2 月出生）的年龄 */
const DEFAULT_BAND = ageBandOf(ageOf('2021-02').total);
const fresh = (band: AgeId = DEFAULT_BAND): State => ({ done: [], events: [], flowers: 0, xp: 0, areas: {}, band, missions: {}, dayShift: 0 });
function load(): State {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '');
    if (v && Array.isArray(v.done)) return { ...fresh(), ...v, band: AGES.some(a => a.id === v.band) ? v.band : DEFAULT_BAND };
  } catch { /* 没存过 */ }
  return fresh();
}
const dom = (d: DomainId) => DOMAINS.find(x => x.id === d)!;
const areaOf = (a: AreaId) => AREAS.find(x => x.id === a)!;
const ageName = (a?: AgeId) => (a ? AGES.find(x => x.id === a)!.name : '未分年龄');
/** 依据里的简称展开成文件全名，家长能自己去查 */
const SRC_FULL: [string, string][] = [
  ['指南 ', '《3-6岁儿童学习与发展指南》（教育部 2012）'],
  ['入学准备 ', '《幼儿园入学准备教育指导要点》（教育部 2021）'],
  ['数学课标 ', '《义务教育数学课程标准（2022年版）》第一学段 '],
  ['语文课标 ', '《义务教育语文课程标准（2022年版）》第一学段 '],
  ['英语课标 ', '《义务教育英语课程标准（2022年版）》'],
  ['科学课标 ', '《义务教育科学课程标准（2022年版）》'],
  ['道德与法治课标 ', '《义务教育道德与法治课程标准（2022年版）》'],
  ['体育与健康课标 ', '《义务教育体育与健康课程标准（2022年版）》'],
  ['艺术课标 ', '《义务教育艺术课程标准（2022年版）》'],
  ['劳动课标 ', '《义务教育劳动课程标准（2022年版）》']
];
const srcFull = (src: string) => { const hit = SRC_FULL.find(([k]) => src.startsWith(k)); return hit ? hit[1] + src.slice(hit[0].length) : src; };

/** 每个画面的说明：这一页做什么、以后要画什么 */
const NOTES: Record<Route['s'], { what: string; art: string }> = {
  home: { what: '孩子每天打开先到这里：小诺打招呼，给出今天的 3 件事（复习一个、学一个新的、动手玩一个）。新学的优先是孩子自己年龄段的关。点卡片直接进关卡，不用自己找。', art: '小诺角色、温暖的背景、3 张任务卡的插画' },
  world: { what: '大地图：5 座岛，每座岛对应一个学习领域。孩子一次只看到这 5 个选择。进度只算这个年龄能看到的关。', art: '一整张群岛地图（就是之前渲染的那种风格），每座岛一个地标' },
  island: { what: '一座岛里分几个区域，分类参照《指南》和课标。有的区域要点亮够了关卡才“浮出来”；这个年龄还没有内容的区域（比如幼儿园阶段的英语）会显示什么时候开放。', art: '这座岛的大地图（比如数字岛那张），区域用地标表示' },
  area: { what: '一个区域里的关卡一层一层排：上一层点亮了，下一层才能玩。只显示这个年龄能看到的关；比自己年龄段小的关当作已经会了，也可以回去玩。自己年龄段的都点亮了，会出现下一段的“挑战关”。', art: '地图上的小路和关卡点，或者一条台阶/小路' },
  level: { what: '关卡说明：这一关学什么、怎么玩、适合几岁、依据哪份文件。家长看得懂，孩子听小诺读。', art: '关卡的小插图、小诺讲解' },
  play: { what: '每关用 17 种玩法里的一种。发现岛幼儿园段（到幼小衔接）的 39 关全部能玩：猜一猜·试一试、分一分、配一配、放大镜、小剧场、排顺序、生活任务卡；其他岛有几关“分一分”能玩，其余先显示设计稿。', art: '每种玩法设计一次，所有用它的关共用' },
  done: { what: '完成奖励：得小红花，告诉孩子新开放了哪些关卡。', art: '撒花动画、小诺欢呼、新关卡亮起来' },
  reward: { what: '小红花和成长伙伴：攒花换奖励（家长确认），伙伴随经验长大。', art: '伙伴的 5 个成长阶段、奖励商店' },
  parent: { what: '家长端：看每座岛的进度，手动打开或关上区域，清空进度。', art: '家长端以简洁为主，不需要太多美术' },
  map: { what: '整个产品的结构图：页面怎么跳转，内容怎么分类，每个年龄段有多少关。', art: '—' }
};

export function ProtoApp() {
  const [st, setSt] = useState<State>(load);
  const [stack, setStack] = useState<Route[]>([{ s: 'home' }]);
  const [showNote, setShowNote] = useState(true);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* 存不了也能玩 */ } }, [st]);

  const route = stack[stack.length - 1];
  const go = (r: Route) => setStack(s => [...s, r]);
  const back = () => setStack(s => (s.length > 1 ? s.slice(0, -1) : s));
  const home = () => setStack([{ s: 'home' }]);
  /** 完成后回到这一关的区域：去掉“关卡说明”和“完成”两页；如果本来就是从这个区域进来的，直接回到它 */
  const toArea = (a: AreaId) => setStack(s => {
    const rest = s.slice(0, -2), last = rest[rest.length - 1];
    return last?.s === 'area' && last.a === a ? rest : [...rest, { s: 'area', a }];
  });
  const done = new Set(st.done);
  const band = st.band;
  const open = openAreas(st);
  /** 这个孩子现在能玩的关：区域打开了、这个年龄看得到、前置都过了 */
  const playableNow = (d: ReadonlySet<string>) => new Set(NODES.filter(n => open.has(n.a) && visibleFor(n, band, d) && nodeState(n.id, d, band) === 'now').map(n => n.id));

  function finish(id: string) {
    if (done.has(id)) { setStack(s => [...s.slice(0, -1), { s: 'done', id, opened: [] }]); return; }
    const after = new Set(done); after.add(id);
    const before = playableNow(done);
    const opened = [...playableNow(after)].filter(x => !before.has(x));
    setSt(p => ({ ...p, done: [...p.done, id], flowers: p.flowers + 1, xp: p.xp + 2, events: [...p.events, { at: new Date().toISOString(), type: 'complete', node: id }] }));
    setStack(s => [...s.slice(0, -1), { s: 'done', id, opened }]);
  }
  const setBand = (b: AgeId) => setSt(p => ({ ...p, band: b }));

  const crumbs = stack.map(r => label(r));
  const note = NOTES[route.s];

  return (
    <div className="pf">
      <header className="pf-top">
        <button className="pf-btn" onClick={back} disabled={stack.length < 2}>← 返回</button>
        <nav className="pf-crumbs">{crumbs.map((c, i) => <span key={i}>{i > 0 && <i>›</i>}{c}</span>)}</nav>
        <div className="pf-top-r">
          <label className="pf-age">
            <span>年龄</span>
            <select value={band} onChange={e => setBand(e.target.value as AgeId)}>
              {AGES.map(a => <option key={a.id} value={a.id}>{a.name}（{a.range}）</option>)}
            </select>
          </label>
          <span className="pf-flower">✿ {st.flowers}</span>
          <button className="pf-btn" onClick={home}>🏠</button>
          <button className="pf-btn" onClick={() => go({ s: 'map' })}>结构图</button>
          <button className={`pf-btn ${showNote ? 'on' : ''}`} onClick={() => setShowNote(v => !v)}>说明</button>
        </div>
      </header>
      {showNote && (
        <aside className="pf-note">
          <b>这一页：</b>{note.what}<br /><b>以后的美术：</b>{note.art}
        </aside>
      )}
      <main className="pf-main">
        {route.s === 'home' && <Home st={st} go={go} />}
        {route.s === 'world' && <World st={st} go={go} />}
        {route.s === 'island' && <Island d={route.d} st={st} go={go} />}
        {route.s === 'area' && <Area a={route.a} st={st} go={go} />}
        {route.s === 'level' && <Level id={route.id} st={st} go={go} />}
        {route.s === 'play' && <Play id={route.id} st={st} setSt={setSt} onFinish={() => finish(route.id)} />}
        {route.s === 'done' && <Done id={route.id} opened={route.opened} st={st} toArea={() => toArea(node(route.id).a)} home={home} />}
        {route.s === 'reward' && <Reward st={st} />}
        {route.s === 'parent' && <Parent st={st} open={open} setSt={setSt} />}
        {route.s === 'map' && <SiteMap st={st} open={open} />}
      </main>
    </div>
  );
}

function label(r: Route): string {
  switch (r.s) {
    case 'home': return '首页';
    case 'world': return '大地图';
    case 'island': return dom(r.d).name;
    case 'area': return areaOf(r.a).name;
    case 'level': return node(r.id).name;
    case 'play': return '玩';
    case 'done': return '完成';
    case 'reward': return '小红花';
    case 'parent': return '家长';
    case 'map': return '结构图';
  }
}

/** 这个孩子在某个范围里能看到的关 */
const seen = (st: State, f: (n: Node) => boolean) => { const done = new Set(st.done); return NODES.filter(n => f(n) && visibleFor(n, st.band, done)); };

function Art({ children, h = 120 }: { children: string; h?: number }) {
  return <div className="pf-art" style={{ minHeight: h }}>美术：{children}</div>;
}

function AgeChip({ n, band }: { n: Node; band: AgeId }) {
  if (!n.age) return <span className="pf-chip none">未分年龄</span>;
  return <span className={`pf-chip ${isChallenge(n, band) ? 'up' : ageIndex(n.age) < ageIndex(band) ? 'down' : ''}`}>{isChallenge(n, band) ? '挑战 · ' : ''}{ageName(n.age)}</span>;
}

function Home({ st, go }: { st: State; go: (r: Route) => void }) {
  const t = dailyThree(st);
  const cards: { tag: string; n: Node | null; empty: string }[] = [
    { tag: '🔁 复习', n: t.review, empty: '今天没有要复习的（学过的关会在第 1、3、7、14 天回来）' },
    { tag: '✨ 学个新的', n: t.learn, empty: '能学的都学完啦' },
    { tag: '🖐️ 动手玩', n: t.play, empty: '暂时没有可以动手的' }
  ];
  const A = AGES.find(a => a.id === st.band)!;
  return (
    <div className="pf-col">
      <div className="pf-hello">
        <div className="pf-owl">🦉</div>
        <div className="pf-bubble">豆豆，早上好！我是小诺。今天{t.theme ? `是${dom(t.theme).name}的探险日` : '休息一下'}，我们一起做 3 件事吧。<small className="pf-sub">（现在按「{A.name} {A.range}」出题，右上角可以换年龄）</small></div>
      </div>
      <div className="pf-grid3">
        {cards.map(c => (
          <button key={c.tag} className="pf-card" disabled={!c.n} onClick={() => c.n && go({ s: 'level', id: c.n.id })}>
            <span className="pf-tag">{c.tag}</span>
            {c.n ? <>
              <span className="pf-big">{c.n.icon}</span>
              <b>{c.n.name}</b>
              <small>{dom(c.n.d).icon} {dom(c.n.d).name} · {areaOf(c.n.a).name}</small>
              <AgeChip n={c.n} band={st.band} />
              {st.done.includes(c.n.id) && <small className="pf-ok">✓ 已点亮</small>}
            </> : <small>{c.empty}</small>}
          </button>
        ))}
      </div>
      <div className="pf-row">
        <button className="pf-cta" onClick={() => go({ s: 'world' })}>🗺️ 去大地图自己逛</button>
        <button className="pf-cta alt" onClick={() => go({ s: 'reward' })}>✿ 我的小红花</button>
        <button className="pf-btn small" onClick={() => go({ s: 'parent' })}>👨‍👩‍👧 家长</button>
      </div>
    </div>
  );
}

function World({ st, go }: { st: State; go: (r: Route) => void }) {
  return (
    <div className="pf-col">
      <Art h={70}>整张群岛地图，5 座岛各有地标；这里先用卡片代替</Art>
      <div className="pf-grid5">
        {DOMAINS.map(d => {
          const all = seen(st, n => n.d === d.id), lit = all.filter(n => st.done.includes(n.id)).length;
          const sorted = NODES.some(n => n.d === d.id && n.age);
          return (
            <button key={d.id} className="pf-card island" style={{ borderColor: d.color }} onClick={() => go({ s: 'island', d: d.id })}>
              <span className="pf-big">{d.icon}</span>
              <b>{d.name}</b>
              <small>{d.full}{sorted ? '' : ' · 还没按年龄整理'}</small>
              <Progress v={lit} of={all.length} color={d.color} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Island({ d, st, go }: { d: DomainId; st: State; go: (r: Route) => void }) {
  const D = dom(d), open = openAreas(st), next = nextAreaIn(d, st);
  return (
    <div className="pf-col">
      <h2 style={{ color: D.color }}>{D.icon} {D.name} <small>（{D.full}）</small></h2>
      <Art h={70}>{`${D.name}的大地图，区域用地标表示`}</Art>
      <div className="pf-grid3">
        {AREAS.filter(a => a.d === d).map(a => {
          const isOpen = open.has(a.id), all = seen(st, n => n.a === a.id), lit = all.filter(n => st.done.includes(n.id)).length;
          if (isOpen && all.length === 0) {
            // 这个年龄一关都没有（比如英语：课标从 1～2 年级开始，幼儿园不提前教）
            const first = NODES.filter(n => n.a === a.id && n.age).sort((x, y) => ageIndex(x.age!) - ageIndex(y.age!))[0];
            return (
              <div key={a.id} className="pf-card locked">
                <span className="pf-big">{a.icon}</span>
                <b>{a.name}</b>
                <small>{first?.age === 'g1' ? '上小学（6 岁）后开放' : `${ageName(first?.age)}开放`}</small>
              </div>
            );
          }
          return (
            <button key={a.id} className={`pf-card ${isOpen ? '' : 'locked'}`} disabled={!isOpen} onClick={() => go({ s: 'area', a: a.id })}>
              <span className="pf-big">{isOpen ? a.icon : '☁️'}</span>
              <b>{isOpen ? a.name : '还在云里'}</b>
              {isOpen ? <Progress v={lit} of={all.length} color={D.color} /> : <small>{next?.a.id === a.id ? `再点亮 ${next.need} 关就浮出来` : '以后会浮出来'}</small>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Area({ a, st, go }: { a: AreaId; st: State; go: (r: Route) => void }) {
  const A = areaOf(a), D = dom(A.d), done = new Set(st.done);
  const all = NODES.filter(n => n.a === a), shown = all.filter(n => visibleFor(n, st.band, done)), hidden = all.filter(n => !shown.includes(n));
  // 比孩子年龄段小的关收起来（当作已经会了，可以回去复习）；自己的和挑战关放前面
  const younger = shown.filter(n => n.age && ageIndex(n.age) < ageIndex(st.band)), nodes = shown.filter(n => !younger.includes(n));
  const [showYounger, setShowYounger] = useState(nodes.length === 0);
  const hiddenBy = AGES.map(g => ({ g, k: hidden.filter(n => n.age === g.id).length })).filter(x => x.k);
  const steps = (list: Node[]) => (
    <div className="pf-steps">
      {[...new Set(list.map(n => n.lv))].sort((x, y) => x - y).map(lv => (
        <div key={lv} className="pf-step">
          <span className="pf-lv">第 {lv + 1} 层</span>
          {list.filter(n => n.lv === lv).map(n => {
            const s = nodeState(n.id, done, st.band);
            return (
              <button key={n.id} className={`pf-node ${s}`} onClick={() => go({ s: 'level', id: n.id })}>
                <span>{s === 'lock' ? '🔒' : n.icon}</span>{n.name}{s === 'done' && ' ✓'}
                <AgeChip n={n} band={st.band} />
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
  return (
    <div className="pf-col">
      <h2 style={{ color: D.color }}>{A.icon} {A.name} <small>· {SCENES[a].place}，{SCENES[a].npc}在这里</small></h2>
      <p className="pf-hint">从上往下走：这一层点亮了，下一层才打开。<span className="lg done">✓ 点亮</span><span className="lg now">● 现在能玩</span><span className="lg lock">🔒 还没开</span></p>
      {nodes.length > 0 ? steps(nodes) : <p className="pf-hidden">这个区域没有「{ageName(st.band)}」的关，下面是更小时候的关，可以回去玩。</p>}
      {younger.length > 0 && (
        <>
          <button className="pf-btn pf-fold" onClick={() => setShowYounger(v => !v)}>
            {showYounger ? '▲ 收起' : '▼ 展开'}更小时候的关（{younger.length} 关，当作已经会了，可以回去复习）
          </button>
          {showYounger && steps(younger)}
        </>
      )}
      {hiddenBy.length > 0 && (
        <p className="pf-hidden">☁️ 还有 {hidden.length} 关，长大一点再来：{hiddenBy.map(x => `${x.g.name} ${x.k} 关`).join('、')}。
          {hidden.some(n => n.age !== 'g1') && '自己年龄段的关都点亮了，会先出现下一段的挑战关。'}
          {hidden.some(n => n.age === 'g1') && st.band !== 'g1' && '1～2 年级的关要到 6 岁上学以后才出现。'}
        </p>
      )}
    </div>
  );
}

function Level({ id, st, go }: { id: string; st: State; go: (r: Route) => void }) {
  const done = new Set(st.done), n = node(id), s = nodeState(id, done, st.band), pre = prereqs(n).map(node);
  const A = n.age ? AGES.find(a => a.id === n.age)! : null;
  return (
    <div className="pf-col narrow">
      <div className="pf-level">
        <span className="pf-big">{n.icon}</span>
        <h2>{n.name}</h2>
        <p>{dom(n.d).icon} {dom(n.d).name} › {areaOf(n.a).name} › 第 {n.lv + 1} 层</p>
        <p><b>学会了：</b>{n.goal}</p>
        <p className="pf-play"><b>玩法：</b>{ENGINES[PLAYS[n.id][0]].icon} {ENGINES[PLAYS[n.id][0]].name} — {PLAYS[n.id][1]}</p>
        <p className="pf-src">{SCENES[n.a].place}的{SCENES[n.a].npc}请你帮忙 · 完成后{SCENES[n.a].reward}{playable(n.id) ? ' · 已经能玩' : ' · 玩法还在设计稿里'}</p>
        <p><b>适合：</b>{A ? `${A.name}（${A.range}）` : '还没按年龄整理'} <AgeChip n={n} band={st.band} /></p>
        {n.src && <p className="pf-src"><b>依据：</b>{srcFull(n.src)}</p>}
        {pre.length > 0 && <p><b>先要点亮：</b>{pre.map(p => `${p.name}${done.has(p.id) ? ' ✓' : p.age && ageIndex(p.age) < ageIndex(st.band) ? '（这个年龄当作已经会了）' : ''}`).join('、')}</p>}
        <Art h={90}>这一关的小插图 + 小诺讲解</Art>
        {s === 'lock'
          ? <button className="pf-cta" disabled>🔒 先点亮前面的关</button>
          : <button className="pf-cta" onClick={() => go({ s: 'play', id })}>{s === 'done' ? '🔁 再玩一次' : '▶ 开始玩'}</button>}
      </div>
    </div>
  );
}

function Play({ id, st, setSt, onFinish }: { id: string; st: State; setSt: (f: (p: State) => State) => void; onFinish: () => void }) {
  const n = node(id), [e, line] = PLAYS[id], E = ENGINES[e];
  const wrap = (el: ReactNode) => <div className="pf-col narrow" key={id}>{el}</div>;
  if (SORT_LEVELS[id]) return wrap(<SortGame level={SORT_LEVELS[id]} onFinish={onFinish} />);
  if (LAB_LEVELS[id]) return wrap(<LabGame level={LAB_LEVELS[id]} onFinish={onFinish} />);
  if (MATCH_LEVELS[id]) return wrap(<MatchGame level={MATCH_LEVELS[id]} onFinish={onFinish} />);
  if (SPOT_LEVELS[id]) return wrap(<SpotGame level={SPOT_LEVELS[id]} onFinish={onFinish} />);
  if (SCENE_LEVELS[id]) return wrap(<SceneGame level={SCENE_LEVELS[id]} onFinish={onFinish} />);
  if (ORDER_LEVELS[id]) return wrap(<OrderGame level={ORDER_LEVELS[id]} onFinish={onFinish} />);
  if (MISSION_LEVELS[id]) {
    const recs = st.missions[id] ?? [];
    return wrap(<>
      <MissionGame key={`${id}-${st.dayShift}-${recs.length}`} level={MISSION_LEVELS[id]} recs={recs} today={dayOf(st.dayShift)}
        onRecord={r => setSt(p => ({ ...p, missions: { ...p.missions, [id]: [...(p.missions[id] ?? []), r] } }))} onFinish={onFinish} />
      <p className="pf-hint">线框版演示：<button className="pf-btn small" onClick={() => setSt(p => ({ ...p, dayShift: p.dayShift + 1 }))}>⏩ 当作过了一天</button>（真正使用时一天只能记一次）</p>
    </>);
  }
  if (BENCH.has(id)) return wrap(<>
    <Art h={140}>{`「${n.name}」在 3D 工作台上玩（已经做好）`}</Art>
    <a className="pf-cta" href={`bench.html?node=${id}`}>🔧 打开 3D 工作台</a>
    <p className="pf-hint">3D 工作台需要在 Mac 或 iPad 的本机地址打开（localhost:4177 或 :4178）。玩完回来点下面的按钮算完成。</p>
    <button className="pf-cta alt" onClick={onFinish}>✓ 我在工作台上玩完了</button>
  </>);
  return wrap(<>
    <Art h={240}>{`「${n.name}」· ${E.icon} ${E.name}：${line}`}</Art>
    <p className="pf-hint"><b>这种玩法怎么玩：</b>{E.loop}。<b>怎么判断：</b>{E.judge}。<b>不同年龄：</b>{E.ages}。</p>
    <button className="pf-cta" onClick={onFinish}>✓ 我玩完了（线框版直接算完成）</button>
  </>);
}

function Done({ id, opened, st, toArea, home }: { id: string; opened: string[]; st: State; toArea: () => void; home: () => void }) {
  const n = node(id);
  return (
    <div className="pf-col narrow">
      <div className="pf-level">
        <span className="pf-big">🎉</span>
        <h2>点亮了「{n.name}」！</h2>
        <p>得到 1 朵小红花，现在一共 ✿ {st.flowers}</p>
        {opened.length > 0 && <p><b>新开放：</b>{opened.map(o => `${node(o).name}${isChallenge(node(o), st.band) ? '（挑战关）' : ''}`).join('、')}</p>}
        <Art h={80}>撒花动画、小诺欢呼</Art>
        <div className="pf-row">
          <button className="pf-cta" onClick={toArea}>去{areaOf(n.a).name}看看</button>
          <button className="pf-cta alt" onClick={home}>回首页看今天的事</button>
        </div>
      </div>
    </div>
  );
}

function Reward({ st }: { st: State }) {
  const [e, name, desc] = petOf(st.xp);
  const total = seen(st, () => true).length;
  return (
    <div className="pf-col">
      <div className="pf-grid3">
        <div className="pf-card static"><span className="pf-big">✿</span><b>{st.flowers} 朵小红花</b><small>每点亮一关 +1</small></div>
        <div className="pf-card static"><span className="pf-big">{e}</span><b>{name}</b><small>{desc}（经验 {st.xp}，一共 {PET.length} 个阶段）</small></div>
        <div className="pf-card static"><span className="pf-big">⭐</span><b>点亮 {st.done.length} / {total} 关</b><small>这个年龄能看到的关</small></div>
      </div>
      <h3>用小红花换（需要爸爸妈妈同意）</h3>
      <div className="pf-grid5">
        {SHOP.map(s => <div key={s.id} className={`pf-card static ${st.flowers >= s.cost ? '' : 'locked'}`}><span className="pf-big">{s.e}</span><b>{s.n}</b><small>✿ {s.cost}</small></div>)}
      </div>
    </div>
  );
}

function Parent({ st, open, setSt }: { st: State; open: Set<AreaId>; setSt: (f: (p: State) => State) => void }) {
  const toggle = (a: AreaId) => setSt(p => ({ ...p, areas: { ...p.areas, [a]: !open.has(a) } }));
  return (
    <div className="pf-col">
      <table className="pf-table">
        <thead><tr><th>岛</th><th>区域</th><th>这个年龄能看到</th><th>点亮</th><th>孩子能看到</th></tr></thead>
        <tbody>
          {AREAS.map(a => {
            const all = seen(st, n => n.a === a.id);
            return (
              <tr key={a.id}>
                <td>{dom(a.d).icon} {dom(a.d).name}</td><td>{a.icon} {a.name}</td><td>{all.length} 关</td>
                <td>{all.filter(n => st.done.includes(n.id)).length}</td>
                <td><button className={`pf-btn small ${open.has(a.id) ? 'on' : ''}`} onClick={() => toggle(a.id)}>{open.has(a.id) ? '打开' : '关上'}</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="pf-row">
        <button className="pf-btn" onClick={() => { if (confirm('清空线框版里的进度？')) setSt(p => fresh(p.band)); }}>清空进度</button>
        <button className="pf-btn" onClick={() => setSt(p => ({ ...p, done: [...new Set([...p.done, ...NODES.filter(n => n.lv === 0).map(n => n.id)])] }))}>演示：把每个区域第 1 层都点亮</button>
      </div>
    </div>
  );
}

function SiteMap({ st, open }: { st: State; open: Set<AreaId> }) {
  const done = new Set(st.done);
  const count = (f: (n: Node) => boolean) => NODES.filter(f).length;
  return (
    <div className="pf-col">
      <h3>页面怎么走</h3>
      <div className="pf-flow">
        {['首页（小诺 + 今天 3 件事）', '大地图（5 座岛）', '岛（几个区域）', '区域（关卡一层层）', '关卡说明', '玩', '完成奖励'].map((t, i) => <span key={i}>{i > 0 && <i>→</i>}<b>{t}</b></span>)}
      </div>
      <p className="pf-hint">首页的 3 张卡片可以直接跳到“关卡说明”，不用一层层点进去；首页还能去“小红花”和“家长”。</p>

      <h3>17 种玩法（每关 = 一种玩法 + 这关的题目 + 这个年龄的难度）</h3>
      <div className="pf-tree">
        {(Object.keys(ENGINES) as (keyof typeof ENGINES)[]).map(k => {
          const E = ENGINES[k], used = Object.values(PLAYS).filter(([g]) => g === k).length;
          return (
            <div key={k} className="pf-tree-d">
              <b>{E.icon} {E.name}</b> <small>{used} 关{E.built ? ` · 已做好：${E.built}` : ''}{k === 'sort' ? ' · 小样能玩' : ''}</small>
              <p className="pf-hint">{E.loop}</p>
            </div>
          );
        })}
      </div>

      <h3>按年龄段：每个区域有几关</h3>
      <p className="pf-hint">依据：幼儿园三段按教育部《3-6岁儿童学习与发展指南》（2012），幼小衔接按《幼儿园入学准备教育指导要点》（2021），1～2 年级按 2022 年版各科课程标准的第一学段要求（数学、语文、英语、科学、道德与法治、体育与健康、艺术、劳动）。按教育部要求，拼音、识字、英语只放在 1～2 年级。</p>
      <div className="pf-scroll">
        <table className="pf-table">
          <thead><tr><th>区域</th>{AGES.map(a => <th key={a.id} className={a.id === st.band ? 'me' : ''}>{a.name}<br /><small>{a.range}</small></th>)}<th>未分年龄</th></tr></thead>
          <tbody>
            {AREAS.map(a => (
              <tr key={a.id}>
                <td>{dom(a.d).icon} {a.name}</td>
                {AGES.map(g => <td key={g.id} className={g.id === st.band ? 'me' : ''}>{count(n => n.a === a.id && n.age === g.id) || '—'}</td>)}
                <td>{count(n => n.a === a.id && !n.age) || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>内容怎么分类：5 座岛 → {AREAS.length} 个区域 → {NODES.length} 个关卡</h3>
      <div className="pf-tree">
        {DOMAINS.map(d => (
          <div key={d.id} className="pf-tree-d" style={{ borderColor: d.color }}>
            <b>{d.icon} {d.name}</b> <small>{d.full} · {count(n => n.d === d.id)} 关</small>
            <ul>
              {AREAS.filter(a => a.d === d.id).map(a => (
                <li key={a.id} className={open.has(a.id) ? '' : 'dim'}>
                  {a.icon} {a.name} <small>{count(n => n.a === a.id)} 关{a.unlock ? ` · 本岛点亮 ${a.unlock} 关后浮出` : ' · 一开始就有'}{` · 已点亮 ${count(n => n.a === a.id && done.has(n.id))}`}</small>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function Progress({ v, of, color }: { v: number; of: number; color: string }) {
  return <span className="pf-prog"><span style={{ width: `${(v / Math.max(1, of)) * 100}%`, background: color }} /><em>{v}/{of}</em></span>;
}
