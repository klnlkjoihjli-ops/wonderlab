import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE, clay, glowTexture, gradientColors, mesh, rng } from './util';
import { GAP, HOME, POST_OFFICE, ROAD_Y, WATER_Y, creekHalf, creekX, heightAt } from './terrain';

const vc = (color?: string) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, ...(color ? { color } : {}) });

function canopyGeo(seed: number, bottom: string, top: string) {
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const n = 4 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const g = new THREE.IcosahedronGeometry(0.75 + r() * 0.45, 2);
    const a = (i / n) * Math.PI * 2 + r();
    g.scale(1, 0.88, 1);
    g.translate(Math.cos(a) * 0.55 * (i ? 1 : 0), 2.3 + (i ? r() * 0.5 : 0.75), Math.sin(a) * 0.55 * (i ? 1 : 0));
    parts.push(g);
  }
  return gradientColors(mergeGeometries(parts.map(p => p.toNonIndexed())), bottom, top, 1.5, 3.6);
}
function pineGeo(bottom: string, top: string) {
  const parts = [0, 1, 2, 3].map(i => { const g = new THREE.ConeGeometry(1.25 - i * 0.24, 1.35, 9); g.translate(0, 1.4 + i * 0.72, 0); return g.toNonIndexed(); });
  return gradientColors(mergeGeometries(parts), bottom, top, 0.9, 4.2);
}

/** 树林：圆冠树、松树和几棵金黄的秋树 */
export function buildTrees(scene: THREE.Scene) {
  const trunkGeo = new THREE.CylinderGeometry(0.13, 0.22, 2.1, 7); trunkGeo.translate(0, 1.0, 0);
  const trunkMat = clay('#8a5b3c');
  const canopies = [
    { geo: canopyGeo(3, '#3f8442', '#9fd05e'), w: 5 },
    { geo: canopyGeo(9, '#4a8c3f', '#b9d763'), w: 4 },
    { geo: canopyGeo(21, '#d57a35', '#f7c75e'), w: 1.4 },
    { geo: canopyGeo(33, '#c75f3a', '#f29c55'), w: 0.8 }
  ];
  const pines = [pineGeo('#245b43', '#5e9c5c'), pineGeo('#2c6648', '#78ad5e')];
  const canopyMat = vc(), r = rng(42);
  const placed: THREE.Vector2[] = [];
  const ok = (x: number, z: number, minGap: number) => {
    if (Math.abs(z) < 2.4 && Math.abs(x) < 12) return false;                       // 主路
    if (Math.abs(x - creekX(z)) < creekHalf(z) + 1.3) return false;              // 小溪
    if (Math.hypot(x - POST_OFFICE.x, z - POST_OFFICE.z) < 3.3) return false;
    if (Math.hypot(x - HOME.x, z - HOME.z) < 3.4) return false;
    if (z > 1.5 && Math.abs(x) < 8.5) return false;                              // 留出孩子观察的前景
    if (z > -2 && z < 2.5 && Math.abs(x) < 4.5) return false;
    return !placed.some(p => p.distanceTo(new THREE.Vector2(x, z)) < minGap);
  };
  let tries = 0;
  while (placed.length < 120 && tries++ < 6000) {
    const x = (r() - 0.5) * 50, z = -30 + r() * 42;
    const far = z < -7;
    if (!ok(x, z, far ? 1.7 : 2.3)) continue;
    placed.push(new THREE.Vector2(x, z));
    const g = new THREE.Group();
    const s = (far ? 1.1 : 0.9) + r() * 0.55;
    g.position.set(x, heightAt(x, z) - 0.05, z); g.scale.setScalar(s); g.rotation.y = r() * 6.28;
    if (r() < 0.35) {
      mesh(pines[Math.floor(r() * 2)], canopyMat, g);
      mesh(trunkGeo, trunkMat, g).scale.set(0.8, 0.6, 0.8);
    } else {
      const total = canopies.reduce((a, c) => a + c.w, 0);
      let pick = r() * total, chosen = canopies[0];
      for (const c of canopies) { pick -= c.w; if (pick <= 0) { chosen = c; break; } }
      mesh(trunkGeo, trunkMat, g); mesh(chosen.geo, canopyMat, g);
    }
    scene.add(g);
  }
}

/** 草丛、小花、石头、芦苇、蘑菇——用实例化保持平板流畅 */
export function buildGroundDetail(scene: THREE.Scene) {
  const r = rng(5);
  const blade = (h: number, a: number) => { const g = new THREE.ConeGeometry(0.05, h, 4); g.translate(0, h / 2, 0); g.rotateZ(a); return g.toNonIndexed(); };
  const tuft = gradientColors(mergeGeometries([blade(0.42, 0.25), blade(0.55, -0.15), blade(0.36, -0.45), blade(0.48, 0.05)]), '#3f7d3b', '#bfe07a', 0, 0.5);
  const grass = new THREE.InstancedMesh(tuft, vc(), 1600);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  let n = 0;
  for (let i = 0; i < 6000 && n < 1600; i++) {
    const x = (r() - 0.5) * 34, z = -14 + r() * 26;
    const d = Math.abs(x - creekX(z)) - creekHalf(z);
    if (d < 0.25 || (Math.abs(z) < 1.25 && Math.abs(x) < 12)) continue;
    // 越靠近镜头越矮，避免前景杂乱挡住操作区
    const near = z > 2.5 ? Math.max(0.35, 1 - (z - 2.5) * 0.12) : 1;
    if (z > 3 && Math.abs(x) < 6 && r() < 0.6) continue;
    p.set(x, heightAt(x, z) - 0.02, z); q.setFromAxisAngle(up, r() * 6.3); s.setScalar((0.7 + r() * 0.9) * near);
    grass.setMatrixAt(n++, m.compose(p, q, s));
  }
  grass.count = n; grass.receiveShadow = true; scene.add(grass);

  // 小花
  const headGeo = new THREE.IcosahedronGeometry(0.09, 1); headGeo.translate(0, 0.32, 0);
  const stemGeo = new THREE.CylinderGeometry(0.015, 0.02, 0.32, 4); stemGeo.translate(0, 0.16, 0);
  const flowerColors = ['#ffffff', '#ffd45c', '#ff9fb2', '#c9a7ff', '#ff8a5c'].map(c => new THREE.Color(c));
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({ roughness: 0.6 }), 260);
  const stems = new THREE.InstancedMesh(stemGeo, clay('#5f9a48'), 260);
  n = 0;
  for (let i = 0; i < 3000 && n < 260; i++) {
    const cx = (r() - 0.5) * 30, cz = -10 + r() * 20;
    const d = Math.abs(cx - creekX(cz)) - creekHalf(cz);
    if (d < 0.6 || (Math.abs(cz) < 1.4 && Math.abs(cx) < 12)) continue;
    const color = flowerColors[Math.floor(r() * flowerColors.length)];
    for (let k = 0; k < 3 && n < 260; k++) {
      const x = cx + (r() - 0.5) * 0.7, z = cz + (r() - 0.5) * 0.7;
      p.set(x, heightAt(x, z) - 0.02, z); q.identity(); s.setScalar(0.8 + r() * 0.6);
      m.compose(p, q, s); heads.setMatrixAt(n, m); stems.setMatrixAt(n, m); heads.setColorAt(n, color); n++;
    }
  }
  heads.count = stems.count = n; heads.castShadow = true; scene.add(heads, stems);

  // 岸边卵石
  const stoneGeo = new THREE.DodecahedronGeometry(0.3, 1);
  const stones = new THREE.InstancedMesh(stoneGeo, new THREE.MeshStandardMaterial({ roughness: 0.9 }), 120);
  const stoneColors = ['#b9c2c4', '#a2adb3', '#cfc7b6', '#9aa6a0'].map(c => new THREE.Color(c));
  n = 0;
  for (let i = 0; i < 400 && n < 120; i++) {
    const z = -14 + r() * 24; if (Math.abs(z) < 1.6) continue;
    const side = r() < 0.5 ? -1 : 1;
    const x = creekX(z) + side * (creekHalf(z) + (r() - 0.3) * 0.6);
    p.set(x, Math.max(heightAt(x, z), WATER_Y) - 0.05, z); q.setFromEuler(new THREE.Euler(r(), r() * 6, r())); s.set(0.6 + r(), 0.4 + r() * 0.4, 0.6 + r());
    stones.setMatrixAt(n, m.compose(p, q, s)); stones.setColorAt(n, stoneColors[n % 4]); n++;
  }
  stones.count = n; stones.castShadow = stones.receiveShadow = true; scene.add(stones);

  // 芦苇
  const reed = gradientColors(new THREE.CylinderGeometry(0.02, 0.03, 1.1, 4).translate(0, 0.55, 0), '#4c7d3e', '#9cc56a', 0, 1.1);
  const cattail = new THREE.CapsuleGeometry(0.05, 0.18, 3, 6).translate(0, 1.15, 0);
  const reeds = new THREE.InstancedMesh(reed, vc(), 90), tails = new THREE.InstancedMesh(cattail, clay('#8a5532'), 90);
  n = 0;
  for (let i = 0; i < 300 && n < 90; i++) {
    const z = -14 + r() * 16.5; if (Math.abs(z) < 2.2) continue;
    const side = r() < 0.5 ? -1 : 1, x = creekX(z) + side * (creekHalf(z) - 0.1 + r() * 0.4);
    p.set(x, Math.max(heightAt(x, z), WATER_Y) - 0.1, z); q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3)); s.setScalar(0.7 + r() * 0.6);
    m.compose(p, q, s); reeds.setMatrixAt(n, m); tails.setMatrixAt(n, m); n++;
  }
  reeds.count = tails.count = n; scene.add(reeds, tails);

  // 蘑菇丛
  for (const [x, z] of [[-4.2, 3.4], [4.6, 4.2], [-9.5, -1.8], [9.6, 2.4], [-3.4, -5.8]]) {
    for (let k = 0; k < 3; k++) {
      const g = new THREE.Group(), sc = 0.5 + k * 0.22;
      const px = x + k * 0.32 - 0.3, pz = z + (k % 2) * 0.25;
      g.position.set(px, heightAt(px, pz), pz); g.scale.setScalar(sc);
      mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.42, 8).translate(0, 0.21, 0), clay(PALETTE.cream), g);
      const cap = mesh(new THREE.SphereGeometry(0.32, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), clay(k === 1 ? '#f2a03d' : PALETTE.cherry, 0.6), g); cap.position.y = 0.38; cap.scale.y = 0.75;
      scene.add(g);
    }
  }
}

/** 桥头：两岸的石砌桥台、木桩，以及小溪中间那块可以立桥墩的大石头 */
export function buildBridgeSite(scene: THREE.Scene) {
  const r = rng(11);
  const stoneMats = ['#aeb8bc', '#98a4aa', '#c3c6bb'].map(c => clay(c, 0.92));
  for (const side of [-1, 1]) {
    for (let row = 0; row < 3; row++) {
      for (let k = 0; k < 4; k++) {
        const w = 0.55 + r() * 0.2;
        const geo = new RoundedBoxGeometry(0.62, 0.48, w, 2, 0.12);
        const st = mesh(geo, stoneMats[(row + k) % 3], scene);
        st.position.set(side * (GAP + 0.18) + (r() - 0.5) * 0.06, ROAD_Y - 0.26 - row * 0.44, -1.15 + k * 0.76 + (row % 2) * 0.2 - 0.1);
        st.rotation.y = (r() - 0.5) * 0.2;
      }
    }
    // 桥头木桩：告诉孩子“桥在这里”
    for (const z of [-0.95, 0.95]) {
      const post = mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.95, 10), clay(PALETTE.woodDark), scene);
      post.position.set(side * (GAP + 0.42), ROAD_Y + 0.42, z);
      const cap = mesh(new THREE.SphereGeometry(0.13, 10, 8), clay(PALETTE.woodLight), scene); cap.position.set(side * (GAP + 0.42), ROAD_Y + 0.92, z);
    }
  }
  // 中间的大石头（桥墩可以立在这里）
  const rock = mesh(new THREE.DodecahedronGeometry(0.7, 1), clay('#9aa6ac', 0.9), scene);
  rock.scale.set(1.0, 0.5, 1.35); rock.position.set(0, WATER_Y - 0.08, 0);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.0, 40), new THREE.MeshBasicMaterial({ color: '#e6fbf6', transparent: true, opacity: 0.55 }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(0, WATER_Y + 0.02, 0); ring.scale.set(1, 1.3, 1);
  scene.add(ring);
  return { ring };
}

/** 森林邮局 */
export function buildPostOffice(scene: THREE.Scene) {
  const g = new THREE.Group(); g.position.copy(POST_OFFICE); g.rotation.y = 0.18; scene.add(g);
  mesh(new RoundedBoxGeometry(3.3, 0.32, 2.7, 2, 0.1), clay('#b6b0a0'), g).position.y = 0.06;
  const walls = mesh(gradientColors(new RoundedBoxGeometry(2.8, 1.9, 2.2, 3, 0.16), '#f0d9b0', '#fff3dc', 0, 1.9), vc(), g); walls.position.y = 1.15;
  // 屋顶：邮差包一样的蓝色
  const roofMat = clay(PALETTE.satchel, 0.7);
  for (const s of [-1, 1]) {
    const slab = mesh(new RoundedBoxGeometry(3.4, 0.22, 1.75, 2, 0.1), roofMat, g);
    slab.position.set(0, 2.55, s * 0.62); slab.rotation.x = s * 0.62;
  }
  const ridge = mesh(new THREE.CylinderGeometry(0.15, 0.15, 3.5, 12), clay('#2e4aa0'), g); ridge.rotation.z = Math.PI / 2; ridge.position.y = 3.02;
  const gable = new THREE.Shape(); gable.moveTo(-1.1, 0); gable.lineTo(1.1, 0); gable.lineTo(0, 0.95); gable.closePath();
  for (const s of [-1, 1]) { const tri = mesh(new THREE.ExtrudeGeometry(gable, { depth: 0.1, bevelEnabled: false }), clay('#f6e2bd'), g); tri.rotation.y = Math.PI / 2; tri.position.set(s * 1.36 - 0.05, 2.08, 1.1); tri.scale.set(1, 1, 1); }
  const chimney = mesh(new RoundedBoxGeometry(0.42, 0.9, 0.42, 2, 0.08), clay('#c6765a'), g); chimney.position.set(0.85, 3.0, -0.45);
  // 门、窗、信封招牌
  const door = mesh(new RoundedBoxGeometry(0.75, 1.15, 0.12, 3, 0.1), clay(PALETTE.woodDark), g); door.position.set(0, 0.8, 1.12);
  mesh(new THREE.SphereGeometry(0.05, 8, 6), clay('#ffd27a'), g).position.set(0.24, 0.8, 1.2);
  const glow = new THREE.MeshStandardMaterial({ color: '#ffe3a1', emissive: '#ffb84d', emissiveIntensity: 0.9 });
  for (const x of [-0.95, 0.95]) {
    const frame = mesh(new THREE.TorusGeometry(0.27, 0.06, 8, 24), clay(PALETTE.woodDark), g); frame.position.set(x, 1.35, 1.12);
    mesh(new THREE.CircleGeometry(0.26, 24), glow, g).position.set(x, 1.35, 1.11);
  }
  const sign = new THREE.Group(); sign.position.set(0, 1.95, 1.2); g.add(sign);
  mesh(new RoundedBoxGeometry(0.95, 0.62, 0.08, 2, 0.06), clay('#ffffff', 0.6), sign);
  for (const s of [-1, 1]) { const flap = mesh(new THREE.BoxGeometry(0.56, 0.07, 0.04), clay(PALETTE.cherry), sign); flap.position.set(s * 0.22, 0.08, 0.05); flap.rotation.z = -s * 0.55; }
  // 门口的红色邮筒
  const box = new THREE.Group(); box.position.set(1.75, 0.2, 1.35); g.add(box);
  mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.95, 18).translate(0, 0.48, 0), clay(PALETTE.cherry, 0.55), box);
  mesh(new THREE.SphereGeometry(0.3, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2), clay(PALETTE.cherry, 0.55), box).position.y = 0.95;
  mesh(new THREE.BoxGeometry(0.3, 0.05, 0.06), clay(PALETTE.ink), box).position.set(0, 0.78, 0.29);
  // 烟囱的烟
  const puffs: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, roughness: 1 })); g.add(p); puffs.push(p); }
  return { group: g, update(t: number) { puffs.forEach((p, i) => { const k = ((t * 0.25 + i / 4) % 1); p.position.set(0.85 + k * 0.4, 3.55 + k * 1.6, -0.45 - k * 0.2); p.scale.setScalar(0.5 + k * 1.2); (p.material as THREE.MeshStandardMaterial).opacity = 0.75 * (1 - k); }); } };
}

/** 小兔的蘑菇屋和路边信箱 */
export function buildHome(scene: THREE.Scene) {
  const g = new THREE.Group(); g.position.copy(HOME); g.rotation.y = -0.22; scene.add(g);
  const stem = mesh(gradientColors(new THREE.CylinderGeometry(1.0, 1.2, 1.9, 28).translate(0, 0.95, 0), '#ecd5ae', '#fff4df', 0, 1.9), vc(), g);
  stem.position.y = 0.05;
  const cap = mesh(new THREE.SphereGeometry(1.85, 36, 18, 0, Math.PI * 2, 0, Math.PI * 0.55), clay(PALETTE.cherry, 0.5), g);
  cap.position.y = 1.75; cap.scale.y = 0.72;
  const under = mesh(new THREE.CircleGeometry(1.82, 36), clay('#f2c9a0'), g); under.rotation.x = Math.PI / 2; under.position.y = 1.6;
  const dots: [number, number, number][] = [[0.0, 1.1, 0.3], [0.9, 0.85, 1.1], [-0.95, 0.9, 1.0], [0.4, 1.0, -1.2], [-1.3, 0.55, -0.3], [1.45, 0.45, 0.1], [0.2, 0.35, 1.6], [-0.6, 1.15, -0.5]];
  for (const [x, y, z] of dots) { const v = new THREE.Vector3(x, y, z).normalize(); const d = mesh(new THREE.SphereGeometry(0.26, 12, 8), clay('#fff7ec', 0.6), g); d.position.set(v.x * 1.8, 1.75 + v.y * 1.8 * 0.72, v.z * 1.8); d.scale.set(1, 1, 0.4); d.lookAt(g.position.clone().add(new THREE.Vector3(0, 1.0, 0))); }
  const door = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 24, 1, false, 0, Math.PI), clay('#7fb4d9'), g); door.rotation.set(Math.PI / 2, 0, Math.PI / 2); door.position.set(0, 0.45, 1.17);
  const doorBottom = mesh(new THREE.BoxGeometry(0.84, 0.5, 0.12), clay('#7fb4d9'), g); doorBottom.position.set(0, 0.3, 1.17);
  const glow = new THREE.MeshStandardMaterial({ color: '#ffe3a1', emissive: '#ffb84d', emissiveIntensity: 0.9 });
  const win = mesh(new THREE.CircleGeometry(0.22, 20), glow, g); win.position.set(0.72, 1.1, 0.9); win.rotation.y = 0.65;
  // 信箱：送达时小旗会举起来
  const mailbox = new THREE.Group(); mailbox.position.set(5.3, ROAD_Y, -1.55); scene.add(mailbox);
  mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.0, 8).translate(0, 0.5, 0), clay(PALETTE.woodDark), mailbox);
  mesh(new RoundedBoxGeometry(0.62, 0.42, 0.42, 2, 0.12), clay(PALETTE.satchel, 0.6), mailbox).position.y = 1.15;
  const flag = new THREE.Group(); flag.position.set(0.34, 1.05, 0); mailbox.add(flag);
  mesh(new THREE.BoxGeometry(0.04, 0.45, 0.04).translate(0, 0.22, 0), clay(PALETTE.ink), flag);
  mesh(new THREE.BoxGeometry(0.04, 0.16, 0.2).translate(0, 0.38, 0.1), clay(PALETTE.cherry), flag);
  flag.rotation.x = Math.PI / 2;
  return { group: g, mailbox, flag };
}

/** 空气中漂浮的金色花粉/萤火 */
export function buildMotes(scene: THREE.Scene) {
  const count = 140, r = rng(77);
  const positions = new Float32Array(count * 3), seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) { positions.set([(r() - 0.5) * 26, 0.6 + r() * 4, -8 + r() * 16], i * 3); seeds[i] = r() * 100; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const base = positions.slice();
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.16, map: glowTexture(), color: '#ffe7a3', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
  scene.add(pts);
  return (t: number) => {
    for (let i = 0; i < count; i++) {
      const s = seeds[i];
      positions[i * 3] = base[i * 3] + Math.sin(t * 0.3 + s) * 0.6;
      positions[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.5 + s * 2) * 0.35;
      positions[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.25 + s) * 0.5;
    }
    geo.attributes.position.needsUpdate = true;
  };
}

export function buildClouds(scene: THREE.Scene) {
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#ffe9d2', emissiveIntensity: 0.35 });
  const clouds: THREE.Group[] = [];
  const r = rng(3);
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group();
    for (let k = 0; k < 5; k++) { const s = mesh(new THREE.SphereGeometry(1.6 + r() * 1.4, 16, 10), mat, g, false); s.position.set(k * 1.7 - 3.4, Math.sin(k) * 0.6, r() * 0.8); s.scale.y = 0.7; }
    g.position.set(-50 + i * 20, 15 + r() * 7, -55 - r() * 12); g.scale.setScalar(1.3 + r());
    scene.add(g); clouds.push(g);
  }
  return (dt: number) => clouds.forEach(c => { c.position.x += dt * 0.4; if (c.position.x > 70) c.position.x = -70; });
}
