// Pieces every court shares: the regulation terrain (same spot on every court,
// so physics and cameras are shared), the sky dome, a geometry batcher that
// merges static scenery into a few draw calls, and common street furniture.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { pitch } from "../../config/rules";
import { worldTheme, type CourtPalette } from "../../config/theme";
import { shadowed, wiiMaterial } from "../materials";
import { barkTexture, foliageTexture, gravelTextures, seeded, timberTexture } from "../textures";

export interface SpectatorSpot {
  position: THREE.Vector3;
  facing: number;
}

export interface CourtScene {
  group: THREE.Group;
  palette: CourtPalette;
  sunDirection: THREE.Vector3;
  spectatorSpots: SpectatorSpot[];
  update(dt: number, clock: number): void;
}

export const terrainLength = pitch.backLine - pitch.deadLine;
export const terrainCentreZ = (pitch.backLine + pitch.deadLine) / 2;

// ---------- batching ----------

// World-space box mapping: each face gets UVs from its two in-plane world axes,
// so textures keep a constant scale whatever size the piece is.
function boxMapUv(geometry: THREE.BufferGeometry, tile: number): void {
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    const nx = Math.abs(normal.getX(i));
    const ny = Math.abs(normal.getY(i));
    const nz = Math.abs(normal.getZ(i));
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    let u: number;
    let v: number;
    if (ny >= nx && ny >= nz) {
      u = x;
      v = z;
    } else if (nx >= nz) {
      u = z;
      v = y;
    } else {
      u = x;
      v = y;
    }
    uv[i * 2] = u / tile;
    uv[i * 2 + 1] = v / tile;
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

interface BatchEntry {
  material: THREE.Material;
  geometries: THREE.BufferGeometry[];
  castShadow: boolean;
}

export class Batcher {
  private entries = new Map<string, BatchEntry>();
  private matrix = new THREE.Matrix4();
  private quaternion = new THREE.Quaternion();
  private euler = new THREE.Euler();

  // Add a geometry placed at position/rotation/scale. `tile` re-maps UVs in
  // world space (metres per texture repeat) after placement.
  add(
    key: string,
    material: THREE.Material,
    geometry: THREE.BufferGeometry,
    position: THREE.Vector3Like,
    options: { rotation?: [number, number, number]; scale?: [number, number, number]; tile?: number; castShadow?: boolean } = {},
  ): void {
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { material, geometries: [], castShadow: options.castShadow ?? true };
      this.entries.set(key, entry);
    }
    const rotation = options.rotation ?? [0, 0, 0];
    const scale = options.scale ?? [1, 1, 1];
    this.quaternion.setFromEuler(this.euler.set(rotation[0], rotation[1], rotation[2]));
    this.matrix.compose(new THREE.Vector3(position.x, position.y, position.z), this.quaternion, new THREE.Vector3(...scale));
    const placed = (geometry.index ? geometry.toNonIndexed() : geometry.clone()).applyMatrix4(this.matrix);
    for (const name of Object.keys(placed.attributes)) {
      if (name !== "position" && name !== "normal" && name !== "uv") placed.deleteAttribute(name);
    }
    if (!placed.attributes.uv) placed.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(placed.attributes.position.count * 2), 2));
    if (options.tile) boxMapUv(placed, options.tile);
    placed.clearGroups();
    entry.geometries.push(placed);
  }

  // Add every mesh of a built group (respecting its transforms) under one key per material.
  addObject(prefix: string, object: THREE.Object3D, origin: THREE.Vector3Like, rotationY = 0): void {
    object.position.set(origin.x, origin.y, origin.z);
    object.rotation.y = rotationY;
    object.updateMatrixWorld(true);
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const material = child.material as THREE.Material;
      const key = `${prefix}:${material.uuid}`;
      let entry = this.entries.get(key);
      if (!entry) {
        entry = { material, geometries: [], castShadow: child.castShadow };
        this.entries.set(key, entry);
      }
      const geometry = child.geometry as THREE.BufferGeometry;
      const placed = (geometry.index ? geometry.toNonIndexed() : geometry.clone()).applyMatrix4(child.matrixWorld);
      for (const name of Object.keys(placed.attributes)) {
        if (name !== "position" && name !== "normal" && name !== "uv") placed.deleteAttribute(name);
      }
      if (!placed.attributes.uv) placed.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(placed.attributes.position.count * 2), 2));
      // Meshes tagged with userData.tile get world-space box-mapped UVs.
      if (typeof child.userData.tile === "number") boxMapUv(placed, child.userData.tile);
      placed.clearGroups();
      entry.geometries.push(placed);
    });
  }

  build(): THREE.Group {
    const group = new THREE.Group();
    for (const entry of this.entries.values()) {
      const merged = mergeGeometries(entry.geometries, false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, entry.material);
      mesh.castShadow = entry.castShadow;
      mesh.receiveShadow = true;
      group.add(mesh);
      for (const geometry of entry.geometries) geometry.dispose();
    }
    this.entries.clear();
    return group;
  }
}

// ---------- sky ----------

// Gradient dome with a sun disc and drifting fbm clouds, all in one shader.
export function createSky(palette: CourtPalette, sunDirection: THREE.Vector3, cloudCover: number): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(palette.skyTop) },
      horizon: { value: new THREE.Color(palette.skyHorizon) },
      sunColor: { value: new THREE.Color(palette.sunDisc) },
      sunDirection: { value: sunDirection.clone().normalize() },
      cloudCover: { value: cloudCover },
      time: { value: 0 },
    },
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 top;
      uniform vec3 horizon;
      uniform vec3 sunColor;
      uniform vec3 sunDirection;
      uniform float cloudCover;
      uniform float time;
      varying vec3 vDirection;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 5; i++) {
          value += noise(p) * amplitude;
          p *= 2.03;
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec3 direction = normalize(vDirection);
        float height = max(direction.y, 0.0);
        vec3 color = mix(horizon, top, pow(height, 0.55));
        // Haze band just above the horizon.
        color = mix(color, horizon * 1.08, exp(-height * 18.0) * 0.6);
        float sunAmount = max(dot(direction, sunDirection), 0.0);
        color += sunColor * pow(sunAmount, 9.0) * 0.35;
        color += sunColor * pow(sunAmount, 900.0) * 6.0;
        // Clouds projected onto a flat layer.
        if (direction.y > 0.02) {
          vec2 layer = direction.xz / (direction.y + 0.12) * 1.4 + vec2(time * 0.006, time * 0.002);
          float density = smoothstep(1.0 - cloudCover, 1.25 - cloudCover * 0.6, fbm(layer));
          vec3 cloud = mix(horizon * 0.95, vec3(1.0, 0.98, 0.94), 0.55) + sunColor * pow(sunAmount, 4.0) * 0.4;
          color = mix(color, cloud, density * smoothstep(0.02, 0.2, direction.y) * 0.9);
        }
        // Below the horizon fade to the haze colour (hidden by scenery anyway).
        if (direction.y < 0.0) color = horizon * 0.9;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), material);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  return sky;
}

// ---------- terrain ----------

export function createTerrain(batcher: Batcher): THREE.Group {
  const group = new THREE.Group();

  const { map, bump } = gravelTextures();
  const gravelMap = map.clone();
  const gravelBump = bump.clone();
  for (const texture of [gravelMap, gravelBump]) {
    texture.needsUpdate = true;
    texture.repeat.set((pitch.halfWidth * 2) / 2.2, terrainLength / 2.2);
  }
  const gravel = new THREE.Mesh(
    new THREE.PlaneGeometry(pitch.halfWidth * 2, terrainLength, 1, 1),
    wiiMaterial(0xffffff, { map: gravelMap, bumpMap: gravelBump, bumpScale: 2.2, sheen: 0.05 }),
  );
  gravel.rotation.x = -Math.PI / 2;
  gravel.position.set(0, 0.004, terrainCentreZ);
  gravel.receiveShadow = true;
  group.add(gravel);

  // Heavy timber surround on short stone footings.
  const timber = wiiMaterial(0xffffff, { map: timberTexture(), sheen: 0.12 });
  const boardHeight = 0.18;
  const boardThickness = 0.16;
  for (const side of [-1, 1]) {
    batcher.add("terrainBoards", timber, new THREE.BoxGeometry(boardThickness, boardHeight, terrainLength + boardThickness * 2), {
      x: side * (pitch.halfWidth + boardThickness / 2),
      y: boardHeight / 2,
      z: terrainCentreZ,
    }, { tile: 1.2 });
  }
  for (const z of [pitch.backLine + boardThickness / 2, pitch.deadLine - boardThickness / 2]) {
    batcher.add("terrainBoards", timber, new THREE.BoxGeometry(pitch.halfWidth * 2, boardHeight, boardThickness), { x: 0, y: boardHeight / 2, z }, { tile: 1.2 });
  }
  // Iron brackets every 2 m along the boards.
  const iron = wiiMaterial(worldTheme.metalDark, { sheen: 0.5 });
  for (let z = pitch.backLine; z >= pitch.deadLine; z -= 2) {
    for (const side of [-1, 1]) {
      batcher.add("terrainIron", iron, new THREE.BoxGeometry(0.02, 0.12, 0.08), {
        x: side * (pitch.halfWidth + boardThickness + 0.01),
        y: 0.08,
        z,
      });
    }
  }

  // Throwing circle: a scuffed red plastic hoop.
  const circle = new THREE.Mesh(
    new THREE.TorusGeometry(pitch.circleRadius, 0.022, 10, 48),
    wiiMaterial(worldTheme.circle, { sheen: 0.6, rim: 0.4 }),
  );
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = 0.022;
  group.add(shadowed(circle, true, false));

  // Faded chalk lines for the 6 m – 10 m jack zone.
  for (const distance of [pitch.jackMinDistance, pitch.jackMaxDistance]) {
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(pitch.halfWidth * 2 - 0.1, 0.05),
      new THREE.MeshBasicMaterial({ color: worldTheme.chalk, transparent: true, opacity: 0.45, depthWrite: false }),
    );
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.009, -distance);
    group.add(line);
  }
  return group;
}

// The paving around the terrain, with the pitch cut out so gravel shows through.
export function createPaving(material: THREE.Material, width: number, nearZ: number, farZ: number): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, -nearZ);
  shape.lineTo(width / 2, -nearZ);
  shape.lineTo(width / 2, -farZ);
  shape.lineTo(-width / 2, -farZ);
  shape.closePath();
  const hole = new THREE.Path();
  const margin = 0.16;
  hole.moveTo(-pitch.halfWidth - margin, -(pitch.backLine + margin));
  hole.lineTo(-pitch.halfWidth - margin, -(pitch.deadLine - margin));
  hole.lineTo(pitch.halfWidth + margin, -(pitch.deadLine - margin));
  hole.lineTo(pitch.halfWidth + margin, -(pitch.backLine + margin));
  hole.closePath();
  shape.holes.push(hole);
  const geometry = new THREE.ShapeGeometry(shape);
  // Shape UVs are in shape units (metres); scale to the tile size.
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 3, uv.getY(i) / 3);
  const paving = new THREE.Mesh(geometry, material);
  paving.rotation.x = -Math.PI / 2;
  paving.receiveShadow = true;
  return paving;
}

// ---------- furniture ----------

export function addBench(batcher: Batcher, palette: CourtPalette, wood: THREE.Material, position: THREE.Vector3, rotationY: number): void {
  const iron = wiiMaterial(palette.ironwork, { sheen: 0.45 });
  const bench = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.04, 0.12), wood);
    slat.position.set(0, 0.45, -0.16 + i * 0.15);
    bench.add(slat);
  }
  for (let i = 0; i < 2; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.035), wood);
    slat.position.set(0, 0.62 + i * 0.17, 0.2);
    slat.rotation.x = -0.18;
    bench.add(slat);
  }
  for (const x of [-0.78, 0.78]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.42), iron);
    leg.position.set(x, 0.225, 0);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), iron);
    back.position.set(x, 0.7, 0.22);
    back.rotation.x = -0.18;
    bench.add(leg, back);
  }
  bench.traverse((child) => (child.castShadow = true));
  batcher.addObject("bench", bench, position, rotationY);
}

export function addLamp(batcher: Batcher, palette: CourtPalette, position: THREE.Vector3, glow: THREE.Material): void {
  const iron = wiiMaterial(palette.ironwork, { sheen: 0.5 });
  const lamp = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.4, 8), iron);
  base.position.y = 0.2;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.4, 8), iron);
  post.position.y = 2.0;
  const arm = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 6, 12, Math.PI), iron);
  arm.position.set(0.28, 3.7, 0);
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.1, 0.34, 6), glow);
  lantern.position.set(0.56, 3.5, 0);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.18, 6), iron);
  cap.position.set(0.56, 3.75, 0);
  lamp.add(base, post, arm, lantern, cap);
  lamp.traverse((child) => (child.castShadow = true));
  batcher.addObject("lamp", lamp, position, Math.atan2(-position.x, 0) + Math.PI / 2);
}

// A broad plane tree: bent mottled trunk, a few limbs, and a canopy of
// alpha-tested leaf cards around a dark core (casts dappled shadows).
export function addPlaneTree(batcher: Batcher, palette: CourtPalette, position: THREE.Vector3, scale: number, seed: number): void {
  const random = seeded(seed);
  const bark = wiiMaterial(palette.bark, { map: barkTexture("plane"), sheen: 0.08 });
  const leaves = wiiMaterial(palette.leaves, { map: foliageTexture("broad"), alphaTest: 0.45, side: THREE.DoubleSide, sheen: 0.15 });
  const core = wiiMaterial(palette.leavesDark, { sheen: 0 });
  const trunkHeight = 3.4 * scale;
  const lean = (random() - 0.5) * 0.12;
  batcher.add("planeBark", bark, new THREE.CylinderGeometry(0.17 * scale, 0.26 * scale, trunkHeight, 9), {
    x: position.x,
    y: trunkHeight / 2,
    z: position.z,
  }, { rotation: [0, 0, lean] });
  const top = new THREE.Vector3(position.x - Math.sin(lean) * trunkHeight, trunkHeight, position.z);
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + random();
    batcher.add("planeBark", bark, new THREE.CylinderGeometry(0.07 * scale, 0.12 * scale, 1.9 * scale, 6), {
      x: top.x + Math.cos(angle) * 0.5 * scale,
      y: top.y + 0.7 * scale,
      z: top.z + Math.sin(angle) * 0.5 * scale,
    }, { rotation: [Math.sin(angle) * 0.6, 0, -Math.cos(angle) * 0.6] });
  }
  const canopyCentre = top.clone().add(new THREE.Vector3(0, 1.9 * scale, 0));
  batcher.add("planeCore", core, new THREE.IcosahedronGeometry(1, 1), canopyCentre, {
    scale: [2.2 * scale, 1.4 * scale, 2.2 * scale],
  });
  const card = new THREE.PlaneGeometry(1.7 * scale, 1.7 * scale);
  for (let i = 0; i < 46; i++) {
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(random() * 1.6 - 0.6);
    const radius = (2.0 + random() * 0.6) * scale;
    batcher.add("planeLeaves", leaves, card, {
      x: canopyCentre.x + Math.sin(phi) * Math.cos(theta) * radius * 1.15,
      y: canopyCentre.y + Math.cos(phi) * radius * 0.7,
      z: canopyCentre.z + Math.sin(phi) * Math.sin(theta) * radius * 1.15,
    }, { rotation: [random() * Math.PI, random() * Math.PI, random() * Math.PI] });
  }
}

// Low rolling hills on the horizon, vertex-shaded from base to crest.
export function createHills(color: number, crest: number, radius: number, height: number, seed: number, arc: [number, number]): THREE.Mesh {
  const random = seeded(seed);
  const segments = 64;
  const positions: number[] = [];
  const colors: number[] = [];
  const base = new THREE.Color(color);
  const top = new THREE.Color(crest);
  const heights = Array.from({ length: segments + 1 }, (_, i) => height * (0.45 + 0.55 * Math.abs(Math.sin(i * 0.31 + random() * 0.4)) * (0.6 + random() * 0.4)));
  for (let i = 0; i < segments; i++) {
    const a0 = arc[0] + ((arc[1] - arc[0]) * i) / segments;
    const a1 = arc[0] + ((arc[1] - arc[0]) * (i + 1)) / segments;
    const p = (angle: number, y: number) => [Math.sin(angle) * radius, y, -Math.cos(angle) * radius];
    const quad = [p(a0, -2), p(a1, -2), p(a1, heights[i + 1]), p(a0, -2), p(a1, heights[i + 1]), p(a0, heights[i])];
    for (const vertex of quad) {
      positions.push(...vertex);
      const c = base.clone().lerp(top, Math.max(0, vertex[1]) / height);
      colors.push(c.r, c.g, c.b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: true }));
}

// Bunting strung between two points, sagging, with flags that flutter.
export function createBunting(from: THREE.Vector3, to: THREE.Vector3, colors: readonly number[], seed: number): { group: THREE.Group; flags: THREE.Mesh[] } {
  const random = seeded(seed);
  const group = new THREE.Group();
  const flags: THREE.Mesh[] = [];
  const curve = new THREE.QuadraticBezierCurve3(from, from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, -0.9, 0)), to);
  const rope = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.012, 4, false), wiiMaterial(worldTheme.rope, { sheen: 0 }));
  group.add(rope);
  const count = Math.floor(from.distanceTo(to) / 0.45);
  const flagGeometry = new THREE.BufferGeometry();
  flagGeometry.setAttribute("position", new THREE.Float32BufferAttribute([-0.13, 0, 0, 0.13, 0, 0, 0, -0.3, 0], 3));
  flagGeometry.computeVertexNormals();
  const materials = colors.map((color) => wiiMaterial(color, { side: THREE.DoubleSide, sheen: 0.1 }));
  for (let i = 1; i < count; i++) {
    const flag = new THREE.Mesh(flagGeometry, materials[Math.floor(random() * materials.length)]);
    const point = curve.getPoint(i / count);
    flag.position.copy(point);
    // Flag's x axis runs along the rope; it flutters about that axis.
    flag.rotation.order = "YXZ";
    flag.rotation.y = Math.atan2(-(to.z - from.z), to.x - from.x);
    flag.userData.phase = random() * Math.PI * 2;
    flag.castShadow = true;
    flags.push(flag);
    group.add(flag);
  }
  return { group, flags };
}

export function flutter(flags: THREE.Mesh[], clock: number): void {
  for (const flag of flags) flag.rotation.x = Math.sin(clock * 3.1 + (flag.userData.phase as number)) * 0.4;
}
