import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { ALL_PARTS, FLAG_DISTANCE, type CarPartId, type RampLevel, type RampResult } from '../../shared/modules/car';
import { createOwl } from '../scene/characters';
import { PALETTE, clamp01, ease, easeOutBack, glowTexture, lerp, rng, woodTexture } from '../scene/util';
import { sfx } from '../audio';

// 探索工作台：树屋里的一张木桌。所有模块都在这张桌子上进行（这里先放第一个模块：拼装小车）。
// 坐标：桌面 y=0，镜头在前方（+z）俯看；房间的后墙在 -z。

type Tween = { t: number; dur: number; update: (k: number) => void; resolve: () => void };
type PartView = { id: CarPartId; node: THREE.Object3D; home: THREE.Vector3; away: THREE.Vector3; meshes: THREE.Mesh[] };
export type BenchEvents = { onPartTap: (id: CarPartId) => void };

const MAT_W = 6.4, MAT_D = 3.4;
const CAR_YAW = -0.55;                         // 小车在垫子上斜着放，脸朝向孩子
const RAMP_BOTTOM_X = -1.6, BLOCK_H = 0.3;
// 拆开后零件摆放的位置（车的局部坐标，只给 x、z；高度按零件自身大小算，让它“躺”在垫子上）
const AWAY: Record<CarPartId, [number, number]> = {
  AxleFront: [0.7, 1.3], AxleRear: [-0.7, 1.3],
  WheelFL: [1.75, 0.75], WheelFR: [1.75, -0.75], WheelRL: [-1.75, 0.75], WheelRR: [-1.75, -0.75],
  Motor: [-0.65, -1.25], Battery: [0.6, -1.25], Shell: [-2.6, 0.1], Roof: [2.3, -1.2]
};

export class BenchScene {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
  private clock = new THREE.Clock();
  private tweens: Tween[] = [];
  private raf = 0; private disposed = false;
  private car = new THREE.Group();
  private chassis: THREE.Object3D | null = null;
  private parts = new Map<CarPartId, PartView>();
  private hits: { id: CarPartId; obj: THREE.Object3D }[] = [];
  private wheels: CarPartId[] = ['WheelFL', 'WheelFR', 'WheelRL', 'WheelRR'];
  private owl = createOwl();
  private ramp = new THREE.Group();
  private rampBoard!: THREE.Mesh;
  private blocks: THREE.Mesh[] = [];
  private flag = new THREE.Group();
  private glowIds = new Set<CarPartId>();
  private inspecting: CarPartId | null = null;
  private ray = new THREE.Raycaster(); private ptr = new THREE.Vector2();
  private cam = { yaw: 0, pitch: 0.62, dist: 9, target: new THREE.Vector3(0, 0.2, 0.1) };
  private camGoal = { yaw: 0, pitch: 0.62, dist: 9, target: new THREE.Vector3(0, 0.2, 0.1) };
  private baseDist = 9;
  private drag: { x: number; y: number; yaw: number; moved: boolean } | null = null;
  busy = false;
  ready: Promise<void>;

  constructor(private host: HTMLElement, private events: BenchEvents) {
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
    r.domElement.className = 'scene-canvas';
    host.appendChild(r.domElement);
    this.buildRoom();
    this.buildRamp();
    this.scene.add(this.car);
    this.owl.root.position.set(3.35, 0.5, 0.9); this.owl.root.rotation.y = -0.5; this.owl.root.scale.setScalar(1.25);
    this.scene.add(this.owl.root);
    r.domElement.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    this.ro.observe(this.host);                  // 容器从隐藏变成显示时也要重新算尺寸
    this.resize();
    this.ready = this.loadCar();
    this.loop();
    if (import.meta.env.DEV) (window as unknown as { __bench: BenchScene }).__bench = this;
  }
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf);
    window.removeEventListener('pointermove', this.onMove); window.removeEventListener('pointerup', this.onUp); this.ro.disconnect();
    this.renderer.dispose(); this.renderer.domElement.remove();
  }

  // ===================== 房间 =====================
  private buildRoom() {
    const s = this.scene;
    s.background = new THREE.Color('#f3dfc0');
    s.fog = new THREE.Fog('#f3dfc0', 16, 34);
    s.add(new THREE.HemisphereLight('#fff3df', '#8a6a4a', 1.15));
    // 窗外的阳光，从后左方斜照进来，在桌上投出柔和的影子
    const sun = new THREE.DirectionalLight('#ffe2b5', 2.4);
    sun.position.set(-5, 9, -4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 6, bottom: -6, near: 1, far: 30 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 5;
    s.add(sun);
    const fill = new THREE.DirectionalLight('#dfe9ff', 0.55); fill.position.set(6, 5, 8); s.add(fill);

    const wood = woodTexture('#c98f55', '#8a5527'); wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
    const plank = (color: string) => new THREE.MeshStandardMaterial({ map: wood, color, roughness: 0.85 });
    // 地板与墙
    const floorTex = wood.clone(); floorTex.repeat.set(6, 10); floorTex.needsUpdate = true;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: floorTex, color: '#d9a46a', roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -3; floor.receiveShadow = true; s.add(floor);
    const wallTex = wood.clone(); wallTex.repeat.set(1, 14); wallTex.rotation = Math.PI / 2; wallTex.needsUpdate = true;
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), new THREE.MeshStandardMaterial({ map: wallTex, color: '#e7b98a', roughness: 0.9 }));
    wall.position.set(0, 4, -3.6); wall.receiveShadow = true; s.add(wall);
    // 圆窗：窗外是森林（画在画布上）
    const win = document.createElement('canvas'); win.width = win.height = 512;
    const g = win.getContext('2d')!;
    const sky = g.createLinearGradient(0, 0, 0, 512); sky.addColorStop(0, '#8fcbea'); sky.addColorStop(0.7, '#ffe0b5'); sky.addColorStop(1, '#ffd29a');
    g.fillStyle = sky; g.fillRect(0, 0, 512, 512);
    const rr = rng(4);
    for (let layer = 0; layer < 3; layer++) {
      g.fillStyle = ['#a9d18e', '#7dba5a', '#4f8a52'][layer];
      for (let i = 0; i < 9; i++) { const x = rr() * 512, y = 300 + layer * 60 + rr() * 30, rad = 60 + rr() * 50; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill(); }
    }
    g.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(90 + i * 160, 90 + (i % 2) * 40, 50, 18, 0, 0, Math.PI * 2); g.fill(); }
    const winTex = new THREE.CanvasTexture(win); winTex.colorSpace = THREE.SRGBColorSpace;
    const pane = new THREE.Mesh(new THREE.CircleGeometry(1.7, 48), new THREE.MeshBasicMaterial({ map: winTex }));
    pane.position.set(2.2, 3.3, -3.58); s.add(pane);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.16, 12, 48), plank('#b97a33')); frame.position.copy(pane.position); s.add(frame);
    for (const rot of [0, Math.PI / 2]) { const bar = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 0.08), plank('#b97a33')); bar.position.copy(pane.position); bar.rotation.z = rot; s.add(bar); }
    // 工具架：放已经过关的“收藏品”
    const shelf = new THREE.Mesh(new RoundedBoxGeometry(4.2, 0.14, 0.7, 2, 0.04), plank('#c98f55'));
    shelf.position.set(-3.2, 2.6, -3.25); shelf.castShadow = shelf.receiveShadow = true; s.add(shelf);
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.55, 20), new THREE.MeshStandardMaterial({ color: '#bfe6f2', roughness: 0.15, transparent: true, opacity: 0.7 }));
    jar.position.set(-4.6, 2.95, -3.2); s.add(jar);
    for (let i = 0; i < 4; i++) { const book = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.7 - i * 0.06, 0.5, 2, 0.03), new THREE.MeshStandardMaterial({ color: ['#ee5a4f', '#3d5fc4', '#ffcf4a', '#7dba5a'][i] })); book.position.set(-3.9 + i * 0.18, 2.67 + (0.7 - i * 0.06) / 2, -3.2); book.castShadow = true; s.add(book); }
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.3, 16), new THREE.MeshStandardMaterial({ color: '#d9824a' })); pot.position.set(-1.6, 2.82, -3.2); s.add(pot);
    for (let i = 0; i < 5; i++) { const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshStandardMaterial({ color: '#5f9a48' })); leaf.scale.set(0.6, 1.2, 0.6); leaf.position.set(-1.6 + Math.cos(i * 1.3) * 0.12, 3.12 + (i % 2) * 0.1, -3.2 + Math.sin(i * 1.3) * 0.12); leaf.rotation.z = Math.cos(i * 1.3) * 0.5; s.add(leaf); }
    // 大木桌
    const top = new THREE.Mesh(new RoundedBoxGeometry(9, 0.32, 5, 3, 0.1), plank('#e0a463'));
    top.position.set(0, -0.16, 0); top.receiveShadow = true; top.castShadow = true; s.add(top);
    for (const x of [-4.1, 4.1]) for (const z of [-2.1, 2.1]) {
      const leg = new THREE.Mesh(new RoundedBoxGeometry(0.4, 2.7, 0.4, 2, 0.08), plank('#c98f55'));
      leg.position.set(x, -1.65, z); leg.castShadow = true; s.add(leg);
    }
    // 绿色工作垫（带格子），所有模块都在这块垫子上进行
    const mc = document.createElement('canvas'); mc.width = 640; mc.height = 340;
    const mg = mc.getContext('2d')!;
    mg.fillStyle = '#7fc27a'; mg.fillRect(0, 0, 640, 340);
    mg.strokeStyle = 'rgba(255,255,255,.35)'; mg.lineWidth = 2;
    for (let x = 0; x <= 640; x += 40) { mg.beginPath(); mg.moveTo(x, 0); mg.lineTo(x, 340); mg.stroke(); }
    for (let y = 0; y <= 340; y += 40) { mg.beginPath(); mg.moveTo(0, y); mg.lineTo(640, y); mg.stroke(); }
    mg.strokeStyle = 'rgba(255,255,255,.7)'; mg.lineWidth = 6; mg.strokeRect(10, 10, 620, 320);
    const matTex = new THREE.CanvasTexture(mc); matTex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.Mesh(new RoundedBoxGeometry(MAT_W, 0.03, MAT_D, 2, 0.012), new THREE.MeshStandardMaterial({ map: matTex, roughness: 0.95 }));
    mat.position.y = 0.012; mat.receiveShadow = true; s.add(mat);
    // 台灯：暖光
    const lamp = new THREE.Group(); lamp.position.set(-3.7, 0, -1.6); s.add(lamp);
    const lm = new THREE.MeshStandardMaterial({ color: '#3d5fc4', roughness: 0.5 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.12, 24), lm); base.position.y = 0.06; lamp.add(base);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 10), lm); arm.position.set(0.25, 0.95, 0); arm.rotation.z = -0.28; lamp.add(arm);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.5, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#ffcf4a', side: THREE.DoubleSide, roughness: 0.5 })); shade.position.set(0.55, 1.75, 0.15); shade.rotation.set(0.3, 0, -0.9); lamp.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), new THREE.MeshBasicMaterial({ color: '#fff3c4' })); bulb.position.set(0.7, 1.62, 0.18); lamp.add(bulb);
    const light = new THREE.PointLight('#ffc77a', 6, 7, 1.6); light.position.copy(bulb.position); lamp.add(light);
    for (const o of [base, arm, shade]) o.castShadow = true;
    // 桌上的小摆设
    const pencils = new THREE.Group(); pencils.position.set(3.7, 0, -1.7); s.add(pencils);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.6, 20, 1, true), new THREE.MeshStandardMaterial({ color: '#ff8fb1', side: THREE.DoubleSide })); cup.position.y = 0.3; pencils.add(cup);
    ['#ee5a4f', '#3d5fc4', '#7dba5a'].forEach((c, i) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6), new THREE.MeshStandardMaterial({ color: c })); p.position.set(-0.1 + i * 0.1, 0.55, (i - 1) * 0.08); p.rotation.z = (i - 1) * 0.15; pencils.add(p); });
  }

  // ===================== 斜坡实验道具 =====================
  private buildRamp() {
    const s = this.scene;
    this.ramp.visible = false; s.add(this.ramp);
    const wood = woodTexture('#e8b066', '#9a6224');
    this.rampBoard = new THREE.Mesh(new RoundedBoxGeometry(2.1, 0.08, 1.3, 2, 0.03), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.8 }));
    this.rampBoard.castShadow = this.rampBoard.receiveShadow = true; this.ramp.add(this.rampBoard);
    const colors = ['#ee5a4f', '#ffcf4a', '#3d5fc4'];
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new RoundedBoxGeometry(0.5, BLOCK_H - 0.02, 0.9, 2, 0.05), new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.6 }));
      b.position.set(RAMP_BOTTOM_X - 1.95, BLOCK_H * (i + 0.5), 0); b.castShadow = true; this.blocks.push(b); this.ramp.add(b);
    }
    // 卷尺：从坡底量过去，孩子能看到“冲了多远”
    const tc = document.createElement('canvas'); tc.width = 1024; tc.height = 64;
    const tg = tc.getContext('2d')!; tg.fillStyle = '#ffd45c'; tg.fillRect(0, 0, 1024, 64); tg.fillStyle = '#2a3a33';
    for (let i = 0; i <= 40; i++) { const x = i * 1024 / 40; tg.fillRect(x, 0, 3, i % 10 === 0 ? 40 : 20); }
    const tapeTex = new THREE.CanvasTexture(tc); tapeTex.colorSpace = THREE.SRGBColorSpace;
    const tape = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.22), new THREE.MeshStandardMaterial({ map: tapeTex, roughness: 0.6 }));
    tape.rotation.x = -Math.PI / 2; tape.position.set(RAMP_BOTTOM_X + 2, 0.03, 0.95); this.ramp.add(tape);
    // 终点小旗子
    this.flag.position.set(RAMP_BOTTOM_X + FLAG_DISTANCE, 0, -0.85); this.ramp.add(this.flag);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8), new THREE.MeshStandardMaterial({ color: PALETTE.woodDark })); pole.position.y = 0.6; this.flag.add(pole);
    const tri = new THREE.Shape(); tri.moveTo(0, 0); tri.lineTo(0.55, -0.18); tri.lineTo(0, -0.36); tri.closePath();
    const cloth = new THREE.Mesh(new THREE.ShapeGeometry(tri), new THREE.MeshStandardMaterial({ color: PALETTE.cherry, side: THREE.DoubleSide })); cloth.position.set(0.03, 1.18, 0); this.flag.add(cloth);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 2.2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 }));
    line.rotation.x = -Math.PI / 2; line.position.set(0, 0.035, 0.85); this.flag.add(line);
    this.setRampLevel(1);
  }
  setRampLevel(level: RampLevel) {
    const h = level * BLOCK_H;
    this.blocks.forEach((b, i) => (b.visible = i < level));
    const top = new THREE.Vector3(RAMP_BOTTOM_X - 1.95, h + 0.04, 0), bottom = new THREE.Vector3(RAMP_BOTTOM_X, 0.04, 0);
    this.rampBoard.position.copy(top).lerp(bottom, 0.5);
    this.rampBoard.rotation.z = -Math.atan2(h, top.distanceTo(new THREE.Vector3(bottom.x, top.y, 0)));
    this.rampTop = top; this.rampLevel = level;
  }
  private rampTop = new THREE.Vector3(); private rampLevel: RampLevel = 1;
  showRamp(on: boolean) {
    this.ramp.visible = on;
    if (on) { this.ramp.scale.setScalar(0.01); void this.tween(0.5, k => this.ramp.scale.setScalar(Math.max(0.01, easeOutBack(k)))); this.setView('ramp'); }
    else this.setView('bench');
  }

  // ===================== 小车 =====================
  private async loadCar() {
    const gltf = await new GLTFLoader().loadAsync('/models/toy_car.glb');
    const root = gltf.scene;
    this.chassis = root.getObjectByName('Chassis') ?? null;
    root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = m.receiveShadow = true; } });
    if (this.chassis) this.car.add(this.chassis);
    for (const id of ALL_PARTS) {
      const node = root.getObjectByName(id);
      if (!node) throw new Error(`toy_car.glb 缺少零件 ${id}`);
      const meshes: THREE.Mesh[] = [];
      node.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.material = (m.material as THREE.Material).clone(); meshes.push(m); } });
      this.car.add(node);
      const home = node.position.clone();
      // 拆开后的位置：让零件的最低点正好贴着垫子
      const box = new THREE.Box3().setFromObject(node);
      const lift = node.position.y - box.min.y;
      const away = new THREE.Vector3(AWAY[id][0], lift + 0.02, AWAY[id][1]);
      // 放大的透明点击区：细小的零件（车轴）也容易点中
      const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3()).sub(node.position);
      const hit = new THREE.Mesh(new THREE.BoxGeometry(Math.max(size.x, 0.5) + 0.25, Math.max(size.y, 0.4) + 0.25, Math.max(size.z, 0.5) + 0.25), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.copy(center); node.add(hit);
      this.hits.push({ id, obj: hit });
      this.parts.set(id, { id, node, home, away, meshes });
    }
    this.car.position.y = 0.06;
    this.car.rotation.y = CAR_YAW;
  }

  /** 按存档摆放零件（不播动画） */
  setInstalled(installed: Set<CarPartId>) {
    for (const p of this.parts.values()) { p.node.position.copy(installed.has(p.id) ? p.home : p.away); p.node.rotation.set(0, 0, 0); }
  }
  /** 一下全拆开：零件依次飞出去 */
  async explode() {
    this.busy = true; sfx.whoosh();
    const list = [...this.parts.values()];
    await Promise.all(list.map((p, i) => this.wait(i * 0.06).then(() => this.fly(p, p.away, 0.7))));
    this.busy = false;
  }
  /** 装上一个零件：沿弧线飞回原位，落下时“咔哒” */
  async install(id: CarPartId) {
    const p = this.parts.get(id)!; this.busy = true;
    await this.fly(p, p.home, 0.55);
    sfx.place(); this.pop(p.node);
    this.busy = false;
  }
  /** 装不上：零件抖一抖，同时让缺少的零件发光 */
  async reject(id: CarPartId, missing: CarPartId[]) {
    const p = this.parts.get(id)!; sfx.deny();
    this.glowIds = new Set(missing);
    const x0 = p.node.position.x;
    await this.tween(0.45, k => { p.node.position.x = x0 + Math.sin(k * Math.PI * 6) * 0.08 * (1 - k); });
    p.node.position.x = x0;
  }
  clearGlow() { this.glowIds.clear(); }
  /** 认识一个零件：飞到镜头前转一圈，再回去 */
  async inspect(id: CarPartId) {
    if (this.inspecting) return;
    const p = this.parts.get(id)!; this.inspecting = id; this.busy = true;
    const back = p.node.position.clone();
    const front = new THREE.Vector3(0, 1.4, 1.6);
    await this.fly(p, front, 0.45, 0.4);
    await this.tween(1.6, k => { p.node.rotation.y = k * Math.PI * 2; p.node.position.y = front.y + Math.sin(k * Math.PI * 2) * 0.06; });
    p.node.rotation.y = 0;
    await this.fly(p, back, 0.45, 0.4);
    this.inspecting = null; this.busy = false;
  }
  /** 开动：马达转，小车往前开一段再倒回来 */
  async drive() {
    this.busy = true; sfx.engine();
    const start = this.car.position.clone();
    let last = 0;
    await this.tween(1.3, k => { const d = Math.sin(ease(k) * Math.PI) * 1.2; this.driveAlong(start, d); this.spinWheels((d - last) / 0.24); last = d; });
    this.car.position.copy(start);
    this.owl.cheer();
    this.busy = false;
  }
  /** 斜坡实验：小车从坡顶滑下，冲出规则算好的距离 */
  async rollRamp(result: RampResult) {
    this.busy = true;
    const top = this.rampTop.clone(), bottomX = RAMP_BOTTOM_X;
    // 先把小车放到坡顶
    const start = this.car.position.clone();
    const yaw0 = this.car.rotation.y;
    await this.tween(0.6, k => { this.car.position.lerpVectors(start, new THREE.Vector3(top.x + 0.5, top.y + 0.35 * Math.sin(k * Math.PI) + 0.06, 0), ease(k)); this.car.rotation.y = lerp(yaw0, 0, ease(k)); });
    this.car.rotation.z = this.rampBoard.rotation.z;
    await this.wait(0.3);
    sfx.whoosh();
    // 下坡
    const downDur = 0.5 + this.rampLevel * 0.08;
    const from = this.car.position.clone();
    await this.tween(downDur, k => { const e = k * k; this.car.position.lerpVectors(from, new THREE.Vector3(bottomX + 0.6, 0.06, 0), e); this.spinWheels(0.25); });
    this.car.rotation.z = 0;
    // 平地上减速滑行到规则给出的距离
    const x0 = this.car.position.x, x1 = bottomX + result.distance;
    await this.tween(0.6 + result.distance * 0.35, k => { const e = 1 - (1 - k) ** 2; this.rollTo(lerp(x0, x1, e)); });
    if (result.reached) { sfx.success(); this.owl.cheer(); this.confetti(new THREE.Vector3(this.flag.position.x, 1.2, -0.6)); }
    else sfx.oops();
    await this.wait(0.8);
    this.busy = false;
  }
  /** 小车回到垫子中央 */
  async homeCar() {
    const from = this.car.position.clone();
    this.car.rotation.z = 0;
    await this.tween(0.6, k => { this.car.position.lerpVectors(from, new THREE.Vector3(0, 0.06, 0), ease(k)); this.car.position.y += Math.sin(k * Math.PI) * 0.4; this.car.rotation.y = lerp(0, CAR_YAW, ease(k)); });
  }
  private rollTo(x: number) { const dx = x - this.car.position.x; this.car.position.x = x; this.spinWheels(dx / 0.24); }
  /** 沿车头方向开 dist 的距离 */
  private driveAlong(from: THREE.Vector3, dist: number) {
    const yaw = this.car.rotation.y;
    this.car.position.set(from.x + Math.cos(yaw) * dist, from.y, from.z - Math.sin(yaw) * dist);
  }
  private spinWheels(angle: number) { for (const id of this.wheels) { const p = this.parts.get(id); if (p) p.node.rotation.z -= angle; } }

  // ===================== 动画小工具 =====================
  private fly(p: PartView, to: THREE.Vector3, dur: number, arc = 0.9) {
    const from = p.node.position.clone();
    return this.tween(dur, k => { const e = ease(k); p.node.position.lerpVectors(from, to, e); p.node.position.y += Math.sin(e * Math.PI) * arc; });
  }
  private pop(o: THREE.Object3D) { void this.tween(0.3, k => o.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.12)).then(() => o.scale.setScalar(1)); }
  private tween(dur: number, update: (k: number) => void) { return new Promise<void>(resolve => this.tweens.push({ t: 0, dur, update, resolve })); }
  private wait(s: number) { return this.tween(s, () => {}); }
  private confetti(at: THREE.Vector3) {
    const g = new THREE.Group(); g.position.copy(at); this.scene.add(g);
    const colors = ['#ffcf4a', '#ee5a4f', '#3d5fc4', '#7dba5a', '#ff9fb2'];
    const geo = new THREE.PlaneGeometry(0.12, 0.08);
    const ps = Array.from({ length: 70 }, (_, i) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colors[i % 5], side: THREE.DoubleSide })); m.userData.v = new THREE.Vector3((Math.random() - 0.5) * 4, 3 + Math.random() * 3, (Math.random() - 0.5) * 3); g.add(m); return m; });
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#fff2b0', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); glow.scale.setScalar(2); g.add(glow);
    let life = 0;
    const tick = (dt: number) => { life += dt; ps.forEach(p => { const v = p.userData.v as THREE.Vector3; v.y -= 7 * dt; p.position.addScaledVector(v, dt); p.rotation.x += dt * 6; p.rotation.y += dt * 4; }); glow.material.opacity = Math.max(0, 1 - life * 2); if (life > 2.4) { this.scene.remove(g); this.effects.delete(tick); } };
    this.effects.add(tick);
  }
  private effects = new Set<(dt: number) => void>();

  // ===================== 镜头与指针 =====================
  private setView(v: 'bench' | 'ramp') {
    const g = this.camGoal;
    if (v === 'bench') { g.pitch = 0.62; g.dist = this.baseDist; g.target.set(0, 0.2, 0.1); }
    else { g.pitch = 0.5; g.dist = this.baseDist * 1.08; g.target.set(-0.4, 0.2, 0); }
  }
  private ro = new ResizeObserver(() => this.resize());
  private resize = () => {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;                          // 容器还没显示（0×0）时不算，否则宽高比变成 NaN，镜头就一直是黑屏
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    // 保证工作垫左右（约 ±4）都在画面里
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.baseDist = THREE.MathUtils.clamp(4.6 / (tan * this.camera.aspect), 7.5, 16);
    this.camGoal.dist = this.baseDist; this.cam.dist = this.baseDist;
  };
  private pick(cx: number, cy: number): CarPartId | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ptr.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.ptr, this.camera);
    const hits = this.ray.intersectObjects(this.hits.map(h => h.obj), false);
    return hits.length ? this.hits.find(h => h.obj === hits[0].object)!.id : null;
  }
  private onDown = (e: PointerEvent) => { this.drag = { x: e.clientX, y: e.clientY, yaw: this.camGoal.yaw, moved: false }; };
  private onMove = (e: PointerEvent) => {
    if (!this.drag) return;
    const dx = e.clientX - this.drag.x;
    if (Math.abs(dx) > 8) this.drag.moved = true;
    if (this.drag.moved) this.camGoal.yaw = THREE.MathUtils.clamp(this.drag.yaw - dx * 0.004, -0.6, 0.6);
  };
  private onUp = (e: PointerEvent) => {
    const d = this.drag; this.drag = null;
    if (!d || d.moved || this.busy) return;
    const id = this.pick(e.clientX, e.clientY);
    if (id) this.events.onPartTap(id);
  };

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const raw = Math.min(this.clock.getDelta(), 1), dt = Math.min(raw, 0.05), t = this.clock.elapsedTime;
    for (const tw of [...this.tweens]) { tw.t += raw; const k = clamp01(tw.t / tw.dur); tw.update(k); if (k >= 1) { this.tweens.splice(this.tweens.indexOf(tw), 1); tw.resolve(); } }
    for (const f of [...this.effects]) f(dt);
    this.owl.update(t, dt);
    this.owl.lookAt(-this.owl.root.position.x / 4, -0.2);
    // 缺少的零件一闪一闪：告诉孩子“先装这个”
    for (const p of this.parts.values()) {
      const on = this.glowIds.has(p.id);
      for (const m of p.meshes) { const mat = m.material as THREE.MeshStandardMaterial; mat.emissive?.set(on ? '#ffd54a' : '#000000'); if (mat.emissive) mat.emissiveIntensity = on ? 0.35 + Math.sin(t * 7) * 0.25 : 0; }
    }
    // 镜头缓动（空白处左右拖可以转一点角度，松手后慢慢回正）
    const c = this.cam, g = this.camGoal, k = 1 - Math.pow(0.02, dt);
    if (!this.drag) g.yaw *= 1 - dt * 0.4;
    c.yaw = lerp(c.yaw, g.yaw, k); c.pitch = lerp(c.pitch, g.pitch, k); c.dist = lerp(c.dist, g.dist, k); c.target.lerp(g.target, k);
    const cp = Math.cos(c.pitch);
    this.camera.position.set(c.target.x + Math.sin(c.yaw) * cp * c.dist, c.target.y + Math.sin(c.pitch) * c.dist, c.target.z + Math.cos(c.yaw) * cp * c.dist);
    this.camera.lookAt(c.target);
    this.renderer.render(this.scene, this.camera);
  };
}
