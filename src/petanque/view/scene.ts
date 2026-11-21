// Builds the sunny village park: painted sky and clouds, rolling hills, a
// striped lawn, the gravel terrain, trees, a café terrace, bunting and the
// village beyond. Soft, high-key lighting with image-based fill from the scene
// itself, plus a little bloom and a vignette for that console-party glow.

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { pitch } from "../config/rules";
import { worldTheme } from "../config/theme";
import {
  blobShadowTexture,
  cloudTexture,
  grassTexture,
  gravelTextures,
  leafTexture,
  roofTexture,
  woodTexture,
} from "./textures";

export interface SpectatorSpot {
  position: THREE.Vector3;
  facing: number;
}

export interface StageView {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  spectatorSpots: SpectatorSpot[];
  update(dt: number): void;
  render(): void;
  resize(): void;
}

// ---------- materials & helpers ----------

function standard(color: number, roughness = 0.75, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
}

function shadowed<T extends THREE.Object3D>(object: T, cast = true, receive = true): T {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = cast;
      child.receiveShadow = receive;
    }
  });
  return object;
}

// Paints a vertical light-to-dark gradient into vertex colours, plus a touch of
// "sky light" on upward-facing faces, so rounded foliage reads as soft volumes.
function paintGradient(geometry: THREE.BufferGeometry, bottom: number, top: number, minY: number, maxY: number): THREE.BufferGeometry {
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const low = new THREE.Color(bottom);
  const high = new THREE.Color(top);
  const colors: number[] = [];
  const color = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const t = THREE.MathUtils.clamp((position.getY(i) - minY) / (maxY - minY), 0, 1);
    color.copy(low).lerp(high, t * t * (3 - 2 * t));
    if (normal) color.lerp(high, Math.max(0, normal.getY(i)) * 0.25);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

function blobShadow(size: number, opacity = 1): THREE.Mesh {
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, opacity, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  shadow.renderOrder = -1;
  return shadow;
}

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// ---------- sky ----------

function createSky(sunDirection: THREE.Vector3): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(worldTheme.skyTop) },
      horizonColor: { value: new THREE.Color(worldTheme.skyHorizon) },
      sunColor: { value: new THREE.Color(worldTheme.sunLight) },
      sunDirection: { value: sunDirection.clone().normalize() },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 sunColor;
      uniform vec3 sunDirection;
      varying vec3 vWorld;
      void main() {
        vec3 direction = normalize(vWorld);
        float h = clamp(direction.y * 1.4, 0.0, 1.0);
        vec3 color = mix(horizonColor, topColor, pow(h, 0.6));
        float sun = max(dot(direction, sunDirection), 0.0);
        color += sunColor * (pow(sun, 8.0) * 0.18 + pow(sun, 400.0) * 0.9);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(450, 48, 24), material);
}

function createClouds(): THREE.Sprite[] {
  const random = seeded(5);
  const clouds: THREE.Sprite[] = [];
  for (let i = 0; i < 14; i++) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: cloudTexture(i % 4), transparent: true, depthWrite: false, fog: false }),
    );
    const scale = 28 + random() * 30;
    sprite.scale.set(scale, scale / 2, 1);
    const angle = -Math.PI * 0.95 + random() * Math.PI * 1.9;
    const distance = 160 + random() * 140;
    sprite.position.set(Math.sin(angle) * distance, 35 + random() * 45, -Math.cos(angle) * distance);
    clouds.push(sprite);
  }
  return clouds;
}

// ---------- ground & pitch ----------

function createGround(): THREE.Group {
  const group = new THREE.Group();

  const size = 260;
  const grassGeometry = new THREE.PlaneGeometry(size, size, 80, 80);
  const colors: number[] = [];
  const position = grassGeometry.attributes.position;
  const light = new THREE.Color(0xffffff);
  const far = new THREE.Color(worldTheme.hillFar);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const patch = 0.5 + 0.5 * Math.sin(x * 0.13 + Math.cos(y * 0.07) * 2) * Math.cos(y * 0.11);
    const color = light.clone().lerp(new THREE.Color(0.86, 0.92, 0.84), patch * 0.35);
    const distance = Math.hypot(x, y + 6);
    color.lerp(far.clone().multiplyScalar(1.15), THREE.MathUtils.clamp((distance - 45) / 70, 0, 0.6));
    colors.push(color.r, color.g, color.b);
  }
  grassGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const grassMap = grassTexture().clone();
  grassMap.needsUpdate = true;
  grassMap.repeat.set(size / 9, size / 9);
  const grass = new THREE.Mesh(grassGeometry, standard(0xffffff, 0.92, { map: grassMap, vertexColors: true }));
  grass.rotation.x = -Math.PI / 2;
  grass.receiveShadow = true;
  group.add(grass);

  // Gravel terrain
  const length = pitch.backLine - pitch.deadLine;
  const centreZ = (pitch.backLine + pitch.deadLine) / 2;
  const { map, bump } = gravelTextures();
  const gravelMap = map.clone();
  const gravelBump = bump.clone();
  for (const texture of [gravelMap, gravelBump]) {
    texture.needsUpdate = true;
    texture.repeat.set((pitch.halfWidth * 2) / 1.6, length / 1.6);
  }
  const gravel = new THREE.Mesh(
    new THREE.PlaneGeometry(pitch.halfWidth * 2, length),
    standard(0xffffff, 0.95, { map: gravelMap, bumpMap: gravelBump, bumpScale: 1.2 }),
  );
  gravel.rotation.x = -Math.PI / 2;
  gravel.position.set(0, 0.004, centreZ);
  gravel.receiveShadow = true;
  group.add(gravel);

  // Rounded timber surround with corner posts.
  const wood = woodTexture();
  const boardMaterial = standard(0xffffff, 0.7, { map: wood });
  const boardHeight = 0.16;
  const boardThickness = 0.14;
  const sideGeometry = new THREE.BoxGeometry(boardThickness, boardHeight, length + boardThickness * 2);
  const endGeometry = new THREE.BoxGeometry(pitch.halfWidth * 2 + boardThickness * 2, boardHeight, boardThickness);
  for (const side of [-1, 1]) {
    const board = new THREE.Mesh(sideGeometry, boardMaterial);
    board.position.set(side * (pitch.halfWidth + boardThickness / 2), boardHeight / 2, centreZ);
    group.add(shadowed(board));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(boardThickness / 2, boardThickness / 2, length + boardThickness * 2, 12), boardMaterial);
    cap.rotation.x = Math.PI / 2;
    cap.position.set(side * (pitch.halfWidth + boardThickness / 2), boardHeight, centreZ);
    group.add(shadowed(cap));
  }
  for (const z of [pitch.backLine + boardThickness / 2, pitch.deadLine - boardThickness / 2]) {
    const board = new THREE.Mesh(endGeometry, boardMaterial);
    board.position.set(0, boardHeight / 2, z);
    group.add(shadowed(board));
  }
  const postMaterial = standard(worldTheme.boardDark, 0.7);
  for (const x of [-1, 1]) {
    for (const z of [pitch.backLine + boardThickness / 2, pitch.deadLine - boardThickness / 2]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.3, 16), postMaterial);
      post.position.set(x * (pitch.halfWidth + boardThickness / 2), 0.15, z);
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), postMaterial);
      top.position.set(post.position.x, 0.3, z);
      group.add(shadowed(post), shadowed(top));
    }
  }

  // Throwing circle: a red plastic hoop like the real thing.
  const circle = new THREE.Mesh(
    new THREE.TorusGeometry(pitch.circleRadius, 0.022, 12, 64),
    standard(worldTheme.circle, 0.35, { emissive: worldTheme.circle, emissiveIntensity: 0.08 }),
  );
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = 0.022;
  group.add(shadowed(circle, true, false));

  // Chalk lines for the 6 m – 10 m jack zone.
  for (const distance of [pitch.jackMinDistance, pitch.jackMaxDistance]) {
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(pitch.halfWidth * 2 - 0.1, 0.04),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }),
    );
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.008, -distance);
    group.add(line);
  }

  // A sandy footpath circling the terrain.
  const path = new THREE.Mesh(
    new THREE.RingGeometry(9.5, 11.5, 64, 1),
    standard(worldTheme.path, 0.95),
  );
  path.rotation.x = -Math.PI / 2;
  path.scale.set(0.9, 1.6, 1);
  path.position.set(0, 0.003, -6);
  path.receiveShadow = true;
  group.add(path);

  return group;
}

// ---------- plants ----------

function createRoundTree(scale: number, seed: number): THREE.Group {
  const random = seeded(seed);
  const tree = new THREE.Group();
  const bark = standard(worldTheme.trunk, 0.9);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 2.4, 12), bark);
  trunk.position.y = 1.2;
  tree.add(trunk);
  for (const side of [-1, 1]) {
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.9, 8), bark);
    branch.position.set(side * 0.3, 2.2, 0);
    branch.rotation.z = -side * 0.7;
    tree.add(branch);
  }

  const leaves = standard(0xffffff, 0.8, { vertexColors: true, map: leafTexture() });
  const blobs = 6;
  for (let i = 0; i < blobs; i++) {
    const radius = 0.9 + random() * 0.6;
    const geometry = new THREE.IcosahedronGeometry(radius, 4);
    const angle = (i / blobs) * Math.PI * 2;
    const ring = i === 0 ? 0 : 0.9;
    const y = 3.0 + (i === 0 ? 0.6 : random() * 0.6 - 0.2);
    paintGradient(geometry, worldTheme.leavesDark, worldTheme.leavesLight, -radius, radius);
    const blob = new THREE.Mesh(geometry, leaves);
    blob.position.set(Math.cos(angle) * ring, y, Math.sin(angle) * ring);
    tree.add(blob);
  }
  const top = new THREE.Mesh(paintGradient(new THREE.IcosahedronGeometry(1.2, 4), worldTheme.leaves, worldTheme.leavesLight, -1.2, 1.2), leaves);
  top.position.y = 4.1;
  tree.add(top);
  tree.add(blobShadow(4.6, 0.75));
  tree.scale.setScalar(scale);
  return shadowed(tree);
}

function createCypress(scale: number): THREE.Group {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.8, 8), standard(worldTheme.trunkDark, 0.9));
  trunk.position.y = 0.4;
  const geometry = paintGradient(new THREE.SphereGeometry(0.75, 24, 24), worldTheme.cypress, worldTheme.cypressLight, -0.75, 0.75);
  const body = new THREE.Mesh(geometry, standard(0xffffff, 0.85, { vertexColors: true, map: leafTexture() }));
  body.scale.set(1, 3.6, 1);
  body.position.y = 3.0;
  tree.add(trunk, body, blobShadow(2.4, 0.7));
  tree.scale.setScalar(scale);
  return shadowed(tree);
}

function createHedge(length: number): THREE.Group {
  const group = new THREE.Group();
  const geometry = new THREE.CapsuleGeometry(0.45, length, 8, 24);
  geometry.rotateZ(Math.PI / 2);
  paintGradient(geometry, worldTheme.leavesDark, worldTheme.leavesLight, -0.45, 0.45);
  const hedge = new THREE.Mesh(geometry, standard(0xffffff, 0.85, { vertexColors: true, map: leafTexture() }));
  hedge.scale.set(1, 1.1, 0.9);
  hedge.position.y = 0.45;
  group.add(hedge);
  return shadowed(group);
}

function createFlowerBed(length: number, seed: number): THREE.Group {
  const random = seeded(seed);
  const group = new THREE.Group();
  const soil = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, length, 4, 16), standard(worldTheme.trunkDark, 1));
  soil.rotation.z = Math.PI / 2;
  soil.scale.set(0.25, 1, 1);
  soil.position.y = 0.03;
  group.add(soil);

  const count = Math.floor(length * 22);
  const leafMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 8, 6), standard(worldTheme.leaves, 0.8), count);
  const flowerMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 10, 8), standard(0xffffff, 0.5), count);
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const x = (random() - 0.5) * length;
    const z = (random() - 0.5) * 0.6;
    matrix.makeTranslation(x, 0.12 + random() * 0.06, z);
    leafMesh.setMatrixAt(i, matrix);
    matrix.makeTranslation(x + (random() - 0.5) * 0.08, 0.24 + random() * 0.08, z);
    flowerMesh.setMatrixAt(i, matrix);
    flowerMesh.setColorAt(i, color.setHex(worldTheme.flowers[Math.floor(random() * worldTheme.flowers.length)]));
  }
  group.add(leafMesh, flowerMesh);
  return shadowed(group);
}

function createLavenderRow(length: number): THREE.Group {
  const row = new THREE.Group();
  const geometry = paintGradient(new THREE.SphereGeometry(0.36, 16, 12), worldTheme.leavesDark, worldTheme.lavenderLight, -0.36, 0.36);
  // Purple tops over a green base.
  const colors = geometry.attributes.color;
  const purple = new THREE.Color(worldTheme.lavender);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    if (position.getY(i) > -0.05) {
      const t = THREE.MathUtils.clamp((position.getY(i) + 0.05) / 0.3, 0, 1);
      const c = new THREE.Color(colors.getX(i), colors.getY(i), colors.getZ(i)).lerp(purple, 0.6 + t * 0.4);
      colors.setXYZ(i, c.r, c.g, c.b);
    }
  }
  const material = standard(0xffffff, 0.85, { vertexColors: true });
  for (let i = 0; i < length; i++) {
    const bush = new THREE.Mesh(geometry, material);
    bush.scale.set(1, 0.85, 1);
    bush.position.set(i * 0.68, 0.26, 0);
    row.add(bush);
  }
  return shadowed(row);
}

// ---------- village ----------

function createHouse(width: number, depth: number, height: number, wall: number, shutter: number, seed: number): THREE.Group {
  const random = seeded(seed);
  const house = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), standard(wall, 0.9));
  body.position.y = height / 2;
  house.add(body);

  // Gabled terracotta roof with overhang.
  const overhang = 0.35;
  const roofHeight = height * 0.42;
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2 - overhang, 0);
  shape.lineTo(0, roofHeight);
  shape.lineTo(width / 2 + overhang, 0);
  shape.lineTo(-width / 2 - overhang, 0);
  const roofGeometry = new THREE.ExtrudeGeometry(shape, { depth: depth + overhang * 2, bevelEnabled: false });
  roofGeometry.translate(0, 0, -(depth + overhang * 2) / 2);
  const roofMap = roofTexture().clone();
  roofMap.needsUpdate = true;
  roofMap.repeat.set(0.25, 0.25);
  const roof = new THREE.Mesh(roofGeometry, standard(0xffffff, 0.8, { map: roofMap }));
  roof.position.y = height;
  house.add(roof);
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 0.5), standard(wall, 0.9));
  chimney.position.set(width * 0.25, height + roofHeight * 0.6, 0);
  house.add(chimney);

  const frame = standard(0xffffff, 0.6);
  const glass = standard(worldTheme.windowGlass, 0.15, { metalness: 0.2 });
  const shutterMaterial = standard(shutter, 0.6);
  const floors = height > 5 ? 2 : 1;
  for (let floor = 0; floor < floors; floor++) {
    for (const column of [-1, 1]) {
      const y = height * (floors === 2 ? 0.32 + floor * 0.38 : 0.58);
      const x = column * width * 0.27;
      const windowGroup = new THREE.Group();
      const pane = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.95, 0.05), glass);
      const surround = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.1, 0.04), frame);
      surround.position.z = -0.01;
      windowGroup.add(surround, pane);
      for (const side of [-1, 1]) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.05, 0.05), shutterMaterial);
        panel.position.set(side * 0.65, 0, 0.01);
        windowGroup.add(panel);
      }
      if (random() < 0.7) {
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.22), standard(worldTheme.trunk, 0.8));
        box.position.set(0, -0.62, 0.1);
        windowGroup.add(box);
        for (let i = 0; i < 5; i++) {
          const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), standard(worldTheme.flowers[Math.floor(random() * 5)], 0.5));
          bloom.position.set(-0.32 + i * 0.16, -0.5, 0.12);
          windowGroup.add(bloom);
        }
      }
      windowGroup.position.set(x, y, depth / 2 + 0.03);
      house.add(windowGroup);
    }
  }
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.7, 0.06), standard(shutter, 0.6));
  door.position.set(0, 0.85, depth / 2 + 0.03);
  const doorTop = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.06, 20, 1, false, -Math.PI / 2, Math.PI), standard(shutter, 0.6));
  doorTop.rotation.x = Math.PI / 2;
  doorTop.position.set(0, 1.7, depth / 2 + 0.03);
  house.add(door, doorTop);
  return shadowed(house);
}

function createBench(): THREE.Group {
  const bench = new THREE.Group();
  const wood = standard(0xffffff, 0.65, { map: woodTexture() });
  for (let i = 0; i < 3; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 0.13), wood);
    slat.position.set(0, 0.45, -0.15 + i * 0.15);
    bench.add(slat);
  }
  for (let i = 0; i < 2; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.13, 0.04), wood);
    slat.position.set(0, 0.68 + i * 0.17, -0.24);
    slat.rotation.x = -0.15;
    bench.add(slat);
  }
  const iron = standard(worldTheme.metalDark, 0.4, { metalness: 0.4 });
  for (const x of [-0.75, 0.75]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.42), iron);
    leg.position.set(x, 0.225, -0.02);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), iron);
    back.position.set(x, 0.7, -0.25);
    bench.add(leg, back);
  }
  bench.add(blobShadow(2.2, 0.6));
  return shadowed(bench);
}

function createLamp(): THREE.Group {
  const lamp = new THREE.Group();
  const iron = standard(worldTheme.metalDark, 0.4, { metalness: 0.5 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 3.2, 10), iron);
  pole.position.y = 1.6;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.3, 12), iron);
  base.position.y = 0.15;
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.12, 0.4, 6), standard(0xfff6d8, 0.3, { emissive: 0xfff2c0, emissiveIntensity: 0.4 }));
  head.position.y = 3.35;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.25, 6), iron);
  hat.position.y = 3.67;
  lamp.add(pole, base, head, hat, blobShadow(0.8, 0.6));
  return shadowed(lamp);
}

function createCafeTable(seed: number): THREE.Group {
  const random = seeded(seed);
  const group = new THREE.Group();
  const iron = standard(worldTheme.metalDark, 0.4, { metalness: 0.4 });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.04, 24), standard(worldTheme.tablecloth, 0.6));
  top.position.y = 0.74;
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.74, 8), iron);
  leg.position.y = 0.37;
  group.add(top, leg);

  // Striped parasol: alternate the colour of each canopy wedge.
  const canopyGeometry = new THREE.ConeGeometry(1.3, 0.45, 12, 1, true).toNonIndexed();
  const position = canopyGeometry.attributes.position;
  const colors: number[] = [];
  const stripeA = new THREE.Color(worldTheme.umbrella[0]);
  const stripeB = new THREE.Color(worldTheme.umbrella[1]);
  for (let i = 0; i < position.count; i += 3) {
    const cx = (position.getX(i) + position.getX(i + 1) + position.getX(i + 2)) / 3;
    const cz = (position.getZ(i) + position.getZ(i + 1) + position.getZ(i + 2)) / 3;
    const wedge = Math.floor(((Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2)) * 12);
    const color = wedge % 2 === 0 ? stripeA : stripeB;
    for (let k = 0; k < 3; k++) colors.push(color.r, color.g, color.b);
  }
  canopyGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  canopyGeometry.computeVertexNormals();
  const canopy = new THREE.Mesh(canopyGeometry, standard(0xffffff, 0.6, { vertexColors: true, side: THREE.DoubleSide }));
  canopy.position.y = 2.25;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.4, 8), standard(0xffffff, 0.5));
  pole.position.y = 1.2;
  group.add(canopy, pole);

  for (let i = 0; i < 2; i++) {
    const chair = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 16), standard(worldTheme.shutter, 0.5));
    seat.position.y = 0.45;
    const back = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 6, 16, Math.PI), iron);
    back.position.set(0, 0.65, 0.18);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 6), iron);
    stem.position.y = 0.225;
    chair.add(seat, back, stem);
    const angle = i * Math.PI + random() * 0.6;
    chair.position.set(Math.sin(angle) * 0.75, 0, Math.cos(angle) * 0.75);
    chair.rotation.y = angle;
    group.add(chair);
  }
  group.add(blobShadow(2.8, 0.65));
  return shadowed(group);
}

// Pennant bunting strung between two poles; flags sway in the breeze.
function createBunting(from: THREE.Vector3, to: THREE.Vector3, seed: number): { group: THREE.Group; flags: THREE.Mesh[] } {
  const random = seeded(seed);
  const group = new THREE.Group();
  const poleMaterial = standard(0xffffff, 0.5);
  for (const end of [from, to]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, end.y + 0.2, 8), poleMaterial);
    pole.position.set(end.x, (end.y + 0.2) / 2, end.z);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), standard(worldTheme.flowers[1], 0.4));
    ball.position.set(end.x, end.y + 0.25, end.z);
    group.add(shadowed(pole), ball);
  }
  const middle = from.clone().lerp(to, 0.5);
  middle.y -= from.distanceTo(to) * 0.08;
  const curve = new THREE.QuadraticBezierCurve3(from, middle, to);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.012, 5), standard(worldTheme.rope, 0.8)));

  const flagGeometry = new THREE.BufferGeometry();
  flagGeometry.setAttribute("position", new THREE.Float32BufferAttribute([-0.18, 0, 0, 0.18, 0, 0, 0, -0.42, 0], 3));
  flagGeometry.computeVertexNormals();
  const flags: THREE.Mesh[] = [];
  const count = Math.floor(from.distanceTo(to) / 0.55);
  for (let i = 1; i < count; i++) {
    const t = i / count;
    const point = curve.getPoint(t);
    const tangent = curve.getTangent(t);
    const flag = new THREE.Mesh(
      flagGeometry,
      standard(worldTheme.bunting[i % worldTheme.bunting.length], 0.6, { side: THREE.DoubleSide }),
    );
    flag.position.copy(point);
    flag.rotation.y = Math.atan2(-tangent.z, tangent.x);
    flag.userData.phase = random() * Math.PI * 2;
    flag.castShadow = true;
    flags.push(flag);
    group.add(flag);
  }
  return { group, flags };
}

// ---------- landscape ----------

function createHills(): THREE.Group {
  const group = new THREE.Group();
  const hills: Array<[number, number, number, number, number, number]> = [
    [-110, -230, 120, 0.4, worldTheme.hillDistant, worldTheme.hillFar],
    [80, -260, 140, 0.32, worldTheme.hillDistant, worldTheme.hillFar],
    [0, -300, 160, 0.3, worldTheme.hillDistant, worldTheme.hillDistant],
    [-60, -130, 55, 0.35, worldTheme.hillFar, worldTheme.hill],
    [45, -150, 70, 0.3, worldTheme.hillFar, worldTheme.hill],
    [-30, -100, 38, 0.38, worldTheme.hill, worldTheme.grassStripe],
    [75, -95, 42, 0.34, worldTheme.hill, worldTheme.grassStripe],
    [-100, -60, 48, 0.3, worldTheme.hill, worldTheme.grassStripe],
    [105, -40, 44, 0.3, worldTheme.hillFar, worldTheme.hill],
    [-95, 40, 50, 0.3, worldTheme.hillFar, worldTheme.hill],
    [90, 55, 50, 0.3, worldTheme.hillFar, worldTheme.hill],
  ];
  for (const [x, z, radius, squash, bottom, top] of hills) {
    const geometry = paintGradient(new THREE.SphereGeometry(radius, 48, 24), bottom, top, 0, radius);
    const hill = new THREE.Mesh(geometry, standard(0xffffff, 1, { vertexColors: true }));
    hill.scale.y = squash;
    hill.position.set(x, -2, z);
    group.add(hill);
  }

  // Little tree clumps dotted on the hills.
  const random = seeded(77);
  const clump = paintGradient(new THREE.IcosahedronGeometry(1.6, 2), worldTheme.leavesDark, worldTheme.leaves, -1.6, 1.6);
  const clumps = new THREE.InstancedMesh(clump, standard(0xffffff, 0.9, { vertexColors: true }), 90);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < 90; i++) {
    const angle = -Math.PI * 0.85 + random() * Math.PI * 1.7;
    const distance = 55 + random() * 70;
    const scale = 1 + random() * 1.6;
    matrix.compose(
      new THREE.Vector3(Math.sin(angle) * distance, 1 + random() * 5, -6 - Math.cos(angle) * distance),
      new THREE.Quaternion(),
      new THREE.Vector3(scale, scale * 1.2, scale),
    );
    clumps.setMatrixAt(i, matrix);
  }
  group.add(clumps);
  return group;
}

function createScenery(): { group: THREE.Group; flags: THREE.Mesh[]; spectatorSpots: SpectatorSpot[] } {
  const group = new THREE.Group();
  group.add(createHills());

  const treeSpots: Array<[number, number, number]> = [
    [-7.5, -3, 1.0], [-8, -11, 1.15], [-7.2, -19, 0.95], [7.8, -8, 1.1], [8.4, -16, 1.0], [7, 4, 0.95],
    [-8.5, 5, 1.1], [-14, -24, 1.3], [13, -23, 1.2], [15, -7, 1.35], [-16, -9, 1.3], [-3, -27, 1.1], [-11, 12, 1.2], [12, 10, 1.15],
    [-20, 2, 1.4], [21, 0, 1.4],
  ];
  treeSpots.forEach(([x, z, scale], index) => {
    const tree = createRoundTree(scale, index + 1);
    tree.position.set(x, 0, z);
    tree.rotation.y = x * 1.7;
    group.add(tree);
  });

  // A row of Provençal cypresses along the back.
  for (let i = 0; i < 7; i++) {
    const cypress = createCypress(0.9 + (i % 3) * 0.12);
    cypress.position.set(-13 + i * 4.3, 0, -30 - (i % 2) * 1.2);
    group.add(cypress);
  }

  // Village
  const walls = [worldTheme.wallCream, worldTheme.wallPeach, worldTheme.wallYellow];
  const shutters = [worldTheme.shutter, worldTheme.shutterBlue];
  const houses: Array<[number, number, number, number, number, number]> = [
    [-17, -40, 6, 5, 4.6, 0.2],
    [-8, -43, 5, 5, 6.2, -0.05],
    [1, -44, 6.5, 5, 4.4, 0.05],
    [10, -42, 5.2, 5.5, 5.8, -0.12],
    [19, -38, 5.5, 5, 4.6, -0.3],
  ];
  houses.forEach(([x, z, width, depth, height, rotation], index) => {
    const house = createHouse(width, depth, height, walls[index % walls.length], shutters[index % shutters.length], index + 10);
    house.position.set(x, 0, z);
    house.rotation.y = rotation;
    group.add(house);
  });

  // Benches, lamps, café terrace and flower beds around the terrain.
  for (const [x, z, rotation] of [[-3.8, -2, Math.PI / 2], [3.8, -6, -Math.PI / 2], [-3.8, -12, Math.PI / 2]] as const) {
    const bench = createBench();
    bench.position.set(x, 0, z);
    bench.rotation.y = rotation;
    group.add(bench);
  }
  for (const [x, z] of [[-4.3, -2.2], [4.3, -2.2], [-4.3, -14.8], [4.3, -14.8]] as const) {
    const lamp = createLamp();
    lamp.position.set(x, 0, z);
    group.add(lamp);
  }
  for (const [x, z, seed] of [[8.5, -1.5, 1], [9.6, -5, 2], [-6.5, -16, 3]] as const) {
    const table = createCafeTable(seed);
    table.position.set(x, 0, z);
    group.add(table);
  }
  for (const [x, z, length, rotation, seed] of [
    [-5.2, -6, 6, Math.PI / 2, 1],
    [5.2, -11.5, 5, Math.PI / 2, 2],
    [0, 4.4, 4, 0, 3],
  ] as const) {
    const bed = createFlowerBed(length, seed);
    bed.position.set(x, 0, z);
    bed.rotation.y = rotation;
    group.add(bed);
  }
  for (const [x, z, length, rotation] of [
    [-11, -4, 7, Math.PI / 2],
    [11, -12, 7, Math.PI / 2],
    [-9, -20.5, 5, 0],
    [9, -20.5, 5, 0],
  ] as const) {
    const hedge = createHedge(length);
    hedge.position.set(x, 0, z);
    hedge.rotation.y = rotation;
    group.add(hedge);
  }
  for (const [x, z] of [[-10, 1], [9, -28]] as const) {
    const row = createLavenderRow(9);
    row.position.set(x, 0, z);
    if (x < 0) row.rotation.y = Math.PI / 2;
    group.add(row);
  }

  // Bunting across the far end and along one side.
  const flags: THREE.Mesh[] = [];
  for (const [from, to, seed] of [
    [new THREE.Vector3(-3.2, 2.6, -13.5), new THREE.Vector3(3.2, 2.6, -13.5), 1],
    [new THREE.Vector3(-3.2, 2.6, -13.5), new THREE.Vector3(-3.2, 2.6, -3), 2],
    [new THREE.Vector3(3.2, 2.6, -13.5), new THREE.Vector3(3.2, 2.6, -3), 3],
  ] as const) {
    const bunting = createBunting(from, to, seed);
    group.add(bunting.group);
    flags.push(...bunting.flags);
  }

  // Where onlookers stand to watch the game.
  const spectatorSpots: SpectatorSpot[] = [
    { position: new THREE.Vector3(-4.6, 0, -4.2), facing: -Math.PI / 2 },
    { position: new THREE.Vector3(-4.8, 0, -8.6), facing: -Math.PI / 2.4 },
    { position: new THREE.Vector3(4.7, 0, -9.5), facing: Math.PI / 2.2 },
    { position: new THREE.Vector3(5.3, 0, -3.4), facing: Math.PI / 1.8 },
    { position: new THREE.Vector3(-1.4, 0, -15.6), facing: Math.PI },
    { position: new THREE.Vector3(1.6, 0, -15.8), facing: Math.PI * 0.95 },
  ];

  return { group, flags, spectatorSpots };
}

// ---------- post-processing ----------

const vignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    strength: { value: 0.32 },
    warmth: { value: new THREE.Color(1.03, 1.0, 0.96) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float strength;
    uniform vec3 warmth;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      vec2 centred = vUv - 0.5;
      float vignette = 1.0 - dot(centred, centred) * strength * 1.6;
      // A little extra saturation for that bright party-game pop.
      float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = mix(vec3(luma), color.rgb, 1.04) * warmth * vignette;
      gl_FragColor = color;
    }
  `,
};

// ---------- stage ----------

export function createStage(container: HTMLElement): StageView {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(worldTheme.fog, 70, 330);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 1000);
  camera.position.set(0, 2, 4);

  const sunDirection = new THREE.Vector3(10, 18, 7).normalize();
  scene.add(createSky(sunDirection));
  const clouds = createClouds();
  scene.add(...clouds);

  scene.add(new THREE.HemisphereLight(worldTheme.hemiSky, worldTheme.hemiGround, 0.9));
  const sun = new THREE.DirectionalLight(worldTheme.sunLight, 2.3);
  sun.position.copy(sunDirection).multiplyScalar(30).add(new THREE.Vector3(0, 0, -6));
  sun.target.position.set(0, 0, -6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.left = -22;
  sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 26;
  sun.shadow.camera.bottom = -26;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 80;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 5;
  scene.add(sun, sun.target);

  scene.add(createGround());
  const scenery = createScenery();
  scene.add(scenery.group);

  // Image-based fill light captured from the park itself, so chrome boules
  // reflect sky and grass and everything gets soft bounce light.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(scene, 0.03, 0.1, 1000, { position: new THREE.Vector3(0, 1.2, -6) }).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  const target = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.22, 0.55, 0.92);
  composer.addPass(bloom);
  composer.addPass(new ShaderPass(vignetteShader));
  composer.addPass(new OutputPass());

  function resize(): void {
    const width = container.clientWidth;
    const height = container.clientHeight;
    renderer.setSize(width, height);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(width, height);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }

  resize();

  let clock = 0;
  return {
    renderer,
    scene,
    camera,
    spectatorSpots: scenery.spectatorSpots,
    resize,
    render() {
      composer.render();
    },
    update(dt) {
      clock += dt;
      for (const cloud of clouds) {
        cloud.position.x += dt * 0.9;
        if (cloud.position.x > 260) cloud.position.x = -260;
      }
      for (const flag of scenery.flags) {
        flag.rotation.x = Math.sin(clock * 2.6 + (flag.userData.phase as number)) * 0.35;
      }
    },
  };
}
