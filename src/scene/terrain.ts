import * as THREE from 'three';
import { PALETTE, fbm, lerp, noise, smoothstep } from './util';

export const ROAD_Y = 0.5;     // 岸边路面高度
export const GAP = 2.2;        // 小溪在桥位处的半宽
export const WATER_Y = -0.34;
export const POST_OFFICE = new THREE.Vector3(-6.4, 0.5, -4.2);
export const HOME = new THREE.Vector3(6.6, 0.5, -4.4);
const HOUSE_PADS = [[POST_OFFICE.x, POST_OFFICE.z], [HOME.x, HOME.z]];

/** 小溪中心线：桥附近笔直，远处蜿蜒 */
export function creekX(z: number) { return Math.sin(z * 0.21 + 0.6) * 2.2 * smoothstep(2.5, 9, Math.abs(z)) + Math.sin(z * 0.09) * 0.8 * smoothstep(6, 14, Math.abs(z)); }
export function creekHalf(z: number) { return lerp(GAP, 1.75 + noise(z * 0.3, 3.1) * 0.8, smoothstep(1.4, 5, Math.abs(z))); }

function roadMask(x: number, z: number) {
  const main = 1 - smoothstep(0.85, 1.25, Math.abs(z + noise(x * 0.4, 1) * 0.18 - 0.05));
  const toPost = (1 - smoothstep(0.45, 0.8, Math.abs(x + 6.4))) * smoothstep(0.3, -0.2, z) * smoothstep(-3.2, -2.4, z);
  const toHome = (1 - smoothstep(0.45, 0.8, Math.abs(x - 6.6))) * smoothstep(0.3, -0.2, z) * smoothstep(-3.4, -2.6, z);
  return Math.max(main * (1 - smoothstep(10.5, 13, Math.abs(x))), toPost, toHome);
}

export function heightAt(x: number, z: number) {
  const nearRoad = smoothstep(1.3, 5.5, Math.abs(z));
  let h = ROAD_Y + (fbm(x * 0.11 + 4, z * 0.11) - 0.45) * 1.7 * nearRoad;
  h += smoothstep(-5, -24, z) * 3.6 + smoothstep(9, 24, Math.abs(x)) * 2.2 + smoothstep(7, 16, z) * 0.6;
  h = lerp(h, ROAD_Y, roadMask(x, z));
  for (const [px, pz] of HOUSE_PADS) h = lerp(h, ROAD_Y + 0.02, 1 - smoothstep(2.0, 3.4, Math.hypot(x - px, z - pz)));
  const d = Math.abs(x - creekX(z)), w = creekHalf(z);
  const bridge = 1 - smoothstep(1.2, 2.6, Math.abs(z));
  const carve = smoothstep(w + lerp(0.9, 0.12, bridge), w - lerp(0.6, 0.2, bridge), d);
  return lerp(h, -1.05 - (1 - d / w) * 0.25, carve);
}

export function buildTerrain(scene: THREE.Scene) {
  const geo = new THREE.PlaneGeometry(64, 54, 220, 186);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -8);
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const grassA = new THREE.Color(PALETTE.grassDeep), grassB = new THREE.Color(PALETTE.grassLight);
  const sand = new THREE.Color(PALETTE.sand), path = new THREE.Color(PALETTE.path), edge = new THREE.Color(PALETTE.pathEdge), soil = new THREE.Color(PALETTE.soil);
  const c = new THREE.Color(), t = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = heightAt(x, z);
    pos.setY(i, y);
    c.copy(grassA).lerp(grassB, smoothstep(0.25, 0.75, fbm(x * 0.28, z * 0.28)));
    c.lerp(t.set('#4f8a52'), smoothstep(-6, -20, z) * 0.45);                 // 远处更冷更深
    const r = roadMask(x, z);
    c.lerp(edge, smoothstep(0.05, 0.4, r) * 0.9); c.lerp(path, smoothstep(0.45, 0.85, r));
    const d = Math.abs(x - creekX(z)), w = creekHalf(z);
    c.lerp(sand, smoothstep(w + 0.9, w + 0.2, d) * 0.95);
    c.lerp(soil, smoothstep(WATER_Y + 0.25, WATER_Y - 0.2, y) * 0.8);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  m.receiveShadow = true;
  scene.add(m);
  return m;
}

const GLSL_CREEK = /* glsl */`
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
  float creekX(float z){ return sin(z*0.21+0.6)*2.2*smoothstep(2.5,9.0,abs(z)) + sin(z*0.09)*0.8*smoothstep(6.0,14.0,abs(z)); }
  float creekHalf(float z){ return mix(${GAP.toFixed(2)}, 1.75 + vnoise(vec2(z*0.3, 3.1))*0.8, smoothstep(1.4,5.0,abs(z))); }
`;

export function buildWater(scene: THREE.Scene) {
  const uniforms = { uTime: { value: 0 }, uDeep: { value: new THREE.Color(PALETTE.creekDeep) }, uShallow: { value: new THREE.Color(PALETTE.creekShallow) } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true,
    vertexShader: /* glsl */`varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uDeep; uniform vec3 uShallow; varying vec3 vW;
      ${GLSL_CREEK}
      void main(){
        float d = abs(vW.x - creekX(vW.z)) / creekHalf(vW.z);
        vec3 col = mix(uDeep, uShallow, smoothstep(0.15, 1.0, d));
        // 顺流的水纹
        float flow = vW.z * 1.6 - uTime * 1.1;
        float n = vnoise(vec2(vW.x * 2.2, flow)) * 0.6 + vnoise(vec2(vW.x * 5.0 + 3.0, flow * 1.8)) * 0.4;
        col = mix(col, vec3(0.86,0.98,0.95), smoothstep(0.72, 0.8, n) * 0.55);
        // 岸边白色泡沫
        float foam = smoothstep(0.82, 0.97, d + (vnoise(vec2(vW.z * 3.0 - uTime * 0.6, vW.x * 3.0)) - 0.5) * 0.18);
        col = mix(col, vec3(1.0, 0.98, 0.92), foam * 0.85);
        gl_FragColor = vec4(col, 0.93);
        #include <colorspace_fragment>
      }`
  });
  const w = new THREE.Mesh(new THREE.PlaneGeometry(64, 54, 1, 1), mat);
  w.rotation.x = -Math.PI / 2; w.position.set(0, WATER_Y, -8);
  scene.add(w);
  return uniforms;
}

export function buildSky(scene: THREE.Scene, sunDir: THREE.Vector3) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color(PALETTE.skyTop) }, uHorizon: { value: new THREE.Color(PALETTE.skyHorizon) }, uSun: { value: sunDir.clone().normalize() } },
    vertexShader: /* glsl */`varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */`uniform vec3 uTop, uHorizon, uSun; varying vec3 vDir;
      void main(){ float h = clamp(vDir.y*1.6+0.08, 0.0, 1.0);
        vec3 col = mix(uHorizon, uTop, pow(h, 0.7));
        float s = max(dot(vDir, uSun), 0.0);
        col += vec3(1.0,0.85,0.6) * (pow(s, 18.0)*0.45 + pow(s, 400.0)*0.6);
        gl_FragColor = vec4(col,1.0);
        #include <colorspace_fragment>
      }`
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(140, 32, 16), mat);
  scene.add(sky);
  // 远山剪影：几层颜色越来越淡，营造纵深
  const layers: [number, string][] = [[-46, '#9cc59a'], [-60, '#b8d4ae'], [-74, '#d1dfbf']];
  layers.forEach(([z, color], li) => {
    for (let i = 0; i < 7; i++) {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), new THREE.MeshBasicMaterial({ color, fog: true }));
      const s = 14 + ((i * 37 + li * 11) % 9);
      hill.scale.set(s, s * 0.42, s * 0.6);
      hill.position.set(-60 + i * 20 + li * 7, 1 + li * 1.5, z);
      scene.add(hill);
    }
  });
}
