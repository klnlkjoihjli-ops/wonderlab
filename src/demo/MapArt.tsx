import { useEffect, useState, type ReactNode } from 'react';
import LAYOUT from './numberLayout.json';

// 用 Blender 渲染出来的素材画地图：底图一张 + 物件、角色按“落地点”摆放，前后按高度排。
// 素材的尺寸和落地点在 public/art/*/manifest.json 里（由 art/blender/*.py 渲染时写出）。

export type Sprite = { file: string; w: number; h: number; ax: number; ay: number };
export type Art = { props: Record<string, Sprite>; chars: Record<string, Sprite>; v: number };
/** 素材版本号（optimize.py 写入），加在图片地址后面，素材更新后不会用旧缓存 */
let ART_V = 0;
export const artUrl = (path: string) => `${path}?v=${ART_V}`;
/** 素材是按 110 像素/米渲染的，地图是 60 像素/米 */
export const ART_SCALE = LAYOUT.world.pxPerMeter / 110;

export function useArt(): Art | null | 'missing' {
  const [art, setArt] = useState<Art | null | 'missing'>(null);
  useEffect(() => {
    let alive = true;
    const get = (u: string) => fetch(u, { cache: 'no-store' }).then(r => (r.ok ? r.json() : Promise.reject(r.status)));
    Promise.all([get('/art/number/manifest.json'), get('/art/chars/manifest.json'), get('/art/version.json').catch(() => ({ v: 0 }))])
      .then(([props, chars, ver]) => { ART_V = ver.v; if (alive) setArt({ props, chars, v: ver.v }); })
      .catch(() => { if (alive) setArt('missing'); });   // 没有素材就退回代码画的版本
    return () => { alive = false; };
  }, []);
  return art;
}

/** 一张素材：把它的落地点放在地图上的 (x, y) */
export function SpriteImg({ s, dir, x, y, flip = false, scale = 1, className, onClick }: {
  s: Sprite | undefined; dir: 'number' | 'chars'; x: number; y: number; flip?: boolean; scale?: number; className?: string; onClick?: () => void;
}) {
  if (!s) return null;
  const k = ART_SCALE * scale, w = s.w * k, h = s.h * k;
  return (
    <g transform={`translate(${x},${y})${flip ? ' scale(-1,1)' : ''}`} className={className} onClick={onClick}>
      <image href={artUrl(`/art/${dir}/${s.file}`)} x={-s.ax * k} y={-s.ay * k} width={w} height={h} />
    </g>
  );
}

/** 按落地点的 y 从后往前画（y 越大越靠前） */
export function DepthSorted({ items }: { items: { y: number; key: string; node: ReactNode }[] }) {
  return <>{[...items].sort((a, b) => a.y - b.y).map(it => <g key={it.key}>{it.node}</g>)}</>;
}

export { LAYOUT };
