import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createRabbit, createOwl } from '../scene/characters';
import { clamp01, clay, ease, easeOutBack, glowTexture, gradientColors, mesh, rng } from '../scene/util';
import { sfx } from '../audio';

// 游戏 · 帮小兔子摘花：阳光下的小花园，前面一片花丛，后面是小兔子和她的篮子。
// 摘一朵，花就飞进篮子，篮子上方跳出这是第几朵。

type Tween = { t: number; dur: number; update: (k: number) => void; resolve: () => void };
export type FlowerEvents = { onFlower: (i: number) => void; onBasket: () => void; onBasketFlower: (i: number) => void };

const PETALS = ['#ff6b8a', '#ffcf4a', '#b48cff', '#ff8f4a', '#ffffff', '#5fb8ff'];
const N_PATCH = 12;
const BASKET = new THREE.Vector3(0.9, 0.55, -0.9);

type Flower = { g: THREE.Group; head: THREE.Group; home: THREE.Vector3; picked: boolean; color: string };

function makeFlower(color: string, seed: number) {
  const g = new THREE.Group();
  const r = rng(seed);
  const h = 0.75 + r() * 0.3;
  mesh(new THREE.CylinderGeometry(0.035, 0.045, h, 8).translate(0, h / 2, 0), clay('#4f9a45'), g);
  const leaf = mesh(new THREE.SphereGeometry(0.12, 10, 8), clay('#6cbf55'), g); leaf.scale.set(1.6, 0.35, 0.8); leaf.position.set(0.1, h * 0.4, 0); leaf.rotation.z = 0.5;
  const head = new THREE.Group(); head.position.y = h; g.add(head);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const p = mesh(new THREE.SphereGeometry(0.13, 12, 10), clay(color, 0.6), head); p.scale.set(1, 0.45, 0.7);
    p.position.set(Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15); p.rotation.y = -a;
  }
  mesh(new THREE.SphereGeometry(0.09, 12, 10), clay('#ffd23f', 0.5), head).position.y = 0.04;
  head.rotation.x = 0.5;                       // 花朝着孩子
  return { g, head };
}

/** 画一个大数字（可以带“朵”） */
function numberTexture(text: string) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d')!;
  g.font = '700 170px "PingFang SC","Hiragino Sans GB",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 22; g.strokeStyle = '#ffffff'; g.lineJoin = 'round'; g.strokeText(text, 128, 138);
  g.fillStyle = '#ee5a4f'; g.fillText(text, 128, 138);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class FlowerScene {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  private clock = new THREE.Clock();
  private tweens: Tween[] = [];
  private effects = new Set<(dt: number) => void>();
  private raf = 0; private disposed = false;
  private patch: Flower[] = [];
  private basket: Flower[] = [];               // 篮子里的花（按放进去的顺序）
  private basketMesh!: THREE.Group;
  private rabbit = createRabbit();
  private owl = createOwl();
  private ray = new THREE.Raycaster(); private ptr = new THREE.Vector2();
  private camDist = 10;
  busy = false;

  constructor(private host: HTMLElement, private events: FlowerEvents) {
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.domElement.className = 'scene-canvas';
    host.appendChild(r.domElement);
    this.build();
    r.domElement.addEventListener('pointerup', this.onUp);
    this.ro.observe(host);
    this.resize();
    this.loop();
    if (import.meta.env.DEV) (window as unknown as { __flowers: FlowerScene }).__flowers = this;
  }
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf); this.ro.disconnect();
    this.renderer.dispose(); this.renderer.domElement.remove();
  }

  // ===================== 花园 =====================
  private build() {
    const s = this.scene;
    s.background = new THREE.Color('#bfe6f7');
    s.fog = new THREE.Fog('#bfe6f7', 18, 40);
    s.add(new THREE.HemisphereLight('#eaf6ff', '#7aa34e', 1.4));
    const sun = new THREE.DirectionalLight('#fff0cf', 2.4); sun.position.set(-5, 9, 6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; s.add(sun);
    // 草地
    const ground = mesh(new THREE.CircleGeometry(30, 48), clay('#9fd36a', 0.95), s); ground.rotation.x = -Math.PI / 2; ground.castShadow = false;
    const soil = mesh(new THREE.CircleGeometry(4.6, 40), clay('#a8774d', 0.95), s, false); soil.rotation.x = -Math.PI / 2; soil.position.set(-0.6, 0.01, 1.6); soil.scale.set(1.25, 0.55, 1);
    // 后面的小树和栅栏
    const rr = rng(7);
    for (let i = 0; i < 7; i++) {
      const t = new THREE.Group(); t.position.set(-9 + i * 3 + rr() * 0.8, 0, -6 - rr() * 2); s.add(t);
      mesh(new THREE.CylinderGeometry(0.15, 0.22, 1.6, 8).translate(0, 0.8, 0), clay('#8a5b3c'), t);
      const crown = mesh(gradientColors(new THREE.IcosahedronGeometry(1.1 + rr() * 0.4, 2), '#4f9a45', '#a6d26a', -1, 1.2), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), t); crown.position.y = 2.2;
    }
    for (let i = 0; i < 14; i++) { const post = mesh(new RoundedBoxGeometry(0.16, 0.8, 0.1, 2, 0.04), clay('#f3e3c6'), s); post.position.set(-6.5 + i, 0.4, -3.6); }
    const rail = mesh(new RoundedBoxGeometry(14, 0.1, 0.06, 2, 0.03), clay('#f3e3c6'), s); rail.position.set(0, 0.6, -3.62);
    // 小兔子和篮子
    this.rabbit.root.position.set(-0.4, 0, -1.4); this.rabbit.root.scale.setScalar(2.3); this.rabbit.root.rotation.y = 0.15; s.add(this.rabbit.root);
    this.basketMesh = new THREE.Group(); this.basketMesh.position.set(BASKET.x, 0, BASKET.z); s.add(this.basketMesh);
    const weave = clay('#c98f55', 0.9);
    const bowl = mesh(new THREE.CylinderGeometry(0.75, 0.55, 0.55, 28, 1, true), weave, this.basketMesh); bowl.position.y = 0.3;
    (bowl.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    mesh(new THREE.CircleGeometry(0.55, 24), weave, this.basketMesh).rotation.x = -Math.PI / 2;
    mesh(new THREE.TorusGeometry(0.75, 0.06, 8, 28), clay('#a8703c'), this.basketMesh).rotation.x = Math.PI / 2;
    this.basketMesh.children[this.basketMesh.children.length - 1].position.y = 0.57;
    const handle = mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 24, Math.PI), clay('#a8703c'), this.basketMesh); handle.position.y = 0.57;
    const bhit = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 1.6, 12), new THREE.MeshBasicMaterial({ visible: false })); bhit.position.y = 0.6; bhit.name = 'basket'; this.basketMesh.add(bhit);
    // 小诺在旁边的树桩上
    const stump = mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.6, 14), clay('#9a6a43'), s); stump.position.set(3.6, 0.3, -0.6);
    this.owl.root.position.set(3.6, 0.6, -0.6); this.owl.root.rotation.y = -0.7; s.add(this.owl.root);
    // 花丛：12 朵花，摆在前面的土地上
    for (let i = 0; i < N_PATCH; i++) {
      const row = i % 2, col = Math.floor(i / 2);
      const home = new THREE.Vector3(-4.1 + col * 1.15 + row * 0.55, 0, 0.9 + row * 1.15 + (col % 2) * 0.15);
      const color = PETALS[i % PETALS.length];
      const { g, head } = makeFlower(color, i + 3);
      g.position.copy(home); s.add(g);
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.copy(head.position); hit.name = `flower:${i}`; g.add(hit);
      this.patch.push({ g, head, home, picked: false, color });
    }
  }

  // ===================== 篮子里的位置 =====================
  private basketSlot(k: number) {
    // 一圈 6 个，中间再叠一层
    const ring = k < 6, a = ((ring ? k : k - 6) / (ring ? 6 : 4)) * Math.PI * 2 + (ring ? 0 : 0.4);
    const rad = ring ? 0.45 : 0.22;
    return new THREE.Vector3(BASKET.x + Math.cos(a) * rad, ring ? 0.62 : 0.78, BASKET.z + Math.sin(a) * rad);
  }
  /** 一朵只有花头的花，放在篮子里 */
  private basketFlower(color: string, k: number) {
    const { g, head } = makeFlower(color, 50 + k);
    g.children.slice(0, 2).forEach(c => { c.visible = false; });   // 不要茎和叶子
    head.position.set(0, 0, 0); head.rotation.x = 0.7;
    g.position.copy(this.basketSlot(k));
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshBasicMaterial({ visible: false })); hit.name = `bf:${k}`; g.add(hit);
    this.scene.add(g);
    return { g, head, home: g.position.clone(), picked: true, color };
  }

  // ===================== 对外的动作 =====================
  get basketCount() { return this.basket.length; }
  /** 花丛全部重新长出来，篮子清空 */
  async regrow() {
    for (const b of this.basket) this.scene.remove(b.g);
    this.basket = [];
    await Promise.all(this.patch.map((f, i) => {
      f.picked = false; f.g.visible = true; f.g.position.copy(f.home); f.g.scale.setScalar(0.01);
      return new Promise<void>(res => setTimeout(() => this.tween(0.5, k => f.g.scale.setScalar(Math.max(0.01, easeOutBack(k)))).then(res), i * 40));
    }));
  }
  /** 篮子里直接放好 n 朵（“有几朵”那一轮） */
  fillBasket(n: number) {
    for (const b of this.basket) this.scene.remove(b.g);
    this.basket = [];
    // 摆在土地上排成一排，大一点、隔开一点，方便小手指一朵一朵点着数
    for (let k = 0; k < n; k++) {
      const f = this.basketFlower(PETALS[(k * 2) % PETALS.length], k);
      f.g.position.set(-0.4 + (k - (n - 1) / 2) * 1.15, 0.45, 1.5 + (k % 2) * 0.35);
      const big = 1.7; f.g.scale.setScalar(0.01); this.basket.push(f);
      setTimeout(() => this.tween(0.4, e => f.g.scale.setScalar(Math.max(0.01, easeOutBack(e) * big))), k * 120);
    }
    for (const f of this.patch) { f.picked = true; f.g.visible = false; }
  }
  /** 摘一朵：从花丛飞进篮子 */
  async pick(i: number) {
    const f = this.patch[i]; if (f.picked) return;
    f.picked = true; sfx.pick();
    const k = this.basket.length, to = this.basketSlot(k);
    const from = f.head.getWorldPosition(new THREE.Vector3());
    const bf = this.basketFlower(f.color, k); bf.g.position.copy(from); this.basket.push(bf);
    f.g.visible = false;
    await this.tween(0.55, e => {
      bf.g.position.lerpVectors(from, to, ease(e)); bf.g.position.y += Math.sin(e * Math.PI) * 1.4;
      bf.g.rotation.y = e * Math.PI * 2;
    });
    sfx.place();
    this.squash(this.basketMesh);
    this.popNumber(String(this.basket.length), to);
  }
  /** 放回一朵：篮子里最后一朵回到花丛 */
  async putBack() {
    const bf = this.basket.pop(); if (!bf) return;
    const slot = this.patch.find(f => f.picked && f.color === bf.color) ?? this.patch.find(f => f.picked);
    const from = bf.g.position.clone(), to = slot ? slot.head.getWorldPosition(new THREE.Vector3()) : from;
    sfx.remove();
    await this.tween(0.5, e => { bf.g.position.lerpVectors(from, to, ease(e)); bf.g.position.y += Math.sin(e * Math.PI) * 1.2; });
    this.scene.remove(bf.g);
    if (slot) { slot.picked = false; slot.g.visible = true; }
  }
  /** 数篮子里的花：点到的那朵跳一下，头上冒出数字 */
  countTap(k: number, n: number) {
    const b = this.basket[k]; if (!b) return;
    sfx.tap(); this.squash(b.g);
    this.popNumber(String(n), b.g.position.clone().add(new THREE.Vector3(0, 0.2, 0)), 0.8);
  }
  celebrate() {
    this.rabbit.celebrate(); this.owl.cheer(); sfx.success();
    const tex = glowTexture();
    const g = new THREE.Group(); g.position.set(BASKET.x, 1.2, BASKET.z); this.scene.add(g);
    const ps = Array.from({ length: 26 }, (_, i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: PETALS[i % PETALS.length], transparent: true, depthWrite: false })); s.scale.setScalar(0.3); s.userData.v = new THREE.Vector3((Math.random() - 0.5) * 4, 3 + Math.random() * 2.5, (Math.random() - 0.5) * 3); g.add(s); return s; });
    let life = 0;
    const tick = (dt: number) => { life += dt; ps.forEach(p => { const v = p.userData.v as THREE.Vector3; v.y -= 6 * dt; p.position.addScaledVector(v, dt); p.material.opacity = Math.max(0, 1 - life / 1.6); }); if (life > 1.6) { this.scene.remove(g); this.effects.delete(tick); } };
    this.effects.add(tick);
  }
  /** 兔子摇摇头（太多了 / 不对） */
  shake() { const r = this.rabbit.root; const y0 = r.rotation.y; sfx.oops(); void this.tween(0.6, k => { r.rotation.y = y0 + Math.sin(k * Math.PI * 4) * 0.25 * (1 - k); }); }

  private squash(o: THREE.Object3D) { const s0 = o.scale.x; void this.tween(0.3, k => { const s = 1 + Math.sin(k * Math.PI) * 0.18; o.scale.set(s0 * s, s0 / s, s0 * s); }); }
  private popNumber(text: string, at: THREE.Vector3, size = 1.2) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: numberTexture(text), transparent: true, depthTest: false }));
    sp.position.copy(at).add(new THREE.Vector3(0, 0.9, 0)); sp.renderOrder = 10; this.scene.add(sp);
    const y0 = sp.position.y;
    void this.tween(1.1, k => { sp.scale.setScalar(size * (k < 0.25 ? easeOutBack(k / 0.25) : 1)); sp.position.y = y0 + k * 0.6; sp.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3; }).then(() => this.scene.remove(sp));
  }
  private tween(dur: number, update: (k: number) => void) { return new Promise<void>(resolve => this.tweens.push({ t: 0, dur, update, resolve })); }

  // ===================== 指针、镜头、循环 =====================
  private ro = new ResizeObserver(() => this.resize());
  private resize = () => {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.camDist = THREE.MathUtils.clamp(5.2 / (tan * this.camera.aspect), 8.5, 18);
  };
  private onUp = (e: PointerEvent) => {
    if (this.busy) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ptr.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.ptr, this.camera);
    const targets: THREE.Object3D[] = [];
    this.scene.traverse(o => { if (o.name && (o.name.startsWith('flower:') || o.name.startsWith('bf:') || o.name === 'basket') && o.parent?.visible !== false) targets.push(o); });
    const hits = this.ray.intersectObjects(targets, false).filter(h => { let o: THREE.Object3D | null = h.object; while (o) { if (!o.visible) return false; o = o.parent; } return true; });
    // 篮子里的单朵花优先于整个篮子
    const hit = hits.find(h => h.object.name.startsWith('bf:')) ?? hits[0];
    if (!hit) return;
    const n = hit.object.name;
    if (n.startsWith('flower:')) this.events.onFlower(Number(n.slice(7)));
    else if (n.startsWith('bf:')) this.events.onBasketFlower(Number(n.slice(3)));
    else this.events.onBasket();
  };
  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const raw = Math.min(this.clock.getDelta(), 1), dt = Math.min(raw, 0.05), t = this.clock.elapsedTime;
    for (const tw of [...this.tweens]) { tw.t += raw; const k = clamp01(tw.t / tw.dur); tw.update(k); if (k >= 1) { this.tweens.splice(this.tweens.indexOf(tw), 1); tw.resolve(); } }
    for (const f of [...this.effects]) f(dt);
    // 花在风里轻轻摇
    this.patch.forEach((f, i) => { f.g.rotation.z = Math.sin(t * 1.6 + i) * 0.06; });
    this.rabbit.update(t, dt);
    this.owl.update(t, dt); this.owl.lookAt(-0.5, 0);
    this.camera.position.set(0, this.camDist * 0.55, 2 + this.camDist * 0.85);
    this.camera.lookAt(-0.2, 0.4, 0.2);
    this.renderer.render(this.scene, this.camera);
  };
}
