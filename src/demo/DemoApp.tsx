import { useEffect, useRef, useState } from 'react';
import { DOMAINS, NODES, THEMES, dayIndex, type Node } from '../../shared/platform';
import { LIKES, ageText, dailyThree, reviewQuestion, stageOf, type LikeId, type Profile } from '../../shared/daily';
import { usePlatform } from '../world/platformStore';
import { setMuted, setOnlineVoice, sfx, speak, stopSpeaking, unlockAudio } from '../audio';
import { listen, speechSupported, type ListenState } from '../recognizer';
import { OwlFace } from '../components/Icons';
import { NumberMap } from './NumberMap';

// 商用版 P0 小样：孩子档案 → 每日开场（回顾昨天 + 今天三件事）→ 数字岛 2D 大地图。
// 只是演示，不改主程序；进度和主程序共用同一份存档（摘花等关卡做完会记下来）。

const PROFILE_KEY = 'wonderlab.profile.v1';
const PRETEND_KEY = 'wonderlab.demo.pretend-yesterday';
function loadProfile(): Profile | null { try { const x = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null'); return x?.name && x?.birth ? x : null; } catch { return null; } }
function saveProfile(p: Profile) { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch { /* 隐私模式 */ } }
const WEEK = ['一', '二', '三', '四', '五', '六', '日'];

type Screen = 'profile' | 'opening' | 'map';

export function DemoApp() {
  const { p, update } = usePlatform();
  const [profile, setProfile] = useState<Profile | null>(loadProfile);
  const arrived = useRef(new URLSearchParams(location.search).get('arrived'));
  const [screen, setScreen] = useState<Screen>(() => (!loadProfile() ? 'profile' : arrived.current ? 'map' : 'opening'));
  const [focus, setFocus] = useState<string | null>(arrived.current);
  useEffect(() => { if (arrived.current) history.replaceState(null, '', location.pathname); }, []);
  useEffect(() => { setMuted(p.muted); setOnlineVoice(!!p.consent.voice); }, [p.muted, p.consent.voice]);

  if (screen === 'profile' || !profile) return (
    <ProfileForm initial={profile} speechOn={p.consent.speech}
      onSave={(pr, speech) => { saveProfile(pr); setProfile(pr); update(d => { d.consent.speech = speech; }); setScreen('opening'); }} />
  );
  if (screen === 'opening') return (
    <Opening profile={profile} p={p}
      onEdit={() => setScreen('profile')}
      onGo={(n) => {
        if (!n || n.d === 'math') { setFocus(n?.id ?? null); setScreen('map'); return; }
        if (n.module) { location.href = `/bench.html?node=${n.id}&back=demo`; return; }
      }} />
  );
  return <NumberMap p={p} update={update} profile={profile} focus={focus} onBack={() => { stopSpeaking(); setScreen('opening'); }} />;
}

// ===================== 孩子档案 =====================
function ProfileForm({ initial, speechOn, onSave }: { initial: Profile | null; speechOn: boolean; onSave: (p: Profile, speech: boolean) => void }) {
  const now = new Date();
  const [name, setName] = useState(initial?.name ?? '');
  const [y, setY] = useState(initial ? Number(initial.birth.slice(0, 4)) : now.getFullYear() - 5);
  const [m, setM] = useState(initial ? Number(initial.birth.slice(5, 7)) : 1);
  const [city, setCity] = useState(initial?.city ?? '南京');
  const [likes, setLikes] = useState<LikeId[]>(initial?.likes ?? []);
  const [speech, setSpeech] = useState(speechOn);
  const birth = `${y}-${String(m).padStart(2, '0')}`;
  const st = stageOf(birth, now);
  const years = Array.from({ length: 10 }, (_, i) => now.getFullYear() - 12 + i);
  return (
    <div className="demo-page profile">
      <div className="profile-card">
        <div className="profile-owl"><OwlFace size={86} /></div>
        <h1>认识一下小探险家</h1>
        <p className="muted">这一页给爸爸妈妈填。只需要小名和出生年月，不要真实姓名。</p>
        <label className="pf-row"><span>小名</span><input value={name} maxLength={8} placeholder="比如：豆豆" onChange={e => setName(e.target.value)} /></label>
        <div className="pf-row"><span>出生年月</span>
          <select value={y} onChange={e => setY(Number(e.target.value))}>{years.map(v => <option key={v} value={v}>{v} 年</option>)}</select>
          <select value={m} onChange={e => setM(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1} 月</option>)}</select>
        </div>
        <p className={`pf-age ${st.tooYoung ? 'warn' : ''}`}>{st.tooYoung ? '3 岁以下先不建议使用屏幕学习哦' : `👉 ${ageText(birth, now)}`}</p>
        <label className="pf-row"><span>所在城市</span><input value={city} maxLength={10} onChange={e => setCity(e.target.value)} /></label>
        <div className="pf-row top"><span>喜欢什么</span>
          <div className="pf-likes">{LIKES.map(l => (
            <button key={l.id} className={likes.includes(l.id) ? 'on' : ''} onClick={() => setLikes(x => x.includes(l.id) ? x.filter(i => i !== l.id) : [...x, l.id])}>{l.e} {l.name}</button>
          ))}</div>
        </div>
        <label className="pf-check"><input type="checkbox" checked={speech} onChange={e => setSpeech(e.target.checked)} />
          <span>允许小诺听孩子说话（用设备自带的语音识别转成文字，本应用不录音、不保存声音）</span></label>
        <button className="pill pf-go" disabled={!name.trim() || st.tooYoung} onClick={() => onSave({ name: name.trim(), birth, city: city.trim(), likes }, speech)}>开始探险 ✨</button>
      </div>
    </div>
  );
}

// ===================== 每日开场 =====================
type Step = 'wake' | 'hello' | 'review' | 'plan';
function Opening({ profile, p, onGo, onEdit }: { profile: Profile; p: ReturnType<typeof usePlatform>['p']; onGo: (n: Node | null) => void; onEdit: () => void }) {
  const now = new Date();
  const [pretend, setPretend] = useState(() => { try { return localStorage.getItem(PRETEND_KEY) === '1'; } catch { return false; } });
  // 演示开关：没有真实的“昨天”时，假装昨天玩过“数到 20”（只影响这一屏，不写进记录）
  const real = dailyThree(p, now);
  const three = !real.review && pretend ? dailyThree(p, now, NODES.find(n => n.id === 'm1')!) : real;
  const reviewNode = three.review;
  const canListen = p.consent.speech && speechSupported();
  const [step, setStep] = useState<Step>('wake');
  const [say, setSay] = useState('');
  const theme = three.theme ? DOMAINS.find(d => d.id === three.theme)! : null;
  const hour = now.getHours(), hi = hour < 11 ? '早上好' : hour < 18 ? '下午好' : '晚上好';
  const talk = (t: string) => { setSay(t); speak(t); };

  const wake = () => {
    unlockAudio(); sfx.tap(); setStep('hello');
    talk(`${profile.name}，${hi}！我是小诺。今天是星期${WEEK[dayIndex(now)]}，${theme ? `是${theme.name}的探险日。` : '是复盘休息日。'}`);
  };
  const toReview = () => {
    if (!reviewNode) { setStep('plan'); talk(`这是我们第一次一起探险，还没有要复习的。来看看今天要做的三件事吧！${planLine()}`); return; }
    setStep('review'); talk(`我们先想一想昨天。${reviewQuestion(reviewNode).q} ${canListen ? '按住下面的话筒告诉我！' : '说给爸爸妈妈听吧！'}`);
  };
  const planLine = () => {
    const parts = [three.review && `复习一下「${three.review.name}」`, three.learn && `学一个新的：「${three.learn.name}」`, three.play && `再去「${three.play.name}」动手玩一玩`].filter(Boolean);
    return parts.length ? `今天有 ${parts.length} 件事：${parts.join('，')}。` : '今天的事都做完啦！';
  };
  const toPlan = () => { setStep('plan'); talk(`太好了！${planLine()}点一张卡片出发吧！`); };

  return (
    <div className="demo-page opening">
      <div className="op-sky" aria-hidden><i /><i /><i /><i /><i /></div>
      <header className="op-top">
        <button className="op-chip" onClick={onEdit}>🧒 {profile.name} · {ageText(profile.birth, now)}</button>
        <label className="op-chip demo-flag"><input type="checkbox" checked={pretend} onChange={e => { setPretend(e.target.checked); try { localStorage.setItem(PRETEND_KEY, e.target.checked ? '1' : '0'); } catch { /* 忽略 */ } }} />演示：假装昨天玩过「数到 20」</label>
      </header>

      {step === 'wake' ? (
        <button className="op-wake" onClick={wake} aria-label="叫醒小诺">
          <span className="op-owl big"><OwlFace size={150} /></span>
          <b>点一下，叫醒小诺</b>
          <small>第 1 章 · 灰灰雾来了</small>
        </button>
      ) : (
        <div className="op-stage">
          <div className="op-owl"><OwlFace size={110} /></div>
          {say && <p className="op-bubble" key={say}>{say}<button className="op-replay" aria-label="再听一遍" onClick={() => speak(say)}>🔊</button></p>}

          {step === 'hello' && (
            <div className="op-story">
              <b>📖 第 1 章 · 灰灰雾来了</b>
              <p>一阵灰灰雾飘过 WonderLab 星球，数字岛的钟楼不响了，花园里的花也数不清了。小诺需要你帮忙，一件一件把它们找回来！</p>
              <button className="pill" onClick={toReview}>好的，出发前先想一想 →</button>
            </div>
          )}

          {step === 'review' && reviewNode && <Review node={reviewNode} talk={talk} speechOn={p.consent.speech} onNext={toPlan} />}

          {step === 'plan' && (
            <div className="op-plan">
              {[['🔁', '复习一下', three.review], ['✨', '学个新的', three.learn], ['🖐️', '动手玩', three.play]].map(([icon, label, n]) => {
                const node = n as Node | null; if (!node) return null;
                const dom = DOMAINS.find(d => d.id === node.d)!;
                const inDemo = node.d === 'math' || !!node.module;
                return (
                  <button key={label as string} className="op-task" style={{ ['--dc' as string]: dom.color }} onClick={() => inDemo ? onGo(node) : talk(`「${node.name}」在${dom.name}。小样里先做了数字岛的大地图，正式版会直接飞过去。`)}>
                    <span className="op-task-k">{icon as string} {label as string}</span>
                    <span className="op-task-ic" aria-hidden>{node.icon}</span>
                    <b>{node.name}</b>
                    <small>{dom.icon} {dom.name}</small>
                    {!inDemo && <em>正式版</em>}
                  </button>
                );
              })}
              <button className="pill op-map" onClick={() => onGo(null)}>🗺️ 去数字岛的大地图看看</button>
            </div>
          )}
          {step !== 'plan' && step !== 'review' && step !== 'hello' && null}
        </div>
      )}
      <p className="op-foot">小样 · 今天的主题：{THEMES[dayIndex(now)]}</p>
    </div>
  );
}

// —— 回顾：按住话筒回答 ——
function Review({ node, talk, speechOn, onNext }: { node: Node; talk: (t: string) => void; speechOn: boolean; onNext: () => void }) {
  const q = reviewQuestion(node);
  const [state, setState] = useState<'idle' | 'listening' | 'ok' | 'no' | 'unavailable'>(() => (speechOn && speechSupported() ? 'idle' : 'unavailable'));
  const [text, setText] = useState('');
  const textRef = useRef(''); textRef.current = text;
  const stop = useRef<() => void>(() => {});
  // 离开这一步时停掉识别；停掉时识别器还会回调一次“结束”，那时已经不在这一步了，要忽略
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; stop.current(); }, []);
  const begin = () => {
    if (state === 'listening') return;
    stopSpeaking(); setText(''); setState('listening'); sfx.tap();
    stop.current = listen(t => { if (alive.current) setText(t); }, (s: ListenState) => {
      if (!alive.current) return;
      if (s === 'denied' || s === 'error') { setState('unavailable'); return; }
      if (s === 'done') {
        const ok = q.check(textRef.current);
        setState(ok ? 'ok' : 'no'); if (ok) sfx.success();
        talk(ok ? q.yes : textRef.current ? q.no : '小诺没听清，再按住说一次吧。');
        if (!ok && !textRef.current) setState('idle');
      }
    }, { maxMs: 10000 });
  };
  const end = () => stop.current();
  return (
    <div className="op-review">
      <p className="op-q">{node.icon} {q.q}</p>
      {state !== 'unavailable' && (state === 'idle' || state === 'listening') && (
        <button className={`op-mic ${state === 'listening' ? 'on' : ''}`} onPointerDown={begin} onPointerUp={end} onPointerLeave={end} onPointerCancel={end} onContextMenu={e => e.preventDefault()}>
          <span aria-hidden>🎤</span>{state === 'listening' ? '我在听……说完就松开' : '按住说话'}
        </button>
      )}
      {text && <p className="op-heard">你说：“{text}”</p>}
      {state === 'unavailable' && <p className="op-heard">（这台设备现在听不了，请爸爸妈妈听孩子说一说）</p>}
      <div className="op-row">
        {(state === 'ok' || state === 'no') && <button className="pill" onClick={onNext}>看看今天做什么 →</button>}
        {state === 'no' && <button className="pill ghost" onClick={() => setState('idle')}>再说一次</button>}
        {(state === 'idle' || state === 'unavailable') && <button className="pill ghost" onClick={() => { talk(q.yes); setState('ok'); }}>👪 爸爸妈妈听过了</button>}
        {(state === 'idle' || state === 'unavailable') && <button className="pill ghost" onClick={() => { talk(q.no); setState('no'); }}>想不起来</button>}
      </div>
    </div>
  );
}
