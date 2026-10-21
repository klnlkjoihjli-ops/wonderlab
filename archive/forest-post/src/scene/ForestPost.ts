import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Bridge, Material, Outcome, Slot } from '../../shared/bridge';
import { sagAmount, slotFor } from '../../shared/bridge';
import { sfx } from '../audio';
import { PALETTE, clamp01, ease, easeOutBack, glowTexture, lerp } from './util';
import { HOME, ROAD_Y, WATER_Y, buildSky, buildTerrain, buildWater } from './terrain';
import { buildBridgeSite, buildClouds, buildGroundDetail, buildHome, buildMotes, buildPostOffice, buildTrees } from './props';
import { createCart, createHedgehog, createOutfit, createOwl, createRabbit, createSquirrel } from './characters';
import type { Decoration, Recipient } from '../../shared/game';
import { BRIDGE_END, BRIDGE_START, PLANK_Y, Plank, createDecoration, createGhost, createHeld, createPier, slotCenter } from './bridgeParts';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { LabResult, LabSetup, Level } from '../../shared/lab';
import type { Build, BuildResult, PartKind } from '../../shared/build';
import { CELL, WorkshopView, colX } from './workshop';

export type Focus = Outcome['focus'];
export type SceneEvents = {
  onDrop: (material: Material, slot: Slot) => void;
  onSlotTap: (slot: Slot) => void;
  onPieceTap: (slot: Slot) => void;
  onMissDrop: () => void;
  onWsPick?: (id: string) => void;                 // 搭桥工坊：从桥上拿起一个零件
  onWsPlace?: (kind: PartKind, col: number) => void;
};

type Tween = { t: number; dur: number; update: (k: number) => void; resolve: () => void };

const CART_WAIT_X = -3.35;
const CART_HOME_X = -5.9;
const OWL_REST = new THREE.Vector3(-4.9, 2.5, -0.9);
const FOCUS_POINT: Record<Focus, THREE.Vector3> = {
  left: new THREE.Vector3(-1.3, ROAD_Y + 0.1, 0),
  middle: new THREE.Vector3(0, ROAD_Y + 0.05, 0),
  right: new THREE.Vector3(1.35, ROAD_Y + 0.1, 0),
  cart: new THREE.Vector3(CART_WAIT_X, ROAD_Y + 0.6, 0)
};

export class ForestPost {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 400);
  private clock = new THREE.Clock();
  private tweens: Tween[] = [];
  private raf = 0;
  private disposed = false;
  private waterU: { uTime: { value: number } };
  private motes: (t: number) => void;
  private clouds: (dt: number) => void;
  private post: ReturnType<typeof buildPostOffice>;
  private home: ReturnType<typeof buildHome>;
  private cart = createCart();
  private owl = createOwl();
  private friends: Record<Recipient, ReturnType<typeof createRabbit>> = { rabbit: createRabbit(), squirrel: createSquirrel(), hedgehog: createHedgehog() };
  private recipient: Recipient = 'rabbit';
  private outfit: THREE.Group | null = null;
  private decorations = new Map<Decoration, THREE.Group>();
  private site: ReturnType<typeof buildBridgeSite>;
  private planks = new Map<Slot, Plank>();
  private pier: THREE.Group | null = null;
  // —— 小桥实验室 ——
  private lab: LabSetup | null = null;
  private labBoxes = new THREE.Group();
  // —— 搭桥工坊 ——
  private ws: WorkshopView | null = null;
  private wsDragging: PartKind | null = null;
  private ruler = new THREE.Group();
  private rulerMarker = new THREE.Group();
  private ghosts = new Map<Slot, THREE.Mesh>();
  private held: THREE.Group | null = null;
  private heldMaterial: Material | null = null;
  private hovered: Slot | null = null;
  private selected: Material | null = null;
  private bridge: Bridge = { long: false, left: false, right: false, pier: false };
  private marker: THREE.Mesh;
  private beam: THREE.Mesh;
  private markerOn = 0;
  private effects: { obj: THREE.Object3D; life: number; max: number; tick: (k: number, dt: number) => void }[] = [];
  private cartX = CART_HOME_X;
  private wobble = 0;                 // 没有支撑的短板在轻轻晃
  private busy = false;
  // 相机：围绕桥位的受限环绕
  private cam = { yaw: 0, pitch: 0.5, dist: 18, target: new THREE.Vector3(0, 0.4, -0.6) };
  private camGoal = { yaw: 0, pitch: 0.5, dist: 18, target: new THREE.Vector3(0, 0.4, -0.6) };
  private baseDist = 18;
  private inspect = false;
  private orbit: { x: number; y: number; yaw: number; pitch: number } | null = null;
  private ray = new THREE.Raycaster();
  private pointer = new THREE.Vector2();

  constructor(private container: HTMLElement, private events: SceneEvents) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.domElement.className = 'scene-canvas';
    container.appendChild(r.domElement);

    const s = this.scene;
    s.fog = new THREE.Fog(PALETTE.skyHorizon, 26, 85);
    const sunDir = new THREE.Vector3(-0.7, 0.55, -0.45);
    buildSky(s, sunDir);
    // 黄昏前的暖光：主光从左前上方，冷色天光补暗部，背后一道暖色轮廓光
    s.add(new THREE.HemisphereLight('#d8ecff', '#6f8f4a', 1.25));
    const sun = new THREE.DirectionalLight('#ffe0b0', 2.7);
    sun.position.set(-9, 13, 7); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 14, bottom: -12, near: 1, far: 50 });
    s.add(sun);
    const rim = new THREE.DirectionalLight('#ffb38a', 1.1); rim.position.set(8, 6, -12); s.add(rim);

    buildTerrain(s);
    this.waterU = buildWater(s);
    buildTrees(s);
    buildGroundDetail(s);
    this.site = buildBridgeSite(s);
    this.post = buildPostOffice(s);
    this.home = buildHome(s);
    this.motes = buildMotes(s);
    this.clouds = buildClouds(s);

    this.cart.root.position.set(CART_HOME_X, ROAD_Y, 0);
    // Blender 模型异步加载；加载失败或 ?cart=classic 时继续用程序拼的小车，体验不受影响
    if (new URLSearchParams(location.search).get('cart') !== 'classic') {
      new GLTFLoader().load('/models/mail_cart.glb', gltf => {
        if (this.disposed) return;
        try { this.cart.applyModel(gltf.scene); } catch (e) { console.warn('邮车模型未能替换，继续使用简化模型', e); }
      }, undefined, e => console.warn('邮车模型加载失败，继续使用简化模型', e));
    }
    s.add(this.cart.root);
    this.owl.root.position.copy(OWL_REST);
    s.add(this.owl.root);
    for (const f of Object.values(this.friends)) { f.root.rotation.y = -0.5; s.add(f.root); }
    this.setRecipient('rabbit');

    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.72, 48), new THREE.MeshBasicMaterial({ color: '#fff6a8', transparent: true, opacity: 0, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
    this.marker.rotation.x = -Math.PI / 2; this.marker.renderOrder = 10;
    s.add(this.marker);
    // 光柱：从高处照向要观察的地方
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.5, 3.2, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#fff3a0', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    s.add(this.beam);

    const el = r.domElement;
    el.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    this.resize();
    window.addEventListener('resize', this.resize);
    this.cam.dist = this.camGoal.dist = this.baseDist;
    // 美术检查用：?inspect=cart 时镜头对准小邮车特写（不影响正常游戏）
    if (new URLSearchParams(location.search).get('inspect') === 'cart') {
      Object.assign(this.camGoal, { yaw: 0.75, pitch: 0.28, dist: 5.2 }); this.camGoal.target.set(CART_HOME_X, 1.0, 0);
      Object.assign(this.cam, { yaw: 0.75, pitch: 0.28, dist: 5.2 }); this.cam.target.copy(this.camGoal.target);
      this.inspect = true;
    }
    this.loop();
    // 开发调试用：控制台里可以通过 __forest 查看场景状态（正式构建不包含）
    if (import.meta.env.DEV) (window as unknown as { __forest: ForestPost }).__forest = this;
  }

  // —— 生命周期 ——
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
  private resize = () => {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    // 让小溪两岸（约 ±8 米）总在画面里，竖屏或 4:3 时自动拉远
    const halfW = 8.8, tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.baseDist = THREE.MathUtils.clamp(halfW / (tan * this.camera.aspect), 15, 30);
    if (!this.busy) this.camGoal.dist = this.baseDist;
  };
  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    // 流程动画按真实时间推进（最多 1 秒一跳），即使设备卡顿或掉帧，试车和送信也会按时完成；
    // 其余装饰性动画用截断后的 dt，避免一下跳太远
    const raw = Math.min(this.clock.getDelta(), 1), dt = Math.min(raw, 0.05), t = this.clock.elapsedTime;
    for (const tw of [...this.tweens]) {
      tw.t += raw; const k = clamp01(tw.t / tw.dur); tw.update(k);
      if (k >= 1) { this.tweens.splice(this.tweens.indexOf(tw), 1); tw.resolve(); }
    }
    this.waterU.uTime.value = t;
    this.motes(t); this.clouds(dt); this.post.update(t);
    this.cart.update(t, dt); this.owl.update(t, dt); for (const f of Object.values(this.friends)) f.update(t, dt);
    // 小诺的眼睛看向小车或正在指的地方
    const look = this.markerOn > 0 ? this.marker.position : this.cart.root.position;
    this.owl.lookAt((look.x - this.owl.root.position.x) / 3, (look.y - this.owl.root.position.y) / 3);
    this.updateGhosts(t);
    this.updateWobble(t);
    this.updateMarker(t, dt);
    this.updateRuler();
    this.ws?.update(t, dt);
    const edt = Math.min(raw, 0.1);
    for (const e of [...this.effects]) { e.life += edt; e.tick(Math.min(1, e.life / e.max), edt); if (e.life >= e.max) { this.scene.remove(e.obj); this.effects.splice(this.effects.indexOf(e), 1); } }
    this.site.ring.scale.setScalar(1 + Math.sin(t * 1.6) * 0.06);
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  };
  private tween(dur: number, update: (k: number) => void) {
    return new Promise<void>(resolve => this.tweens.push({ t: 0, dur, update, resolve }));
  }
  private wait(s: number) { return this.tween(s, () => {}); }

  // —— 相机 ——
  private updateCamera(dt: number) {
    const c = this.cam, g = this.camGoal, k = 1 - Math.pow(0.02, dt);
    if (!this.orbit && !this.inspect) { g.yaw *= 1 - dt * 0.15; }
    c.yaw = lerp(c.yaw, g.yaw, k); c.pitch = lerp(c.pitch, g.pitch, k); c.dist = lerp(c.dist, g.dist, k); c.target.lerp(g.target, k);
    const cp = Math.cos(c.pitch);
    this.camera.position.set(c.target.x + Math.sin(c.yaw) * cp * c.dist, c.target.y + Math.sin(c.pitch) * c.dist, c.target.z + Math.cos(c.yaw) * cp * c.dist);
    this.camera.lookAt(c.target);
  }
  private setView(view: 'build' | 'follow' | 'intro' | 'deliver' | 'lab', x = 0) {
    if (view === 'lab') { const g = this.camGoal; g.pitch = 0.36; g.dist = this.baseDist * 0.72; g.target.set(0.2, 0.2, 0); return; }
    const g = this.camGoal;
    if (view === 'build') { g.pitch = 0.5; g.dist = this.baseDist; g.target.set(0, 0.4, -0.6); }
    if (view === 'follow') { g.pitch = 0.42; g.dist = this.baseDist * 0.78; g.target.set(x * 0.6, 0.6, -0.2); }
    if (view === 'deliver') { g.pitch = 0.42; g.dist = this.baseDist * 0.8; g.target.set(3.2, 0.8, -1.4); }
    if (view === 'intro') { g.pitch = 0.5; g.dist = this.baseDist; g.target.set(0, 0.4, -0.6); }
  }

  // —— 桥的同步 ——
  clearMarker() { this.markerOn = 0; }
  setBridge(next: Bridge, animate = true) {
    if (animate) this.markerOn = 0;
    const prev = this.bridge; this.bridge = next;
    for (const slot of ['span', 'left', 'right'] as Slot[]) {
      const want = slot === 'span' ? next.long : next[slot as 'left' | 'right'];
      const has = this.planks.get(slot);
      if (want && !has) {
        const p = new Plank(slot === 'span' ? 'long' : 'short', slot);
        this.scene.add(p.group); this.planks.set(slot, p);
        if (animate) this.dropIn(p.group, slotCenter(slot));
      } else if (!want && has) {
        this.scene.remove(has.group); this.planks.delete(slot);
        if (animate) this.puff(slotCenter(slot), '#fff4dd');
      }
    }
    if (next.pier && !this.pier) { this.pier = createPier(); this.scene.add(this.pier); if (animate) this.dropIn(this.pier, slotCenter('pier')); }
    else if (!next.pier && this.pier) { this.scene.remove(this.pier); this.pier = null; if (animate) this.puff(slotCenter('pier'), '#e6fbf6'); }
    if (animate && (prev.long !== next.long || prev.left !== next.left || prev.right !== next.right || prev.pier !== next.pier)) this.refreshGhosts();
    this.relax();
  }
  private relax() {
    for (const p of this.planks.values()) { p.group.rotation.z = 0; p.applySag(p.kind === 'short' && !this.bridge.pier ? 0.12 : 0); }
  }
  private dropIn(obj: THREE.Object3D, at: THREE.Vector3) {
    const y0 = obj.position.y;
    obj.position.y = y0 + 1.4; obj.scale.setScalar(0.6);
    void this.tween(0.42, k => { obj.position.y = y0 + 1.4 * (1 - easeOutBack(k)) * (k < 1 ? 1 : 0); obj.scale.setScalar(lerp(0.6, 1, easeOutBack(k))); }).then(() => { obj.position.y = y0; obj.scale.setScalar(1); this.puff(at, '#fff4dd'); });
  }
  private updateWobble(t: number) {
    if (this.busy) return;
    // 只有一头搭在岸上的短板会轻轻晃，暗示“这里不稳”
    const unsupported = !this.bridge.pier;
    for (const p of this.planks.values()) if (p.kind === 'short') p.group.rotation.z = unsupported ? (Math.sin(t * 3.2 + (p.slot === 'left' ? 0 : 1.6)) * 0.022 + 0.02) * (p.slot === 'left' ? -1 : 1) : 0;
  }

  // —— 放置提示虚影 ——
  private refreshGhosts() {
    for (const g of this.ghosts.values()) this.scene.remove(g);
    this.ghosts.clear();
    const material = this.heldMaterial ?? this.selected;
    if (!material || this.busy) return;
    for (const slot of slotFor(material, this.bridge)) { const g = createGhost(slot); this.scene.add(g); this.ghosts.set(slot, g); }
  }
  private updateGhosts(t: number) {
    for (const [slot, g] of this.ghosts) {
      const m = g.material as THREE.MeshBasicMaterial;
      const on = slot === this.hovered;
      m.opacity = on ? 0.7 : 0.25 + (Math.sin(t * 4) * 0.5 + 0.5) * 0.25;
      m.color.set(on ? '#fffbe0' : '#fff0a0');
    }
  }
  setSelected(material: Material | null) { this.selected = material; this.refreshGhosts(); }

  // —— 拖放 ——
  beginDrag(material: Material, clientX: number, clientY: number) {
    if (this.busy) return;
    this.heldMaterial = material; this.held = createHeld(material); this.scene.add(this.held);
    sfx.pick();
    this.refreshGhosts();
    this.moveHeld(clientX, clientY, true);
  }
  private nearestSlot(clientX: number, clientY: number, slots: Iterable<Slot>, maxPx: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    let best: Slot | null = null, bestD = maxPx;
    for (const slot of slots) {
      const p = slotCenter(slot).project(this.camera);
      const sx = rect.left + (p.x + 1) / 2 * rect.width, sy = rect.top + (1 - p.y) / 2 * rect.height;
      const d = Math.hypot(sx - clientX, sy - clientY);
      if (d < bestD) { bestD = d; best = slot; }
    }
    return best;
  }
  private moveHeld(clientX: number, clientY: number, snap = false) {
    if (!this.held || !this.heldMaterial) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.pointer, this.camera);
    const hit = new THREE.Vector3();
    this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.5), hit);
    const reach = Math.max(120, rect.width * 0.12);
    this.hovered = this.nearestSlot(clientX, clientY, this.ghosts.keys(), reach);
    const goal = this.hovered ? this.ghosts.get(this.hovered)!.position.clone().add(new THREE.Vector3(0, 0.7, 0)) : hit;
    if (snap) this.held.position.copy(goal); else this.held.position.lerp(goal, 0.45);
    this.held.rotation.z = this.hovered ? 0 : Math.sin(performance.now() / 200) * 0.06;
  }
  private endDrag(clientX: number, clientY: number) {
    if (!this.held || !this.heldMaterial) return;
    this.moveHeld(clientX, clientY);
    const material = this.heldMaterial, slot = this.hovered;
    this.scene.remove(this.held); this.held = null; this.heldMaterial = null; this.hovered = null;
    this.refreshGhosts();
    if (slot) this.events.onDrop(material, slot); else this.events.onMissDrop();
  }
  /** 由界面层（材料卡）转发的指针事件 */
  dragMove(x: number, y: number) { this.moveHeld(x, y); }
  dragEnd(x: number, y: number) { this.endDrag(x, y); }
  get dragging() { return !!this.held; }

  private onDown = (e: PointerEvent) => {
    if (this.busy || this.held || this.wsDragging) return;
    if (this.ws && this.ws.group.visible && !this.ws.exploded) {
      const id = this.pickWsPart(e.clientX, e.clientY);
      if (id) {
        const kind = this.wsParts.get(id);
        if (kind) { this.events.onWsPick?.(id); this.beginWsDrag(kind, e.clientX, e.clientY); return; }
      }
    }
    // 选中材料后点虚影 = 放置；点已放的木板 = 拿回材料包
    if (this.selected) {
      const s = this.nearestSlot(e.clientX, e.clientY, this.ghosts.keys(), 130);
      if (s) { this.events.onSlotTap(s); return; }
    }
    const piece = this.pickPiece(e.clientX, e.clientY);
    if (piece) { this.events.onPieceTap(piece); return; }
    this.orbit = { x: e.clientX, y: e.clientY, yaw: this.camGoal.yaw, pitch: this.camGoal.pitch };
  };
  private onMove = (e: PointerEvent) => {
    if (this.wsDragging) { this.moveWsGhost(e.clientX, e.clientY); return; }
    if (this.held) { this.moveHeld(e.clientX, e.clientY); return; }
    if (this.orbit) {
      this.camGoal.yaw = THREE.MathUtils.clamp(this.orbit.yaw - (e.clientX - this.orbit.x) * 0.004, -0.55, 0.55);
      this.camGoal.pitch = THREE.MathUtils.clamp(this.orbit.pitch + (e.clientY - this.orbit.y) * 0.003, 0.28, 0.85);
    }
  };
  private onUp = (e: PointerEvent) => {
    if (this.wsDragging) { this.endWsDrag(e.clientX, e.clientY); return; }
    if (this.held) { this.endDrag(e.clientX, e.clientY); return; }
    this.orbit = null;
  };
  private pickPiece(clientX: number, clientY: number): Slot | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.pointer, this.camera);
    const targets: [THREE.Object3D, Slot][] = [...this.planks.entries()].map(([s, p]) => [p.group, s]);
    if (this.pier) targets.push([this.pier, 'pier']);
    const hits = this.ray.intersectObjects(targets.map(t => t[0]), true);
    if (!hits.length) return null;
    let o: THREE.Object3D | null = hits[0].object;
    while (o) { const f = targets.find(t => t[0] === o); if (f) return f[1]; o = o.parent; }
    return null;
  }

  // —— 小诺 ——
  async flyOwl(to: THREE.Vector3, dur = 1.1) {
    const from = this.owl.root.position.clone();
    const mid = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, 1.2, 0));
    this.owl.setFlying(true); sfx.whoosh();
    await this.tween(dur, k => {
      const e = ease(k), a = from.clone().lerp(mid, e), b = mid.clone().lerp(to, e);
      this.owl.root.position.copy(a.lerp(b, e));
      this.owl.root.rotation.z = Math.sin(k * Math.PI) * 0.25 * Math.sign(to.x - from.x);
    });
    this.owl.setFlying(false);
  }
  async point(focus: Focus) {
    const target = FOCUS_POINT[focus].clone();
    if (focus === 'cart') target.x = this.cartX;
    // 指“中间”时，光圈落在小溪中间那块大石头上：那里正是可以托住木板的地方
    if (focus === 'middle') this.marker.position.set(0, WATER_Y + 0.12, 0);
    else this.marker.position.set(target.x, target.y + 0.12, 0);
    await this.flyOwl(target.clone().add(new THREE.Vector3(0.2, 1.7, 1.1)));
    this.markerOn = 60;       // 一直亮着，直到孩子动手
  }
  async owlHome() { this.markerOn = 0; await this.flyOwl(OWL_REST, 0.9); }
  cheer() { this.owl.cheer(); }
  private updateMarker(t: number, dt: number) {
    this.markerOn = Math.max(0, this.markerOn - dt);
    const m = this.marker.material as THREE.MeshBasicMaterial;
    m.opacity = lerp(m.opacity, this.markerOn > 0 ? 0.95 : 0, 0.15);
    this.marker.scale.setScalar(1 + Math.sin(t * 4) * 0.12);
    const b = this.beam.material as THREE.MeshBasicMaterial;
    b.opacity = m.opacity * 0.28;
    this.beam.position.set(this.marker.position.x, this.marker.position.y + 1.6, this.marker.position.z);
  }

  // —— 小车 ——
  private heightAtX(x: number) {
    if (this.ws?.group.visible) {
      if (x < -2.2 || x > 2.2) return ROAD_Y;
      return this.ws.deckHeight(x) ?? ROAD_Y;
    }
    if (x < BRIDGE_START + 0.05 || x > BRIDGE_END - 0.05) return ROAD_Y;
    let best: number | null = null;
    for (const p of this.planks.values()) { const h = p.topAt(x); if (h !== null) best = best === null ? h : Math.max(best, h); }
    return best ?? ROAD_Y;
  }
  private placeCart(x: number) {
    const dx = x - this.cartX; this.cartX = x;
    const back = this.heightAtX(x - 0.42), front = this.heightAtX(x + 0.42);
    this.cart.root.position.set(x, (back + front) / 2, 0);
    this.cart.root.rotation.z = Math.atan2(front - back, 0.84);
    this.cart.roll(dx);
  }
  private drive(to: number, speed = 2.2, onStep?: (x: number) => void) {
    const from = this.cartX, dur = Math.max(0.2, Math.abs(to - from) / speed);
    return this.tween(dur, k => { const x = lerp(from, to, ease(k)); this.placeCart(x); onStep?.(x); });
  }
  setCargo(load: 1 | 2) { this.cart.gift.visible = load > 1; }

  // ===================== 小桥实验室 =====================
  /** 弯曲程度 → 画面上的下沉量（米） */
  static readonly SAG_SCALE = 0.42;
  static readonly SAG_MAX = 0.68;
  private buildLabProps() {
    if (this.ruler.children.length) return;
    // 桥前方立一根彩色标尺：绿 / 黄 / 红，对应规则里的三档
    const top = PLANK_Y, s = ForestPost.SAG_SCALE;
    const bands: [number, number, string][] = [[0, 0.4 * s, '#5cbf5a'], [0.4 * s, 1 * s, '#ffcf4a'], [1 * s, ForestPost.SAG_MAX + 0.08, '#ee5a4f']];
    for (const [a, b, c] of bands) {
      const m = new THREE.Mesh(new RoundedBoxGeometry(0.26, b - a, 0.1, 2, 0.03), new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
      m.position.set(0, top - (a + b) / 2, 0); m.castShadow = true; this.ruler.add(m);
    }
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, top - WATER_Y + 0.5, 10), new THREE.MeshStandardMaterial({ color: PALETTE.woodDark }));
    pole.position.set(0.12, (top + WATER_Y + 0.5) / 2 - 0.1, -0.02); this.ruler.add(pole);
    this.ruler.position.set(0.15, 0, 1.0); this.ruler.scale.setScalar(1.15); this.ruler.visible = false; this.scene.add(this.ruler);
    // 指针：跟着桥面中间一起往下走
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 3), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }));
    arrow.rotation.z = Math.PI / 2; arrow.position.x = -0.3;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.045, 0.045), new THREE.MeshStandardMaterial({ color: '#2a3a33' }));
    bar.position.x = -0.05;
    this.rulerMarker.add(arrow, bar); this.ruler.add(this.rulerMarker);
    this.cart.body.add(this.labBoxes);
  }
  private updateRuler() {
    if (!this.lab) return;
    const p = this.planks.get('span');
    const sag = p ? p.sag : 0;
    this.rulerMarker.position.y = PLANK_Y - Math.min(sag, ForestPost.SAG_MAX + 0.05);
  }
  setLab(setup: LabSetup | null, animate = true) {
    this.buildLabProps();
    const prev = this.lab; this.lab = setup;
    this.ruler.visible = !!setup;
    if (!setup) {
      const p = this.planks.get('span'); if (p) { this.scene.remove(p.group); this.planks.delete('span'); }
      if (this.pier) { this.scene.remove(this.pier); this.pier = null; }
      this.labBoxes.clear();
      this.bridge = { long: false, left: false, right: false, pier: false };
      return;
    }
    if (!prev || prev.deck !== setup.deck) {
      const old = this.planks.get('span'); if (old) this.scene.remove(old.group);
      const p = new Plank('long', 'span', setup.deck); this.scene.add(p.group); this.planks.set('span', p);
      if (animate) this.dropIn(p.group, slotCenter('span'));
    }
    if (setup.pier && !this.pier) { this.pier = createPier(); this.scene.add(this.pier); if (animate) this.dropIn(this.pier, slotCenter('pier')); }
    if (!setup.pier && this.pier) { this.scene.remove(this.pier); this.pier = null; if (animate) this.puff(slotCenter('pier'), '#e6fbf6'); }
    this.bridge = { long: true, left: false, right: false, pier: setup.pier };
    this.setCartBoxes(setup.boxes, animate);
    this.cart.gift.visible = false;
    this.planks.get('span')?.applySag(0);
    this.setView('lab');
  }
  /** 礼物盒堆在车头上：两排两层（实验室和搭桥工坊共用） */
  setCartBoxes(n: number, animate = true) {
    this.buildLabProps();
    const colors = ['#ff8fb1', '#7fb4d9', '#ffcf4a', '#9fd36a'];
    while (this.labBoxes.children.length > n) this.labBoxes.remove(this.labBoxes.children[this.labBoxes.children.length - 1]);
    while (this.labBoxes.children.length < n) {
      const i = this.labBoxes.children.length;
      const b = new THREE.Group();
      const box = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.26, 0.3, 2, 0.04), new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.55 }));
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.27, 0.06), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }));
      box.castShadow = rib.castShadow = true; b.add(box, rib);
      b.position.set(0.36, 0.86 + Math.floor(i / 2) * 0.27, i % 2 ? 0.17 : -0.17);
      this.labBoxes.add(b);
      if (animate) { b.scale.setScalar(0.01); void this.tween(0.35, k => b.scale.setScalar(Math.max(0.01, easeOutBack(k)))); }
    }
  }
  /** 实验室试车：下沉量由规则算出的 sag 决定，过桥时随小车位置变化 */
  async testLab(result: LabResult): Promise<string | null> {
    this.busy = true; this.markerOn = 0;
    const p = this.planks.get('span');
    if (!p) { this.busy = false; return null; }
    let shot: string | null = null;      // 在弯得最厉害的那一刻抓拍
    const show = Math.min(ForestPost.SAG_MAX, result.sag * ForestPost.SAG_SCALE);
    const pierShape = this.lab?.pier ?? false;
    const bend = (x: number) => {
      const u = clamp01(1 - (x / 2.65) ** 2);
      p.applySag(show * (pierShape ? Math.sin(Math.PI * clamp01(Math.abs(x) / 2.65)) * 0.9 + 0.1 * u : u));
    };
    this.setView('follow', -1);
    sfx.engine();
    if (result.ok) {
      await this.drive(BRIDGE_END + 0.7, 1.6, x => { bend(x); if (!shot && x >= (pierShape ? -1.3 : -0.05)) shot = this.snapshot(); });
      p.applySag(0);
      if (result.level === 'green') { sfx.success(); this.owl.cheer(); } else sfx.honk();
      await this.wait(0.9);
    } else {
      const stop = BRIDGE_START + result.reach * (BRIDGE_END - BRIDGE_START);
      await this.drive(stop, 1.2, x => bend(x));
      sfx.creak();
      await this.tween(0.9, k => { p.applySag(Math.min(ForestPost.SAG_MAX + 0.05, p.sag + 0.004)); this.cart.roll(0.04); this.placeCart(this.cartX - 0.003 * k); });
      shot = this.snapshot();
      if (this.lab?.deck === 'paper') { this.splash(new THREE.Vector3(0, WATER_Y, 0)); sfx.splash(); }
      await this.wait(0.4);
      await this.drive(CART_WAIT_X, 1.5, x => bend(x));
    }
    p.applySag(0);
    this.puff(new THREE.Vector3(this.cartX, ROAD_Y + 0.5, 0), '#ffffff');
    this.placeCart(CART_WAIT_X);
    this.setView('lab');
    this.busy = false;
    return shot;
  }
  levelColor(l: Level) { return l === 'green' ? '#5cbf5a' : l === 'yellow' ? '#ffcf4a' : '#ee5a4f'; }
  // ===================== 搭桥工坊 =====================
  /** 进入（传入搭建）或离开（null）工坊模式 */
  setWorkshop(build: Build | null, animate = true) {
    if (!build) { if (this.ws) { this.ws.group.visible = false; this.ws.setExplode(false); this.ws.flash(null); } this.cart.explode(0); this.setCartBoxes(0, false); return; }
    if (!this.ws) this.ws = new WorkshopView(this.scene);
    this.ws.group.visible = true;
    this.ws.setBuild(build, animate);
    this.wsParts = new Map(build.parts.map(p => [p.id, p.kind]));
    this.setCartBoxes(build.boxes, animate);
    this.cart.gift.visible = false;
    if (!this.busy) this.setView('lab');
  }
  clearFlash() { this.ws?.flash(null); this.markerOn = 0; }
  private wsParts = new Map<string, PartKind>();     // 零件 id → 类型，拿起时知道拖的是什么
  private pickWsPart(clientX: number, clientY: number): string | null {
    if (!this.ws) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.pointer, this.camera);
    const items = this.ws.meshes();
    const hits = this.ray.intersectObjects(items.map(i => i.obj), true);
    if (!hits.length) return null;
    let o: THREE.Object3D | null = hits[0].object;
    while (o) { const f = items.find(i => i.obj === o); if (f) return f.id; o = o.parent; }
    return null;
  }
  /** 手指在桥所在的竖直平面（z=0）上的位置 */
  private planeHit(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.pointer, this.camera);
    const hit = new THREE.Vector3();
    return this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit) ? hit : null;
  }
  beginWsDrag(kind: PartKind, clientX: number, clientY: number) {
    if (!this.ws || this.busy) return;
    this.ws.setExplode(false); this.cart.explode(0);
    this.wsDragging = kind; this.ws.beginGhost(kind); sfx.pick();
    this.moveWsGhost(clientX, clientY);
  }
  private moveWsGhost(clientX: number, clientY: number) { const h = this.planeHit(clientX, clientY); if (h && this.ws) this.ws.moveGhost(h); }
  private endWsDrag(clientX: number, clientY: number) {
    if (!this.ws || !this.wsDragging) return;
    this.moveWsGhost(clientX, clientY);
    const t = this.ws.target, kind = this.wsDragging;
    this.ws.endGhost(); this.wsDragging = null;
    if (t) this.events.onWsPlace?.(kind, t.col); else this.events.onMissDrop();
  }
  /** 由界面层（零件卡）转发的拖动 */
  wsDragMove(x: number, y: number) { if (this.wsDragging) this.moveWsGhost(x, y); }
  wsDragEnd(x: number, y: number) { if (this.wsDragging) this.endWsDrag(x, y); }
  /** 拆开看看：桥和小车一起散开 */
  setExplode(on: boolean) {
    this.ws?.setExplode(on); this.cart.explode(on ? 1 : 0);
    if (on) { sfx.whoosh(); this.markerOn = 0; void this.owlHome(); }   // 小诺让开，别挡住零件
  }
  get explodedView() { return this.ws?.exploded ?? false; }

  /** 小诺飞到某个零件上方指给孩子看 */
  async pointAtWorld(pos: THREE.Vector3) {
    this.marker.position.set(pos.x, pos.y + 0.12, 0);
    await this.flyOwl(pos.clone().add(new THREE.Vector3(0.2, 1.6, 1.1)));
    this.markerOn = 60;
  }

  /** 工坊试车：动画由规则结果驱动，并精确到出问题的那块零件 */
  async testBuild(result: BuildResult) {
    if (!this.ws) return;
    const ws = this.ws;
    this.busy = true; this.markerOn = 0; ws.flash(null); ws.setExplode(false); this.cart.explode(0); ws.resetPose();
    ws.setPlankStates(result.planks);
    const display = (sag: number) => Math.min(0.62, sag * 0.42);
    const ok = new Map(result.planks.filter(p => p.status === 'ok').map(p => [p.id, display(p.sag)]));
    // 小车经过时，脚下的木板按各自的弯曲程度往下沉
    const bendNear = (x: number) => {
      for (const [id, m] of ok) {
        const obj = ws.objectFor(id); if (!obj) continue;
        const near = clamp01(1.3 - Math.abs(x - obj.position.x) / 1.6);
        ws.bend(id, m * near);
      }
    };
    const stopBefore = (col: number) => colX(col) - CELL / 2 - 0.72;
    this.setView('follow', -1);
    sfx.engine();
    const failPart = result.partId ? ws.objectFor(result.partId) : null;
    if (result.reason === 'gap') {
      await this.drive(stopBefore(result.col!), 1.5, bendNear);
      await this.brake(); sfx.oops();
      this.dropPebble(colX(result.col!) - CELL / 2);
      await this.wait(0.6);
    } else if (result.reason === 'fall' || result.reason === 'tip') {
      const st = result.planks.find(p => p.id === result.partId)!;
      await this.drive(stopBefore(result.col!) + (st.freeEnd === 'b' ? 0.9 : 0.15), 1.4, bendNear);
      sfx.creak();
      await this.tween(0.55, k => { ws.tip(st.id, st.freeEnd!, easeOutBack(k) * (st.freeEnd === 'both' ? 1 : 0.9)); this.placeCart(this.cartX); });
      if (st.freeEnd === 'both' || failPart) { this.splash(new THREE.Vector3(failPart ? failPart.position.x : 0, WATER_Y, 0)); sfx.splash(); }
      sfx.oops();
      await this.wait(0.6);
    } else if (result.reason === 'sag') {
      const st = result.planks.find(p => p.id === result.partId)!;
      const obj = failPart!;
      await this.drive(obj.position.x - 0.2, 1.3, x => { bendNear(x); });
      sfx.creak();
      await this.tween(0.9, k => { ws.bend(st.id, display(st.sag) * (0.8 + 0.4 * k)); this.cart.roll(0.05); this.placeCart(this.cartX - 0.003 * k); });
      await this.wait(0.3);
    } else {
      await this.drive(2.2 + 1.1, 1.6, bendNear);
      for (const id of ok.keys()) ws.bend(id, 0);
      if (result.level === 'green') { sfx.success(); this.owl.cheer(); } else sfx.honk();
      await this.wait(0.9);
    }
    // 回到起点；出问题的零件留在闪红状态，等孩子去改
    if (result.reason !== 'success') {
      await this.drive(CART_WAIT_X, 1.6, bendNear);
      ws.resetPose();
      ws.flash(result.partId);
      const at = failPart ? failPart.position.clone() : new THREE.Vector3(colX(result.col ?? 0), ROAD_Y, 0);
      void this.pointAtWorld(at);
    } else {
      this.puff(new THREE.Vector3(this.cartX, ROAD_Y + 0.5, 0), '#ffffff');
      this.placeCart(CART_WAIT_X);
    }
    for (const id of ok.keys()) ws.bend(id, 0);
    this.setView('lab');
    this.busy = false;
  }

  /** 拍一张小照片（在同一帧里渲染再读取画布） */
  snapshot(): string | null {
    try {
      this.renderer.render(this.scene, this.camera);
      const src = this.renderer.domElement, c = document.createElement('canvas');
      c.width = 240; c.height = Math.round(240 * src.height / src.width);
      c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.62);
    } catch { return null; }
  }
  setOutfit(kind: 'hat' | 'bag' | null) {
    if (this.outfit) this.cart.body.remove(this.outfit);
    this.outfit = kind ? createOutfit(kind) : null;
    if (this.outfit) this.cart.body.add(this.outfit);
  }
  /** 收信的朋友站在信箱旁；party = true 时三位朋友都来了 */
  setRecipient(r: Recipient, party = false) {
    this.recipient = r;
    const spots = [new THREE.Vector3(HOME.x - 0.2, ROAD_Y, HOME.z + 2.6), new THREE.Vector3(HOME.x + 1.0, ROAD_Y, HOME.z + 2.2), new THREE.Vector3(HOME.x - 2.4, ROAD_Y, HOME.z + 1.9)];
    let k = 1;
    for (const [name, f] of Object.entries(this.friends) as [Recipient, ReturnType<typeof createRabbit>][]) {
      const main = name === r;
      f.root.visible = main || party;
      f.root.position.copy(main ? spots[0] : spots[k++]);
    }
  }
  setDecorations(list: Decoration[], animate = true) {
    for (const [k, g] of this.decorations) if (!list.includes(k)) { this.scene.remove(g); this.decorations.delete(k); }
    for (const k of list) if (!this.decorations.has(k)) {
      const g = createDecoration(k); this.scene.add(g); this.decorations.set(k, g);
      if (animate) { g.scale.setScalar(0.01); void this.tween(0.45, e => g.scale.setScalar(Math.max(0.01, easeOutBack(e)))); sfx.place(); }
    }
  }
  /** 镜头转向小兔家，用于选收信人 */
  lookHome(on: boolean) { if (on) { this.camGoal.pitch = 0.42; this.camGoal.dist = this.baseDist * 0.75; this.camGoal.target.set(4.2, 0.9, -2); } else this.setView('build'); }

  /** 开场：镜头从树梢落下，小车从邮局开到小溪边停下 */
  async intro(skip = false) {
    this.busy = true;
    if (skip) { this.placeCart(CART_WAIT_X); this.setView('build'); this.busy = false; return; }
    this.cam.pitch = 1.1; this.cam.dist = this.baseDist * 1.6; this.cam.target.set(-2, 0.4, -2);
    this.setView('intro');
    this.placeCart(CART_HOME_X);
    await this.wait(0.6);
    sfx.honk();
    sfx.engine();
    await this.drive(CART_WAIT_X, 1.4);
    await this.brake();
    this.busy = false;
  }
  private async brake() {
    await this.tween(0.5, k => { this.cart.body.rotation.z = -Math.sin(k * Math.PI) * 0.12; });
    this.cart.body.rotation.z = 0;
  }
  resetCart() { this.placeCart(CART_WAIT_X); this.cart.letter.visible = true; this.setView('build'); }

  /** 试车：动画完全由规则结果驱动 */
  async test(outcome: Outcome, load: 1 | 2) {
    this.busy = true; this.markerOn = 0;
    this.selected = null; this.refreshGhosts();
    for (const p of this.planks.values()) p.group.rotation.z = 0;
    const sag = sagAmount(this.bridge, load);
    const sagFor = (x: number) => (this.bridge.long ? 0.55 * sag * clamp01(1 - (x / 2.65) ** 2) : 0);
    const bend = (x: number) => { const p = this.planks.get('span'); if (p) p.applySag(sagFor(x)); };
    this.setView('follow', -1.5);
    sfx.engine();
    if (outcome.reason === 'gap') {
      await this.drive(-2.88, 1.6);
      await this.brake(); sfx.oops();
      this.dropPebble(-2.25);
      await this.wait(0.7);
    } else if (outcome.reason === 'half') {
      const stop = BRIDGE_START + outcome.reach * (BRIDGE_END - BRIDGE_START);
      await this.drive(stop, 1.5);
      sfx.oops();
      await this.tween(0.8, k => { this.cart.body.rotation.z = -Math.sin(k * Math.PI * 3) * 0.08 * (1 - k); });
      this.cart.look(1);
      await this.wait(0.5);
    } else if (outcome.reason === 'tip') {
      const left = this.planks.get('left')!;
      await this.drive(-1.25, 1.5);
      sfx.creak();
      await this.tween(0.45, k => { left.group.rotation.z = -0.34 * ease(k); this.placeCart(this.cartX + 0.004); });
      this.splash(new THREE.Vector3(0.1, WATER_Y, 0));
      sfx.splash();
      await this.drive(-1.1, 0.6);
      await this.wait(0.6);
      await this.drive(-2.95, 1.2);
      await this.tween(0.6, k => { left.group.rotation.z = -0.34 * (1 - easeOutBack(k)); });
      left.group.rotation.z = 0;
    } else if (outcome.reason === 'sag') {
      const stop = BRIDGE_START + outcome.reach * (BRIDGE_END - BRIDGE_START);
      await this.drive(stop, 1.3, x => { bend(x); });
      sfx.creak();
      // 车轮打滑、木板吱呀下沉
      await this.tween(1.0, k => { this.cart.roll(0.05); bend(this.cartX); const p = this.planks.get('span')!; p.applySag(p.sag + 0.002 * (1 - k)); this.placeCart(this.cartX - 0.002); });
      await this.wait(0.3);
    } else {
      // 成功：过桥 → 开到小兔家 → 送信
      await this.drive(BRIDGE_END + 0.6, 1.7, x => bend(x));
      bend(9); this.setView('deliver');
      void this.flyOwl(new THREE.Vector3(HOME.x - 2.4, 2.4, HOME.z + 2.2), 1.6);
      await this.drive(4.6, 1.9);
      await this.deliver();
      this.busy = false;
      return;
    }
    // 失败后：小车退回原位，木板恢复
    this.cart.look(0);
    await this.drive(CART_WAIT_X, 1.6, x => bend(x));
    bend(9); this.relax();
    this.setView('build');
    this.busy = false;
  }

  private async deliver() {
    const letter = this.cart.letter;
    const start = new THREE.Vector3(); letter.getWorldPosition(start);
    const fly = letter.clone(); this.scene.add(fly); fly.position.copy(start);
    letter.visible = false;
    const end = this.home.mailbox.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    sfx.whoosh();
    await this.tween(0.9, k => {
      fly.position.lerpVectors(start, end, ease(k)); fly.position.y += Math.sin(k * Math.PI) * 1.4;
      fly.rotation.y = k * Math.PI * 2; fly.scale.setScalar(1 - k * 0.6);
    });
    this.scene.remove(fly);
    await this.tween(0.4, k => { this.home.flag.rotation.x = Math.PI / 2 * (1 - easeOutBack(k)); });
    sfx.success();
    for (const f of Object.values(this.friends)) if (f.root.visible) f.celebrate();
    this.owl.cheer();
    this.confetti(end.clone().add(new THREE.Vector3(-0.5, 0.5, 0.5)));
    await this.wait(1.2);
  }
  /** 第三次的派对：三位朋友都来了 */
  async party() {
    this.setRecipient(this.recipient, true);
    this.setView('deliver');
    sfx.success();
    for (const f of Object.values(this.friends)) f.celebrate();
    this.owl.cheer();
    this.confetti(new THREE.Vector3(HOME.x - 1.2, ROAD_Y + 1.6, HOME.z + 2));
    await this.wait(0.5);
    this.confetti(new THREE.Vector3(HOME.x - 2.6, ROAD_Y + 1.8, HOME.z + 2.4));
    await this.wait(1.5);
  }
  /** 回到搭桥视角（成功后重玩或继续调整时） */
  backToBridge() { this.home.flag.rotation.x = Math.PI / 2; this.resetCart(); this.setRecipient(this.recipient); void this.owlHome(); }

  // —— 特效 ——
  private puff(at: THREE.Vector3, color: string) {
    const g = new THREE.Group(); g.position.copy(at); this.scene.add(g);
    const mat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.9, roughness: 1 });
    const parts = Array.from({ length: 8 }, (_, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat); const a = (i / 8) * Math.PI * 2; m.userData.v = new THREE.Vector3(Math.cos(a), 0.4, Math.sin(a)); g.add(m); return m; });
    this.effects.push({ obj: g, life: 0, max: 0.6, tick: k => { parts.forEach(p => { p.position.copy((p.userData.v as THREE.Vector3).clone().multiplyScalar(ease(k) * 1.0)); p.scale.setScalar(1 + k); }); mat.opacity = 0.9 * (1 - k); } });
  }
  private splash(at: THREE.Vector3) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.32, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(at).setY(WATER_Y + 0.03); this.scene.add(ring);
    this.effects.push({ obj: ring, life: 0, max: 0.9, tick: k => { ring.scale.setScalar(1 + k * 4); (ring.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k); } });
    const drops = new THREE.Group(); drops.position.copy(at).setY(WATER_Y); this.scene.add(drops);
    const dmat = new THREE.MeshStandardMaterial({ color: '#dff7f3', transparent: true, roughness: 0.2 });
    const ds = Array.from({ length: 12 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), dmat); m.userData.v = new THREE.Vector3((Math.random() - 0.5) * 2.2, 2.5 + Math.random() * 1.5, (Math.random() - 0.5) * 2.2); drops.add(m); return m; });
    this.effects.push({ obj: drops, life: 0, max: 0.8, tick: (k, dt) => { ds.forEach(d => { const v = d.userData.v as THREE.Vector3; v.y -= 9 * dt; d.position.addScaledVector(v, dt); }); dmat.opacity = 1 - k; } });
  }
  private dropPebble(x: number) {
    const p = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1, 0), new THREE.MeshStandardMaterial({ color: PALETTE.stone }));
    p.position.set(x, ROAD_Y, 0.2); this.scene.add(p);
    let v = 0;
    this.effects.push({ obj: p, life: 0, max: 0.6, tick: (_k, dt) => { v -= 12 * dt; p.position.y += v * dt; p.position.x += dt * 0.6; if (p.position.y < WATER_Y && p.visible) { p.visible = false; this.splash(p.position.clone()); sfx.splash(); } } });
  }
  private confetti(at: THREE.Vector3) {
    const g = new THREE.Group(); g.position.copy(at); this.scene.add(g);
    const colors = ['#ffcf4a', '#ee5a4f', '#3d5fc4', '#7dba5a', '#ff9fb2', '#ffffff'];
    const geo = new THREE.PlaneGeometry(0.16, 0.1);
    const ps = Array.from({ length: 90 }, (_, i) => {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide, transparent: true }));
      m.userData.v = new THREE.Vector3((Math.random() - 0.5) * 5, 4 + Math.random() * 4, (Math.random() - 0.5) * 4);
      m.userData.s = new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8);
      g.add(m); return m;
    });
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#fff2b0', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(3); g.add(glow);
    this.effects.push({ obj: g, life: 0, max: 2.6, tick: (k, dt) => {
      ps.forEach(p => { const v = p.userData.v as THREE.Vector3, s = p.userData.s as THREE.Vector3; v.y -= 7 * dt; v.multiplyScalar(0.985); p.position.addScaledVector(v, dt); p.rotation.x += s.x * dt; p.rotation.y += s.y * dt; (p.material as THREE.MeshBasicMaterial).opacity = 1 - Math.max(0, k - 0.7) / 0.3; });
      glow.material.opacity = Math.max(0, 1 - k * 3); glow.scale.setScalar(3 + k * 6);
    } });
  }
  /** 当前小诺在屏幕上的位置（界面层用来放对话气泡） */
  owlScreen() {
    const p = this.owl.root.position.clone().add(new THREE.Vector3(0, 0.5, 0)).project(this.camera);
    return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 };
  }
}
