import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { DOMAINS, type AreaId, type DomainId } from '../../shared/platform';
import { createOwl } from '../scene/characters';
import { PALETTE, clamp01, clay, ease, fbm, glowTexture, lerp, mesh, rng } from '../scene/util';
import { buildLandmark } from './landmarks';
import { createKid } from './kid';
import { sfx } from '../audio';

// 首页：一颗慢慢转的小星球。五块陆地 = 五个领域；点一块陆地，星球转过来、镜头推近，进入那块陆地的关卡。

const R = 7;
type Region = { d: DomainId; dir: THREE.Vector3; label: THREE.Sprite };
export type PlanetEvents = { onPick: (d: DomainId) => void };

/** 每个领域在星球上的位置（经纬度，度） */
// 五块大陆错开排在赤道两边
const PLACES: Record<DomainId, [number, number]> = { math: [16, 0], lang: [-14, 72], sci: [16, 144], grow: [-16, 216], art: [14, 288] };
/** 大陆在星球上用哪个地标 */
const LANDMARK: Record<DomainId, AreaId> = { math: 'num', lang: 'story', sci: 'sky', grow: 'heart', art: 'art' };
function dirFromLatLon(lat: number, lon: number) {
  const la = THREE.MathUtils.degToRad(lat), lo = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo));
}

/** 名字牌：图标 + 名字 + 进度小星；右上角的小圆章是今天的任务（'todo' 还没做 / 'done' 今天做过了） */
function labelTexture(icon: string, name: string, done: number, total: number, color: string, today: 'todo' | 'done' | null) {
  const c = document.createElement('canvas'); c.width = 560; c.height = 220;
  const g = c.getContext('2d')!;
  g.shadowColor = 'rgba(40,20,60,.35)'; g.shadowBlur = 16; g.shadowOffsetY = 6;
  g.fillStyle = 'rgba(255,250,240,.97)'; g.beginPath(); g.roundRect(10, 44, 496, 140, 70); g.fill();
  g.shadowColor = 'transparent';
  g.lineWidth = 10; g.strokeStyle = color; g.stroke();
  g.font = '92px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textBaseline = 'middle'; g.fillText(icon, 36, 118);
  g.fillStyle = '#2a3a33'; g.font = '700 54px "PingFang SC","Hiragino Sans GB",sans-serif'; g.fillText(name, 152, 98);
  // 进度：点亮了几关（一块大陆关卡很多，就不画一颗颗星了）
  g.fillStyle = '#ffcf4a'; g.font = '34px "Apple Color Emoji","Segoe UI Emoji",sans-serif'; g.fillText('⭐', 154, 150);
  g.fillStyle = '#8a7a6a'; g.font = '600 32px "PingFang SC",sans-serif'; g.fillText(done ? `点亮了 ${done} 关` : '还没开始', 198, 151);
  void total;
  if (today) {
    g.beginPath(); g.arc(500, 52, 40, 0, Math.PI * 2); g.fillStyle = today === 'done' ? '#4caf50' : '#ff8a3d'; g.fill();
    g.lineWidth = 7; g.strokeStyle = '#fff'; g.stroke();
    g.fillStyle = '#fff'; g.font = '800 46px "PingFang SC",sans-serif'; g.textAlign = 'center'; g.fillText(today === 'done' ? '✓' : '!', 500, 55);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class PlanetScene {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(34, 1, 0.1, 400);
  private clock = new THREE.Clock();
  private raf = 0; private disposed = false;
  private planet = new THREE.Group();
  private globe!: THREE.Mesh;
  private clouds = new THREE.Group();
  private regions: Region[] = [];
  private spins: ((t: number, dt: number) => void)[] = [];
  private owl = createOwl();
  private kid = createKid();
  private spinVel = 0.12;            // 自转速度（弧度/秒）
  private drag: { x: number; rot: number; moved: boolean; last: number; t: number } | null = null;
  private zoom = { from: 0, to: 0, t: 1, dur: 1 };
  private camZ = 24; private camGoalZ = 24; private camY = 2.4;
  private rotTween: { from: number; to: number; fromX: number; toX: number; t: number; dur: number; done: () => void } | null = null;
  private ray = new THREE.Raycaster(); private ptr = new THREE.Vector2();
  locked = false;

  constructor(private host: HTMLElement, private events: PlanetEvents) {
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.domElement.className = 'scene-canvas';
    host.appendChild(r.domElement);
    this.build();
    r.domElement.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    this.ro.observe(this.host);                  // 容器从隐藏变成显示时也要重新算尺寸
    this.resize();
    this.loop();
    if (import.meta.env.DEV) (window as unknown as { __planet: PlanetScene }).__planet = this;
  }
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf);
    window.removeEventListener('pointermove', this.onMove); window.removeEventListener('pointerup', this.onUp); this.ro.disconnect();
    this.renderer.dispose(); this.renderer.domElement.remove();
  }

  private build() {
    const s = this.scene;
    this.buildSpace();
    s.add(new THREE.HemisphereLight('#fff1e0', '#7d6a9a', 1.15));
    const sun = new THREE.DirectionalLight('#ffe2b8', 2.8); sun.position.set(-12, 10, 14); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 50 }); sun.shadow.bias = -0.0006;
    s.add(sun);
    const rim = new THREE.DirectionalLight('#ff9fc0', 1.3); rim.position.set(12, 4, -10); s.add(rim);

    s.add(this.planet);
    this.planet.rotation.x = 0.18;
    this.buildGlobe();
    // 陆地上的地标、小树、名字牌
    for (const d of DOMAINS) {
      const [lat, lon] = PLACES[d.id], dir = dirFromLatLon(lat, lon);
      const { group, spin } = buildLandmark(LANDMARK[d.id]);
      this.stick(group, dir, R + this.terrain(dir).h - 0.02, 0.72);
      this.spins.push(spin);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(d.icon, d.name, 0, 4, d.color, null), transparent: true }));
      label.scale.set(4.6, 1.8, 1); label.position.copy(dir.clone().multiplyScalar(R + 2.6)); this.planet.add(label);
      this.regions.push({ d: d.id, dir, label });
    }
    this.scatterTrees();
    // 星球顶上：小诺的树屋 + 小探险家
    const top = new THREE.Vector3(0, 1, 0);
    const hut = new THREE.Group();
    mesh(new RoundedBoxGeometry(1.4, 0.9, 1.2, 2, 0.1), clay('#f2c590', 0.85), hut).position.y = 0.45;
    for (const sgn of [-1, 1]) { const slab = mesh(new RoundedBoxGeometry(1.6, 0.1, 0.9, 2, 0.04), clay(PALETTE.satchel, 0.6), hut); slab.position.set(0, 1.05, sgn * 0.33); slab.rotation.x = sgn * 0.6; }
    mesh(new RoundedBoxGeometry(0.34, 0.55, 0.06, 2, 0.05), clay(PALETTE.woodDark), hut).position.set(0, 0.3, 0.61);
    const tree = new THREE.Group(); tree.position.set(0.95, 0, -0.3); hut.add(tree);
    mesh(new THREE.CylinderGeometry(0.1, 0.16, 1.2, 8).translate(0, 0.6, 0), clay('#8a5b3c'), tree);
    mesh(new THREE.IcosahedronGeometry(0.6, 2), clay('#6fb04f', 0.85), tree).position.y = 1.45;
    this.stick(hut, top, R + this.terrain(top).h - 0.03, 0.9);
    const kidDir = dirFromLatLon(80, 20);
    this.kid.root.scale.setScalar(0.38); this.stick(this.kid.root, kidDir, R + this.terrain(kidDir).h - 0.02, 1);
    // 云朵绕着星球转
    const cloudM = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#fff4ea', emissiveIntensity: 0.35 });
    const rr = rng(8);
    for (let i = 0; i < 7; i++) {
      const c = new THREE.Group();
      for (let k = 0; k < 4; k++) { const b = mesh(new THREE.SphereGeometry(0.35 + rr() * 0.25, 14, 10), cloudM, c, false); b.position.set(k * 0.45 - 0.7, rr() * 0.15, rr() * 0.2); b.scale.y = 0.7; }
      const dir = dirFromLatLon(-40 + rr() * 80, i * 51);
      c.position.copy(dir.multiplyScalar(R + 1.7)); c.lookAt(0, 0, 0);
      this.clouds.add(c);
    }
    s.add(this.clouds);
    this.owl.root.scale.setScalar(0.55); s.add(this.owl.root);
  }

  // ===================== 星球外面：黄昏的星空 =====================
  private starsU = { uTime: { value: 0 } };
  private moon = new THREE.Group();
  private shooting!: THREE.Mesh;
  private shootT = 4;
  private buildSpace() {
    const s = this.scene;
    // 天空：上面是深一点的蓝紫，往下变成粉紫、暖橙（暖色的黄昏，不是黑漆漆的太空）
    const sky = new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `varying vec3 vD;
        void main(){ float y = vD.y;
          vec3 top = vec3(0.17,0.18,0.42), mid = vec3(0.50,0.36,0.66), low = vec3(1.0,0.66,0.52);
          vec3 col = mix(low, mid, smoothstep(-0.35, 0.15, y)); col = mix(col, top, smoothstep(0.1, 0.75, y));
          // 远处淡淡的彩色星云
          float neb = sin(vD.x*3.1+1.3)*sin(vD.y*2.3+0.4)*sin(vD.z*2.7);
          col += vec3(0.35,0.18,0.45) * smoothstep(0.35, 0.9, neb) * 0.35;
          gl_FragColor = vec4(col,1.0);
          #include <colorspace_fragment>
        }`
    }));
    s.add(sky);
    // 一闪一闪的星星（大小不一，各闪各的）
    const N = 900, pos = new Float32Array(N * 3), seed = new Float32Array(N), rr = rng(31);
    for (let i = 0; i < N; i++) {
      const v = new THREE.Vector3(rr() * 2 - 1, rr() * 1.4 - 0.25, rr() * 2 - 1).normalize().multiplyScalar(110);
      pos.set([v.x, v.y, v.z], i * 3); seed[i] = rr();
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const stars = new THREE.Points(sg, new THREE.ShaderMaterial({
      uniforms: this.starsU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float seed; uniform float uTime; varying float vA; varying float vS;
        void main(){ vS = seed; vA = 0.55 + 0.45*sin(uTime*(1.0+seed*2.5) + seed*40.0);
          vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = (2.0 + seed*seed*7.0) * vA; gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `varying float vA; varying float vS;
        void main(){ vec2 p = gl_PointCoord-0.5; float d = length(p);
          float core = smoothstep(0.5, 0.0, d); float cross = max(0.0, 1.0-abs(p.x)*9.0)*max(0.0,1.0-abs(p.y)*2.2) + max(0.0,1.0-abs(p.y)*9.0)*max(0.0,1.0-abs(p.x)*2.2);
          vec3 c = mix(vec3(1.0,0.95,0.8), vec3(0.8,0.9,1.0), vS);
          gl_FragColor = vec4(c, (core*0.9 + cross*0.35*step(0.75, vS)) * vA); }`
    }));
    s.add(stars);
    // 太阳的光晕（在左后方，和主光一个方向）
    const glow = glowTexture();
    const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#ffd9a0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sunGlow.position.set(-55, 40, -70); sunGlow.scale.setScalar(55); s.add(sunGlow);
    const sunDisc = mesh(new THREE.SphereGeometry(3.2, 24, 16), new THREE.MeshBasicMaterial({ color: '#fff1cf' }), s, false); sunDisc.position.copy(sunGlow.position);
    // 远处的两颗小星球：一颗带光环，一颗粉粉的
    const ringed = new THREE.Group(); ringed.position.set(34, 14, -60); s.add(ringed);
    mesh(new THREE.SphereGeometry(4, 32, 20), clay('#ffb877', 0.7), ringed, false);
    const ring = mesh(new THREE.RingGeometry(5.2, 7.6, 48), new THREE.MeshStandardMaterial({ color: '#ffe3b0', side: THREE.DoubleSide, transparent: true, opacity: 0.8 }), ringed, false); ring.rotation.x = 1.2; ring.rotation.y = 0.3;
    const pink = mesh(new THREE.SphereGeometry(2.4, 24, 16), clay('#f59ac0', 0.7), s, false); pink.position.set(-38, -8, -52);
    const tiny = mesh(new THREE.SphereGeometry(1.3, 18, 12), clay('#9fd4ff', 0.7), s, false); tiny.position.set(24, -16, -40);
    // 绕着我们星球转的小月亮（带几个坑）
    const moonBall = mesh(new THREE.SphereGeometry(0.75, 28, 18), clay('#f3ead6', 0.9), this.moon);
    for (let i = 0; i < 5; i++) {
      const v = new THREE.Vector3(rr() - 0.5, rr() - 0.5, rr() - 0.5).normalize();
      const crater = mesh(new THREE.CircleGeometry(0.1 + rr() * 0.1, 14), clay('#d9cdb4', 0.95), moonBall, false);
      crater.position.copy(v.multiplyScalar(0.752)); crater.lookAt(crater.position.clone().multiplyScalar(2));
    }
    s.add(this.moon);
    // 偶尔划过的流星
    this.shooting = new THREE.Mesh(new THREE.PlaneGeometry(9, 0.12), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform float uA; varying vec2 vU; void main(){ float a = pow(vU.x, 3.0) * (1.0 - abs(vU.y-0.5)*2.0); gl_FragColor = vec4(1.0,0.97,0.88, a*uA); }',
      uniforms: { uA: { value: 0 } }
    }));
    this.shooting.visible = false; s.add(this.shooting);
  }
  private updateSpace(t: number, dt: number) {
    this.starsU.uTime.value = t;
    // 月亮斜斜地绕一圈
    const a = t * 0.18;
    this.moon.position.set(Math.cos(a) * 13.5, Math.sin(a) * 3.6 + 1.5, Math.sin(a) * 13.5 - 2);
    this.moon.rotation.y = t * 0.3;
    // 流星：每隔几秒从右上划到左下
    this.shootT -= dt;
    const m = this.shooting.material as THREE.ShaderMaterial;
    if (this.shootT < 0) { this.shootT = 6 + Math.random() * 6; this.shooting.userData.life = 0; this.shooting.userData.from = new THREE.Vector3(10 + Math.random() * 30, 26 + Math.random() * 8, -60); this.shooting.visible = true; }
    if (this.shooting.visible) {
      const life = (this.shooting.userData.life += dt), from = this.shooting.userData.from as THREE.Vector3;
      const dir = new THREE.Vector3(-1, -0.45, 0).normalize();
      this.shooting.position.copy(from).addScaledVector(dir, life * 38);
      this.shooting.rotation.z = Math.atan2(dir.y, dir.x) + Math.PI;
      m.uniforms.uA.value = Math.sin(clamp01(life / 0.9) * Math.PI);
      if (life > 0.9) this.shooting.visible = false;
    }
  }

  // ===================== 星球本体 =====================
  /** 地形：离哪块陆地最近、有多高（陆地凸起，海底凹下去，海面在 R 处） */
  private centers = DOMAINS.map(d => ({ dir: dirFromLatLon(...PLACES[d.id]), d }));
  private terrain(v0: THREE.Vector3) {
    const v = v0.clone().normalize();
    const n = fbm(v.x * 2.6 + 3, v.z * 2.6 + v.y * 1.9) - 0.5;
    let m = -1, dom: typeof DOMAINS[number] | null = null;
    for (const c of this.centers) { const x = 0.46 - v.angleTo(c.dir) + n * 0.22; if (x > m) { m = x; dom = c.d; } }
    const hm = 0.26 - v.angleTo(new THREE.Vector3(0, 1, 0)) + n * 0.12;
    if (hm > m) { m = hm; dom = null; }
    const hill = fbm(v.x * 7 + 11, v.y * 7 - v.z * 5) - 0.5;
    const smooth = (a: number, b: number, x: number) => { const k = clamp01((x - a) / (b - a)); return k * k * (3 - 2 * k); };
    const h = lerp(-0.34, 0.1, smooth(-0.14, 0.0, m)) + (m > 0 ? smooth(0, 0.28, m) * 0.2 + hill * 0.08 * smooth(0, 0.15, m) : 0);
    return { h, m, dom, n };
  }
  /** 星球：海底 + 陆地是一个起伏的球，外面再罩一层亮亮的海面；海岸线就是陆地露出海面的地方，很圆滑 */
  private buildGlobe() {
    const geo = new THREE.SphereGeometry(R, 240, 160);
    const pos = geo.getAttribute('position'), colors = new Float32Array(pos.count * 3);
    const seabed = new THREE.Color('#5fc7c0'), deepbed = new THREE.Color('#2a7fa8'), sand = new THREE.Color('#f6dfa8'), grass = new THREE.Color('#9ad468'), homeG = new THREE.Color('#a8dc74'), c = new THREE.Color();
    const tints = Object.fromEntries(DOMAINS.map(d => [d.id, new THREE.Color(d.color)])), white = new THREE.Color('#ffffff');
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      const { h, dom, n } = this.terrain(v);
      pos.setXYZ(i, v.x * (R + h), v.y * (R + h), v.z * (R + h));
      if (h < 0.0) c.copy(seabed).lerp(deepbed, clamp01(-h / 0.3));
      else if (h < 0.075) c.copy(sand);
      else {
        // 每块陆地有自己的颜色：草地 + 领域色，浅浅的、亮亮的
        // 每块陆地用自己领域色的“粉彩版”：一眼就分得出是哪块；带一点点草绿，看起来还是地面
        if (dom) c.copy(tints[dom.id]).lerp(white, 0.3).lerp(grass, 0.18); else c.copy(homeG);
        c.offsetHSL(0, 0.04, n * 0.08);
      }
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    this.globe = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
    this.globe.receiveShadow = true; this.globe.castShadow = true;
    this.planet.add(this.globe);
    // 海面：半透明、有一点光泽，能看到下面浅浅的海底
    const sea = new THREE.Mesh(new THREE.SphereGeometry(R + 0.03, 128, 80), new THREE.MeshStandardMaterial({ color: '#36c4e6', roughness: 0.42, metalness: 0, transparent: true, opacity: 0.8 }));
    sea.receiveShadow = true; this.planet.add(sea);
    // 大气光圈：星球边上一圈柔柔的亮边
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.16, 64, 40), new THREE.ShaderMaterial({
      side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.NormalBlending,
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){ float f = pow(clamp(-dot(vN, vV) / 0.5, 0.0, 1.0), 2.6); gl_FragColor = vec4(vec3(0.66,0.9,1.0), f * 0.75); }'
    }));
    this.scene.add(atmo);
  }
  /** 把物体立在星球表面（物体的 +Y 朝外） */
  private stick(obj: THREE.Object3D, dir: THREE.Vector3, r: number, scale: number) {
    obj.position.copy(dir.clone().normalize().multiplyScalar(r));
    obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    obj.scale.multiplyScalar(scale);
    obj.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
    this.planet.add(obj);
  }
  private scatterTrees() {
    const rr = rng(21), trunk = clay('#8a5b3c'), greens = ['#4f9a4a', '#6fb04f', '#e39a3f', '#ff9fb8'].map(c => clay(c, 0.85));
    for (const d of DOMAINS) {
      const center = dirFromLatLon(...PLACES[d.id]);
      let placed = 0;
      for (let tries = 0; tries < 50 && placed < 7; tries++) {
        const off = new THREE.Vector3(rr() - 0.5, rr() - 0.5, rr() - 0.5).multiplyScalar(0.85);
        const dir = center.clone().add(off).normalize();
        const a = dir.angleTo(center), tr = this.terrain(dir);
        if (a < 0.2 || tr.h < 0.12 || tr.dom?.id !== d.id) continue;   // 别挡住地标，也别长在海边
        const t = new THREE.Group();
        mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.5, 6).translate(0, 0.25, 0), trunk, t);
        mesh(new THREE.IcosahedronGeometry(0.32, 1), greens[rr() < 0.25 ? 2 + Math.floor(rr() * 2) : Math.floor(rr() * 2)], t).position.y = 0.65;
        this.stick(t, dir, R + tr.h - 0.03, 0.8 + rr() * 0.5);
        placed++;
      }
    }
  }

  /** 更新名字牌：进度星星 + 今天的任务小圆章 */
  setProgress(progress: Record<DomainId, { done: number; total: number; today?: 'todo' | 'done' | null }>) {
    for (const r of this.regions) {
      const d = DOMAINS.find(x => x.id === r.d)!, pr = progress[r.d];
      (r.label.material as THREE.SpriteMaterial).map = labelTexture(d.icon, d.name, pr.done, pr.total, d.color, pr.today ?? null);
      (r.label.material as THREE.SpriteMaterial).needsUpdate = true;
    }
  }

  /** 选中一块陆地：星球转到正面，镜头推近（返回 Promise，动画结束后再切换页面） */
  focus(d: DomainId): Promise<void> {
    const r = this.regions.find(x => x.d === d)!;
    this.locked = true; sfx.whoosh();
    const phi = Math.atan2(r.dir.x, r.dir.z);
    let to = -phi; const cur = this.planet.rotation.y;
    while (to - cur > Math.PI) to -= Math.PI * 2;
    while (to - cur < -Math.PI) to += Math.PI * 2;
    // 再前后倾一点，让南边、北边的陆地都转到画面正中间
    const lat = Math.asin(THREE.MathUtils.clamp(r.dir.y, -1, 1));
    return new Promise(resolve => {
      this.rotTween = { from: cur, to, fromX: this.planet.rotation.x, toX: lat, t: 0, dur: 0.9, done: () => { this.camGoalZ = 15; setTimeout(resolve, 650); } };
    });
  }
  /** 回到星球全貌 */
  reset() { this.locked = false; this.camGoalZ = this.baseZ; this.rotTween = null; this.planet.rotation.x = 0.18; }
  private baseZ = 24;

  private shiftPx = 0;
  /** 画面整体往右挪 px 像素（给左边的今日任务让位置） */
  setShift(px: number) { this.shiftPx = px; this.resize(); }
  private ro = new ResizeObserver(() => this.resize());
  private resize = () => {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;                          // 容器还没显示（0×0）时不算，否则宽高比变成 NaN，镜头就一直是黑屏
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // 左边开着今日任务时，把星球往右挪一点（只挪画面，不动 3D 场景）
    if (this.shiftPx) this.camera.setViewOffset(w, h, -this.shiftPx, 0, w, h); else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.baseZ = THREE.MathUtils.clamp((R + 3.4) / (tan * Math.min(1, this.camera.aspect)), 18, 40);
    if (!this.locked) { this.camGoalZ = this.baseZ; this.camZ = this.camZ || this.baseZ; }
  };
  private pick(cx: number, cy: number): DomainId | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ptr.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.ptr, this.camera);
    const lab = this.ray.intersectObjects(this.regions.map(r => r.label), false)[0];
    const hit = this.ray.intersectObject(this.globe, false)[0];
    // 转到背面的牌子被星球挡住，不能点
    if (lab && (!hit || lab.distance < hit.distance)) return this.regions.find(r => r.label === lab.object)!.d;
    if (!hit) return null;
    const local = this.planet.worldToLocal(hit.point.clone()).normalize();
    let best: Region | null = null, bestA = 0.8;
    for (const r of this.regions) { const a = local.angleTo(r.dir); if (a < bestA) { bestA = a; best = r; } }
    return best?.d ?? null;
  }
  private onDown = (e: PointerEvent) => { if (this.locked) return; this.drag = { x: e.clientX, rot: this.planet.rotation.y, moved: false, last: e.clientX, t: performance.now() }; };
  private onMove = (e: PointerEvent) => {
    if (!this.drag) return;
    const dx = e.clientX - this.drag.x;
    if (Math.abs(dx) > 8) this.drag.moved = true;
    if (this.drag.moved) {
      this.planet.rotation.y = this.drag.rot + dx * 0.008;
      const now = performance.now(); this.spinVel = ((e.clientX - this.drag.last) * 0.008) / Math.max(0.016, (now - this.drag.t) / 1000);
      this.drag.last = e.clientX; this.drag.t = now;
    }
  };
  private onUp = (e: PointerEvent) => {
    const d = this.drag; this.drag = null;
    if (!d || this.locked) return;
    if (d.moved) return;                           // 拨动星球，松手后继续带着惯性转
    const id = this.pick(e.clientX, e.clientY);
    if (id) { sfx.tap(); this.events.onPick(id); }
  };

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const raw = Math.min(this.clock.getDelta(), 0.5), dt = Math.min(raw, 0.05), t = this.clock.elapsedTime;
    if (this.rotTween) {
      const tw = this.rotTween; tw.t += raw; const k = clamp01(tw.t / tw.dur);
      this.planet.rotation.y = lerp(tw.from, tw.to, ease(k)); this.planet.rotation.x = lerp(tw.fromX, tw.toX, ease(k));
      if (k >= 1) { this.rotTween = null; tw.done(); }
    } else if (!this.drag && !this.locked) {
      // 拨完后的惯性慢慢回到平常的自转速度
      this.spinVel = lerp(this.spinVel, 0.12, 1 - Math.pow(0.4, dt));
      this.planet.rotation.y += this.spinVel * dt;
    }
    for (const f of this.spins) f(t, dt);
    this.updateSpace(t, dt);
    this.clouds.rotation.y += dt * 0.05; this.clouds.rotation.x = Math.sin(t * 0.1) * 0.1;
    // 小诺绕着星球飞
    const a = t * 0.35;
    this.owl.root.position.set(Math.sin(a) * (R + 2.2), 2.4 + Math.sin(t * 0.8) * 0.6, Math.cos(a) * (R + 2.2));
    this.owl.root.rotation.y = a + Math.PI / 2;
    this.owl.setFlying(true); this.owl.update(t, dt);
    this.kid.update(t, dt, 0);
    this.camZ = lerp(this.camZ, this.camGoalZ, 1 - Math.pow(0.03, dt));
    this.camera.position.set(0, this.camY * (this.camZ / 24), this.camZ);
    this.camera.lookAt(0, 0.3, 0);
    this.renderer.render(this.scene, this.camera);
  };
}
