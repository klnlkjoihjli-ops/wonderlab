import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { LIGHT_IDS, SPOT_R, START_SPOTS, WALL, clampSpot, type LightId, type Spots, type TorchPartId } from '../../shared/modules/lights';
import { createOwl } from '../scene/characters';
import { clamp01, clay, ease, easeOutBack, glowTexture, lerp, mesh, woodTexture } from '../scene/util';
import { sfx } from '../audio';

// 探索工作台 · 光的三原色：关了灯的小房间，桌上三支手电筒，对面一面白墙。
// 墙上的光斑用着色器“加”在一起（红+绿 → 黄），颜色完全按光的加法算，和 shared/modules/lights.ts 一致。
// 坐标：桌面 y=0，墙在 z=WALL_Z；墙面坐标 (x, y) → 世界 (x, y + WALL_Y0, WALL_Z)。

type Tween = { t: number; dur: number; update: (k: number) => void; resolve: () => void };
export type LightsEvents = {
  onTorchTap: (id: LightId) => void;
  onPartTap: (id: TorchPartId) => void;
  onSpotsMove: (spots: Spots) => void;      // 拖动中不停地报
  onSpotsDrop: (spots: Spots) => void;      // 松手
};

const WALL_Z = -1.6, WALL_Y0 = 0.25;
const TORCH_X: Record<LightId, number> = { R: -1.7, G: 0, B: 1.7 };
const TORCH_Z = 1.7, TORCH_Y = 0.42, PART_SCALE = 1.4;
const LENS_COLOR: Record<LightId, string> = { R: '#ff3b30', G: '#2ee65a', B: '#3a6bff' };
const BODY_COLOR: Record<LightId, string> = { R: '#d9473d', G: '#3fae5a', B: '#3d5fc4' };
// 拆开后零件在桌上的位置（世界坐标 x、z）
const AWAY: Record<TorchPartId, [number, number]> = { cap: [-3.3, 1.0], lens: [-2.5, 2.6], bulb: [-1.3, 2.9], battery: [-0.1, 2.7], body: [-3.6, 2.4] };

type Torch = { id: LightId; group: THREE.Group; lens: THREE.Mesh; glow: THREE.Sprite; beam: THREE.Mesh; on: boolean; hit: THREE.Mesh };
type Part = { id: TorchPartId; obj: THREE.Object3D; home: THREE.Vector3; homeQ: THREE.Quaternion; meshes: THREE.Mesh[] };

export class LightsScene {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  private clock = new THREE.Clock();
  private tweens: Tween[] = [];
  private raf = 0; private disposed = false;
  private torches = new Map<LightId, Torch>();
  private parts = new Map<TorchPartId, Part>();
  private wallU = {
    uOn: { value: [0, 0, 0] }, uPos: { value: LIGHT_IDS.map(id => new THREE.Vector2(START_SPOTS[id].x, START_SPOTS[id].y)) },
    uR: { value: SPOT_R }, uTime: { value: 0 }
  };
  private wall!: THREE.Mesh;
  private owl = createOwl();
  private spots: Spots = structuredClone(START_SPOTS);
  private ray = new THREE.Raycaster(); private ptr = new THREE.Vector2();
  private drag: { x: number; y: number; spot: LightId | null; moved: boolean; off: THREE.Vector2 } | null = null;
  private exploded = false;
  private glowPart: TorchPartId | null = null;
  private camGoal = { dist: 10, y: 3.0 };
  private cam = { dist: 10, y: 3.0 };
  private effects = new Set<(dt: number) => void>();
  busy = false;

  constructor(private host: HTMLElement, private events: LightsEvents) {
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.domElement.className = 'scene-canvas';
    host.appendChild(r.domElement);
    this.buildRoom();
    for (const id of LIGHT_IDS) this.buildTorch(id);
    this.owl.root.position.set(3.4, 0.5, 1.6); this.owl.root.rotation.y = -0.6; this.owl.root.scale.setScalar(1.2);
    this.scene.add(this.owl.root);
    this.aimAll();
    r.domElement.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    this.ro.observe(this.host);
    this.resize();
    this.loop();
    if (import.meta.env.DEV) (window as unknown as { __lights: LightsScene }).__lights = this;
  }
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf);
    window.removeEventListener('pointermove', this.onMove); window.removeEventListener('pointerup', this.onUp); this.ro.disconnect();
    this.renderer.dispose(); this.renderer.domElement.remove();
  }

  // ===================== 房间 =====================
  private buildRoom() {
    const s = this.scene;
    s.background = new THREE.Color('#231d2e');
    s.fog = new THREE.Fog('#231d2e', 14, 30);
    // 关了灯：只留一点暖暖的夜灯，看得清桌子和手电筒
    s.add(new THREE.HemisphereLight('#9d8fd0', '#4a3a2a', 0.95));
    const lamp = new THREE.PointLight('#ffb36b', 26, 14, 1.4); lamp.position.set(4.2, 3.2, 3.2); lamp.castShadow = true; lamp.shadow.mapSize.set(1024, 1024); s.add(lamp);
    // 夜灯本体（右后方的小台灯）
    const shade = mesh(new THREE.CylinderGeometry(0.25, 0.45, 0.45, 20, 1, true), new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ffb36b', emissiveIntensity: 0.9, side: THREE.DoubleSide }), s);
    shade.position.set(4.2, 2.9, 3.2);

    const wood = woodTexture('#b98251', '#7a4a22'); wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
    const plank = (color: string) => new THREE.MeshStandardMaterial({ map: wood, color, roughness: 0.85 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: '#4a3528', roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -3; s.add(floor);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), new THREE.MeshStandardMaterial({ color: '#3a2f45', roughness: 0.95 }));
    back.position.set(0, 4, WALL_Z - 0.3); s.add(back);
    // 大木桌
    const top = new THREE.Mesh(new RoundedBoxGeometry(9.4, 0.32, 5.2, 3, 0.1), plank('#c98f55'));
    top.position.set(0, -0.16, 1.2); top.receiveShadow = true; top.castShadow = true; s.add(top);
    for (const x of [-4.3, 4.3]) for (const z of [-1, 3.4]) { const leg = mesh(new RoundedBoxGeometry(0.4, 2.7, 0.4, 2, 0.08), plank('#a8703c'), s); leg.position.set(x, -1.65, z); }

    // 白墙（投影幕）：着色器把三个光斑按加法混在一起
    const w = WALL.w + SPOT_R * 2 + 0.6, h = WALL.h + SPOT_R * 2 - 0.2;
    const mat = new THREE.ShaderMaterial({
      uniforms: this.wallU, toneMapped: false,
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform float uOn[3]; uniform vec2 uPos[3]; uniform float uR; uniform float uTime; varying vec2 vP;
        void main(){
          vec3 base = vec3(0.13, 0.12, 0.15);                  // 关灯时墙是暗暗的灰
          vec3 col = vec3(0.0);
          vec3 lc[3]; lc[0] = vec3(1.0,0.0,0.0); lc[1] = vec3(0.0,1.0,0.0); lc[2] = vec3(0.0,0.0,1.0);
          for (int i = 0; i < 3; i++) {
            float d = length(vP - uPos[i]);
            float disc = 1.0 - smoothstep(uR - 0.05, uR + 0.03, d);
            float halo = exp(-max(0.0, d - uR) * 3.0) * 0.12;
            col += uOn[i] * lc[i] * (disc * 0.95 + halo);
          }
          vec3 c = min(base + col, vec3(1.0));
          // 墙边一圈细细的木框阴影
          gl_FragColor = vec4(c, 1.0);
        }`
    });
    // 几何体以“墙面坐标”建：原点在墙面坐标 (0,0)，这样着色器里的 vP 就是墙面坐标
    const geo = new THREE.PlaneGeometry(w, h); geo.translate(0, WALL.h / 2, 0);
    this.wall = new THREE.Mesh(geo, mat); this.wall.position.set(0, WALL_Y0, WALL_Z); s.add(this.wall);
    const frame = mesh(new RoundedBoxGeometry(w + 0.4, h + 0.4, 0.12, 2, 0.05), plank('#8a5527'), s, false);
    frame.position.set(0, WALL_Y0 + WALL.h / 2, WALL_Z - 0.08);
  }

  // ===================== 手电筒 =====================
  // 沿 +z 方向建：尾巴在 z=-0.9，灯头在 z=+0.55；group.lookAt(光斑) 就是对准墙
  private buildTorch(id: LightId) {
    const g = new THREE.Group(); g.position.set(TORCH_X[id], TORCH_Y, TORCH_Z); this.scene.add(g);
    // 小支架
    const stand = new THREE.Group(); stand.position.set(TORCH_X[id], 0, TORCH_Z); this.scene.add(stand);
    mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.08, 24), clay('#6b5a48'), stand).position.y = 0.04;
    mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 10), clay('#6b5a48'), stand).position.y = 0.2;

    const plastic = clay(BODY_COLOR[id], 0.45);
    const metal = new THREE.MeshStandardMaterial({ color: '#c9ccd4', metalness: 0.6, roughness: 0.35 });
    const part = (pid: TorchPartId, obj: THREE.Object3D) => {
      g.add(obj);
      if (id !== 'R') return;                  // 只有红色那支可以拆开
      const meshes: THREE.Mesh[] = []; obj.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
      obj.userData.part = pid;
      this.parts.set(pid, { id: pid, obj, home: obj.position.clone(), homeQ: obj.quaternion.clone(), meshes });
    };
    // 筒身
    const body = new THREE.Group();
    const tube = mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.1, 24), plastic, body); tube.rotation.x = Math.PI / 2; tube.position.z = -0.35;
    const tail = mesh(new THREE.SphereGeometry(0.2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), plastic, body); tail.rotation.x = -Math.PI / 2; tail.position.z = -0.9;
    const btn = mesh(new RoundedBoxGeometry(0.12, 0.08, 0.2, 2, 0.03), clay('#fff3d6'), body); btn.position.set(0, 0.2, -0.3);
    part('body', body);
    // 电池（藏在筒身里）
    const battery = new THREE.Group();
    const cell = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.7, 20), clay('#2f2f36', 0.5), battery); cell.rotation.x = Math.PI / 2;
    const band = mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.22, 20), clay('#e9b13a', 0.4), battery); band.rotation.x = Math.PI / 2; band.position.z = 0.22;
    const plus = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 12), metal, battery); plus.rotation.x = Math.PI / 2; plus.position.z = 0.38;
    battery.position.z = -0.4; battery.visible = false;
    part('battery', battery);
    // 灯头盖（喇叭口）
    const cap = new THREE.Group();
    const cone = mesh(new THREE.CylinderGeometry(0.33, 0.22, 0.4, 28, 1, true), plastic, cap); cone.rotation.x = Math.PI / 2; cone.position.z = 0.4;
    (cone.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    const rim = mesh(new THREE.TorusGeometry(0.33, 0.035, 8, 28), metal, cap); rim.position.z = 0.6;
    part('cap', cap);
    // 灯泡（藏在灯头里）
    const bulb = new THREE.Group();
    mesh(new THREE.SphereGeometry(0.12, 20, 14), new THREE.MeshStandardMaterial({ color: '#fffbe8', emissive: '#fff2c0', emissiveIntensity: 0.4, roughness: 0.1, transparent: true, opacity: 0.85 }), bulb).position.z = 0.36;
    const screw = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.14, 14), metal, bulb); screw.rotation.x = Math.PI / 2; screw.position.z = 0.22;
    part('bulb', bulb);
    // 彩色玻璃片
    const lens = mesh(new THREE.CircleGeometry(0.3, 28), new THREE.MeshStandardMaterial({ color: LENS_COLOR[id], emissive: LENS_COLOR[id], emissiveIntensity: 0.15, transparent: true, opacity: 0.9, side: THREE.DoubleSide }), undefined, false);
    lens.position.z = 0.59;
    const lensG = new THREE.Group(); lensG.add(lens); part('lens', lensG);
    // 亮灯时灯头的光晕
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: LENS_COLOR[id], transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(1.3); glow.position.z = 0.65; g.add(glow);
    // 光束：从灯头到墙的半透明光锥（顶点在原点，底面在 z=1，按距离拉长）
    const coneGeo = new THREE.ConeGeometry(1, 1, 40, 1, true); coneGeo.translate(0, -0.5, 0); coneGeo.rotateX(-Math.PI / 2);
    const beam = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: LENS_COLOR[id], transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.visible = false; this.scene.add(beam);
    // 点手电筒用的大一点的透明碰撞体
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.9, 12), new THREE.MeshBasicMaterial({ visible: false })); hit.rotation.x = Math.PI / 2; hit.position.z = -0.15; g.add(hit);
    this.torches.set(id, { id, group: g, lens, glow, beam, on: false, hit });
  }
  private wallPoint(id: LightId) { const s = this.spots[id]; return new THREE.Vector3(s.x, s.y + WALL_Y0, WALL_Z); }
  private aimAll() {
    for (const t of this.torches.values()) {
      if (this.exploded && t.id === 'R') continue;
      t.group.lookAt(this.wallPoint(t.id));
      // 光束从灯头出发
      const head = new THREE.Vector3(0, 0, 0.62).applyMatrix4(t.group.matrixWorld.clone().compose(t.group.position, t.group.quaternion, t.group.scale));
      const to = this.wallPoint(t.id), len = head.distanceTo(to);
      t.beam.position.copy(head); t.beam.lookAt(to); t.beam.scale.set(SPOT_R * 0.92, SPOT_R * 0.92, len);
    }
  }

  // ===================== 对外的动作 =====================
  setOn(id: LightId, on: boolean) {
    const t = this.torches.get(id)!; t.on = on;
    this.wallU.uOn.value[LIGHT_IDS.indexOf(id)] = on ? 1 : 0;
    t.beam.visible = on;
    (t.beam.material as THREE.MeshBasicMaterial).opacity = on ? 0.09 : 0;
    t.glow.material.opacity = on ? 0.9 : 0;
    (t.lens.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 2.2 : 0.15;
    // 按一下开关：手电筒轻轻一抖
    this.tween(0.25, k => { t.group.position.y = TORCH_Y + Math.sin(k * Math.PI) * 0.06; });
  }
  setSpots(s: Spots) {
    this.spots = structuredClone(s);
    LIGHT_IDS.forEach((id, i) => this.wallU.uPos.value[i].set(s[id].x, s[id].y));
    this.aimAll();
  }
  getSpots(): Spots { return structuredClone(this.spots); }
  /** 把红色手电筒一下拆开，零件散在桌子前面 */
  explode(): Promise<void> {
    if (this.exploded) return Promise.resolve();
    this.exploded = true; this.busy = true; sfx.whoosh();
    const torch = this.torches.get('R')!; torch.group.updateMatrixWorld(true);
    const inv = torch.group.matrixWorld.clone().invert();
    const jobs = [...this.parts.values()].map((p, i) => {
      p.obj.visible = true;
      const [x, z] = AWAY[p.id];
      const lift = p.id === 'lens' ? 0.44 : p.id === 'body' || p.id === 'cap' ? 0.3 : 0.24;   // 放大 1.4 倍后刚好立在桌上
      const to = new THREE.Vector3(x, lift, z).applyMatrix4(inv);
      // 零件平躺在桌上：绕世界 y 轴转一点，让它侧对孩子
      const from = p.obj.position.clone(), fromQ = p.obj.quaternion.clone();
      const toQ = torch.group.quaternion.clone().invert().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, p.id === 'lens' ? 0 : Math.PI / 2 + 0.3, 0)));
      return new Promise<void>(res => setTimeout(() => this.tween(0.8, k => {
        const e = easeOutBack(k);
        p.obj.position.lerpVectors(from, to, e); p.obj.position.y += Math.sin(clamp01(k) * Math.PI) * 1.4;
        p.obj.quaternion.slerpQuaternions(fromQ, toQ, ease(k));
        p.obj.scale.setScalar(lerp(1, PART_SCALE, ease(k)));            // 拆开后放大一点，小手指好点
      }).then(res), i * 90));
    });
    return Promise.all(jobs).then(() => { this.busy = false; });
  }
  /** 装回去 */
  assemble(): Promise<void> {
    if (!this.exploded) return Promise.resolve();
    this.busy = true; sfx.place(); this.glowPart = null;
    const jobs = [...this.parts.values()].map((p, i) => {
      const from = p.obj.position.clone(), fromQ = p.obj.quaternion.clone();
      return new Promise<void>(res => setTimeout(() => this.tween(0.7, k => {
        const e = ease(k); p.obj.position.lerpVectors(from, p.home, e); p.obj.quaternion.slerpQuaternions(fromQ, p.homeQ, e);
        p.obj.scale.setScalar(lerp(PART_SCALE, 1, e));
      }).then(res), i * 80));
    });
    return Promise.all(jobs).then(() => {
      this.exploded = false; this.busy = false;
      this.parts.get('battery')!.obj.visible = false;
      this.aimAll();
    });
  }
  /** 点到的零件跳一下，并闪一会儿 */
  showPart(id: TorchPartId) {
    const p = this.parts.get(id); if (!p) return;
    this.glowPart = id; sfx.pick();
    const y0 = p.obj.position.y;
    this.tween(0.5, k => { p.obj.position.y = y0 + Math.sin(k * Math.PI) * 0.35; });
  }
  get isExploded() { return this.exploded; }
  /** 墙上冒出一圈星星：找到新颜色 / 变出白光 */
  sparkle(x: number, y: number, color: string) {
    const g = new THREE.Group(); g.position.set(x, y + WALL_Y0, WALL_Z + 0.1); this.scene.add(g);
    const tex = glowTexture();
    const ps = Array.from({ length: 18 }, (_, i) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      const a = (i / 18) * Math.PI * 2; s.userData.v = new THREE.Vector3(Math.cos(a), Math.sin(a), 0.3).multiplyScalar(1.6 + (i % 3) * 0.5);
      s.scale.setScalar(0.35); g.add(s); return s;
    });
    let life = 0;
    const tick = (dt: number) => {
      life += dt;
      ps.forEach(p => { p.position.addScaledVector(p.userData.v as THREE.Vector3, dt); p.material.opacity = Math.max(0, 1 - life * 1.2); });
      if (life > 1) { this.scene.remove(g); this.effects.delete(tick); }
    };
    this.effects.add(tick);
  }
  cheer() { this.owl.cheer(); }

  // ===================== 指针 =====================
  private ro = new ResizeObserver(() => this.resize());
  private resize = () => {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;                          // 容器还没显示（0×0）时不算，否则宽高比变成 NaN
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    // 整面墙（约 ±5）都要在画面里
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.camGoal.dist = THREE.MathUtils.clamp(5.4 / (tan * this.camera.aspect), 9, 20);
    this.cam.dist = this.camGoal.dist;
  };
  private setPtr(cx: number, cy: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ptr.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.ptr, this.camera);
  }
  /** 手指在墙面上的位置（墙面坐标） */
  private wallHit(cx: number, cy: number): THREE.Vector2 | null {
    this.setPtr(cx, cy);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -WALL_Z), p = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(plane, p)) return null;
    return new THREE.Vector2(p.x, p.y - WALL_Y0);
  }
  private onDown = (e: PointerEvent) => {
    if (this.busy) return;
    // 先看是不是按在一个亮着的光斑上（最上面的优先：按离手指最近的算）
    const w = this.wallHit(e.clientX, e.clientY);
    let spot: LightId | null = null, best = SPOT_R * 1.15;
    if (w) for (const id of LIGHT_IDS) {
      if (!this.torches.get(id)!.on) continue;
      const d = w.distanceTo(new THREE.Vector2(this.spots[id].x, this.spots[id].y));
      if (d < best) { best = d; spot = id; }
    }
    const off = spot && w ? new THREE.Vector2(this.spots[spot].x - w.x, this.spots[spot].y - w.y) : new THREE.Vector2();
    this.drag = { x: e.clientX, y: e.clientY, spot, moved: false, off };
  };
  private onMove = (e: PointerEvent) => {
    const d = this.drag; if (!d) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) d.moved = true;
    if (!d.moved || !d.spot) return;
    const w = this.wallHit(e.clientX, e.clientY); if (!w) return;
    const s = this.getSpots(); s[d.spot] = clampSpot({ x: w.x + d.off.x, y: w.y + d.off.y });
    this.setSpots(s);
    this.events.onSpotsMove(this.getSpots());
  };
  private onUp = (e: PointerEvent) => {
    const d = this.drag; this.drag = null;
    if (!d || this.busy) return;
    if (d.moved) { if (d.spot) this.events.onSpotsDrop(this.getSpots()); return; }
    this.setPtr(e.clientX, e.clientY);
    if (this.exploded) {
      const objs = [...this.parts.values()].flatMap(p => p.meshes);
      const hit = this.ray.intersectObjects(objs, false)[0];
      if (hit) { let o: THREE.Object3D | null = hit.object; while (o && !o.userData.part) o = o.parent; if (o) this.events.onPartTap(o.userData.part as TorchPartId); }
      return;
    }
    const hits = this.ray.intersectObjects([...this.torches.values()].map(t => t.hit), false);
    if (hits.length) { const t = [...this.torches.values()].find(x => x.hit === hits[0].object)!; this.events.onTorchTap(t.id); }
  };

  private tween(dur: number, update: (k: number) => void) { return new Promise<void>(resolve => this.tweens.push({ t: 0, dur, update, resolve })); }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const raw = Math.min(this.clock.getDelta(), 1), dt = Math.min(raw, 0.05), t = this.clock.elapsedTime;
    for (const tw of [...this.tweens]) { tw.t += raw; const k = clamp01(tw.t / tw.dur); tw.update(k); if (k >= 1) { this.tweens.splice(this.tweens.indexOf(tw), 1); tw.resolve(); } }
    for (const f of [...this.effects]) f(dt);
    this.wallU.uTime.value = t;
    this.owl.update(t, dt);
    this.owl.lookAt(-0.6, 0.3);
    for (const p of this.parts.values()) {
      const on = this.exploded && this.glowPart === p.id;
      for (const m of p.meshes) { const mat = m.material as THREE.MeshStandardMaterial; if (!mat.emissive || p.id === 'lens' || p.id === 'bulb') continue; mat.emissive.set(on ? '#ffd54a' : '#000000'); mat.emissiveIntensity = on ? 0.3 + Math.sin(t * 7) * 0.2 : 0; }
    }
    // 光束轻轻呼吸
    for (const tc of this.torches.values()) if (tc.on) (tc.beam.material as THREE.MeshBasicMaterial).opacity = 0.08 + Math.sin(t * 2 + TORCH_X[tc.id]) * 0.015;
    const c = this.cam, g = this.camGoal, k = 1 - Math.pow(0.02, dt);
    c.dist = lerp(c.dist, g.dist, k); c.y = lerp(c.y, g.y, k);
    this.camera.position.set(0, c.y + c.dist * 0.18, 1.6 + c.dist);
    this.camera.lookAt(0, 1.45, 0);
    this.renderer.render(this.scene, this.camera);
  };
}
