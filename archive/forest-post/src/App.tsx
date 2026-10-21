import { useCallback, useEffect, useRef, useState } from 'react';
import { SUPPLY, evaluate, place, remove, slotFor, used, type Bridge, type Material, type Slot } from '../shared/bridge';
import { RECIPIENTS, enterEpisode, freshProgress, guidedHint, introLine, loadOf, type Decoration, type Episode, type Recipient } from '../shared/game';
import { ForestPost } from './scene/ForestPost';
import { setMuted, setOnlineVoice, sfx, speak, stopSpeaking, unlockAudio } from './audio';
import { useProgress, wipe } from './store';
import { askLabTutor, askTutor } from './tutorClient';
import { speechSupported } from './recognizer';
import { BoardIcon, CartGo, CloseIcon, KeyboardIcon, LongPlankArt, MicIcon, MissionArt, MoonIcon, MuteIcon, OwlFace, PierArt, ShortPlankArt, SpeakerIcon, Stamp, UndoIcon } from './components/Icons';
import { FACES, LetterBoard, OutfitPicker, PaperBridge, RecipientPicker, ShareStep, SpeakPanel } from './components/Kid';
import { ParentPanel } from './components/Parent';
import { Album, LabControls } from './components/Lab';
import { WorkshopControls } from './components/Workshop';
import { PART_NAMES, addPart, buildHint, describeBuild, evaluateBuild, removePart, type Build, type PartKind } from '../shared/build';
import { DECKS, compareLine, guessLine, runLab, type Guess, type LabSetup } from '../shared/lab';
import { EMPTY_BRIDGE } from '../shared/bridge';

type Phase = 'title' | 'board' | 'story' | 'intro' | 'plan' | 'build' | 'testing' | 'success' | 'share' | 'paper' | 'lab' | 'labtest' | 'ws' | 'wstest';
type ParentTab = 'guide' | 'record' | 'paper' | 'feedback' | 'settings';

const MATERIALS: { id: Material; label: string; Art: () => React.JSX.Element }[] = [
  { id: 'short', label: '短木板', Art: ShortPlankArt },
  { id: 'long', label: '长木板', Art: LongPlankArt },
  { id: 'pier', label: '石桥墩', Art: PierArt }
];

export function App() {
  const mount = useRef<HTMLDivElement>(null);
  const scene = useRef<ForestPost | null>(null);
  const [webgl, setWebgl] = useState(true);
  const { progress, update, replace, log, recovered } = useProgress();
  const [episode, setEpisode] = useState<Episode>(1);
  const load = loadOf(episode);
  const bridge = progress.chapters[episode].bridge;
  const [phase, setPhase] = useState<Phase>('title');
  const [history, setHistory] = useState<Bridge[]>([]);
  const [selected, setSelected] = useState<Material | null>(null);
  const [bubble, setBubble] = useState<{ text: string; key: number; thinking?: boolean } | null>(null);
  const [tested, setTested] = useState(false);
  const [hints, setHints] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speakFor, setSpeakFor] = useState<'ask' | 'explain' | null>(null);
  const [parent, setParent] = useState<ParentTab | null>(null);
  const [nudge, setNudge] = useState(false);
  const [bump, setBump] = useState<Material | null>(null);
  const [guess, setGuess] = useState<Guess | null>(null);
  const [albumOpen, setAlbumOpen] = useState(false);
  const [wsHistory, setWsHistory] = useState<Build[]>([]);
  const [exploded, setExploded] = useState(false);
  const attempts = useRef<Bridge[]>([]);
  const nudgeTimer = useRef(0);
  const bridgeRef = useRef(bridge); bridgeRef.current = bridge;
  const selectedRef = useRef(selected); selectedRef.current = selected;
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const episodeRef = useRef(episode); episodeRef.current = episode;

  const say = useCallback((text: string) => { setBubble({ text, key: Date.now() }); speak(text); }, []);
  const activity = useCallback(() => { setNudge(false); clearTimeout(nudgeTimer.current); }, []);

  const setBridge = useCallback((next: Bridge, detail: string, type: 'place' | 'remove') => {
    const prev = bridgeRef.current;
    if (JSON.stringify(prev) === JSON.stringify(next)) return false;
    const ep = episodeRef.current;
    setHistory(h => [...h.slice(-30), prev]);
    update(p => { p.chapters[ep].bridge = next; });
    log(ep, type, detail);
    setTested(false); setHints(0); activity();
    return true;
  }, [update, log, activity]);

  const tryPlace = useCallback((material: Material, slot: Slot) => {
    const next = place(bridgeRef.current, material, slot);
    if (setBridge(next, `${material}→${slot}`, 'place')) { sfx.place(); setSelected(null); setBubble(null); }
    else sfx.deny();
  }, [setBridge]);
  const tryPlaceRef = useRef(tryPlace); tryPlaceRef.current = tryPlace;
  const setBridgeRef = useRef(setBridge); setBridgeRef.current = setBridge;

  // —— 3D 场景：只创建一次，之后按存档同步 ——
  useEffect(() => {
    let s: ForestPost;
    try {
      s = new ForestPost(mount.current!, {
        onDrop: (m, slot) => tryPlaceRef.current(m, slot),
        onSlotTap: slot => { const m = selectedRef.current; if (m) tryPlaceRef.current(m, slot); },
        onPieceTap: slot => { if (phaseRef.current !== 'build') return; if (setBridgeRef.current(remove(bridgeRef.current, slot), slot === 'span' ? 'long' : slot === 'pier' ? 'pier' : slot, 'remove')) sfx.remove(); },
        onMissDrop: () => {},
        onWsPick: id => wsPickRef.current(id),
        onWsPlace: (kind, col) => wsPlaceRef.current(kind, col)
      });
    } catch { setWebgl(false); return; }
    scene.current = s;
    s.setBridge(bridgeRef.current, false);
    s.setOutfit(progress.outfit);
    s.setDecorations(progress.party.decorations, false);
    return () => { s.dispose(); scene.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 故事里的桥 → 场景。按内容比较（存档每次更新都会整体复制，按引用比较会误触发），
  // 并且在实验室和工坊里不同步，否则故事的桥会被放回小溪
  const bridgeKey = JSON.stringify(bridge);
  useEffect(() => { if (!/^(lab|ws)/.test(phaseRef.current)) scene.current?.setBridge(bridge); }, [bridgeKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { scene.current?.setSelected(selected); }, [selected]);
  useEffect(() => { setMuted(progress.muted); }, [progress.muted]);
  useEffect(() => { setOnlineVoice(progress.consent.voice); }, [progress.consent.voice]);
  // 装饰是作品的一部分：场景始终跟存档一致
  const decorKey = progress.party.decorations.join(',');
  useEffect(() => { scene.current?.setDecorations(progress.party.decorations); }, [decorKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // —— 进入某一次体验 ——
  const runIntro = async (ep: Episode, returning: boolean, p = progress) => {
    setPhase('intro');
    log(ep, 'start', returning ? '继续' : '第一次进入');
    await scene.current?.intro(returning);
    if (ep === 3 && !p.party.recipient) {
      setPhase('plan'); scene.current?.lookHome(true);
      say('今天的邮局由你做主！你想把信送给谁？');
    } else {
      setPhase('build');
      say(introLine(ep, p, returning));
    }
  };
  const openEpisode = (ep: Episode) => {
    unlockAudio(); stopSpeaking(); setBubble(null);
    const returning = progress.chapters[ep].started;
    const next = enterEpisode(progress, ep);
    replace(next);
    setEpisode(ep); setHistory([]); setTested(false); setHints(0); attempts.current = [];
    const s = scene.current;
    s?.setBridge(next.chapters[ep].bridge, false);
    s?.setCargo(loadOf(ep));
    s?.setRecipient(ep === 3 && next.party.recipient ? next.party.recipient : 'rabbit');
    s?.backToBridge();
    if (ep === 1 && !next.outfit) { setPhase('story'); say('你好，小小邮差！森林聚会的邀请卡要送给小兔。出发前，选一件邮差装备吧！'); }
    else void runIntro(ep, returning, next);
  };
  const toBoard = () => {
    stopSpeaking(); setBubble(null); setPaused(false); setSelected(null); setAlbumOpen(false);
    if (phaseRef.current === 'lab' || phaseRef.current === 'labtest') {   // 离开实验室：恢复故事里的桥
      scene.current?.setLab(null); scene.current?.setBridge(progress.chapters[episode].bridge, false); scene.current?.setCargo(load);
    }
    if (phaseRef.current === 'ws' || phaseRef.current === 'wstest') {     // 离开工坊：同样恢复故事里的桥
      scene.current?.setWorkshop(null); setExploded(false); scene.current?.setBridge(progress.chapters[episode].bridge, false); scene.current?.setCargo(load);
    }
    scene.current?.backToBridge(); scene.current?.lookHome(false);
    setPhase('board');
    say('选一封信吧！');
  };

  // —— 拖动材料卡 ——
  const onCardDown = (m: Material, e: React.PointerEvent) => {
    if (phase !== 'build') return;
    activity();
    if (used(bridge)[m] >= SUPPLY[m] || slotFor(m, bridge).length === 0) { sfx.deny(); setBump(m); setTimeout(() => setBump(null), 400); return; }
    const sx = e.clientX, sy = e.clientY;
    let dragging = false;
    const move = (ev: PointerEvent) => { if (!dragging && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 12) { dragging = true; setSelected(null); scene.current?.beginDrag(m, ev.clientX, ev.clientY); } };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      if (!dragging) { sfx.tap(); setSelected(cur => (cur === m ? null : m)); }
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  };

  const undo = () => {
    if (phase !== 'build' || !history.length) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    update(p => { p.chapters[episode].bridge = prev; });
    log(episode, 'undo', '撤销上一步'); setTested(false); sfx.remove(); activity();
  };

  const go = async () => {
    if (phase !== 'build' || !scene.current) return;
    activity(); setSelected(null); setBubble(null); stopSpeaking(); setSpeakFor(null);
    const outcome = evaluate(bridge, load);
    attempts.current = [...attempts.current.slice(-5), bridge];
    setPhase('testing');
    update(p => { p.chapters[episode].attempts += 1; });
    log(episode, 'test', `${JSON.stringify(bridge)} → ${outcome.reason}`);
    await scene.current.test(outcome, load);
    setTested(true);
    if (outcome.ok) {
      update(p => { p.chapters[episode].completed = true; });
      log(episode, 'complete', `第 ${progress.chapters[episode].attempts + 1} 次试车送达`);
      if (episode === 3) {
        setPhase('share');
        say(`信送到${RECIPIENTS[progress.party.recipient ?? 'rabbit']}家啦！给你的小桥打扮一下，再说说你是怎么搭的吧。`);
      } else {
        setPhase('success');
        say(episode === 1 ? '邀请卡送到啦！小兔好开心。下一封信在信件板上等你。' : '礼物也稳稳送到啦！你把原来的桥改得更结实了。');
      }
    } else {
      setPhase('build');
      say(outcome.observe);
      void scene.current.point(outcome.focus);
      // 孩子安静地想一会儿是好事；40 秒没动作，小诺只轻轻晃一下，不说话打扰
      clearTimeout(nudgeTimer.current);
      nudgeTimer.current = window.setTimeout(() => setNudge(true), 40000);
    }
  };

  // —— 小桥实验室 ——
  const openLab = () => {
    unlockAudio(); stopSpeaking(); setBubble(null); setGuess(null);
    const s = scene.current;
    s?.setBridge(EMPTY_BRIDGE, false); s?.setRecipient('rabbit'); s?.backToBridge(); s?.setCargo(1);
    s?.setLab(progress.lab.setup, false);
    setPhase('lab');
    say(progress.lab.records.length ? '欢迎回到小桥实验室！接着换一换，看看桥会弯多少。' : '这里是小桥实验室！换一换桥面、加一加礼物盒，看看桥会弯到哪个颜色。');
  };
  const changeLab = (next: LabSetup) => {
    if (phaseRef.current !== 'lab') return;
    update(p => { p.lab.setup = next; }); scene.current?.setLab(next); sfx.tap(); setBubble(null);
  };
  const labGo = async () => {
    if (phaseRef.current !== 'lab' || !scene.current) return;
    stopSpeaking(); setBubble(null);
    const setup = progress.lab.setup, result = runLab(setup);
    const prev = progress.lab.records.length ? progress.lab.records[progress.lab.records.length - 1].setup : null;
    setPhase('labtest');
    const thumb = await scene.current.testLab(result);
    update(p => { p.lab.records.push({ at: new Date().toISOString(), setup, guess, level: result.level, thumb: thumb && thumb.length < 40000 ? thumb : null }); if (p.lab.records.length > 12) p.lab.records.shift(); });
    log(1, 'lab', `${DECKS[setup.deck].name}${setup.pier ? '+桥墩' : ''}，${setup.boxes} 个礼物盒 → ${{ green: '绿', yellow: '黄', red: '红' }[result.level]}${guess ? `（猜${{ green: '绿', yellow: '黄', red: '红' }[guess]}）` : ''}`);
    setPhase('lab'); setGuess(null);
    say([guessLine(guess, result.level), result.observe, compareLine(prev, setup)].filter(Boolean).join(''));
  };
  const labTrials = () => progress.lab.records.slice(-6).map(r => ({ setup: r.setup, guess: r.guess }));
  const askLab = async (question: string, kind: 'hint' | 'question') => {
    if (kind === 'question') log(1, 'lab', `孩子问：${question}`);
    setBubble({ text: '让我想一想……', key: Date.now(), thinking: true });
    const r = await askLabTutor({ question, setup: progress.lab.setup, trials: labTrials(), consent: progress.consent.ai });
    log(1, 'lab', `小诺${kind === 'hint' ? '提示' : '答'}（${r.mode === 'online' ? '在线模型' : '基础提示'}）：${r.reply}`);
    if (r.save) update(p => { p.questions.push({ at: new Date().toISOString(), episode: 1, text: question.slice(0, 300) }); if (p.questions.length > 60) p.questions.shift(); });
    say(r.reply);
  };
  const labHint = () => { void askLab('我下一次该试什么呀？', 'hint'); };

  // —— 搭桥工坊 ——
  const workshopRef = useRef(progress.workshop); workshopRef.current = progress.workshop;
  const openWorkshop = () => {
    unlockAudio(); stopSpeaking(); setBubble(null); setWsHistory([]); setExploded(false);
    const s = scene.current;
    s?.setLab(null); s?.setBridge(EMPTY_BRIDGE, false); s?.setRecipient('rabbit'); s?.backToBridge(); s?.setCargo(1);
    s?.setWorkshop(progress.workshop, false);
    setPhase('ws');
    log(1, 'workshop', `进入搭桥工坊：${describeBuild(progress.workshop)}`);
    say(progress.workshop.parts.length ? '欢迎回来！你的桥还在这里。点桥上的零件可以拿下来重新搭。' : '这里是搭桥工坊！按住零件拖到小溪上，自己搭一座桥。木板两头要搭在岸上或桥墩上哦。');
  };
  const setWorkshopBuild = (next: Build, detail: string) => {
    const prev = workshopRef.current;
    if (prev === next) { sfx.deny(); return false; }
    setWsHistory(h => [...h.slice(-40), prev]);
    update(p => { p.workshop = next; });
    log(1, 'workshop', detail);
    setBubble(null); scene.current?.clearFlash();
    return true;
  };
  const wsPlace = (kind: PartKind, col: number) => { if (setWorkshopBuild(addPart(workshopRef.current, kind, col), `放${PART_NAMES[kind]}（第 ${col} 格）`)) sfx.place(); };
  const wsPick = (id: string) => {
    const p = workshopRef.current.parts.find(x => x.id === id);
    if (p) setWorkshopBuild(removePart(workshopRef.current, id), `拿起${PART_NAMES[p.kind]}`);
  };
  const wsPlaceRef = useRef(wsPlace); wsPlaceRef.current = wsPlace;
  const wsPickRef = useRef(wsPick); wsPickRef.current = wsPick;
  useEffect(() => { if (phase === 'ws' || phase === 'wstest') scene.current?.setWorkshop(progress.workshop); }, [progress.workshop]); // eslint-disable-line react-hooks/exhaustive-deps
  const wsUndo = () => {
    if (phase !== 'ws' || !wsHistory.length) return;
    const prev = wsHistory[wsHistory.length - 1];
    setWsHistory(h => h.slice(0, -1));
    update(p => { p.workshop = prev; }); log(1, 'workshop', '撤销'); sfx.remove(); scene.current?.clearFlash();
  };
  const wsCardDown = (kind: PartKind, e: React.PointerEvent) => {
    if (phase !== 'ws') return;
    if (exploded) { scene.current?.setExplode(false); setExploded(false); }
    const sx = e.clientX, sy = e.clientY;
    let dragging = false;
    const move = (ev: PointerEvent) => { if (!dragging && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 10) { dragging = true; scene.current?.beginWsDrag(kind, ev.clientX, ev.clientY); } };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      if (!dragging) say(`按住${PART_NAMES[kind]}，拖到小溪上再松手。`);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  };
  const wsGo = async () => {
    if (phase !== 'ws' || !scene.current) return;
    stopSpeaking(); setBubble(null); setExploded(false);
    const build = workshopRef.current, result = evaluateBuild(build);
    setPhase('wstest');
    log(1, 'workshop', `试车：${describeBuild(build)} → ${result.ok ? `成功（${result.level === 'green' ? '稳' : '晃'}）` : result.observe}`);
    await scene.current.testBuild(result);
    setPhase('ws');
    say(result.observe);
  };

  // —— 小诺：提示与回答 ——
  const hint = async () => {
    if (phase === 'ws') { const b = workshopRef.current; say(buildHint(evaluateBuild(b), b)); log(1, 'workshop', '请小诺帮忙'); return; }
    if (phase === 'lab') { labHint(); return; }
    if (phase !== 'build') return;
    activity();
    const o = evaluate(bridge, load);
    let text = guidedHint(bridge, episode, hints, tested), mode = 'guided';
    if (progress.consent.ai) {
      setBubble({ text: '让我想一想……', key: Date.now(), thinking: true });
      const r = await askTutor({ question: '我卡住了，可以给我一个小提示吗？', episode, bridge, attempts: attempts.current, hintsGiven: hints, tested, consent: true });
      text = r.reply; mode = r.mode;
    }
    log(episode, 'hint', `${mode}: ${text}`);
    if (tested) setHints(l => l + 1);
    say(text);
    if (tested && !o.ok) void scene.current?.point(o.focus);
  };
  const ask = async (question: string) => {
    setSpeakFor(null); activity();
    if (phaseRef.current === 'lab') { void askLab(question, 'question'); return; }
    log(episode, 'question', question);
    setBubble({ text: '让我想一想……', key: Date.now(), thinking: true });
    const r = await askTutor({ question, episode, bridge, attempts: attempts.current, hintsGiven: hints, tested, consent: progress.consent.ai });
    log(episode, 'reply', `${r.mode}: ${r.reply}`);
    if (r.save) update(p => { p.questions.push({ at: new Date().toISOString(), episode, text: question.slice(0, 300) }); if (p.questions.length > 60) p.questions.shift(); });
    say(r.reply);
  };

  // —— 第三次 ——
  const pickRecipient = (r: Recipient) => { update(p => { p.party.recipient = r; }); scene.current?.setRecipient(r); log(3, 'recipient', RECIPIENTS[r]); sfx.tap(); say(`送给${RECIPIENTS[r]}！`); };
  const DECOR_NAME: Record<Decoration, string> = { flowers: '花环', flags: '彩旗', lanterns: '小灯笼' };
  const toggleDecor = (d: Decoration) => {
    const on = !progress.party.decorations.includes(d);
    update(p => { p.party.decorations = on ? [...new Set([...p.party.decorations, d])] : p.party.decorations.filter(x => x !== d); });
    log(3, 'decorate', `${on ? '加上' : '拿掉'}${DECOR_NAME[d]}`);
  };
  const party = async () => {
    if (phaseRef.current !== 'share') return;
    stopSpeaking(); setBubble(null); setPhase('testing');   // 派对动画期间收起按钮，避免重复点
    await scene.current?.party();
    say('派对开始啦！谢谢你，小小邮差。你搭的桥会一直留在森林里。');
    setPhase('success');
  };

  const pickOutfit = (o: 'hat' | 'bag') => {
    update(p => { p.outfit = o; }); scene.current?.setOutfit(o); log(1, 'outfit', o === 'hat' ? '邮差帽' : '邮包'); sfx.place();
    setTimeout(() => void runIntro(1, false), 900);
  };

  const exportRecords = () => {
    const blob = new Blob([JSON.stringify({ app: 'WonderLab 森林邮局', exportedAt: new Date().toISOString(), note: '只包含本机记录，不含录音和密钥', ...progress }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `wonderlab-记录-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const deleteRecords = () => {
    wipe(); const f = freshProgress(); replace(f);
    const s = scene.current; s?.setBridge(f.chapters[1].bridge, false); s?.setOutfit(null); s?.setRecipient('rabbit'); s?.backToBridge();
    setEpisode(1); setParent(null); setPhase('title'); setBubble(null);
  };

  const remaining = (m: Material) => SUPPLY[m] - used(bridge)[m];
  const inScene = !['title', 'board', 'paper'].includes(phase);
  const speechOn = progress.consent.speech && speechSupported();

  return (
    <div className="app">
      <div className="stage" ref={mount} />
      {!webgl && <div className="fallback">这台设备暂时无法显示 3D 森林。请换用较新的 Safari 或 Chrome 再试。</div>}

      {inScene && (
        <header className="hud-top">
          <button className="round-btn" aria-label="休息一下" onClick={() => { setPaused(true); stopSpeaking(); log(episode, 'pause', '暂停'); }}><MoonIcon /></button>
          {!phase.startsWith('lab') && !phase.startsWith('ws') && <div className="mission" aria-label="任务：把信送到朋友家">
            <MissionArt />{load > 1 && <span className="gift-dot" aria-label="还有一份礼物" />}
            {episode === 3 && progress.party.recipient && <span className="mission-face">{(() => { const F = FACES[progress.party.recipient!]; return <F />; })()}</span>}
          </div>}
          <div className="spacer" />
          {(phase === 'build' || phase === 'lab') && <button className="round-btn" aria-label={speechOn ? '对小诺说话' : '打字问小诺'} onClick={() => { activity(); stopSpeaking(); setSpeakFor('ask'); }}>{speechOn ? <MicIcon /> : <KeyboardIcon />}</button>}
          <button className={`owl-btn ${nudge ? 'is-nudge' : ''}`} aria-label="请小诺帮忙" onClick={hint} disabled={phase !== 'build' && phase !== 'lab' && phase !== 'ws'}><OwlFace size={70} /></button>
        </header>
      )}

      {bubble && phase !== 'title' && !parent && (
        <div className={`bubble ${phase === 'board' || phase === 'paper' ? 'is-wide' : ''}`} key={bubble.key} role="status">
          <OwlFace size={46} />
          <p className={bubble.thinking ? 'thinking' : ''}>{bubble.text}</p>
          {!bubble.thinking && <button className="mini-btn" aria-label="再听一遍" onClick={() => speak(bubble.text)}><SpeakerIcon /></button>}
          <button className="mini-btn" aria-label="关闭" onClick={() => { setBubble(null); stopSpeaking(); }}><CloseIcon /></button>
        </div>
      )}

      {phase === 'build' && (
        <footer className="hud-bottom">
          <div className="satchel" aria-label="材料包：按住拖到小溪上，或者点一下再点要放的位置">
            {MATERIALS.map(({ id, label, Art }) => {
              const left = remaining(id), usable = left > 0 && slotFor(id, bridge).length > 0;
              return (
                <button key={id} className={`card ${selected === id ? 'is-selected' : ''} ${usable ? '' : 'is-empty'} ${bump === id ? 'is-bump' : ''}`}
                  aria-label={`${label}，还剩${left}块`} aria-pressed={selected === id} onPointerDown={e => onCardDown(id, e)}>
                  <Art />
                  <span className="dots" aria-hidden>{Array.from({ length: SUPPLY[id] }, (_, i) => <i key={i} className={i < left ? 'on' : ''} />)}</span>
                </button>
              );
            })}
          </div>
          <div className="actions">
            <button className="round-btn big" aria-label="撤销上一步" onClick={undo} disabled={!history.length}><UndoIcon /></button>
            <button className={`go-btn ${!tested ? 'is-ready' : ''}`} aria-label="让小车出发" onClick={go}><CartGo /></button>
          </div>
        </footer>
      )}

      {(phase === 'lab' || phase === 'labtest') && (
        <LabControls setup={progress.lab.setup} guess={guess} disabled={phase !== 'lab'} recordCount={progress.lab.records.length}
          onSetup={changeLab} onGuess={g => { setGuess(g); sfx.tap(); }} onGo={labGo} onAlbum={() => { setAlbumOpen(true); stopSpeaking(); }} />
      )}
      {(phase === 'ws' || phase === 'wstest') && (
        <WorkshopControls boxes={progress.workshop.boxes} exploded={exploded} canUndo={wsHistory.length > 0} hidden={phase !== 'ws'}
          onCardDown={wsCardDown}
          onBoxes={n => { setWorkshopBuild({ ...workshopRef.current, boxes: n }, `礼物盒改成 ${n} 个`); sfx.tap(); }}
          onUndo={wsUndo}
          onExplode={() => { const on = !exploded; setExploded(on); scene.current?.setExplode(on); if (on) say('拆开看看：绿点是搭住了，红点是悬空的地方。'); }}
          onGo={wsGo} />
      )}
      {albumOpen && <Album records={progress.lab.records} onClose={() => setAlbumOpen(false)} />}

      {phase === 'title' && (
        <div className="title-screen">
          <h1>森林邮局</h1>
          <p className="title-sub">小小邮差，出发送信啦</p>
          <button className="start-btn" onClick={() => { unlockAudio(); toBoard(); }} aria-label="开始">
            <svg viewBox="0 0 60 60" aria-hidden><path d="M22 16l24 14-24 14z" fill="currentColor" /></svg>
          </button>
          <p className="title-note">{recovered ? '上次的记录没能读出来，已经重新开始。' : '建议和妈妈一起玩，每次大约 10 分钟，随时可以暂停'}</p>
          <a className="pill bench-link" href="/bench.html">🔧 探索工作台（新小样）</a>
        </div>
      )}

      {phase === 'board' && (
        <LetterBoard progress={progress} onPick={openEpisode} onActivity={() => { unlockAudio(); setPhase('paper'); }} onLab={openLab} onWorkshop={openWorkshop} onParent={() => setParent('guide')} />
      )}

      {phase === 'paper' && (
        <PaperBridge onSay={t => { setBubble(null); speak(t); }} onRecord={() => setParent('paper')} onClose={toBoard} />
      )}

      {phase === 'story' && <div className="bottom-center"><OutfitPicker value={progress.outfit} onPick={pickOutfit} /></div>}

      {phase === 'plan' && (
        <div className="bottom-center">
          <RecipientPicker value={progress.party.recipient} onPick={pickRecipient} onDone={() => { scene.current?.lookHome(false); setPhase('build'); say('还记得上次的桥吗？它还在这里。先试试看，也可以改一改。'); }} />
        </div>
      )}

      {phase === 'share' && (
        <div className="bottom-center">
          <ShareStep decorations={progress.party.decorations} explanation={progress.party.explanation} speech={speechOn}
            onToggle={toggleDecor} onExplain={() => { stopSpeaking(); setSpeakFor('explain'); }} onParty={party} />
        </div>
      )}

      {phase === 'success' && (
        <div className="success-card" role="dialog" aria-label="送信成功">
          <Stamp />
          <div className="success-actions">
            <button className="pill" onClick={toBoard}><BoardIcon />回信件板</button>
            <button className="pill ghost" onClick={() => { scene.current?.backToBridge(); setPhase('build'); setBubble(null); stopSpeaking(); }}><UndoIcon />改一改，再开一次</button>
          </div>
        </div>
      )}

      {speakFor && (
        <SpeakPanel speechOn={speechOn} title={speakFor === 'ask' ? '问小诺' : '说说我的办法'} onClose={() => setSpeakFor(null)}
          onSubmit={t => {
            if (speakFor === 'ask') void ask(t);
            else { update(p => { p.party.explanation = t.slice(0, 500); }); log(3, 'explain', t); setSpeakFor(null); say('谢谢你告诉我！我把你的办法记在邮局的本子里了。'); }
          }} />
      )}

      {paused && (
        <div className="sheet-backdrop" onClick={() => setPaused(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label="休息一下">
            <MoonIcon />
            <h2>先休息一下</h2>
            <p>你的桥已经保存好，下次打开还在。</p>
            <div className="sheet-row">
              <button className="pill ghost" onClick={() => update(p => { p.muted = !p.muted; })}><MuteIcon off={progress.muted} />{progress.muted ? '打开声音' : '关掉声音'}</button>
              <button className="pill ghost" onClick={toBoard}><BoardIcon />回信件板</button>
              <button className="pill" onClick={() => setPaused(false)}>继续玩</button>
            </div>
          </div>
        </div>
      )}

      {parent && (
        <ParentPanel progress={progress} episode={episode} initialTab={parent} update={update} log={log}
          onExport={exportRecords} onDelete={deleteRecords} onClose={() => setParent(null)} />
      )}
      <div className="rotate-hint">请把平板横过来</div>
    </div>
  );
}
