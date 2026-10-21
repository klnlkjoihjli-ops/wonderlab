import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PALETTE, clay, mesh } from '../scene/util';

/** 小探险家：孩子在世界里的小人。大头、圆身子、背着小背包、戴着邮差帽，走路时手脚摆动 */
export function createKid() {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const skin = clay('#ffd9bf', 0.7), shirt = clay('#ffcf4a', 0.6), pants = clay(PALETTE.satchel, 0.6), shoe = clay('#5a3a2a', 0.7);
  const torso = mesh(new RoundedBoxGeometry(0.52, 0.5, 0.36, 3, 0.15), shirt, body); torso.position.y = 0.72;
  const hips = mesh(new RoundedBoxGeometry(0.48, 0.18, 0.34, 2, 0.08), pants, body); hips.position.y = 0.45;
  const head = new THREE.Group(); head.position.y = 1.25; body.add(head);
  mesh(new THREE.SphereGeometry(0.36, 28, 20), skin, head);
  const hair = mesh(new THREE.SphereGeometry(0.375, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.55), clay('#3b2a22', 0.8), head); hair.rotation.x = -0.25;
  for (const s of [-1, 1]) {
    mesh(new THREE.SphereGeometry(0.05, 12, 8), clay('#24262e', 0.3), head, false).position.set(s * 0.12, 0.02, 0.33);
    mesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), head, false).position.set(s * 0.12 + 0.015, 0.04, 0.375);
    mesh(new THREE.SphereGeometry(0.055, 10, 8), clay('#ffb3a6'), head, false).position.set(s * 0.21, -0.07, 0.29);
    mesh(new THREE.SphereGeometry(0.07, 12, 8), skin, head).position.set(s * 0.36, -0.01, 0);
  }
  const smile = mesh(new THREE.TorusGeometry(0.06, 0.014, 6, 14, Math.PI), clay(PALETTE.ink), head, false); smile.position.set(0, -0.1, 0.34); smile.rotation.z = Math.PI;
  // 邮差帽
  const cap = new THREE.Group(); cap.position.set(0, 0.28, 0.02); cap.rotation.x = -0.12; head.add(cap);
  mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.16, 24), clay(PALETTE.satchel, 0.55), cap);
  const brim = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 20, 1, false, 0, Math.PI), clay('#2e4aa0'), cap); brim.position.set(0, -0.07, 0.18); brim.rotation.y = -Math.PI / 2; brim.scale.z = 1.5;
  mesh(new THREE.SphereGeometry(0.05, 10, 8), clay('#ffcf4a'), cap).position.set(0, 0.02, 0.29);
  // 小背包
  const pack = mesh(new RoundedBoxGeometry(0.4, 0.42, 0.18, 2, 0.08), clay('#ee5a4f', 0.6), body); pack.position.set(0, 0.76, -0.25);
  // 手脚：绕肩膀/胯部摆动
  const limb = (x: number, y: number, len: number, r: number, m: THREE.Material, foot?: THREE.Material) => {
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0); body.add(pivot);
    const l = mesh(new THREE.CapsuleGeometry(r, len, 4, 10), m, pivot); l.position.y = -len / 2 - r * 0.4;
    if (foot) { const f = mesh(new RoundedBoxGeometry(r * 2.4, r * 1.3, r * 3.2, 2, r * 0.5), foot, pivot); f.position.set(0, -len - r * 0.9, r * 0.5); }
    else mesh(new THREE.SphereGeometry(r * 1.25, 10, 8), skin, pivot).position.y = -len - r * 0.6;
    return pivot;
  };
  const armL = limb(-0.33, 0.9, 0.3, 0.075, shirt), armR = limb(0.33, 0.9, 0.3, 0.075, shirt);
  const legL = limb(-0.12, 0.42, 0.22, 0.09, pants, shoe), legR = limb(0.12, 0.42, 0.22, 0.09, pants, shoe);
  let phase = 0, blink = 2;
  return {
    root,
    /** speed：0 = 站着，1 = 正常走 */
    update(t: number, dt: number, speed: number) {
      phase += dt * 9 * speed;
      const swing = Math.sin(phase) * 0.7 * Math.min(1, speed);
      armL.rotation.x = swing; armR.rotation.x = -swing; legL.rotation.x = -swing; legR.rotation.x = swing;
      body.position.y = speed > 0.05 ? Math.abs(Math.sin(phase)) * 0.08 : Math.sin(t * 2) * 0.015;
      head.rotation.z = speed > 0.05 ? Math.sin(phase) * 0.05 : Math.sin(t * 1.3) * 0.04;
      blink -= dt; head.children[0].scale.y = 1;
      if (blink < 0) blink = 2.5 + Math.random() * 2.5;
    },
    cheer() { armL.rotation.x = -2.6; armR.rotation.x = -2.6; }
  };
}
