// 与 3D 场景同一套造型语言的插画图标：圆润、粗描边、木头/石头/红车的配色

export function ShortPlankArt() {
  return (
    <svg viewBox="0 0 120 80" aria-hidden>
      <ellipse cx="60" cy="62" rx="34" ry="6" fill="#000" opacity=".12" />
      <rect x="26" y="30" width="68" height="24" rx="7" fill="#f1c27a" stroke="#9a6224" strokeWidth="4" />
      <path d="M34 39c10-2 22 2 32-1s16 1 20 0M36 47c12 1 20-2 30 0" stroke="#b57a39" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".6" />
    </svg>
  );
}
export function LongPlankArt() {
  return (
    <svg viewBox="0 0 120 80" aria-hidden>
      <ellipse cx="60" cy="62" rx="54" ry="6" fill="#000" opacity=".12" />
      <rect x="6" y="30" width="108" height="24" rx="7" fill="#e2a24a" stroke="#8a541c" strokeWidth="4" />
      <path d="M14 39c16-2 30 2 46-1s30 1 46 0M16 47c18 1 34-2 50 0s26 1 38-1" stroke="#9a6224" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".6" />
    </svg>
  );
}
export function PierArt() {
  return (
    <svg viewBox="0 0 120 80" aria-hidden>
      <ellipse cx="60" cy="72" rx="26" ry="5" fill="#000" opacity=".12" />
      <rect x="40" y="52" width="40" height="18" rx="7" fill="#8d9aa2" stroke="#56626a" strokeWidth="4" />
      <rect x="42" y="36" width="36" height="18" rx="7" fill="#a7b2b8" stroke="#56626a" strokeWidth="4" />
      <rect x="44" y="20" width="32" height="18" rx="7" fill="#b9c1c3" stroke="#56626a" strokeWidth="4" />
      <rect x="36" y="10" width="48" height="10" rx="4" fill="#b97a33" stroke="#7a4a18" strokeWidth="4" />
    </svg>
  );
}
export function CartGo() {
  return (
    <svg viewBox="0 0 120 90" aria-hidden>
      <rect x="18" y="38" width="80" height="30" rx="11" fill="#ee5a4f" stroke="#fff" strokeWidth="5" />
      <rect x="28" y="16" width="42" height="26" rx="8" fill="#fff1d6" stroke="#fff" strokeWidth="5" />
      <circle cx="38" cy="70" r="11" fill="#3a3a48" stroke="#fff" strokeWidth="5" />
      <circle cx="80" cy="70" r="11" fill="#3a3a48" stroke="#fff" strokeWidth="5" />
      <circle cx="88" cy="48" r="5" fill="#fff" /><circle cx="89" cy="48" r="2.5" fill="#24262e" />
      <path d="M102 30l10-4M104 42h12M102 54l10 4" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
export function OwlFace({ size = 64 }: { size?: number }) {
  return (
    <svg viewBox="0 0 80 80" width={size} height={size} aria-hidden>
      <path d="M18 22l6 10M62 22l-6 10" stroke="#7b6acb" strokeWidth="9" strokeLinecap="round" />
      <ellipse cx="40" cy="46" rx="28" ry="28" fill="#9b8ce0" />
      <ellipse cx="40" cy="56" rx="17" ry="15" fill="#fff1d6" />
      <circle cx="29" cy="42" r="12" fill="#f4ecff" /><circle cx="51" cy="42" r="12" fill="#f4ecff" />
      <circle cx="29" cy="42" r="8" fill="#fff" /><circle cx="51" cy="42" r="8" fill="#fff" />
      <circle cx="30" cy="43" r="5" fill="#24262e" /><circle cx="52" cy="43" r="5" fill="#24262e" />
      <circle cx="31.5" cy="41" r="1.8" fill="#fff" /><circle cx="53.5" cy="41" r="1.8" fill="#fff" />
      <path d="M36 52l4 6 4-6z" fill="#f2a03d" />
      <path d="M22 22c4-8 32-8 36 0v4H22z" fill="#3d5fc4" /><circle cx="40" cy="20" r="3" fill="#ffcf4a" />
    </svg>
  );
}
export function MissionArt() {
  return (
    <svg viewBox="0 0 150 60" aria-hidden>
      <rect x="6" y="14" width="40" height="30" rx="5" fill="#fff" stroke="#2a3a33" strokeWidth="3" />
      <path d="M8 17l18 14 18-14" fill="none" stroke="#ee5a4f" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M56 30h34" stroke="#2a3a33" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 9" />
      <path d="M86 22l9 8-9 8" fill="none" stroke="#2a3a33" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="114" y="32" width="22" height="22" rx="6" fill="#fff1d6" stroke="#2a3a33" strokeWidth="3" />
      <path d="M102 34c0-18 46-18 46 0z" fill="#ee5a4f" stroke="#2a3a33" strokeWidth="3" />
      <circle cx="116" cy="26" r="3" fill="#fff" /><circle cx="132" cy="24" r="3.5" fill="#fff" />
      <rect x="121" y="42" width="8" height="12" rx="4" fill="#7fb4d9" />
    </svg>
  );
}
export function UndoIcon() {
  return <svg viewBox="0 0 48 48" aria-hidden><path d="M17 12L8 21l9 9" fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 21h17a11 11 0 010 22h-6" fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" /></svg>;
}
export function SpeakerIcon() {
  return <svg viewBox="0 0 48 48" aria-hidden><path d="M8 19h8l10-8v26l-10-8H8z" fill="currentColor" /><path d="M32 17a10 10 0 010 14M36 11a17 17 0 010 26" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg>;
}
export function CloseIcon() {
  return <svg viewBox="0 0 48 48" aria-hidden><path d="M14 14l20 20M34 14L14 34" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" /></svg>;
}
export function MoonIcon() {
  return <svg viewBox="0 0 48 48" aria-hidden><path d="M30 8a16 16 0 1010 26A14 14 0 0130 8z" fill="currentColor" /></svg>;
}
export function MuteIcon({ off }: { off: boolean }) {
  return <svg viewBox="0 0 48 48" aria-hidden><path d="M8 19h8l10-8v26l-10-8H8z" fill="currentColor" />{off ? <path d="M32 18l10 12M42 18L32 30" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /> : <path d="M32 17a10 10 0 010 14" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />}</svg>;
}
export function Stamp() {
  return (
    <svg viewBox="0 0 160 160" aria-hidden>
      <circle cx="80" cy="80" r="70" fill="none" stroke="#ee5a4f" strokeWidth="7" strokeDasharray="6 7" />
      <circle cx="80" cy="80" r="56" fill="#fff6ea" stroke="#ee5a4f" strokeWidth="5" />
      <rect x="48" y="58" width="64" height="46" rx="8" fill="#fff" stroke="#2a3a33" strokeWidth="4" />
      <path d="M50 62l30 22 30-22" fill="none" stroke="#ee5a4f" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M58 116l14 10 30-30" fill="none" stroke="#4caf50" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MicIcon() {
  return <svg viewBox="0 0 48 48" aria-hidden><rect x="17" y="6" width="14" height="24" rx="7" fill="currentColor" /><path d="M11 23a13 13 0 0026 0M24 36v6M17 42h14" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg>;
}
export function KeyboardIcon() {
  return <svg viewBox="0 0 48 48" aria-hidden><rect x="5" y="12" width="38" height="24" rx="5" fill="none" stroke="currentColor" strokeWidth="4" /><path d="M12 20h2M19 20h2M26 20h2M33 20h2M15 28h18" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg>;
}
export function CheckIcon() {
  return <svg viewBox="0 0 48 48" aria-hidden><path d="M11 25l9 9 17-19" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
export function RetryIcon() {
  return <svg viewBox="0 0 48 48" aria-hidden><path d="M38 24a14 14 0 11-4.1-9.9" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /><path d="M36 6v9h-9" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
export function LockIcon() {
  return <svg viewBox="0 0 48 48" aria-hidden><rect x="11" y="21" width="26" height="20" rx="5" fill="currentColor" /><path d="M16 21v-5a8 8 0 0116 0v5" fill="none" stroke="currentColor" strokeWidth="5" /></svg>;
}
export function BoardIcon() {
  return <svg viewBox="0 0 48 48" aria-hidden><rect x="6" y="12" width="36" height="26" rx="5" fill="none" stroke="currentColor" strokeWidth="4.5" /><path d="M8 15l16 12 16-12" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}
export function ArrowIcon({ dir = 1 }: { dir?: 1 | -1 }) {
  return <svg viewBox="0 0 48 48" aria-hidden style={{ transform: dir < 0 ? 'scaleX(-1)' : undefined }}><path d="M10 24h26M26 13l11 11-11 11" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
export function ParentIcon() {
  return <svg viewBox="0 0 48 48" aria-hidden><circle cx="18" cy="15" r="7" fill="currentColor" /><path d="M5 40c0-9 6-14 13-14s13 5 13 14z" fill="currentColor" /><circle cx="35" cy="22" r="5" fill="currentColor" /><path d="M27 41c0-7 4-10 8-10s8 3 8 10z" fill="currentColor" /></svg>;
}

export function HatArt() {
  return (
    <svg viewBox="0 0 140 110" aria-hidden>
      <ellipse cx="70" cy="96" rx="44" ry="7" fill="#000" opacity=".12" />
      <path d="M30 58c0-26 80-26 80 0v16H30z" fill="#3d5fc4" stroke="#24376f" strokeWidth="4" />
      <rect x="24" y="70" width="92" height="12" rx="6" fill="#2e4aa0" stroke="#24376f" strokeWidth="4" />
      <path d="M40 82c10 12 60 12 70 0" fill="#2e4aa0" stroke="#24376f" strokeWidth="4" />
      <rect x="58" y="48" width="24" height="16" rx="4" fill="#ffcf4a" stroke="#b9861a" strokeWidth="3" />
      <path d="M61 51l9 7 9-7" fill="none" stroke="#ee5a4f" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
export function BagArt() {
  return (
    <svg viewBox="0 0 140 110" aria-hidden>
      <ellipse cx="70" cy="98" rx="42" ry="7" fill="#000" opacity=".12" />
      <path d="M40 46c0-34 60-34 60 0" fill="none" stroke="#a86a2e" strokeWidth="7" />
      <rect x="28" y="44" width="84" height="50" rx="12" fill="#c9853f" stroke="#7a4a18" strokeWidth="4" />
      <path d="M28 56c0-8 4-12 12-12h60c8 0 12 4 12 12v10H28z" fill="#a86a2e" stroke="#7a4a18" strokeWidth="4" />
      <circle cx="70" cy="68" r="6" fill="#ffcf4a" stroke="#b9861a" strokeWidth="3" />
      <rect x="44" y="30" width="30" height="20" rx="3" fill="#fff" stroke="#2a3a33" strokeWidth="3" transform="rotate(-12 59 40)" />
    </svg>
  );
}

export function RabbitFace() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden>
      <ellipse cx="36" cy="26" rx="9" ry="24" fill="#fffaf2" stroke="#d9cbb8" strokeWidth="3" /><ellipse cx="36" cy="26" rx="4" ry="16" fill="#ffb7c5" />
      <ellipse cx="64" cy="26" rx="9" ry="24" fill="#fffaf2" stroke="#d9cbb8" strokeWidth="3" /><ellipse cx="64" cy="26" rx="4" ry="16" fill="#ffb7c5" />
      <circle cx="50" cy="62" r="30" fill="#fffaf2" stroke="#d9cbb8" strokeWidth="3" />
      <circle cx="39" cy="58" r="4.5" fill="#24262e" /><circle cx="61" cy="58" r="4.5" fill="#24262e" />
      <circle cx="31" cy="70" r="5" fill="#ffc3cf" /><circle cx="69" cy="70" r="5" fill="#ffc3cf" />
      <path d="M46 68l4 4 4-4" fill="#ff8fa3" />
    </svg>
  );
}
export function SquirrelFace() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden>
      <path d="M78 90c22-10 22-50 0-62-10-6-20 6-10 14 8 6 8 24-4 32z" fill="#e39556" stroke="#b46a33" strokeWidth="3" />
      <path d="M28 34l6-18 12 14zM72 34l-6-18-12 14z" fill="#c06c38" />
      <circle cx="50" cy="60" r="29" fill="#d9824a" stroke="#b46a33" strokeWidth="3" />
      <ellipse cx="50" cy="70" rx="17" ry="13" fill="#ffe6c7" />
      <circle cx="39" cy="56" r="4.5" fill="#24262e" /><circle cx="61" cy="56" r="4.5" fill="#24262e" />
      <circle cx="50" cy="66" r="4" fill="#5a3a2a" />
    </svg>
  );
}
export function HedgehogFace() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden>
      <path d="M14 66L8 46l14 4-4-18 16 8 2-18 12 14 8-16 6 18 14-10-2 18 16-4-8 18 12 8z" fill="#7a5236" stroke="#5a3a24" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="50" cy="64" r="26" fill="#efd3ae" stroke="#c9a77c" strokeWidth="3" />
      <circle cx="40" cy="60" r="4.5" fill="#24262e" /><circle cx="60" cy="60" r="4.5" fill="#24262e" />
      <ellipse cx="50" cy="73" rx="7" ry="5" fill="#24262e" />
      <circle cx="33" cy="70" r="4.5" fill="#ffb3a6" /><circle cx="67" cy="70" r="4.5" fill="#ffb3a6" />
    </svg>
  );
}
export function FlowersArt() {
  return (
    <svg viewBox="0 0 100 80" aria-hidden>
      {[[22, 40, '#ff9fb2'], [50, 30, '#ffd45c'], [78, 40, '#c9a7ff'], [36, 56, '#ffffff'], [64, 56, '#ff9fb2']].map(([x, y, c], i) => (
        <g key={i}>{[0, 72, 144, 216, 288].map(a => <circle key={a} cx={Number(x) + Math.cos(a * Math.PI / 180) * 7} cy={Number(y) + Math.sin(a * Math.PI / 180) * 7} r="6" fill={String(c)} stroke="#2a3a33" strokeWidth="1.5" />)}<circle cx={x} cy={y} r="4" fill="#ffcf4a" /></g>
      ))}
    </svg>
  );
}
export function FlagsArt() {
  return (
    <svg viewBox="0 0 100 80" aria-hidden>
      <path d="M6 22q44 30 88 0" fill="none" stroke="#2a3a33" strokeWidth="3" />
      {[['#ee5a4f', 16, 28], ['#ffcf4a', 32, 35], ['#3d5fc4', 50, 37], ['#7dba5a', 68, 35], ['#ee5a4f', 84, 28]].map(([c, x, y], i) => (
        <path key={i} d={`M${Number(x) - 8} ${y}h16l-8 18z`} fill={String(c)} stroke="#2a3a33" strokeWidth="2" strokeLinejoin="round" />
      ))}
    </svg>
  );
}
export function LanternsArt() {
  return (
    <svg viewBox="0 0 100 80" aria-hidden>
      {[28, 72].map(x => (
        <g key={x}><path d={`M${x} 6v10`} stroke="#2a3a33" strokeWidth="3" /><rect x={x - 9} y="14" width="18" height="6" rx="2" fill="#2a3a33" />
          <ellipse cx={x} cy="40" rx="18" ry="22" fill="#ffb84d" stroke="#c76f12" strokeWidth="3" /><path d={`M${x} 18v44M${x - 10} 22q-6 18 0 36M${x + 10} 22q6 18 0 36`} stroke="#c76f12" strokeWidth="2" fill="none" />
          <rect x={x - 9} y="60" width="18" height="6" rx="2" fill="#2a3a33" /></g>
      ))}
    </svg>
  );
}
export function PartyArt() {
  return (
    <svg viewBox="0 0 60 60" aria-hidden>
      <path d="M10 52l12-34 22 22z" fill="#ffcf4a" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
      <path d="M30 14c4-6 10-6 12 0M44 26c6-2 10 2 8 8M24 8l2-4M50 18l4-2" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** 纸桥活动的三张步骤图 */
export function PaperStep({ step }: { step: 0 | 1 | 2 }) {
  const books = (
    <g>
      <rect x="20" y="96" width="70" height="40" rx="6" fill="#3d5fc4" stroke="#2a3a33" strokeWidth="4" /><rect x="26" y="88" width="58" height="12" rx="3" fill="#fff1d6" stroke="#2a3a33" strokeWidth="3" />
      <rect x="230" y="96" width="70" height="40" rx="6" fill="#ee5a4f" stroke="#2a3a33" strokeWidth="4" /><rect x="236" y="88" width="58" height="12" rx="3" fill="#fff1d6" stroke="#2a3a33" strokeWidth="3" />
    </g>
  );
  const block = (x: number, y: number) => <rect x={x - 16} y={y - 30} width="32" height="30" rx="5" fill="#7dba5a" stroke="#2a3a33" strokeWidth="4" />;
  return (
    <svg viewBox="0 0 320 160" aria-hidden>
      <rect x="0" y="136" width="320" height="10" rx="5" fill="#d9b27a" />
      {books}
      {step === 0 && <><path d="M40 88h240" stroke="#2a3a33" strokeWidth="8" strokeLinecap="round" /><path d="M40 88h240" stroke="#fff" strokeWidth="4" strokeLinecap="round" /></>}
      {step === 1 && <><path d="M40 88h240" stroke="#2a3a33" strokeWidth="8" strokeLinecap="round" /><path d="M40 88h240" stroke="#fff" strokeWidth="4" strokeLinecap="round" />{block(160, 50)}<path d="M160 56v14" stroke="#2a3a33" strokeWidth="3" strokeDasharray="3 4" /><text x="206" y="44" textAnchor="middle" fontSize="38" fontWeight="700" fill="#3d5fc4">?</text></>}
      {step === 2 && <><path d="M40 88l20-14 20 14 20-14 20 14 20-14 20 14 20-14 20 14 20-14 20 14 20-14 20 14" stroke="#2a3a33" strokeWidth="7" fill="none" strokeLinejoin="round" /><path d="M40 88l20-14 20 14 20-14 20 14 20-14 20 14 20-14 20 14 20-14 20 14 20-14 20 14" stroke="#fff" strokeWidth="3" fill="none" strokeLinejoin="round" />{block(160, 46)}<path d="M160 52v14" stroke="#2a3a33" strokeWidth="3" strokeDasharray="3 4" /><text x="206" y="40" textAnchor="middle" fontSize="38" fontWeight="700" fill="#3d5fc4">?</text></>}
    </svg>
  );
}
