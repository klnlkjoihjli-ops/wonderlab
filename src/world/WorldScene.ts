import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { AREAS, DOMAINS, NODES, area as areaOf, type AreaId, type DomainId, type NodeState } from '../../shared/platform';
import { createOwl } from '../scene/characters';
import { buildSky } from '../scene/terrain';
import { PALETTE, clay, gradientColors, lerp, mesh, rng, woodTexture } from '../scene/util';
import { createKid } from './kid';
import { buildLandmark } from './landmarks';
import { sfx } from '../audio';

// 探险世界：中间是小诺的树屋（工作台），五座岛围在四周，每座岛一个领域。
// 岛上一条小路，路边按顺序立着知识点的任务点。孩子点任务点，小人沿路走过去，到了就开启任务。

export type WorldEvents = { onTap: (id: string) => void; onArrive: (id: string) => void };
type Station = { id: string; d: DomainId; pos: THREE.Vector3; group: THREE.Group; top: THREE.Mesh; icon: THREE.Sprite; ring: THREE.Mesh; flag: THREE.Group; lock: THREE.Sprite; state: NodeState };

const R_ISLAND = 10, WATER_Y = -0.45;


/** 画在画布上的图标牌：白色圆底 + 领域色描边 + emoji，所有任务点都用这一种 */
function iconTexture(emoji: string, ring: string, grey = false) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.fillStyle = grey ? '#d9d6cf' : '#fffaf0'; g.fill();
  g.lineWidth = 16; g.strokeStyle = grey ? '#a9a49a' : ring; g.stroke();
  g.font = '130px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (grey) g.globalAlpha = 0.45;
  g.fillText(emoji, 128, 138);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function labelTexture(text: string) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 112;
  const g = c.getContext('2d')!;
  g.font = '600 52px "PingFang SC","Hiragino Sans GB",sans-serif';
  const w = Math.min(500, g.measureText(text).width + 48);
  g.fillStyle = 'rgba(255,250,240,.92)'; g.beginPath(); g.roundRect((512 - w) / 2, 14, w, 84, 42); g.fill();
  g.fillStyle = '#2a3a33'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 58);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class WorldScene {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
  private clock = new THREE.Clock();
  private raf = 0; private disposed = false;
  private kid = createKid();
  private owl = createOwl();
  private stations = new Map<string, Station>();
  private hits: { id: string; obj: THREE.Object3D }[] = [];
  private graph = new Map<string, { pos: THREE.Vector3; links: string[] }>();
  private route: THREE.Vector3[] = []; private routeTarget: string | null = null;
  private at = '';
  private speed = 0;
  private spinners: ((t: number, dt: number) => void)[] = [];
  private waterU = { uTime: { value: 0 } };
  private cam = { yaw: 0, pitch: 0.82, dist: 17 };
  private camGoal = { yaw: 0, pitch: 0.82, dist: 17 };
  private camTarget = new THREE.Vector3();
  private drag: { x: number; y: number; yaw: number; moved: boolean } | null = null;
  private ray = new THREE.Raycaster(); private ptr = new THREE.Vector2();

  /** 一座岛 = 一块大陆里的一个区域（比如发现岛的“颜色与光”） */
  constructor(private host: HTMLElement, private areaId: AreaId, private events: WorldEvents) {
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.domElement.className = 'scene-canvas';
    host.appendChild(r.domElement);
    this.build();
    r.domElement.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    this.ro.observe(this.host);                  // 容器从隐藏变成显示时也要重新算尺寸
    this.resize();
    this.placeAt(`gate:${areaId}`);
    this.camTarget.copy(this.kid.root.position);
    this.loop();
    if (import.meta.env.DEV) (window as unknown as { __world: WorldScene }).__world = this;
  }
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf);
    window.removeEventListener('pointermove', this.onMove); window.removeEventListener('pointerup', this.onUp); this.ro.disconnect();
    this.renderer.dispose(); this.renderer.domElement.remove();
  }

  // ===================== 搭世界 =====================
  private build() {
    const s = this.scene;
    s.fog = new THREE.Fog('#ffd9ae', 45, 120);
    const sunDir = new THREE.Vector3(-0.6, 0.6, -0.5);
    buildSky(s, sunDir);
    s.add(new THREE.HemisphereLight('#d8ecff', '#6f8f4a', 1.3));
    const sun = new THREE.DirectionalLight('#ffe0b0', 2.5);
    sun.position.set(-20, 30, 16); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 90 });
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
    s.add(sun);
    this.buildWater();
    // 只有这一块陆地：小岛在原点，孩子从前面的小码头上岸，关卡沿着小路围成一圈
    const ar = areaOf(this.areaId), d = DOMAINS.find(x => x.id === ar.d)!, c = new THREE.Vector3();
    this.island(c, R_ISLAND, '#9ed06e', 10 + AREAS.findIndex(x => x.id === ar.id));
    this.bridge(new THREE.Vector3(0, 0, R_ISLAND + 3.2), new THREE.Vector3(0, 0, R_ISLAND - 0.6), d.color);   // 小码头
    this.landmark(ar.id, c);
    const gate = new THREE.Vector3(0, 0, R_ISLAND - 1.3), gateId = `gate:${ar.id}`;
    this.graph.set(gateId, { pos: gate, links: [] });
    const nodes = NODES.filter(n => n.a === ar.id).sort((a, b) => a.lv - b.lv);
    const back = Math.atan2(gate.z, gate.x);          // 码头所在的方向角
    // 8–10 关排成一圈，最后一关再连回码头，小人可以从两边走，路不会太远
    let prevId = gateId, prev = gate;
    nodes.forEach((n, k) => {
      const a = back + 0.6 + k * (5.1 / Math.max(1, nodes.length - 1));
      const p = new THREE.Vector3(Math.cos(a) * 7, 0, Math.sin(a) * 7);
      this.pathStrip(prev, p);
      this.link(prevId, n.id, p);
      this.station(n.id, d.id, d.color, n.icon, n.name, p);
      prevId = n.id; prev = p;
    });
    if (nodes.length > 2) { this.pathStrip(prev, gate); this.link(prevId, gateId, gate); }
    this.trees(c, R_ISLAND, 30 + AREAS.findIndex(x => x.id === ar.id), gate);
    // 角色
    this.kid.root.scale.setScalar(1.15);
    s.add(this.kid.root);
    this.owl.root.scale.setScalar(0.8);
    s.add(this.owl.root);
  }
  private link(a: string, b: string, pos: THREE.Vector3) {
    if (!this.graph.has(b)) this.graph.set(b, { pos: pos.clone(), links: [] });
    this.graph.get(a)!.links.push(b); this.graph.get(b)!.links.push(a);
  }
  private buildWater() {
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...this.waterU, uA: { value: new THREE.Color('#3fb6c9') }, uB: { value: new THREE.Color('#9be6dc') } },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
      fragmentShader: `uniform float uTime; uniform vec3 uA; uniform vec3 uB; varying vec3 vW;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),u.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x), u.y); }
        void main(){ float d = length(vW.xz);
          vec3 col = mix(uB, uA, smoothstep(10.0, 45.0, d));
          float w = n(vW.xz*0.35 + vec2(uTime*0.15, uTime*0.1)) * 0.6 + n(vW.xz*0.9 - uTime*0.2) * 0.4;
          col = mix(col, vec3(0.92,1.0,0.98), smoothstep(0.7, 0.78, w) * 0.5);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`
    });
    const water = new THREE.Mesh(new THREE.CircleGeometry(160, 64), mat);
    water.rotation.x = -Math.PI / 2; water.position.y = WATER_Y; this.scene.add(water);
  }
  /** 一座圆圆的小岛：草地顶 + 沙滩边 + 土层，顶面 y=0 */
  private island(c: THREE.Vector3, r: number, grass: string, seed: number) {
    const g = new THREE.Group(); g.position.copy(c); this.scene.add(g);
    const top = new THREE.CylinderGeometry(r, r + 0.35, 0.6, 48, 1);
    const rr = rng(seed), pos = top.getAttribute('position');
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), a = Math.atan2(z, x); const k = 1 + Math.sin(a * 5 + seed) * 0.04 + (rr() - 0.5) * 0.02; pos.setX(i, x * k); pos.setZ(i, z * k); }
    top.computeVertexNormals();
    const grassM = mesh(top, clay(grass, 0.95), g); grassM.position.y = -0.3; grassM.receiveShadow = true;
    const sand = mesh(new THREE.CylinderGeometry(r + 0.45, r + 0.9, 0.5, 48), clay(PALETTE.sand, 0.95), g); sand.position.y = -0.62;
    const soil = mesh(new THREE.CylinderGeometry(r + 0.85, r * 0.6, 2.4, 48), clay('#b58a5a', 0.95), g); soil.position.y = -2.0;
  }
  private bridge(a: THREE.Vector3, b: THREE.Vector3, rail: string) {
    const g = new THREE.Group(); this.scene.add(g);
    const len = a.distanceTo(b), dir = b.clone().sub(a).normalize(), yaw = Math.atan2(dir.x, dir.z);
    g.position.copy(a.clone().lerp(b, 0.5)); g.rotation.y = yaw;
    const wood = woodTexture('#e2a24a', '#9a6224');
    const n = Math.ceil(len / 0.55);
    for (let i = 0; i < n; i++) {
      const p = mesh(new RoundedBoxGeometry(2.2, 0.14, 0.48, 2, 0.04), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.8 }), g);
      p.position.set(0, -0.08 - Math.sin((i / (n - 1)) * Math.PI) * -0.25, -len / 2 + (i + 0.5) * (len / n)); p.rotation.y = (i % 2 ? 1 : -1) * 0.03;
    }
    for (const sx of [-1.15, 1.15]) {
      for (let i = 0; i <= 4; i++) { const post = mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.8, 8), clay(PALETTE.woodDark), g); post.position.set(sx, 0.3, -len / 2 + (i / 4) * len); }
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(sx, 0.65, -len / 2), new THREE.Vector3(sx, 0.85, 0), new THREE.Vector3(sx, 0.65, len / 2));
      mesh(new THREE.TubeGeometry(curve, 24, 0.045, 6), clay(rail, 0.6), g);
    }
  }
  private pathStrip(a: THREE.Vector3, b: THREE.Vector3) {
    const len = a.distanceTo(b), mid = a.clone().lerp(b, 0.5);
    const strip = mesh(new RoundedBoxGeometry(1.1, 0.04, len + 0.6, 2, 0.02), clay(PALETTE.path, 0.95), this.scene, false);
    strip.position.set(mid.x, 0.02, mid.z); strip.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    for (let i = 1; i < len / 0.9; i++) {        // 小石板
      const p = a.clone().lerp(b, i / (len / 0.9));
      const st = mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.05, 10), clay('#e8d3a8', 0.9), this.scene, false); st.position.set(p.x + (i % 2 ? 0.18 : -0.18), 0.05, p.z);
    }
  }
  private station(id: string, d: DomainId, color: string, emoji: string, name: string, p: THREE.Vector3) {
    const g = new THREE.Group(); g.position.copy(p); this.scene.add(g);
    mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.32, 28), clay('#c9c2b4', 0.9), g).position.y = 0.16;
    const top = mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.08, 28), clay(color, 0.6), g); top.position.y = 0.36;
    const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(emoji, color), transparent: true })); icon.scale.setScalar(1.5); icon.position.y = 2.0; g.add(icon);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(name), transparent: true, depthWrite: false })); label.scale.set(2.6, 0.57, 1); label.position.y = 1.0; g.add(label);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.25, 40), new THREE.MeshBasicMaterial({ color: '#fff3a0', transparent: true, opacity: 0, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.42; g.add(ring);
    const flag = new THREE.Group(); flag.position.set(0.7, 0.36, -0.3); g.add(flag);
    mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8), clay(PALETTE.woodDark), flag).position.y = 0.55;
    const tri = new THREE.Shape(); tri.moveTo(0, 0); tri.lineTo(0.5, -0.16); tri.lineTo(0, -0.32); tri.closePath();
    const cloth = mesh(new THREE.ShapeGeometry(tri), new THREE.MeshStandardMaterial({ color: '#ffcf4a', side: THREE.DoubleSide }), flag, false); cloth.position.y = 1.08;
    const lockC = document.createElement('canvas'); lockC.width = lockC.height = 128; const lg = lockC.getContext('2d')!;
    lg.fillStyle = '#6b5a48'; lg.beginPath(); lg.roundRect(28, 58, 72, 56, 12); lg.fill(); lg.lineWidth = 14; lg.strokeStyle = '#6b5a48'; lg.beginPath(); lg.arc(64, 58, 22, Math.PI, 0); lg.stroke();
    const lt = new THREE.CanvasTexture(lockC); lt.colorSpace = THREE.SRGBColorSpace;
    const lock = new THREE.Sprite(new THREE.SpriteMaterial({ map: lt, transparent: true })); lock.scale.setScalar(0.6); lock.position.set(0.5, 2.5, 0.1); g.add(lock);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 3.2, 12), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1.5; g.add(hit);
    this.hits.push({ id, obj: hit });
    this.stations.set(id, { id, d, pos: p.clone(), group: g, top, icon, ring, flag, lock, state: 'lock' });
  }
  private landmark(d: AreaId, c: THREE.Vector3) {
    const { group, spin } = buildLandmark(d);
    group.position.copy(c); group.scale.multiplyScalar(1.6); this.scene.add(group); this.spinners.push(spin);   // 岛变大了，地标也放大
  }

  private trees(c: THREE.Vector3, r: number, seed: number, gate: THREE.Vector3) {
    const rr = rng(seed);
    const canopy = (a: string, b: string, sd: number) => { const rs = rng(sd); const parts = Array.from({ length: 4 }, (_, i) => { const geo = new THREE.IcosahedronGeometry(0.7 + rs() * 0.35, 2); geo.translate(i ? Math.cos(i * 2) * 0.45 : 0, 1.9 + (i ? rs() * 0.4 : 0.6), i ? Math.sin(i * 2) * 0.45 : 0); return geo.toNonIndexed(); }); return gradientColors(mergeGeometries(parts), a, b, 1.2, 3); };
    const geos = [canopy('#3f8442', '#9fd05e', seed), canopy('#d57a35', '#f7c75e', seed + 1)];
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    const count = 26;
    for (let i = 0; i < count; i++) {
      const a = rr() * Math.PI * 2, d = r * 0.88 + rr() * 0.6;
      const p = new THREE.Vector3(c.x + Math.cos(a) * d, 0, c.z + Math.sin(a) * d);
      if ([...this.stations.values()].some(s => s.pos.distanceTo(p) < 2.3) || p.distanceTo(gate) < 3.5) continue;   // 别挡住关卡和码头
      const t = new THREE.Group(); t.position.copy(p); t.scale.setScalar(0.8 + rr() * 0.5); this.scene.add(t);
      mesh(new THREE.CylinderGeometry(0.12, 0.2, 2, 7).translate(0, 1, 0), clay('#8a5b3c'), t);
      mesh(geos[rr() < 0.25 ? 1 : 0], mat, t);
    }
  }

  // ===================== 状态与行走 =====================
  setStates(states: Record<string, NodeState>) {
    for (const st of this.stations.values()) {
      const s = states[st.id] ?? 'lock';
      if (s === st.state && st.icon.userData.inited) continue;
      st.state = s; st.icon.userData.inited = true;
      const dom = DOMAINS.find(d => d.id === st.d)!, n = NODES.find(x => x.id === st.id)!;
      (st.icon.material as THREE.SpriteMaterial).map = iconTexture(n.icon, dom.color, s === 'lock');
      (st.icon.material as THREE.SpriteMaterial).needsUpdate = true;
      st.top.material = clay(s === 'lock' ? '#b9b4aa' : dom.color, 0.6);
      st.flag.visible = s === 'done';
      st.lock.visible = s === 'lock';
    }
  }
  /** 直接把小人放到某个地点（比如从工作台回来时） */
  placeAt(id: string) {
    const n = this.graph.get(id); if (!n) return;
    this.at = id; this.route = []; this.routeTarget = null;
    const p = n.pos.clone().add(this.standOffset(id));
    this.kid.root.position.copy(p);
    this.owl.root.position.copy(p).add(new THREE.Vector3(1, 2.2, 0.3));
  }
  /** 站在任务点前面一点（不踩在台子上） */
  private standOffset(id: string) {
    const st = this.stations.get(id); if (!st) return new THREE.Vector3();
    const toCenter = st.pos.clone().negate().setY(0).normalize();
    return toCenter.multiplyScalar(1.35);
  }
  /** 沿着小路走到目标；返回路程（米） */
  walkTo(target: string): number {
    const path = this.findPath(this.at, target);
    if (!path) return 0;
    const pts = path.map(id => this.graph.get(id)!.pos.clone());
    pts[0] = this.kid.root.position.clone();
    pts[pts.length - 1].add(this.standOffset(target));
    this.route = pts.slice(1); this.routeTarget = target;
    if (this.route.length === 0 || this.kid.root.position.distanceTo(pts[pts.length - 1]) < 0.3) { this.route = []; this.routeTarget = null; this.at = target; this.events.onArrive(target); return 0; }
    sfx.tap();
    let len = 0; for (let i = 1; i < pts.length; i++) len += pts[i].distanceTo(pts[i - 1]);
    return len;
  }
  get walking() { return this.routeTarget !== null; }
  private findPath(a: string, b: string): string[] | null {
    const prev = new Map<string, string | null>([[a, null]]), q = [a];
    while (q.length) { const cur = q.shift()!; if (cur === b) break; for (const nx of this.graph.get(cur)!.links) if (!prev.has(nx)) { prev.set(nx, cur); q.push(nx); } }
    if (!prev.has(b)) return null;
    const out: string[] = []; for (let c: string | null = b; c; c = prev.get(c)!) out.unshift(c);
    return out;
  }
  /** 镜头拉远看全岛 / 回到跟随小人 */
  overview(on: boolean) { this.camGoal.dist = on ? 34 : this.baseDist; this.camGoal.pitch = on ? 1.2 : 0.82; this.overviewOn = on; }
  private overviewOn = false;
  private baseDist = 17;
  focusStation(id: string) { const st = this.stations.get(id); if (st) st.ring.userData.pulse = 1.5; }

  // ===================== 指针与循环 =====================
  private ro = new ResizeObserver(() => this.resize());
  private resize = () => {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;                          // 容器还没显示（0×0）时不算，否则宽高比变成 NaN，镜头就一直是黑屏
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.baseDist = THREE.MathUtils.clamp(16 / Math.max(0.8, this.camera.aspect), 13, 22);
    if (!this.overviewOn) this.camGoal.dist = this.baseDist;
  };
  private pick(cx: number, cy: number): string | null {
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
    if (this.drag.moved) this.camGoal.yaw = this.drag.yaw - dx * 0.005;
  };
  private onUp = (e: PointerEvent) => {
    const d = this.drag; this.drag = null;
    if (!d || d.moved) return;
    const id = this.pick(e.clientX, e.clientY);
    if (id) this.events.onTap(id);
  };
  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const raw = Math.min(this.clock.getDelta(), 0.5), dt = Math.min(raw, 0.05), t = this.clock.elapsedTime;
    this.waterU.uTime.value = t;
    for (const f of this.spinners) f(t, dt);
    // 走路：按真实时间推进（掉帧也不会走得更慢）
    const kid = this.kid.root;
    if (this.route.length) {
      let move = 4.2 * raw;
      while (move > 0 && this.route.length) {
        const next = this.route[0], d = kid.position.distanceTo(next);
        const dir = next.clone().sub(kid.position).setY(0);
        if (dir.lengthSq() > 1e-6) { const yaw = Math.atan2(dir.x, dir.z); kid.rotation.y = kid.rotation.y + (((yaw - kid.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, raw * 10); }
        if (d <= move) { kid.position.copy(next); this.route.shift(); move -= d; }
        else { kid.position.addScaledVector(dir.normalize(), move); move = 0; }
      }
      this.speed = lerp(this.speed, 1, 0.2);
      if (!this.route.length && this.routeTarget) {
        const id = this.routeTarget; this.routeTarget = null; this.at = id;
        const st = this.stations.get(id);
        if (st) kid.rotation.y = Math.atan2(st.pos.x - kid.position.x, st.pos.z - kid.position.z);
        this.events.onArrive(id);
      }
    } else this.speed = lerp(this.speed, 0, 0.2);
    kid.position.y = 0;
    this.kid.update(t, dt, this.speed);
    // 小诺跟在小人肩膀后面飞
    const owlGoal = kid.position.clone().add(new THREE.Vector3(Math.sin(kid.rotation.y + 2.3) * 1.1, 2.1, Math.cos(kid.rotation.y + 2.3) * 1.1));
    this.owl.root.position.lerp(owlGoal, 1 - Math.pow(0.15, dt));
    this.owl.setFlying(this.speed > 0.3);
    this.owl.update(t, dt);
    this.owl.root.rotation.y = lerp(this.owl.root.rotation.y, kid.rotation.y * 0.3, 0.05);
    // 任务点：能玩的发光、图标上下浮动
    for (const st of this.stations.values()) {
      const m = st.ring.material as THREE.MeshBasicMaterial;
      const pulse = (st.ring.userData.pulse = Math.max(0, (st.ring.userData.pulse ?? 0) - dt));
      m.opacity = st.state === 'now' ? 0.55 + Math.sin(t * 3) * 0.25 : pulse > 0 ? pulse / 1.5 : 0;
      st.ring.scale.setScalar(1 + (st.state === 'now' ? Math.sin(t * 3) * 0.06 : 0));
      st.icon.position.y = 2.0 + (st.state === 'now' ? Math.sin(t * 2.4 + st.pos.x) * 0.12 : 0);
    }
    // 镜头跟着小人（空白处左右拖可以转视角）
    this.camTarget.lerp(this.overviewOn ? new THREE.Vector3(0, 0, 0) : kid.position, 1 - Math.pow(0.05, dt));
    const c = this.cam, g = this.camGoal, k = 1 - Math.pow(0.03, dt);
    c.yaw = lerp(c.yaw, g.yaw, k); c.pitch = lerp(c.pitch, g.pitch, k); c.dist = lerp(c.dist, g.dist, k);
    const cp = Math.cos(c.pitch);
    this.camera.position.set(this.camTarget.x + Math.sin(c.yaw) * cp * c.dist, this.camTarget.y + Math.sin(c.pitch) * c.dist, this.camTarget.z + Math.cos(c.yaw) * cp * c.dist);
    this.camera.lookAt(this.camTarget.x, this.camTarget.y + 0.8, this.camTarget.z);
    this.renderer.render(this.scene, this.camera);
  };
}
