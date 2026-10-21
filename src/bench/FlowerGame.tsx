import { useEffect, useRef, useState } from 'react';
import {
  ROUNDS, amount, flowersPassed, freshFlowersProgress, giveSay, howManySay, pickSay, putBackSay, roundIntro,
  type FlowersProgress, type Round
} from '../../shared/modules/flowers';
import { NODES, nodeState } from '../../shared/platform';
import { FlowerScene } from './FlowerScene';
import { lightUpNode, onlineVoiceAllowed, worldHref } from './common';
import { loadPlatform } from '../world/platformStore';
import { setOnlineVoice, speak, stopSpeaking, unlockAudio } from '../audio';
import { CloseIcon, OwlFace, SpeakerIcon, Stamp } from '../components/Icons';

const KEY = 'wonderlab.bench.flowers.v1';
function load(): FlowersProgress {
  try { const p = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (p && typeof p.round === 'number') return { ...freshFlowersProgress(), ...p }; } catch { /* 重新开始 */ }
  return freshFlowersProgress();
}
function save(p: FlowersProgress) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* 隐私模式 */ } }

/** 游戏 · 帮小兔子摘花：一朵花对一个数 */
export function FlowerGame({ nodeId }: { nodeId: string }) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<FlowerScene | null>(null);
  const [p, setP] = useState<FlowersProgress>(() => { const x = load(); return flowersPassed(x) ? freshFlowersProgress() : x; });
  const pRef = useRef(p); pRef.current = p;
  const [started, setStarted] = useState(false);
  const [bubble, setBubble] = useState<{ text: string; key: number } | null>(null);
  const [count, setCount] = useState(0);                  // 篮子里现在几朵
  const [counted, setCounted] = useState<number[]>([]);   // “有几朵”那一轮：孩子点着数过的花
  const countedRef = useRef(counted); countedRef.current = counted;
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false); busyRef.current = busy;
  const passed = flowersPassed(p);
  const round: Round | undefined = ROUNDS[p.round];

  const say = (text: string) => { setBubble({ text, key: Date.now() }); speak(text); };
  const update = (fn: (d: FlowersProgress) => void) => { const n = structuredClone(pRef.current); fn(n); save(n); pRef.current = n; setP(n); return n; };

  useEffect(() => {
    const s = new FlowerScene(host.current!, {
      onFlower: i => flowerRef.current(i),
      onBasket: () => basketRef.current(),
      onBasketFlower: k => basketFlowerRef.current(k)
    });
    scene.current = s;
    setOnlineVoice(onlineVoiceAllowed());
    return () => s.dispose();
  }, []);

  /** 开始第 i 轮：花重新长出来；“有几朵”那一轮把花放进篮子 */
  const beginRound = async (i: number) => {
    const r = ROUNDS[i]; if (!r) return;
    setBusy(true); setCounted([]); countedRef.current = [];
    await scene.current!.regrow();
    if (r.kind === 'howMany') scene.current!.fillBasket(r.have);
    setCount(r.kind === 'howMany' ? r.have : 0);
    setBusy(false);
    say(roundIntro(r));
  };
  const start = () => { unlockAudio(); setStarted(true); void beginRound(pRef.current.round); };

  /** 这一轮做对了：兔子开心，过一会儿进入下一轮 */
  const winRound = () => {
    setBusy(true);
    scene.current!.celebrate();
    setTimeout(() => {
      const n = update(d => { d.round += 1; });
      if (flowersPassed(n)) { lightUpNode(nodeId); setBusy(false); say('你帮小兔子摘了好多花，每一朵都数得清清楚楚！小兔子说：谢谢你！'); return; }
      void beginRound(n.round);
    }, 2400);
  };

  const tapFlower = async (i: number) => {
    const r = ROUNDS[pRef.current.round];
    if (!started || busyRef.current || !r) return;
    if (r.kind !== 'pick') { say('这一轮先数一数地上摆好的花。用手指一朵一朵点着数。'); return; }
    setBusy(true);
    await scene.current!.pick(i);
    const have = scene.current!.basketCount; setCount(have);
    speak(pickSay(have)); setBubble(null);
    setBusy(false);
  };
  /** 孩子觉得够了：送给小兔子，这时才判断 */
  const give = () => {
    const r = ROUNDS[pRef.current.round];
    if (!r || r.kind !== 'pick' || busyRef.current) return;
    const res = giveSay(r, scene.current!.basketCount);
    say(res.text);
    if (res.state === 'done') winRound();
    else { scene.current!.shake(); update(d => { d.mistakes += 1; }); }
  };
  const flowerRef = useRef(tapFlower); flowerRef.current = tapFlower;

  const tapBasket = async () => {
    const r = ROUNDS[pRef.current.round];
    if (!started || busyRef.current || !r) return;
    if (r.kind !== 'pick') return;
    const have = scene.current!.basketCount;
    if (!have) { say('篮子还是空的，去花丛里摘花吧。'); return; }
    setBusy(true);
    await scene.current!.putBack();
    const now = scene.current!.basketCount; setCount(now);
    say(putBackSay(now)); setBusy(false);
  };
  const basketRef = useRef(tapBasket); basketRef.current = tapBasket;

  const tapBasketFlower = (k: number) => {
    const r = ROUNDS[pRef.current.round];
    if (!started || busyRef.current || !r) return;
    if (r.kind === 'pick') { void tapBasket(); return; }
    // 点着数：每点一朵新的，就报下一个数
    const c = countedRef.current;
    if (c.includes(k)) { say('这朵数过啦，数下一朵。'); return; }
    const n = [...c, k]; countedRef.current = n; setCounted(n);
    scene.current!.countTap(k, n.length); speak(amount(n.length));
  };
  const basketFlowerRef = useRef(tapBasketFlower); basketFlowerRef.current = tapBasketFlower;

  const choose = (n: number) => {
    const r = ROUNDS[pRef.current.round];
    if (!r || r.kind !== 'howMany' || busy) return;
    const res = howManySay(r, n);
    say(res.text);
    if (res.ok) winRound();
    else { update(d => { d.mistakes += 1; }); scene.current!.shake(); setCounted([]); countedRef.current = []; }
  };

  const hint = () => {
    if (!round) return;
    if (round.kind === 'pick') {
      const have = scene.current?.basketCount ?? 0;
      say(`小兔子要${amount(round.need)}，篮子里现在有${amount(have)}。比一比，够了吗？${have > round.need ? '多了就点篮子放回去一朵。' : have < round.need ? '不够就再摘一朵。' : '够了就点“送给小兔子”。'}`);
    } else say('用手指点地上的花，一朵一朵地数，点到最后一朵，就知道一共几朵了。');
  };
  const again = () => { const f = freshFlowersProgress(); save(f); pRef.current = f; setP(f); void beginRound(0); };

  const me = NODES.find(n => n.id === nodeId)!;
  const next = NODES.find(n => n.a === me.a && n.lv === me.lv + 1);
  const nextOpen = next && nodeState(next.id, new Set(loadPlatform().done)) !== 'lock';

  return (
    <div className="app bench flowers">
      <div className="stage" ref={host} />

      {started && (
        <header className="hud-top">
          <a className="round-btn" href={worldHref(nodeId)} aria-label="回到世界"><svg viewBox="0 0 48 48" aria-hidden><path d="M8 24L24 10l16 14M13 21v17h22V21" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg></a>
          <ol className="steps" aria-label={`第 ${Math.min(p.round + 1, ROUNDS.length)} 轮，一共 ${ROUNDS.length} 轮`}>
            {ROUNDS.map((r, i) => <li key={i} className={passed || i < p.round ? 'done' : i === p.round ? 'now' : 'todo'}><span aria-hidden>{passed || i < p.round ? '✓' : r.kind === 'pick' ? '🌷' : '❓'}</span></li>)}
          </ol>
          <div className="spacer" />
          <button className="owl-btn" aria-label="请小诺帮忙" onClick={hint}><OwlFace size={70} /></button>
        </header>
      )}

      {bubble && started && (
        <div className="bubble" key={bubble.key} role="status">
          <OwlFace size={46} />
          <p>{bubble.text}</p>
          <button className="mini-btn" aria-label="再听一遍" onClick={() => speak(bubble.text)}><SpeakerIcon /></button>
          <button className="mini-btn" aria-label="关闭" onClick={() => { setBubble(null); stopSpeaking(); }}><CloseIcon /></button>
        </div>
      )}

      {/* 小兔子的心愿：要几朵，就画几个花的空位，摘一朵填一个；多出来的标成红色 */}
      {started && !passed && round?.kind === 'pick' && (
        <div className="wish" aria-label={`小兔子要${amount(round.need)}，篮子里有${amount(count)}`}>
          <span className="wish-who">🐰 想要</span>
          {Array.from({ length: round.need }, (_, i) => <i key={i}>✿</i>)}
          <span className="wish-have">篮子里 <b>{count}</b></span>
          <button className="give-btn" onClick={give} disabled={busy}>🎁 送给小兔子</button>
        </div>
      )}

      {started && !passed && round?.kind === 'howMany' && (
        <footer className="bench-actions">
          <div className="count-choices" role="group" aria-label="篮子里一共几朵">
            <span className="wish-who">一共几朵？</span>
            {round.choices.map(n => <button key={n} onClick={() => choose(n)} disabled={busy}>{n}</button>)}
          </div>
        </footer>
      )}

      {passed && started && (
        <div className="bench-pass" role="dialog" aria-label="过关">
          <Stamp />
          {next && <div className="next-level"><span className="lock-open" aria-hidden>{next.icon}</span><b>下一关：{next.name}</b><small>{nextOpen ? '已经解锁' : '还要先完成别的关卡'}</small></div>}
          <a className="pill" href={worldHref(nodeId, true)}>回到世界</a>
          <button className="pill ghost" onClick={again}>再玩一次</button>
        </div>
      )}

      {!started && (
        <div className="title-screen">
          <h1>小兔子的花园</h1>
          <p className="title-sub">帮小兔子摘花，一朵一朵数清楚</p>
          <button className="start-btn" onClick={start} aria-label="开始"><svg viewBox="0 0 60 60" aria-hidden><path d="M22 16l24 14-24 14z" fill="currentColor" /></svg></button>
        </div>
      )}
    </div>
  );
}
