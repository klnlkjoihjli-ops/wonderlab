import * as THREE from 'three';

// —— 统一的美术参数：所有场景物件都从这里取色，保证同一种“黏土绘本”语言 ——
export const PALETTE = {
  pine: '#2f6a4c',
  moss: '#7dba5a',
  grassLight: '#a6d26a',
  grassDeep: '#5f9a48',
  sand: '#e9cf98',
  path: '#d9b27a',
  pathEdge: '#c49a62',
  soil: '#9b6f48',
  creekDeep: '#1f8f9e',
  creekShallow: '#78dcd0',
  wood: '#e2a24a',
  woodLight: '#efbf6d',
  woodDark: '#b97a33',
  stone: '#a7b2b8',
  stoneDark: '#7f8c94',
  satchel: '#3d5fc4',
  cherry: '#ee5a4f',
  cream: '#fff1d6',
  ink: '#2a3a33',
  skyTop: '#8fcbea',
  skyHorizon: '#ffd9ae'
};

const matCache = new Map<string, THREE.MeshStandardMaterial>();
/** 哑光黏土材质（带一点柔和高光） */
export function clay(color: string, roughness = 0.82): THREE.MeshStandardMaterial {
  const key = color + roughness;
  let m = matCache.get(key);
  if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 }); matCache.set(key, m); }
  return m;
}

export function mesh(geo: THREE.BufferGeometry, material: THREE.Material, parent?: THREE.Object3D, shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = shadow; m.receiveShadow = true;
  parent?.add(m);
  return m;
}

// 可复现的伪随机
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function hash(x: number, y: number) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function smooth(t: number) { return t * t * (3 - 2 * t); }
export function noise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  const u = smooth(xf), v = smooth(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, y: number) { return noise(x, y) * 0.6 + noise(x * 2.1, y * 2.1) * 0.28 + noise(x * 4.3, y * 4.3) * 0.12; }

export const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOutBack = (t: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

/** 给几何体按高度涂上从深到浅的顶点色，模拟柔和的环境光遮蔽 */
export function gradientColors(geo: THREE.BufferGeometry, bottom: string, top: string, y0: number, y1: number) {
  const pos = geo.getAttribute('position');
  const c0 = new THREE.Color(bottom), c1 = new THREE.Color(top), c = new THREE.Color();
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    c.copy(c0).lerp(c1, smoothstep(y0, y1, pos.getY(i)));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/** 木纹贴图（程序生成，不依赖外部素材） */
export function woodTexture(base: string, dark: string) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = base; g.fillRect(0, 0, 256, 64);
  const r = rng(7);
  g.strokeStyle = dark; g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    g.globalAlpha = 0.18 + r() * 0.2; g.lineWidth = 1.5 + r() * 2.5;
    const y = 4 + i * 7 + r() * 3;
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= 256; x += 32) g.lineTo(x, y + Math.sin(x * 0.03 + i) * 2.2);
    g.stroke();
  }
  g.globalAlpha = 0.35; g.fillStyle = dark;
  for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(40 + r() * 180, 10 + r() * 44, 5, 2.5, 0, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/** 柔光圆点贴图，用于萤火、花粉、光圈 */
export function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
