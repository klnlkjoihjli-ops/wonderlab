import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GAP_COLS, PLANK_LEN, canPlace, isPlank, plankCells, stonesAt, supportCols, type Build, type Part, type PartKind, type PlankState } from '../../shared/build';
import { PALETTE, clamp01, easeOutBack, rng, woodTexture } from './util';
import { ROAD_Y, WATER_Y } from './terrain';

// 搭桥工坊的三维部分：零件模型、吸附网格、拖动虚影、拆开看看。
// 坐标与 shared/build.ts 的格子一一对应：colX(c) 是第 c 格的中心。
export const CELL = 0.55;
export const colX = (c: number) => -2.2 + CELL * (c + 0.5);
export const DECK = ROAD_Y;                    // 桥面高度（和岸上路面平齐）
export const BED = -0.9;                       // 河底
export const STONE_H = (DECK - BED) / 2;       // 两块石头正好叠到桥面
export const PLANK_T = 0.12;
const PLANK_W = 1.2;

const woodA = woodTexture('#e8b066', '#9a6224');
const woodB = woodTexture('#d9a066', '#7a4a18');
const stoneColors = ['#9ca8ae', '#b4bcbf', '#8d9aa2', '#a9b3b6'];

type Visual = { part: Part; obj: THREE.Group; mesh: THREE.Mesh; base: THREE.Vector3; sagPerSpan: number[]; supports: number[] };

/** 第 c 格（连续坐标）处的下沉量：最长一跨的中点下沉 meters，其余各跨按跨度³等比例，形状是抛物线 */
export function spanDrop(c: number, supports: number[], meters: number) {
  if (!meters || supports.length < 2) return 0;
  let maxSpan = 0;
  for (let k = 1; k < supports.length; k++) maxSpan = Math.max(maxSpan, supports[k] - supports[k - 1]);
  for (let k = 1; k < supports.length; k++) {
    const s0 = supports[k - 1], s1 = supports[k];
    if (c >= s0 && c <= s1) { const u = (c - s0) / (s1 - s0); return meters * ((s1 - s0) / maxSpan) ** 3 * 4 * u * (1 - u); }
  }
  return 0;
}

export function partSize(kind: PartKind) { return isPlank(kind) ? PLANK_LEN[kind] * CELL - 0.04 : CELL - 0.04; }

/** 一块零件的模型（不含位置） */
export function makePartMesh(kind: PartKind, seed = 1): { obj: THREE.Group; mesh: THREE.Mesh } {
  const obj = new THREE.Group();
  let mesh: THREE.Mesh;
  if (isPlank(kind)) {
    const len = partSize(kind);
    const geo = new THREE.BoxGeometry(len, PLANK_T, PLANK_W, Math.max(8, PLANK_LEN[kind] * 8), 1, 1);
    mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: kind === 'long' ? woodB : woodA, roughness: 0.75 }));
    // 两头的钉条：让孩子看出“这里要搭在东西上”
    for (const e of [-1, 1]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, PLANK_W * 0.9), new THREE.MeshStandardMaterial({ color: PALETTE.woodDark }));
      s.position.set(e * (len / 2 - 0.12), PLANK_T / 2 + 0.012, 0); mesh.add(s);
    }
    mesh.userData.basePos = (geo.getAttribute('position').array as Float32Array).slice();
  } else if (kind === 'stone') {
    const r = rng(seed);
    mesh = new THREE.Mesh(new RoundedBoxGeometry(CELL - 0.06, STONE_H - 0.04, 0.95, 3, 0.12), new THREE.MeshStandardMaterial({ color: stoneColors[Math.floor(r() * 4)], roughness: 0.92 }));
    mesh.rotation.y = (r() - 0.5) * 0.12;
  } else {
    mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, DECK - BED, 14), new THREE.MeshStandardMaterial({ map: woodB, color: '#c98f55', roughness: 0.8 }));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 14), new THREE.MeshStandardMaterial({ color: PALETTE.woodDark }));
    cap.position.y = (DECK - BED) / 2 - 0.03; mesh.add(cap);
  }
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.traverse(o => { o.castShadow = true; });
  obj.add(mesh);
  return { obj, mesh };
}

/** 零件在格子里的位置（石块要知道自己在第几层） */
export function partPosition(kind: PartKind, col: number, layer = 0) {
  if (isPlank(kind)) return new THREE.Vector3(colX(col) + (PLANK_LEN[kind] - 1) * CELL / 2, DECK + PLANK_T / 2, 0);
  if (kind === 'stone') return new THREE.Vector3(colX(col), BED + STONE_H * (layer + 0.5), 0);
  return new THREE.Vector3(colX(col), (DECK + BED) / 2, 0);
}

export class WorkshopView {
  group = new THREE.Group();
  private visuals = new Map<string, Visual>();
  private ghost: { kind: PartKind; obj: THREE.Group; mat: THREE.MeshBasicMaterial } | null = null;
  private markers = new THREE.Group();
  private gridLines = new THREE.Group();
  private explodeK = 0; private explodeGoal = 0;
  private build: Build = { parts: [], boxes: 0 };
  target: { kind: PartKind; col: number } | null = null;
  highlight: string | null = null;

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    this.group.add(this.markers, this.gridLines);
    // 河底的格子提示：只在拖动零件时淡淡出现
    for (let c = 0; c < GAP_COLS; c++) {
      const tile = new THREE.Mesh(new THREE.PlaneGeometry(CELL - 0.06, 0.95), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.16, depthWrite: false }));
      tile.rotation.x = -Math.PI / 2; tile.position.set(colX(c), WATER_Y + 0.02, 0); this.gridLines.add(tile);
    }
    this.gridLines.visible = false;
  }

  /** 和存档同步：新零件掉落进场，被拿走的零件消失 */
  setBuild(b: Build, animate = true) {
    this.build = b;
    const keep = new Set(b.parts.map(p => p.id));
    for (const [id, v] of this.visuals) if (!keep.has(id)) { this.group.remove(v.obj); this.visuals.delete(id); }
    const layers = new Map<number, number>();
    for (const p of b.parts) {
      const layer = p.kind === 'stone' ? (layers.get(p.col) ?? 0) : 0;
      if (p.kind === 'stone') layers.set(p.col, layer + 1);
      const pos = partPosition(p.kind, p.col, layer);
      let v = this.visuals.get(p.id);
      if (!v) {
        const { obj, mesh } = makePartMesh(p.kind, p.id.length * 7 + p.col);
        obj.position.copy(pos);
        this.group.add(obj);
        v = { part: p, obj, mesh, base: pos.clone(), sagPerSpan: [], supports: [] };
        this.visuals.set(p.id, v);
        if (animate) { obj.position.y += 1.2; obj.userData.drop = 0; }
      } else { v.base.copy(pos); v.part = p; }
    }
    this.resetPose();
    this.refreshMarkers();
  }
  partIds() { return [...this.visuals.keys()]; }
  objectFor(id: string) { return this.visuals.get(id)?.obj ?? null; }
  meshes() { return [...this.visuals.values()].map(v => ({ id: v.part.id, obj: v.obj })); }

  // —— 拖动虚影 ——
  beginGhost(kind: PartKind) {
    this.endGhost();
    const { obj } = makePartMesh(kind);
    const mat = new THREE.MeshBasicMaterial({ color: '#9be38a', transparent: true, opacity: 0.55, depthWrite: false });
    obj.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = mat; });
    this.group.add(obj);
    this.ghost = { kind, obj, mat };
    this.gridLines.visible = true;
  }
  endGhost() { if (this.ghost) this.group.remove(this.ghost.obj); this.ghost = null; this.target = null; this.gridLines.visible = false; }
  /** 手指所在的世界坐标（桥所在的竖直平面）→ 最近的合法格子 */
  moveGhost(world: THREE.Vector3) {
    if (!this.ghost) return;
    const { kind } = this.ghost;
    const len = isPlank(kind) ? PLANK_LEN[kind] : 1;
    const raw = (world.x + 2.2) / CELL - len / 2;
    const guess = Math.round(raw);
    let best: number | null = null;
    for (const d of [0, -1, 1, -2, 2]) { if (canPlace(this.build, kind, guess + d) && Math.abs(guess + d - raw) < 1.6) { best = guess + d; break; } }
    const near = isPlank(kind) ? Math.abs(world.y - DECK) < 1.3 : world.y < DECK + 1.2;
    if (best !== null && near) {
      this.target = { kind, col: best };
      this.ghost.obj.position.copy(partPosition(kind, best, kind === 'stone' ? stonesAt(this.build, best) : 0));
      this.ghost.mat.color.set('#9be38a'); this.ghost.mat.opacity = 0.6;
    } else {
      this.target = null;
      this.ghost.obj.position.set(world.x, Math.max(world.y, DECK + 0.4), 0.3);
      this.ghost.mat.color.set('#ff8a7a'); this.ghost.mat.opacity = 0.4;
    }
  }

  // —— 拆开看看 ——
  setExplode(on: boolean) { this.explodeGoal = on ? 1 : 0; }
  get exploded() { return this.explodeGoal > 0; }
  private refreshMarkers() {
    this.markers.clear();
    const S = supportCols(this.build);
    for (const p of this.build.parts) {
      if (!isPlank(p.kind)) continue;
      const { a, b } = plankCells(p);
      for (const c of [a, b]) {
        const ok = S.has(c);
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), new THREE.MeshBasicMaterial({ color: ok ? '#4fd36a' : '#ff5a4f' }));
        m.userData = { id: p.id, col: c };
        this.markers.add(m);
      }
    }
  }

  /** 试车时由场景按小车位置设置每块木板的弯曲 */
  setPlankStates(states: PlankState[]) {
    for (const st of states) { const v = this.visuals.get(st.id); if (v) { v.supports = st.supports; } }
  }
  bend(id: string, amount: number) {
    const v = this.visuals.get(id);
    if (!v || !isPlank(v.part.kind)) return;
    const { a } = plankCells(v.part);
    const geo = v.mesh.geometry as THREE.BufferGeometry, pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const base = v.mesh.userData.basePos as Float32Array, arr = pos.array as Float32Array;
    const left = v.base.x - partSize(v.part.kind) / 2;
    const sup = v.supports.length >= 2 ? v.supports : [a, a + PLANK_LEN[v.part.kind] - 1];
    for (let i = 0; i < pos.count; i++) {
      const wx = left + base[i * 3] + partSize(v.part.kind) / 2;
      const c = (wx + 2.2) / CELL - 0.5;               // 连续的格子坐标
      arr[i * 3 + 1] = base[i * 3 + 1] - spanDrop(c, sup, amount);
    }
    pos.needsUpdate = true; geo.computeVertexNormals();
    v.mesh.userData.sag = amount;
  }
  /** 小车车轮下的桥面高度（含弯曲、翻翘） */
  deckHeight(x: number): number | null {
    let best: number | null = null;
    for (const v of this.visuals.values()) {
      if (!isPlank(v.part.kind) || !v.obj.visible) continue;
      const half = partSize(v.part.kind) / 2;
      const local = v.obj.worldToLocal(new THREE.Vector3(x, v.obj.position.y, 0));
      if (Math.abs(local.x) > half) continue;
      const sag = (v.mesh.userData.sag as number) ?? 0;
      const dy = -spanDrop((x + 2.2) / CELL - 0.5, v.supports, sag);
      const tilt = v.obj.rotation.z;
      const y = v.obj.position.y + PLANK_T / 2 + dy + Math.sin(tilt) * (local.x);
      best = best === null ? y : Math.max(best, y);
    }
    return best;
  }
  /** 出问题的零件闪红 */
  flash(id: string | null) { this.highlight = id; }
  resetPose() {
    for (const v of this.visuals.values()) {
      v.obj.rotation.set(0, 0, 0); v.obj.visible = true; v.mesh.userData.sag = 0;
      if (isPlank(v.part.kind)) this.bend(v.part.id, 0);
      if (v.obj.userData.drop === undefined) v.obj.position.copy(v.base);
    }
  }
  tip(id: string, freeEnd: 'a' | 'b' | 'both', k: number) {
    const v = this.visuals.get(id); if (!v) return;
    const half = partSize(v.part.kind) / 2;
    if (freeEnd === 'both') { v.obj.position.y = v.base.y - k * (DECK - WATER_Y + 0.1); v.obj.rotation.z = k * 0.15; return; }
    // 绕着搭住的那一头转：先把枢轴移到那一头
    const sign = freeEnd === 'b' ? -1 : 1;            // 自由端在右边时向下（负角度）
    const angle = sign * 0.5 * k;
    const pivotX = v.base.x + (freeEnd === 'b' ? -half : half);
    v.obj.rotation.z = angle;
    v.obj.position.x = pivotX + (v.base.x - pivotX) * Math.cos(angle);
    v.obj.position.y = v.base.y + (v.base.x - pivotX) * Math.sin(angle);
  }

  update(t: number, dt: number) {
    // 新零件掉落
    for (const v of this.visuals.values()) {
      if (v.obj.userData.drop !== undefined) {
        const d = (v.obj.userData.drop = Math.min(1, v.obj.userData.drop + dt / 0.35));
        v.obj.position.copy(v.base); v.obj.position.y += 1.2 * (1 - easeOutBack(d));
        if (d >= 1) delete v.obj.userData.drop;
      }
    }
    // 拆开看看：零件向上、向前散开
    this.explodeK += (this.explodeGoal - this.explodeK) * Math.min(1, dt * 6);
    const k = this.explodeK;
    if (k > 0.001 || this.explodeGoal > 0) {
      let rank = 0;
      for (const v of this.visuals.values()) {
        if (v.obj.userData.drop !== undefined) continue;
        const o = new THREE.Vector3();
        if (isPlank(v.part.kind)) { o.set(0, 0.75 + (rank++ % 2) * 0.35, 0.35); }
        else if (v.part.kind === 'stone') { const layer = Math.round((v.base.y - BED) / STONE_H - 0.5); o.set(0, 0.25 * layer, 0.9); }
        else o.set(0, 0.15, 0.9);
        v.obj.position.copy(v.base).addScaledVector(o, k);
      }
    }
    // 端头标记：拆开时出现，告诉孩子每一头有没有搭住
    this.markers.visible = k > 0.05;
    for (const m of this.markers.children as THREE.Mesh[]) {
      const v = this.visuals.get(m.userData.id); if (!v) continue;
      m.position.set(colX(m.userData.col), v.obj.position.y - PLANK_T / 2 - 0.08, v.obj.position.z + PLANK_W / 2 + 0.05);
      m.scale.setScalar(clamp01(k) * (1 + Math.sin(t * 5) * 0.12));
    }
    // 出问题的零件闪红
    for (const v of this.visuals.values()) {
      const mat = v.mesh.material as THREE.MeshStandardMaterial;
      const on = v.part.id === this.highlight;
      mat.emissive.set(on ? '#ff3b2f' : '#000000');
      mat.emissiveIntensity = on ? 0.45 + Math.sin(t * 8) * 0.35 : 0;
    }
  }
  dispose(scene: THREE.Scene) { scene.remove(this.group); }
}
