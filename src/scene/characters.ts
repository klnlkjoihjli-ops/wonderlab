import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PALETTE, clay, mesh } from './util';

function eye(parent: THREE.Object3D, x: number, y: number, z: number, r: number, facing: 'x' | 'z') {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const white = mesh(new THREE.SphereGeometry(r, 18, 12), clay('#ffffff', 0.35), g, false);
  const pupil = mesh(new THREE.SphereGeometry(r * 0.58, 16, 10), clay('#24262e', 0.3), g, false);
  const spark = mesh(new THREE.SphereGeometry(r * 0.2, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), g, false);
  if (facing === 'x') { white.scale.set(0.55, 1, 1); pupil.position.set(r * 0.42, 0, 0); pupil.scale.set(0.5, 1, 1); spark.position.set(r * 0.62, r * 0.25, r * 0.18); }
  else { white.scale.set(1, 1, 0.6); pupil.position.set(0, 0, r * 0.42); pupil.scale.set(1, 1, 0.5); spark.position.set(r * 0.2, r * 0.25, r * 0.66); }
  return { group: g, pupil: pupil as THREE.Object3D };
}

/** 送信的小邮车：红色车身、会眨眼的大眼睛，车顶立着邀请卡 */
export function createCart() {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  mesh(new RoundedBoxGeometry(1.36, 0.5, 0.9, 3, 0.17), clay(PALETTE.cherry, 0.55), body).position.y = 0.5;
  const cabin = mesh(new RoundedBoxGeometry(0.72, 0.5, 0.82, 3, 0.14), clay(PALETTE.cream, 0.7), body); cabin.position.set(-0.24, 0.98, 0);
  const roof = mesh(new RoundedBoxGeometry(0.86, 0.12, 0.96, 2, 0.05), clay(PALETTE.satchel, 0.6), body); roof.position.set(-0.24, 1.27, 0);
  for (const z of [-0.42, 0.42]) { const w = mesh(new RoundedBoxGeometry(0.42, 0.26, 0.04, 2, 0.04), clay('#bfe6f2', 0.2), body); w.position.set(-0.2, 1.02, z); }
  // 车头的脸
  const eyes = [eye(body, 0.62, 0.6, -0.19, 0.13, 'x'), eye(body, 0.62, 0.6, 0.19, 0.13, 'x')];
  const smile = mesh(new THREE.TorusGeometry(0.11, 0.025, 6, 16, Math.PI), clay(PALETTE.ink), body, false);
  smile.position.set(0.69, 0.42, 0); smile.rotation.set(0, Math.PI / 2, Math.PI);
  for (const z of [-0.33, 0.33]) mesh(new THREE.SphereGeometry(0.06, 10, 8), clay('#ffb3a6', 0.6), body, false).position.set(0.66, 0.46, z);
  // 邀请卡：竖在车顶上，孩子一眼能看到“我们在送什么”
  const letter = new THREE.Group(); letter.position.set(-0.24, 1.55, 0); body.add(letter);
  mesh(new RoundedBoxGeometry(0.66, 0.44, 0.05, 2, 0.03), clay('#ffffff', 0.5), letter);
  for (const s of [-1, 1]) { const f = mesh(new THREE.BoxGeometry(0.38, 0.04, 0.02), clay('#e7ddd0'), letter, false); f.position.set(s * 0.15, 0.07, 0.03); f.rotation.z = -s * 0.5; }
  const seal = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 14), clay(PALETTE.cherry), letter, false); seal.rotation.x = Math.PI / 2; seal.position.set(0, -0.02, 0.04);
  // 礼物（第二次送信时出现在车尾）
  const gift = new THREE.Group(); gift.position.set(0.32, 0.98, 0); gift.visible = false; body.add(gift);
  mesh(new RoundedBoxGeometry(0.5, 0.4, 0.5, 2, 0.05), clay('#ff8fb1', 0.6), gift);
  mesh(new THREE.BoxGeometry(0.52, 0.42, 0.09), clay('#ffd45c'), gift);
  mesh(new THREE.BoxGeometry(0.09, 0.42, 0.52), clay('#ffd45c'), gift);
  for (const s of [-1, 1]) { const bow = mesh(new THREE.TorusGeometry(0.08, 0.03, 6, 12), clay('#ffd45c'), gift); bow.position.set(s * 0.08, 0.26, 0); bow.rotation.y = Math.PI / 2; }
  // 车轮
  const wheels: THREE.Group[] = [];
  for (const x of [-0.42, 0.42]) for (const z of [-0.45, 0.45]) {
    const w = new THREE.Group(); w.position.set(x, 0.24, z); root.add(w);
    const tire = mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.17, 20), clay('#3a3a48', 0.9), w); tire.rotation.x = Math.PI / 2;
    const hub = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.19, 12), clay('#ffd45c', 0.5), w); hub.rotation.x = Math.PI / 2;
    mesh(new THREE.BoxGeometry(0.05, 0.3, 0.2), clay('#2a2a36'), w, false);
    wheels.push(w);
  }
  let blink = 0, explodeK = 0, explodeGoal = 0;
  const wheelBase = wheels.map(w => w.position.clone()), letterBase = letter.position.y, giftBase = gift.position.y;
  return {
    root, body, letter, gift, wheels,
    roll(distance: number) { wheels.forEach(w => (w.rotation.z -= distance / 0.24)); },
    update(t: number, dt: number) {
      explodeK += (explodeGoal - explodeK) * Math.min(1, dt * 6);
      if (explodeK > 0.001 || explodeGoal > 0) {
        body.position.y = explodeK * 0.55;
        wheels.forEach((w, i) => { w.position.z = wheelBase[i].z * (1 + explodeK * 1.6); w.position.y = wheelBase[i].y - explodeK * 0.05; });
        letter.position.y = letterBase + explodeK * 0.7;
        gift.position.y = giftBase + explodeK * 0.45;
      }
      blink -= dt;
      const closing = blink < 0.12 && blink > 0;
      eyes.forEach(e => (e.group.scale.y = closing ? 0.12 : 1));
      if (blink < 0) blink = 2.5 + Math.random() * 3;
      letter.rotation.z = Math.sin(t * 2.2) * 0.04;
    },
    look(dir: number) { eyes.forEach(e => (e.pupil.position.z = dir * 0.04)); },
    /** 拆开看看：车身抬起、车轮向外、邀请卡和礼物飞高，k=0 复原 */
    explode(k: number) {
      explodeGoal = k;
    },
    /** 换上 Blender 做的模型（art/blender/mail_cart.py 导出）。节点按名字对应，动画和交互不变 */
    applyModel(model: THREE.Object3D) {
      const node = (name: string) => model.getObjectByName(name);
      const shell = node('CartBody'), parts = { EyeL: node('EyeL'), EyeR: node('EyeR'), Letter: node('Letter'), Gift: node('Gift') };
      if (!shell || !parts.EyeL || !parts.EyeR || !parts.Letter || !parts.Gift) throw new Error('mail_cart.glb 缺少必要节点');
      model.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      const moveChildren = (from: THREE.Object3D, to: THREE.Object3D) => { to.clear(); [...from.children].forEach(c => to.add(c)); };
      // 车身：去掉程序拼的外壳，眼睛节点单独接管
      for (const c of [...body.children]) if ((c as THREE.Mesh).isMesh) body.remove(c);
      [parts.EyeL, parts.EyeR].forEach((src, i) => {
        const e = eyes.find(x => Math.sign(x.group.position.z) === Math.sign(src.position.z)) ?? eyes[i];
        e.group.position.copy(src.position);
        moveChildren(src, e.group);
        e.pupil = e.group.getObjectByName(i === 0 ? 'PupilL' : 'PupilR') ?? e.pupil;
      });
      shell.remove(parts.EyeL, parts.EyeR);
      body.add(shell);
      moveChildren(parts.Letter, letter);
      moveChildren(parts.Gift, gift);
      // 车轮：按位置对上四个轮子
      for (const w of wheels) {
        const src = (['Wheel_FL', 'Wheel_FR', 'Wheel_RL', 'Wheel_RR'].map(node).filter(Boolean) as THREE.Object3D[])
          .sort((a, b) => a.position.distanceTo(w.position) - b.position.distanceTo(w.position))[0];
        if (src) moveChildren(src, w);
      }
    }
  };
}

/** 小诺：戴邮差帽的小猫头鹰，淡紫色身体，在绿色森林里一眼可辨 */
export function createOwl() {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const lilac = '#9b8ce0', wingC = '#7b6acb';
  const torso = mesh(new THREE.SphereGeometry(0.36, 28, 20), clay(lilac, 0.65), body); torso.scale.set(1, 1.12, 0.95);
  const belly = mesh(new THREE.SphereGeometry(0.27, 24, 16), clay(PALETTE.cream, 0.8), body); belly.position.set(0, -0.08, 0.15); belly.scale.set(1, 1.05, 0.7);
  for (const x of [-0.13, 0.13]) { const disc = mesh(new THREE.SphereGeometry(0.17, 20, 14), clay('#f4ecff', 0.7), body, false); disc.position.set(x, 0.12, 0.25); disc.scale.set(1, 1, 0.45); }
  const eyes = [eye(body, -0.13, 0.13, 0.31, 0.11, 'z'), eye(body, 0.13, 0.13, 0.31, 0.11, 'z')];
  const beak = mesh(new THREE.ConeGeometry(0.05, 0.12, 8), clay('#f2a03d', 0.5), body, false); beak.rotation.x = Math.PI; beak.position.set(0, 0.0, 0.36);
  for (const s of [-1, 1]) { const tuft = mesh(new THREE.ConeGeometry(0.07, 0.18, 8), clay(wingC), body); tuft.position.set(s * 0.2, 0.42, 0); tuft.rotation.z = -s * 0.5; }
  const wings: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.32, 0.05, -0.02); body.add(pivot);
    const w = mesh(new THREE.SphereGeometry(0.22, 18, 12), clay(wingC, 0.7), pivot); w.scale.set(0.35, 0.95, 0.7); w.position.set(s * 0.05, -0.1, 0);
    wings.push(pivot);
  }
  // 黄色围巾 + 蓝色邮差帽
  const scarf = mesh(new THREE.TorusGeometry(0.27, 0.06, 10, 28), clay('#ffcf4a', 0.6), body); scarf.rotation.x = Math.PI / 2; scarf.position.y = -0.1; scarf.scale.set(1, 0.9, 1);
  const tail = mesh(new RoundedBoxGeometry(0.1, 0.22, 0.05, 2, 0.02), clay('#ffcf4a', 0.6), body); tail.position.set(0.16, -0.25, 0.24); tail.rotation.z = 0.3;
  const cap = new THREE.Group(); cap.position.set(0, 0.36, 0.02); cap.rotation.x = -0.15; body.add(cap);
  mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.13, 20), clay(PALETTE.satchel, 0.6), cap);
  const brim = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 20, 1, false, 0, Math.PI), clay('#2e4aa0'), cap); brim.position.set(0, -0.05, 0.12); brim.rotation.y = -Math.PI / 2; brim.scale.z = 1.4;
  mesh(new THREE.SphereGeometry(0.04, 10, 8), clay('#ffcf4a'), cap).position.set(0, 0.01, 0.21);
  for (const s of [-1, 1]) { const foot = mesh(new THREE.SphereGeometry(0.06, 10, 8), clay('#f2a03d'), body); foot.position.set(s * 0.1, -0.4, 0.1); foot.scale.set(1, 0.5, 1.3); }

  let blink = 1, flapSpeed = 0, cheer = 0;
  return {
    root, body,
    setFlying(on: boolean) { flapSpeed = on ? 1 : 0; },
    cheer() { cheer = 1.2; },
    update(t: number, dt: number) {
      const flap = flapSpeed ? Math.sin(t * 22) * 0.9 : Math.sin(t * 2.5) * 0.08;
      wings[0].rotation.z = -0.15 - flap; wings[1].rotation.z = 0.15 + flap;
      body.position.y = Math.sin(t * 2.2) * 0.06;
      blink -= dt;
      eyes.forEach(e => (e.group.scale.y = blink > 0 && blink < 0.12 ? 0.1 : 1));
      if (blink < 0) blink = 2 + Math.random() * 3;
      if (cheer > 0) { cheer -= dt; body.rotation.y = (1.2 - cheer) * Math.PI * 2 / 1.2; body.position.y += Math.sin((1.2 - cheer) / 1.2 * Math.PI) * 0.4; if (cheer <= 0) body.rotation.y = 0; }
    },
    lookAt(dx: number, dy: number) { eyes.forEach(e => { e.pupil.position.x = THREE.MathUtils.clamp(dx, -1, 1) * 0.035; e.pupil.position.y = THREE.MathUtils.clamp(dy, -1, 1) * 0.03; }); }
  };
}

/** 收信的小兔 */
export function createRabbit() {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const fur = clay('#fffaf2', 0.85);
  const torso = mesh(new THREE.SphereGeometry(0.3, 20, 14), fur, body); torso.position.y = 0.32; torso.scale.set(1, 1.1, 0.95);
  const head = mesh(new THREE.SphereGeometry(0.26, 20, 14), fur, body); head.position.y = 0.8;
  for (const s of [-1, 1]) {
    const ear = new THREE.Group(); ear.position.set(s * 0.1, 1.0, 0); ear.rotation.z = -s * 0.15; body.add(ear);
    mesh(new THREE.CapsuleGeometry(0.07, 0.36, 4, 10).translate(0, 0.22, 0), fur, ear);
    mesh(new THREE.CapsuleGeometry(0.035, 0.28, 4, 8).translate(0, 0.22, 0.045), clay('#ffb7c5'), ear, false);
    mesh(new THREE.SphereGeometry(0.045, 10, 8), clay('#24262e', 0.3), body, false).position.set(s * 0.1, 0.84, 0.23);
    mesh(new THREE.SphereGeometry(0.05, 10, 8), clay('#ffc3cf'), body, false).position.set(s * 0.16, 0.74, 0.2);
    const arm = mesh(new THREE.CapsuleGeometry(0.06, 0.16, 4, 8), fur, body); arm.position.set(s * 0.28, 0.42, 0.08); arm.rotation.z = s * 0.5;
  }
  mesh(new THREE.SphereGeometry(0.035, 8, 6), clay('#ff8fa3'), body, false).position.set(0, 0.77, 0.26);
  const bow = mesh(new THREE.TorusGeometry(0.06, 0.025, 6, 12), clay(PALETTE.satchel), body, false); bow.position.set(0, 0.56, 0.24);
  let hop = 0;
  return {
    root,
    celebrate() { hop = 2.4; },
    update(t: number, dt: number) {
      if (hop > 0) { hop -= dt; body.position.y = Math.abs(Math.sin(hop * 7)) * 0.4; }
      else { body.position.y = 0; body.rotation.z = Math.sin(t * 1.5) * 0.04; }
    }
  };
}

function friendBase(color: string, belly: string) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const torso = mesh(new THREE.SphereGeometry(0.3, 20, 14), clay(color, 0.8), body); torso.position.y = 0.32; torso.scale.set(1, 1.1, 0.95);
  mesh(new THREE.SphereGeometry(0.21, 18, 12), clay(belly, 0.85), body).position.set(0, 0.3, 0.14);
  const head = mesh(new THREE.SphereGeometry(0.25, 20, 14), clay(color, 0.8), body); head.position.y = 0.78;
  for (const s of [-1, 1]) {
    mesh(new THREE.SphereGeometry(0.045, 10, 8), clay('#24262e', 0.3), body, false).position.set(s * 0.1, 0.82, 0.22);
    mesh(new THREE.SphereGeometry(0.05, 10, 8), clay('#ffb3a6'), body, false).position.set(s * 0.16, 0.72, 0.19);
  }
  let hop = 0;
  return {
    root, body,
    celebrate() { hop = 2.4; },
    update(t: number, dt: number) {
      if (hop > 0) { hop -= dt; body.position.y = Math.abs(Math.sin(hop * 7)) * 0.4; }
      else { body.position.y = 0; body.rotation.z = Math.sin(t * 1.5 + color.length) * 0.04; }
    }
  };
}

/** 小松鼠：橘色身体和一条大大的卷尾巴 */
export function createSquirrel() {
  const f = friendBase('#d9824a', '#ffe6c7');
  const b = f.body;
  for (const s of [-1, 1]) { const ear = mesh(new THREE.ConeGeometry(0.07, 0.16, 8), clay('#c06c38'), b); ear.position.set(s * 0.13, 1.02, 0); }
  mesh(new THREE.SphereGeometry(0.045, 8, 6), clay('#5a3a2a'), b, false).position.set(0, 0.76, 0.25);
  const tail = new THREE.Group(); tail.position.set(0, 0.35, -0.28); b.add(tail);
  const curl = mesh(new THREE.TorusGeometry(0.28, 0.14, 12, 24, Math.PI * 1.4), clay('#e39556', 0.85), tail); curl.rotation.set(0, Math.PI / 2, -0.4); curl.position.y = 0.3;
  mesh(new THREE.SphereGeometry(0.16, 14, 10), clay('#f0b07a'), tail).position.set(0, 0.62, 0.12);
  return f;
}

/** 小刺猬：圆滚滚的背上长满小刺 */
export function createHedgehog() {
  const f = friendBase('#efd3ae', '#fff1dd');
  const b = f.body;
  const spikeMat = clay('#7a5236', 0.9);
  const back = new THREE.Group(); back.position.set(0, 0.5, -0.06); b.add(back);
  mesh(new THREE.SphereGeometry(0.36, 18, 12), spikeMat, back).scale.set(1, 1.15, 0.9);
  for (let i = 0; i < 46; i++) {
    const phi = Math.acos(1 - (i + 0.5) / 46 * 1.4), th = i * 2.4;
    const d = new THREE.Vector3(Math.sin(phi) * Math.cos(th), Math.cos(phi), -Math.abs(Math.sin(phi) * Math.sin(th)) - 0.15).normalize();
    const sp = mesh(new THREE.ConeGeometry(0.06, 0.2, 6), spikeMat, back);
    sp.position.copy(d.clone().multiplyScalar(0.36)).multiply(new THREE.Vector3(1, 1.15, 0.9));
    sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  }
  const snout = mesh(new THREE.ConeGeometry(0.09, 0.2, 12), clay('#efd3ae'), b); snout.rotation.x = Math.PI / 2; snout.position.set(0, 0.74, 0.3);
  mesh(new THREE.SphereGeometry(0.04, 8, 6), clay('#24262e'), b, false).position.set(0, 0.74, 0.41);
  return f;
}

/** 小邮差的装扮：车顶的邮差帽，或挂在车身侧面的邮包 */
export function createOutfit(kind: 'hat' | 'bag') {
  const g = new THREE.Group();
  if (kind === 'hat') {
    g.position.set(0.18, 1.35, 0);
    mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.16, 20), clay(PALETTE.satchel, 0.6), g);
    mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 20), clay('#2e4aa0'), g).position.y = 0.09;
    const brim = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 20, 1, false, 0, Math.PI), clay('#2e4aa0'), g); brim.position.set(0.12, -0.07, 0); brim.scale.x = 1.3;
    mesh(new THREE.SphereGeometry(0.045, 10, 8), clay('#ffcf4a'), g).position.set(0.21, 0.02, 0);
  } else {
    g.position.set(-0.15, 0.62, 0.5);
    mesh(new RoundedBoxGeometry(0.5, 0.36, 0.14, 3, 0.06), clay('#c9853f', 0.7), g);
    const flap = mesh(new RoundedBoxGeometry(0.52, 0.18, 0.05, 2, 0.04), clay('#a86a2e', 0.7), g); flap.position.set(0, 0.11, 0.07);
    mesh(new THREE.SphereGeometry(0.04, 8, 6), clay('#ffcf4a'), g).position.set(0, 0.04, 0.1);
    const strap = mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 20, Math.PI), clay('#a86a2e'), g); strap.position.set(0, 0.15, -0.02);
  }
  return g;
}
