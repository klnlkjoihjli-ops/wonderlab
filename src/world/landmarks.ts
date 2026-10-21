import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { AreaId } from '../../shared/platform';
import { PALETTE, clay, mesh, rng } from '../scene/util';

/** 每个领域的地标（彩虹门、大积木、风车、字母块、地球仪、大书、嫩芽、红绿灯、气球、音符），岛上和星球上共用 */
/** 按区域放地标；大陆在星球上用它代表区域的地标 */
export function buildLandmark(d: AreaId): { group: THREE.Group; spin: (t: number, dt: number) => void } {
  const g = new THREE.Group();
  const spins: ((t: number, dt: number) => void)[] = [];
    if (d === 'color') {
    ['#ee5a4f', '#f29c45', '#ffcf4a', '#7dba5a', '#4f9fd8', '#9b7fe0'].forEach((col, i) => {
    const arc = mesh(new THREE.TorusGeometry(2.4 - i * 0.22, 0.12, 10, 40, Math.PI), clay(col, 0.6), g); arc.position.y = 0;
    });
  } else if (d === 'num') {
    const cols = ['#4fb39b', '#ffcf4a', '#ee7a5f'];
    [[0, 0.6, 0, 1.2], [1.1, 0.5, 0.3, 1.0], [0.5, 1.6, 0.1, 0.9]].forEach(([x, y, z, s], i) => {
    const b = mesh(new RoundedBoxGeometry(s, s, s, 3, 0.15), clay(cols[i], 0.6), g); b.position.set(x - 0.5, y, z); b.rotation.y = i * 0.4;
    for (let k = 0; k <= i; k++) mesh(new THREE.SphereGeometry(0.09, 10, 8), clay('#ffffff'), b, false).position.set((k - i / 2) * 0.28, 0, s / 2 + 0.01);
    });
  } else if (d === 'move') {
    mesh(new THREE.CylinderGeometry(0.45, 0.8, 3.4, 10), clay('#f2d2a0', 0.8), g).position.y = 1.7;
    mesh(new THREE.ConeGeometry(0.75, 0.9, 10), clay(PALETTE.cherry, 0.6), g).position.y = 3.85;
    const hubG = new THREE.Group(); hubG.position.set(0, 3.1, 0.65); g.add(hubG);
    for (let k = 0; k < 4; k++) { const blade = mesh(new RoundedBoxGeometry(0.35, 1.8, 0.06, 2, 0.04), clay('#fffaf0', 0.7), hubG); blade.position.y = 0.9; const arm = new THREE.Group(); arm.rotation.z = (k * Math.PI) / 2; arm.add(blade); hubG.add(arm); }
    spins.push((_t, dt) => { hubG.rotation.z -= dt * 1.2; });
  } else if (d === 'eng') {
    ['A', 'B', 'C'].forEach((ch, i) => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const cg = cv.getContext('2d')!;
    cg.fillStyle = ['#ee5a4f', '#4f9fd8', '#7dba5a'][i]; cg.fillRect(0, 0, 128, 128);
    cg.fillStyle = '#fff'; cg.font = 'bold 96px sans-serif'; cg.textAlign = 'center'; cg.textBaseline = 'middle'; cg.fillText(ch, 64, 70);
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
    const b = mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.6 }), g);
    b.position.set((i - 1) * 1.1, i === 1 ? 1.5 : 0.5, i === 1 ? 0 : 0.2); b.rotation.y = (i - 1) * 0.3;
    });
  } else if (d === 'story') {
    // 一本打开的大书，两页上写着“山”“水”
    const page = (ch: string, side: number) => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 256; const cg = cv.getContext('2d')!;
      cg.fillStyle = '#fffaf0'; cg.fillRect(0, 0, 256, 256);
      cg.fillStyle = '#2a3a33'; cg.font = 'bold 170px "PingFang SC","Hiragino Sans GB",sans-serif'; cg.textAlign = 'center'; cg.textBaseline = 'middle'; cg.fillText(ch, 128, 136);
      const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
      const pg = new THREE.Group(); pg.position.set(0, 1.25, 0); pg.rotation.z = side * 0.32; g.add(pg);
      const sheet = mesh(new RoundedBoxGeometry(1.5, 1.8, 0.1, 2, 0.04), clay('#fffaf0', 0.8), pg); sheet.position.x = side * 0.78;
      const face = mesh(new THREE.PlaneGeometry(1.3, 1.6), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.8 }), pg, false); face.position.set(side * 0.78, 0, 0.056);
      const cover = mesh(new RoundedBoxGeometry(1.62, 1.92, 0.08, 2, 0.04), clay('#e0567a', 0.6), pg); cover.position.set(side * 0.8, 0, -0.08);
    };
    page('山', -1); page('水', 1);
    mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.9, 10), clay('#c23d62', 0.6), g).position.y = 1.25;
    mesh(new RoundedBoxGeometry(1.2, 0.36, 0.7, 2, 0.1), clay(PALETTE.woodDark), g).position.y = 0.18;
  } else if (d === 'life') {
    // 一棵大大的嫩芽，旁边一个小蘑菇
    mesh(new THREE.CylinderGeometry(0.12, 0.18, 2.6, 10).translate(0, 1.3, 0), clay('#5fa83f', 0.7), g);
    for (const sgn of [-1, 1]) {
      const leaf = mesh(new THREE.SphereGeometry(0.75, 20, 14), clay('#7fd05a', 0.6), g);
      leaf.scale.set(1.3, 0.28, 0.75); leaf.position.set(sgn * 0.8, 2.3 + (sgn > 0 ? 0.3 : 0), 0); leaf.rotation.z = sgn * 0.45;
    }
    const bud = mesh(new THREE.SphereGeometry(0.42, 18, 14), clay('#ff8fb0', 0.6), g); bud.scale.y = 1.3; bud.position.y = 2.95;
    const mush = new THREE.Group(); mush.position.set(1.2, 0, 0.6); g.add(mush);
    mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.5, 10).translate(0, 0.25, 0), clay('#fff3dd'), mush);
    const capM = mesh(new THREE.SphereGeometry(0.42, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), clay('#ee5a4f', 0.6), mush); capM.position.y = 0.45;
    for (let k = 0; k < 4; k++) mesh(new THREE.SphereGeometry(0.06, 8, 6), clay('#ffffff'), mush, false).position.set(Math.cos(k * 1.6) * 0.25, 0.75, Math.sin(k * 1.6) * 0.25);
    spins.push(t => { bud.rotation.y = Math.sin(t * 1.2) * 0.2; });
  } else if (d === 'body') {
    // 红绿灯：红灯、黄灯、绿灯轮流亮
    mesh(new THREE.CylinderGeometry(0.1, 0.14, 2.4, 10).translate(0, 1.2, 0), clay('#5a6470', 0.5), g);
    const box = mesh(new RoundedBoxGeometry(0.75, 1.9, 0.6, 3, 0.15), clay('#2f3640', 0.5), g); box.position.y = 3.2;
    const lamps = ['#ff4b3e', '#ffc93e', '#3ee06b'].map((col, i) => {
      const m = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.1, roughness: 0.3 });
      const l = mesh(new THREE.SphereGeometry(0.22, 16, 12), m, g, false); l.position.set(0, 3.8 - i * 0.6, 0.27); l.scale.z = 0.5;
      return m;
    });
    spins.push(t => { const k = Math.floor(t / 1.6) % 3; lamps.forEach((m, i) => { m.emissiveIntensity = i === k ? 1.6 : 0.08; }); });
  } else if (d === 'heart') {
    // 三个气球，中间那个是笑脸，轻轻地飘
    const cols = ['#ff7aa8', '#ffcf4a', '#8fc8ff'];
    const balloons = cols.map((col, i) => {
      const bg = new THREE.Group(); bg.position.set((i - 1) * 0.95, 0, (i === 1 ? 0.2 : 0)); g.add(bg);
      const b = mesh(new THREE.SphereGeometry(0.62, 22, 16), clay(col, 0.35), bg); b.scale.y = 1.15; b.position.y = 3.0 + (i === 1 ? 0.4 : 0);
      const string = mesh(new THREE.CylinderGeometry(0.015, 0.015, b.position.y - 0.6, 6).translate(0, (b.position.y - 0.6) / 2, 0), clay('#ffffff'), bg, false); string.position.y = 0;
      if (i === 1) {
        for (const sx of [-1, 1]) mesh(new THREE.SphereGeometry(0.07, 10, 8), clay('#2a3a33'), b, false).position.set(sx * 0.2, 0.12, 0.58);
        const smile = mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 16, Math.PI), clay('#2a3a33'), b, false); smile.position.set(0, -0.08, 0.57); smile.rotation.z = Math.PI;
      }
      return bg;
    });
    mesh(new RoundedBoxGeometry(0.5, 0.3, 0.5, 2, 0.08), clay(PALETTE.woodDark), g).position.y = 0.15;
    spins.push(t => balloons.forEach((b, i) => { b.rotation.z = Math.sin(t * 1.1 + i * 1.7) * 0.06; b.position.y = Math.sin(t * 1.4 + i) * 0.08; }));
  } else if (d === 'art') {
    // 一个大音符（八分音符一对），慢慢转
    const note = new THREE.Group(); note.position.y = 0.4; g.add(note);
    const black = clay('#3a2f5a', 0.4);
    for (const x of [-0.55, 0.55]) {
      const head = mesh(new THREE.SphereGeometry(0.42, 20, 14), black, note); head.scale.set(1.25, 0.9, 0.8); head.position.set(x, 0.4, 0); head.rotation.z = 0.35;
      mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 10), black, note).position.set(x + 0.45, 1.6, 0);
    }
    const beam = mesh(new RoundedBoxGeometry(1.25, 0.3, 0.16, 2, 0.06), black, note); beam.position.set(0.45, 2.75, 0); beam.rotation.z = 0.12;
    const palette = mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.1, 24), clay('#f3d9a8', 0.8), g); palette.position.set(1.3, 0.12, 0.6);
    ['#ee5a4f', '#ffcf4a', '#4f9fd8', '#7dba5a'].forEach((col, k) => mesh(new THREE.SphereGeometry(0.13, 10, 8), clay(col, 0.5), palette, false).position.set(Math.cos(k * 1.4) * 0.45, 0.08, Math.sin(k * 1.4) * 0.45));
    spins.push((t, dt) => { note.rotation.y += dt * 0.6; note.position.y = 0.4 + Math.sin(t * 2) * 0.12; });
  } else if (d === 'home') {
    // 我的家：一座小房子，门口一面小红旗
    const house = new THREE.Group(); g.add(house);
    mesh(new RoundedBoxGeometry(2, 1.5, 1.6, 3, 0.12), clay('#fff1d6', 0.8), house).position.y = 0.75;
    for (const sgn of [-1, 1]) { const slab = mesh(new RoundedBoxGeometry(2.3, 0.14, 1.2, 2, 0.05), clay('#e05a4f', 0.6), house); slab.position.set(0, 1.85, sgn * 0.42); slab.rotation.x = sgn * 0.62; }
    mesh(new RoundedBoxGeometry(0.5, 0.85, 0.06, 2, 0.05), clay(PALETTE.woodDark), house).position.set(0, 0.43, 0.81);
    for (const x of [-0.6, 0.6]) mesh(new RoundedBoxGeometry(0.4, 0.4, 0.06, 2, 0.05), new THREE.MeshStandardMaterial({ color: '#ffe3a1', emissive: '#ffb84d', emissiveIntensity: 0.6 }), house, false).position.set(x, 0.95, 0.81);
    const pole = mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 8).translate(0, 1.2, 0), clay('#c7ccd4'), g); pole.position.set(1.4, 0, 0.6);
    const flag = mesh(new THREE.PlaneGeometry(0.75, 0.5), new THREE.MeshStandardMaterial({ color: '#de2910', side: THREE.DoubleSide }), g, false); flag.position.set(1.78, 2.15, 0.6);
    spins.push(t => { flag.rotation.y = Math.sin(t * 2.4) * 0.25; });
  } else {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const cg = cv.getContext('2d')!;
    cg.fillStyle = '#4f9fd8'; cg.fillRect(0, 0, 512, 256); cg.fillStyle = '#7dba5a';
    const r2 = rng(9); for (let k = 0; k < 14; k++) { cg.beginPath(); cg.ellipse(r2() * 512, 40 + r2() * 176, 30 + r2() * 50, 20 + r2() * 40, r2() * 3, 0, Math.PI * 2); cg.fill(); }
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
    mesh(new THREE.CylinderGeometry(0.4, 0.6, 0.5, 16), clay(PALETTE.woodDark), g).position.y = 0.25;
    mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 8), clay('#c7ccd4'), g).position.y = 0.8;
    const globe = mesh(new THREE.SphereGeometry(1.1, 32, 20), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.5 }), g); globe.position.y = 2.1; globe.rotation.z = 0.4;
    spins.push((_t, dt) => { globe.rotation.y += dt * 0.4; });
  }
  return { group: g, spin: (t, dt) => spins.forEach(f => f(t, dt)) };
}
