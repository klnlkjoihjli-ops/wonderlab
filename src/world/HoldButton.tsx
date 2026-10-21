import { useEffect, useRef, useState } from 'react';
import { ParentIcon } from '../components/Icons';

/** 按住 2 秒才生效（家长确认、家长入口，避免孩子误点） */
export function HoldButton({ onDone, label }: { onDone: () => void; label: string }) {
  const [p, setP] = useState(0);
  const timer = useRef(0);
  const stop = () => { cancelAnimationFrame(timer.current); setP(0); };
  const start = () => {
    const t0 = performance.now();
    const tick = () => { const k = Math.min(1, (performance.now() - t0) / 2000); setP(k); if (k >= 1) { setP(0); onDone(); } else timer.current = requestAnimationFrame(tick); };
    timer.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => cancelAnimationFrame(timer.current), []);
  return (
    <button className="hold-btn" aria-label={`${label}（按住两秒）`} onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onContextMenu={e => e.preventDefault()}>
      <svg viewBox="0 0 48 48" className="hold-ring" aria-hidden><circle cx="24" cy="24" r="21" pathLength={1} strokeDasharray={`${p} 1`} /></svg>
      <ParentIcon />
      <span>{label}</span>
    </button>
  );
}
