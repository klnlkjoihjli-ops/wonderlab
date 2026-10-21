import { PART_NAMES, type PartKind } from '../../shared/build';
import { MAX_BOXES } from '../../shared/lab';
import { BoxIcon } from './Lab';
import { CartGo, UndoIcon } from './Icons';

// 零件插画：和场景里的零件同一种造型，格子长度一眼能比较
export function PartArt({ kind }: { kind: PartKind }) {
  if (kind === 'stone') return (
    <svg viewBox="0 0 120 80" aria-hidden><ellipse cx="60" cy="70" rx="26" ry="5" fill="#000" opacity=".12" />
      <rect x="38" y="22" width="44" height="44" rx="12" fill="#a9b3b6" stroke="#56626a" strokeWidth="4" /><path d="M48 36q8-4 14 2M58 52q8 3 14-3" stroke="#7f8c94" strokeWidth="3" fill="none" strokeLinecap="round" /></svg>
  );
  if (kind === 'post') return (
    <svg viewBox="0 0 120 80" aria-hidden><ellipse cx="60" cy="74" rx="18" ry="4" fill="#000" opacity=".12" />
      <rect x="50" y="8" width="20" height="66" rx="8" fill="#c98f55" stroke="#7a4a18" strokeWidth="4" /><rect x="46" y="6" width="28" height="9" rx="4" fill="#b97a33" stroke="#7a4a18" strokeWidth="3" /></svg>
  );
  const cells = kind === 'short' ? 2 : kind === 'medium' ? 3 : 5, w = cells * 21;
  return (
    <svg viewBox="0 0 120 80" aria-hidden><ellipse cx="60" cy="58" rx={w / 2 + 4} ry="5" fill="#000" opacity=".12" />
      <rect x={60 - w / 2} y="36" width={w} height="14" rx="5" fill={kind === 'long' ? '#d9a066' : '#e8b066'} stroke="#7a4a18" strokeWidth="3.5" />
      {Array.from({ length: cells - 1 }, (_, i) => <line key={i} x1={60 - w / 2 + (i + 1) * 21} y1="38" x2={60 - w / 2 + (i + 1) * 21} y2="48" stroke="#7a4a18" strokeWidth="2" opacity=".35" />)}
    </svg>
  );
}
export function ExplodeIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden>
      {on ? <><rect x="12" y="20" width="24" height="8" rx="3" fill="currentColor" /><rect x="14" y="31" width="20" height="8" rx="3" fill="currentColor" /><rect x="16" y="9" width="16" height="8" rx="3" fill="currentColor" /></>
        : <><rect x="10" y="5" width="28" height="7" rx="3" fill="currentColor" /><rect x="14" y="20" width="20" height="7" rx="3" fill="currentColor" /><rect x="18" y="35" width="12" height="7" rx="3" fill="currentColor" /><path d="M24 12v6M24 27v6" stroke="currentColor" strokeWidth="3" strokeDasharray="2 3" /></>}
    </svg>
  );
}

const KINDS: PartKind[] = ['stone', 'post', 'short', 'medium', 'long'];
const BOX_COLORS = ['#ff8fb1', '#7fb4d9', '#ffcf4a', '#9fd36a'];

export function WorkshopControls({ boxes, exploded, canUndo, hidden, onCardDown, onBoxes, onUndo, onExplode, onGo }: {
  boxes: number; exploded: boolean; canUndo: boolean; hidden: boolean;
  onCardDown: (k: PartKind, e: React.PointerEvent) => void; onBoxes: (n: number) => void; onUndo: () => void; onExplode: () => void; onGo: () => void;
}) {
  return (
    <footer className={`hud-bottom lab ${hidden ? 'is-hidden' : ''}`}>
      <div className="lab-left">
        <div className="lab-boxes" aria-label={`车上有${boxes}个礼物盒`}>
          <button className="step-btn" aria-label="拿走一个礼物盒" disabled={boxes === 0} onClick={() => onBoxes(boxes - 1)}>−</button>
          <div className="box-slots" aria-hidden>{Array.from({ length: MAX_BOXES }, (_, i) => <span key={i} className={i < boxes ? 'on' : ''}><BoxIcon color={BOX_COLORS[i]} /></span>)}</div>
          <button className="step-btn" aria-label="加一个礼物盒" disabled={boxes === MAX_BOXES} onClick={() => onBoxes(boxes + 1)}>+</button>
        </div>
        <div className="satchel lab-decks" aria-label="零件箱：按住零件拖到小溪上">
          {KINDS.map(k => (
            <button key={k} className="card deck part" aria-label={PART_NAMES[k]} onPointerDown={e => onCardDown(k, e)}>
              <PartArt kind={k} />
            </button>
          ))}
        </div>
      </div>
      <div className="lab-right">
        <div className="actions">
          <button className="round-btn big" aria-label="撤销上一步" onClick={onUndo} disabled={!canUndo}><UndoIcon /></button>
          <button className={`round-btn big explode-btn ${exploded ? 'is-on' : ''}`} aria-pressed={exploded} aria-label={exploded ? '把桥合起来' : '拆开看看'} onClick={onExplode}><ExplodeIcon on={exploded} /></button>
          <button className="go-btn is-ready" aria-label="让小车出发" onClick={onGo}><CartGo /></button>
        </div>
      </div>
    </footer>
  );
}
