import { DECKS, MAX_BOXES, type Deck, type Guess, type LabRecord, type LabSetup, type Level } from '../../shared/lab';
import { CartGo, CloseIcon, PierArt } from './Icons';

// —— 实验室专用插画：和材料包同一种粗描边、圆角的语言 ——
export function DeckArt({ deck }: { deck: Deck }) {
  return (
    <svg viewBox="0 0 120 80" aria-hidden>
      <ellipse cx="60" cy="64" rx="52" ry="6" fill="#000" opacity=".12" />
      {deck === 'thin' && <rect x="8" y="38" width="104" height="12" rx="5" fill="#f1c27a" stroke="#9a6224" strokeWidth="4" />}
      {deck === 'thick' && <><rect x="8" y="28" width="104" height="28" rx="7" fill="#d9a066" stroke="#7a4a18" strokeWidth="4" /><path d="M16 38c20-2 40 2 60-1s24 1 30 0M18 47c22 1 40-2 60 0" stroke="#7a4a18" strokeWidth="3" fill="none" opacity=".45" /></>}
      {deck === 'paper' && <path d="M8 44l104-4v6L8 50z" fill="#fff" stroke="#2a3a33" strokeWidth="3.5" strokeLinejoin="round" />}
      {deck === 'folded' && <path d="M8 46l10-12 10 12 10-12 10 12 10-12 10 12 10-12 10 12 10-12 10 12" fill="none" stroke="#2a3a33" strokeWidth="7" strokeLinejoin="round" />}
      {deck === 'folded' && <path d="M8 46l10-12 10 12 10-12 10 12 10-12 10 12 10-12 10 12 10-12 10 12" fill="none" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />}
    </svg>
  );
}
export function BoxIcon({ color = '#ff8fb1' }: { color?: string }) {
  return <svg viewBox="0 0 40 40" aria-hidden><rect x="6" y="12" width="28" height="24" rx="4" fill={color} stroke="#2a3a33" strokeWidth="3" /><rect x="17" y="12" width="6" height="24" fill="#fff" /><path d="M20 12c-6-8-12-2-6 0M20 12c6-8 12-2 6 0" fill="none" stroke="#2a3a33" strokeWidth="3" strokeLinecap="round" /></svg>;
}
export function LevelIcon({ level }: { level: Level }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden>
      <circle cx="24" cy="24" r="21" fill={level === 'green' ? '#5cbf5a' : level === 'yellow' ? '#ffcf4a' : '#ee5a4f'} stroke="#fff" strokeWidth="3" />
      {level === 'green' && <path d="M14 25l7 7 13-15" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />}
      {level === 'yellow' && <path d="M11 25q4.5-7 9 0t9 0 9 0" fill="none" stroke="#7a5a00" strokeWidth="4.5" strokeLinecap="round" />}
      {level === 'red' && <path d="M16 16l16 16M32 16L16 32" stroke="#fff" strokeWidth="5" strokeLinecap="round" />}
    </svg>
  );
}
export function AlbumIcon() {
  return <svg viewBox="0 0 48 48" aria-hidden><rect x="7" y="9" width="34" height="30" rx="5" fill="none" stroke="currentColor" strokeWidth="4" /><circle cx="18" cy="20" r="4" fill="currentColor" /><path d="M10 35l10-9 7 6 6-5 6 6" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" /></svg>;
}

const BOX_COLORS = ['#ff8fb1', '#7fb4d9', '#ffcf4a', '#9fd36a'];
const DECK_ORDER: Deck[] = ['paper', 'folded', 'thin', 'thick'];

/** 左下：桥面四选一 + 桥墩开关；右下：礼物盒加减、猜一猜、出发 */
export function LabControls({ setup, guess, disabled, recordCount, onSetup, onGuess, onGo, onAlbum }: {
  setup: LabSetup; guess: Guess | null; disabled: boolean; recordCount: number;
  onSetup: (s: LabSetup) => void; onGuess: (g: Guess | null) => void; onGo: () => void; onAlbum: () => void;
}) {
  return (
    <footer className={`hud-bottom lab ${disabled ? 'is-hidden' : ''}`}>
      <div className="lab-left">
          <div className="lab-boxes" aria-label={`车上有${setup.boxes}个礼物盒`}>
          <button className="step-btn" aria-label="拿走一个礼物盒" disabled={setup.boxes === 0} onClick={() => onSetup({ ...setup, boxes: setup.boxes - 1 })}>−</button>
          <div className="box-slots" aria-hidden>{Array.from({ length: MAX_BOXES }, (_, i) => <span key={i} className={i < setup.boxes ? 'on' : ''}><BoxIcon color={BOX_COLORS[i]} /></span>)}</div>
          <button className="step-btn" aria-label="加一个礼物盒" disabled={setup.boxes === MAX_BOXES} onClick={() => onSetup({ ...setup, boxes: setup.boxes + 1 })}>+</button>
        </div>
        <div className="satchel lab-decks" role="radiogroup" aria-label="选桥面">
          {DECK_ORDER.map(d => (
            <button key={d} role="radio" aria-checked={setup.deck === d} aria-label={DECKS[d].name}
                className={`card deck ${setup.deck === d ? 'is-selected' : ''}`} onClick={() => onSetup({ ...setup, deck: d })}>
                <DeckArt deck={d} />
            </button>
          ))}
          <button className={`card deck pier ${setup.pier ? 'is-selected' : ''}`} aria-pressed={setup.pier} aria-label={setup.pier ? '拿掉桥墩' : '放上桥墩'}
            onClick={() => onSetup({ ...setup, pier: !setup.pier })}>
            <PierArt /><span className={`toggle-dot ${setup.pier ? 'on' : ''}`} aria-hidden />
          </button>
        </div>
      </div>
      <div className="lab-right">
        <div className="guess" role="radiogroup" aria-label="先猜一猜（可以不猜）">
          {(['green', 'yellow', 'red'] as Level[]).map(l => (
            <button key={l} role="radio" aria-checked={guess === l} className={`guess-btn ${guess === l ? 'is-on' : ''}`}
              aria-label={{ green: '猜：稳稳开过去', yellow: '猜：会晃但能过', red: '猜：过不去' }[l]} onClick={() => onGuess(guess === l ? null : l)}>
              <LevelIcon level={l} />
            </button>
          ))}
        </div>
        <div className="actions">
          <button className="round-btn big album-btn" aria-label={`实验相册，${recordCount}张照片`} onClick={onAlbum}>
            <AlbumIcon />{recordCount > 0 && <span className="badge">{recordCount}</span>}
          </button>
          <button className="go-btn is-ready" aria-label="让小车出发" onClick={onGo}><CartGo /></button>
        </div>
      </div>
    </footer>
  );
}

/** 实验相册：每次试车一张照片，旁边是这次的设置和结果，方便横着比较 */
export function Album({ records, onClose }: { records: LabRecord[]; onClose: () => void }) {
  return (
    <div className="album-wrap" role="dialog" aria-label="实验相册">
      <div className="album">
        {records.length === 0 && <p className="album-empty">还没有照片。试一次车，这里就会多一张。</p>}
        {[...records].reverse().map((r, i) => (
          <figure key={r.at + i} className="photo">
            {r.thumb ? <img src={r.thumb} alt="" /> : <div className="photo-blank" />}
            <figcaption>
              <span className="mini-deck"><DeckArt deck={r.setup.deck} /></span>
              {r.setup.pier && <span className="mini-pier"><PierArt /></span>}
              <span className="mini-boxes">{Array.from({ length: r.setup.boxes }, (_, k) => <BoxIcon key={k} color={BOX_COLORS[k]} />)}</span>
              <span className="mini-result">{r.guess && <span className="mini-guess" title="猜的"><LevelIcon level={r.guess} /></span>}<LevelIcon level={r.level} /></span>
            </figcaption>
          </figure>
        ))}
      </div>
      <button className="round-btn close" onClick={onClose} aria-label="关闭相册"><CloseIcon /></button>
    </div>
  );
}
