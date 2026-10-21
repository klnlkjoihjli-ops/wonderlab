import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Material, Slot } from '../../shared/bridge';
import type { Deck } from '../../shared/lab';
import { PALETTE, clay, mesh, woodTexture } from './util';
import { ROAD_Y, WATER_Y } from './terrain';

export const PLANK_Y = ROAD_Y + 0.02;          // 木板底面
export const PLANK_T = 0.15;
export const LONG_LEN = 5.3;
export const SHORT_LEN = 2.75;
export const PLANK_W = 1.3;
export const BRIDGE_START = -2.65, BRIDGE_END = 2.65;

const longTex = woodTexture('#e2a24a', '#9a6224');
const shortTex = woodTexture('#f1c27a', '#b57a39');

/** 一块可以弯曲的木板：沿长度方向分段，弯曲时实时改顶点 */
export class Plank {
  group = new THREE.Group();     // 枢轴：短板在外端（岸边）
  mesh: THREE.Mesh;
  private base: Float32Array;
  private len: number;
  sag = 0;                       // 中点下沉量（米）
  t = PLANK_T;                   // 桥面厚度（实验室里不同桥面不一样）
  constructor(public kind: 'long' | 'short', public slot: Slot, deck: Deck | null = null) {
    this.len = kind === 'long' ? LONG_LEN : SHORT_LEN;
    let geo: THREE.BufferGeometry, mat: THREE.Material, strips = true;
    if (deck === 'paper' || deck === 'folded') {
      this.t = deck === 'paper' ? 0.025 : 0.16;
      geo = deck === 'paper' ? new THREE.BoxGeometry(this.len, this.t, PLANK_W * 0.95, 32, 1, 1) : foldedGeometry(this.len, PLANK_W * 0.95, this.t);
      // 折纸用棱面着色：每道折痕一明一暗，从上往下看也能分辨出“扇子”
      mat = new THREE.MeshStandardMaterial({ color: '#fbf8ef', roughness: 0.92, side: THREE.DoubleSide, flatShading: deck === 'folded', vertexColors: deck === 'folded' });
      strips = false;
    } else {
      this.t = deck === 'thin' ? 0.07 : deck === 'thick' ? 0.26 : PLANK_T;
      geo = new THREE.BoxGeometry(this.len, this.t, PLANK_W, 32, 1, 1);
      const tex = deck === 'thin' ? shortTex : deck === 'thick' ? longTex : kind === 'long' ? longTex : shortTex;
      mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, color: deck === 'thick' ? '#d9a066' : '#ffffff' });
    }
    this.mesh = new THREE.Mesh(geo, mat); this.mesh.castShadow = this.mesh.receiveShadow = true;
    this.base = (geo.getAttribute('position').array as Float32Array).slice();
    this.group.add(this.mesh);
    // 木板两头的钉子/横条，增加“手作”感
    if (strips) {
      const strip = new THREE.BoxGeometry(0.1, 0.03, PLANK_W * 0.92);
      for (const e of [-1, 1]) { const s = mesh(strip, clay(PALETTE.woodDark), this.mesh, false); s.position.set(e * (this.len / 2 - 0.2), this.t / 2 + 0.01, 0); }
    }
    this.place();
  }
  place() {
    const half = this.len / 2;
    if (this.slot === 'span') { this.group.position.set(0, PLANK_Y + this.t / 2, 0); this.mesh.position.x = 0; }
    else if (this.slot === 'left') { this.group.position.set(BRIDGE_START, PLANK_Y + this.t / 2, 0); this.mesh.position.x = half; }
    else { this.group.position.set(BRIDGE_END, PLANK_Y + this.t / 2 + 0.015, 0); this.mesh.position.x = -half; }
  }
  /** 把弯曲量写进顶点：长板呈抛物线，短板呈悬臂下垂 */
  applySag(sag: number) {
    this.sag = sag;
    const pos = this.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array, half = this.len / 2;
    for (let i = 0; i < pos.count; i++) {
      const x = this.base[i * 3];
      let dy: number;
      if (this.kind === 'long') { const u = x / half; dy = -sag * (1 - u * u); }
      else { const u = this.slot === 'left' ? (x + half) / this.len : (half - x) / this.len; dy = -sag * u * u; }
      arr[i * 3 + 1] = this.base[i * 3 + 1] + dy;
    }
    pos.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }
  /** 世界坐标 x 处木板顶面的高度 */
  topAt(x: number) {
    const half = this.len / 2;
    const localX = this.slot === 'span' ? x : this.slot === 'left' ? x - BRIDGE_START - half : x - BRIDGE_END + half;
    if (Math.abs(localX) > half) return null;
    let dy: number;
    if (this.kind === 'long') { const u = localX / half; dy = -this.sag * (1 - u * u); }
    else { const u = this.slot === 'left' ? (localX + half) / this.len : (half - localX) / this.len; dy = -this.sag * u * u; }
    const tilt = this.group.rotation.z;
    const along = this.slot === 'left' ? x - BRIDGE_START : this.slot === 'right' ? x - BRIDGE_END : 0;
    return this.group.position.y + this.t / 2 + dy + Math.sin(tilt) * along;
  }
}

export function createPier() {
  const g = new THREE.Group();
  const colors = ['#8d9aa2', '#a7b2b8', '#b9c1c3', '#9ca8ae'];
  const h = PLANK_Y - (WATER_Y - 0.2);
  const n = 4;
  for (let i = 0; i < n; i++) {
    const s = mesh(new RoundedBoxGeometry(0.82 - i * 0.04, h / n + 0.04, 1.7 - i * 0.06, 2, 0.1), clay(colors[i], 0.9), g);
    s.position.y = WATER_Y - 0.2 + (i + 0.5) * (h / n); s.rotation.y = (i % 2 ? 1 : -1) * 0.06;
  }
  const cap = mesh(new RoundedBoxGeometry(0.9, 0.1, 1.75, 2, 0.03), clay(PALETTE.woodDark), g); cap.position.y = PLANK_Y - 0.04;
  return g;
}

/** 折成扇子的纸：横截面是锯齿形，沿桥的方向延伸（和家里折纸桥一样） */
function foldedGeometry(len: number, width: number, height: number) {
  const segX = 32, folds = 6, cols = folds * 2 + 1;
  const pos: number[] = [], idx: number[] = [], col: number[] = [];
  for (let i = 0; i <= segX; i++) {
    const x = -len / 2 + (i / segX) * len;
    for (let j = 0; j < cols; j++) {
      pos.push(x, (j % 2 ? 0.5 : -0.5) * height, -width / 2 + (j / (cols - 1)) * width);
      const c = j % 2 ? 1 : 0.72;                    // 谷底颜色深一些，折痕更明显
      col.push(c, c * 0.98, c * 0.94);
    }
  }
  for (let i = 0; i < segX; i++) for (let j = 0; j < cols - 1; j++) {
    const a = i * cols + j, b = a + cols;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** 某个槽位在世界里的中心点（用于吸附判断与提示光圈） */
export function slotCenter(slot: Slot) {
  switch (slot) {
    case 'left': return new THREE.Vector3(-1.25, PLANK_Y + 0.1, 0);
    case 'right': return new THREE.Vector3(1.25, PLANK_Y + 0.1, 0);
    case 'span': return new THREE.Vector3(0, PLANK_Y + 0.1, 0);
    case 'pier': return new THREE.Vector3(0, PLANK_Y - 0.4, 0);
  }
}

/** 拖动时显示的“放这里”虚影 */
export function createGhost(slot: Slot) {
  const glow = new THREE.MeshBasicMaterial({ color: '#fff4b8', transparent: true, opacity: 0.35, depthWrite: false });
  let geo: THREE.BufferGeometry;
  if (slot === 'span') geo = new RoundedBoxGeometry(LONG_LEN, PLANK_T, PLANK_W, 2, 0.05);
  else if (slot === 'pier') geo = new RoundedBoxGeometry(0.85, PLANK_Y - WATER_Y + 0.2, 1.7, 2, 0.1);
  else geo = new RoundedBoxGeometry(SHORT_LEN, PLANK_T, PLANK_W, 2, 0.05);
  const m = new THREE.Mesh(geo, glow);
  const c = slotCenter(slot);
  if (slot === 'pier') m.position.set(0, (PLANK_Y + WATER_Y - 0.2) / 2, 0);
  else m.position.set(slot === 'left' ? BRIDGE_START + SHORT_LEN / 2 : slot === 'right' ? BRIDGE_END - SHORT_LEN / 2 : 0, PLANK_Y + PLANK_T / 2, c.z);
  m.renderOrder = 5;
  if (slot === 'pier') glow.depthTest = false;   // 桥墩虚影在木板下面，也要看得见
  return m;
}

/** 手里拿着的材料（跟随手指） */
export function createHeld(material: Material) {
  const g = new THREE.Group();
  if (material === 'pier') { const p = createPier(); p.position.y = -(PLANK_Y - 0.5); p.scale.setScalar(0.8); g.add(p); }
  else {
    const len = material === 'long' ? LONG_LEN : SHORT_LEN;
    const m = mesh(new RoundedBoxGeometry(len, PLANK_T, PLANK_W, 2, 0.04), new THREE.MeshStandardMaterial({ map: material === 'long' ? longTex : shortTex, roughness: 0.75 }), g);
    m.scale.setScalar(0.85);
  }
  return g;
}

const POSTS: [number, number][] = [[-2.62, -0.95], [-2.62, 0.95], [2.62, -0.95], [2.62, 0.95]];
const POST_TOP = 0.5 + 0.95;

/** 第三次的桥头装饰：花环、彩旗、小灯笼 */
export function createDecoration(kind: 'flowers' | 'flags' | 'lanterns') {
  const g = new THREE.Group();
  if (kind === 'flowers') {
    const colors = ['#ff9fb2', '#ffd45c', '#ffffff', '#c9a7ff'];
    for (const [x, z] of POSTS) {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const f = mesh(new THREE.IcosahedronGeometry(0.075, 1), clay(colors[i % 4], 0.6), g);
        f.position.set(x + Math.cos(a) * 0.17, POST_TOP - 0.18, z + Math.sin(a) * 0.17);
      }
      mesh(new THREE.TorusGeometry(0.17, 0.035, 6, 20), clay('#5f9a48'), g).position.set(x, POST_TOP - 0.2, z);
      (g.children[g.children.length - 1] as THREE.Mesh).rotation.x = Math.PI / 2;
    }
  } else if (kind === 'flags') {
    const colors = ['#ee5a4f', '#ffcf4a', '#3d5fc4', '#7dba5a'];
    for (const side of [-0.95, 0.95]) {
      const a = new THREE.Vector3(-2.62, POST_TOP - 0.05, side), b = new THREE.Vector3(2.62, POST_TOP - 0.05, side);
      const curve = new THREE.QuadraticBezierCurve3(a, new THREE.Vector3(0, POST_TOP - 0.55, side), b);
      mesh(new THREE.TubeGeometry(curve, 30, 0.012, 4), clay('#ffffff'), g, false);
      for (let i = 1; i < 12; i++) {
        const p = curve.getPoint(i / 12);
        const tri = new THREE.Shape(); tri.moveTo(-0.12, 0); tri.lineTo(0.12, 0); tri.lineTo(0, -0.24); tri.closePath();
        const f = mesh(new THREE.ShapeGeometry(tri), new THREE.MeshStandardMaterial({ color: colors[i % 4], side: THREE.DoubleSide, roughness: 0.8 }), g, false);
        f.position.copy(p);
      }
    }
  } else {
    for (const [x, z] of POSTS) {
      const l = new THREE.Group(); l.position.set(x, POST_TOP + 0.22, z); g.add(l);
      mesh(new THREE.SphereGeometry(0.15, 16, 12), new THREE.MeshStandardMaterial({ color: '#ffb84d', emissive: '#ff9a2e', emissiveIntensity: 1.1, roughness: 0.6 }), l).scale.y = 1.2;
      mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 12), clay(PALETTE.ink), l).position.y = 0.19;
      mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 12), clay(PALETTE.ink), l).position.y = -0.19;
      const light = new THREE.PointLight('#ffb062', 0.9, 2.6); l.add(light);
    }
  }
  return g;
}
