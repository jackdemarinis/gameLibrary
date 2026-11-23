// Prop models built from low-poly primitives + the pixel textures, and the collider
// shapes that go with them. Interactive props (crates, braziers, gates...) expose the
// moving parts their runtime behaviour animates.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { textures } from "../engine/pixelTextures";
import { cachedMaterial, jitterGeometry, lambert, scaleUv, unlit, worldUvBox } from "../engine/retroMaterials";
import { makeRng, range } from "../engine/rng";
import { artPalette } from "./artPalette";

export type ColliderSpec =
  | { shape: "box"; hx: number; hy: number; hz: number; x: number; y: number; z: number; rotY: number }
  | { shape: "cylinder"; radius: number; halfHeight: number; x: number; y: number; z: number }
  | { shape: "hull"; points: Float32Array; x: number; y: number; z: number };

export interface LightSpec {
  x: number;
  y: number;
  z: number;
  color: number;
  intensity: number;
  distance: number;
  flicker: number;
}

export interface PropBuild {
  object: THREE.Object3D;
  colliders: ColliderSpec[];
  lights: LightSpec[];
  /** A hinged door the runtime turns into an interactable (positions are prop-local). */
  door?: DoorBuild;
}

export interface DoorBuild {
  /** Pivot on the hinge edge; rotate around y to swing (positive = inward). */
  leaf: THREE.Group;
  knob: THREE.Object3D;
  /** Centre of the closed leaf, prop-local. */
  leafCentre: THREE.Vector3;
  leafHalf: { x: number; y: number; z: number };
  /** Where the player stands to use it, prop-local. */
  doorstep: THREE.Vector3;
  /** Warm light spilling out of the doorway; scaled up as the door opens. */
  spill: THREE.Object3D | null;
}

function m(texture: THREE.Texture, side: THREE.Side = THREE.FrontSide): THREE.MeshLambertMaterial {
  return cachedMaterial(`prop-${texture.uuid}-${side}`, () => lambert({ map: texture, side }));
}

function windMaterial(texture: THREE.Texture, wind: number, alphaTest = 0): THREE.MeshLambertMaterial {
  return cachedMaterial(`wind-${texture.uuid}-${wind}-${alphaTest}`, () =>
    lambert({ map: texture, alphaTest, side: alphaTest > 0 ? THREE.DoubleSide : THREE.FrontSide }, { wind }),
  );
}

function glowMaterial(color: number, opacity = 0.6): THREE.SpriteMaterial {
  return cachedMaterial(`glow-${color}-${opacity}`, () =>
    new THREE.SpriteMaterial({ map: textures().glow, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity }),
  );
}

export function glowSprite(color: number, size: number, opacity = 0.6): THREE.Sprite {
  const sprite = new THREE.Sprite(glowMaterial(color, opacity));
  sprite.scale.setScalar(size);
  return sprite;
}

function emissive(color: number): THREE.MeshBasicMaterial {
  return cachedMaterial(`emissive-${color}`, () => unlit({ color }));
}

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const result = new THREE.Mesh(geometry, material);
  result.position.set(x, y, z);
  return result;
}

function box(hx: number, hy: number, hz: number, x: number, y: number, z: number, rotY = 0): ColliderSpec {
  return { shape: "box", hx, hy, hz, x, y, z, rotY };
}

// ---------------------------------------------------------------- buildings

function cottage(variant: string | undefined, enterable: boolean): PropBuild {
  const tex = textures();
  const group = new THREE.Group();
  const width = 6.4;
  const depth = 5;
  const wallHeight = 2.9;
  const roofHeight = 2.1;
  group.add(mesh(worldUvBox(width + 0.3, 0.7, depth + 0.3, 1.5), m(tex.stoneBrick), 0, 0.15, 0));
  // Walls are separate slabs so the front has a real doorway behind the door.
  const wallMaterial = m(tex.timberWall);
  const thick = 0.2;
  const wallY = 0.5 + wallHeight / 2;
  const doorWidth = 1.15;
  const doorHeight = 2.05;
  const doorX = -1.2;
  const doorLeft = doorX - doorWidth / 2;
  const doorRight = doorX + doorWidth / 2;
  const frontZ = depth / 2 - thick / 2;
  const slabs: Array<[number, number, number, number, number, number]> = [
    [width, wallHeight, thick, 0, wallY, -depth / 2 + thick / 2],
    [thick, wallHeight, depth, -width / 2 + thick / 2, wallY, 0],
    [thick, wallHeight, depth, width / 2 - thick / 2, wallY, 0],
    [doorLeft + width / 2, wallHeight, thick, (-width / 2 + doorLeft) / 2, wallY, frontZ],
    [width / 2 - doorRight, wallHeight, thick, (doorRight + width / 2) / 2, wallY, frontZ],
    [doorWidth, wallHeight - doorHeight, thick, doorX, 0.5 + doorHeight + (wallHeight - doorHeight) / 2, frontZ],
  ];
  for (const [sx, sy, sz, px, py, pz] of slabs) group.add(mesh(worldUvBox(sx, sy, sz, 3), wallMaterial, px, py, pz));

  // Gable roof: two sloped slabs with overhang, plus gable triangles.
  const roofTexture = variant === "blue" ? tex.roofBlue : variant === "thatch" ? tex.thatch : tex.roofRed;
  const eave = depth / 2 + 0.55;
  const ridgeY = 0.5 + wallHeight + roofHeight;
  const eaveY = 0.5 + wallHeight - 0.25;
  const roofLength = width + 0.9;
  const slab = Math.hypot(eave, ridgeY - eaveY);
  const pitch = Math.atan2(ridgeY - eaveY, eave);
  for (const side of [1, -1]) {
    const geometry = worldUvBox(roofLength, 0.16, slab, 1.6);
    const roof = mesh(geometry, m(roofTexture), 0, (ridgeY + eaveY) / 2, (side * eave) / 2);
    roof.rotation.x = side * pitch;
    group.add(roof);
  }
  const ridge = mesh(new THREE.CylinderGeometry(0.13, 0.13, roofLength + 0.1, 6).rotateZ(Math.PI / 2), m(tex.bark), 0, ridgeY, 0);
  group.add(ridge);
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-depth / 2, 0);
  gableShape.lineTo(depth / 2, 0);
  gableShape.lineTo(0, roofHeight + 0.1);
  gableShape.closePath();
  const gableGeometry = new THREE.ShapeGeometry(gableShape);
  scaleUv(gableGeometry, 1 / 3, 1 / 3);
  for (const side of [1, -1]) {
    const gable = mesh(gableGeometry, m(tex.timberWall, THREE.DoubleSide), (side * width) / 2, 0.5 + wallHeight, 0);
    gable.rotation.y = Math.PI / 2;
    group.add(gable);
  }

  // Hinged door: the pivot sits on the left jamb so the leaf swings inward.
  const leaf = new THREE.Group();
  leaf.position.set(doorLeft, 0.5, frontZ);
  leaf.add(mesh(worldUvBox(doorWidth - 0.04, doorHeight - 0.02, 0.1, 1), m(tex.plank), doorWidth / 2, doorHeight / 2, 0));
  for (const braceY of [0.4, doorHeight - 0.4]) leaf.add(mesh(new THREE.BoxGeometry(doorWidth - 0.1, 0.1, 0.04), m(tex.bark), doorWidth / 2, braceY, 0.07));
  const knob = new THREE.Group();
  knob.position.set(doorWidth - 0.2, 1.0, 0.09);
  knob.add(mesh(new THREE.OctahedronGeometry(0.06), m(tex.gold)));
  knob.add(mesh(new THREE.BoxGeometry(0.16, 0.035, 0.035), m(tex.gold), 0.05, 0, 0.03));
  leaf.add(knob);
  group.add(leaf);
  // Stone step up onto the plinth.
  group.add(mesh(worldUvBox(1.5, 0.25, 0.6, 1.5), m(tex.stoneBrick), doorX, 0.125, depth / 2 + 0.45));

  let spill: THREE.Object3D | null = null;
  if (enterable) {
    spill = new THREE.Group();
    spill.position.set(doorX, 1.4, depth / 2 + 0.25);
    spill.add(glowSprite(artPalette.windowGlow, 3.2, 0.45));
    spill.scale.setScalar(0.001);
    group.add(spill);
    addCottageInterior(group, width, depth, wallHeight, thick);
  }

  const windowGlow = emissive(artPalette.windowGlow);
  const frame = m(tex.plank);
  const windows: Array<[number, number, number, number]> = [
    [1.4, 2.0, depth / 2 + 0.03, 0],
    [-width / 2 - 0.03, 2.0, 0, -Math.PI / 2],
    [width / 2 + 0.03, 2.0, 0, Math.PI / 2],
  ];
  for (const [x, y, z, rot] of windows) {
    const pane = new THREE.Group();
    pane.position.set(x, y, z);
    pane.rotation.y = rot;
    pane.add(mesh(new THREE.PlaneGeometry(0.9, 0.8), windowGlow));
    pane.add(mesh(new THREE.BoxGeometry(1.06, 0.08, 0.08), frame, 0, 0.44, 0.02));
    pane.add(mesh(new THREE.BoxGeometry(1.06, 0.08, 0.08), frame, 0, -0.44, 0.02));
    pane.add(mesh(new THREE.BoxGeometry(0.06, 0.8, 0.06), frame, 0, 0, 0.03));
    pane.add(mesh(new THREE.BoxGeometry(0.9, 0.05, 0.06), frame, 0, 0, 0.03));
    const glow = glowSprite(artPalette.windowGlow, 2.4, 0.35);
    glow.position.z = 0.3;
    pane.add(glow);
    group.add(pane);
  }
  group.add(mesh(worldUvBox(0.8, 2.2, 0.8, 1), m(tex.stoneBrick), width / 2 - 1.2, ridgeY - 0.4, -0.9));
  const door: DoorBuild = {
    leaf,
    knob,
    leafCentre: new THREE.Vector3(doorX, 0.5 + doorHeight / 2, frontZ),
    leafHalf: { x: doorWidth / 2, y: doorHeight / 2, z: 0.08 },
    doorstep: new THREE.Vector3(doorX, 0, depth / 2 + 0.9),
    spill,
  };
  const outsideLight: LightSpec = { x: 1.4, y: 2.0, z: depth / 2 + 1.2, color: artPalette.windowGlow, intensity: 2.5, distance: 7, flicker: 0.2 };
  const stepCollider = box(0.75, 0.125, 0.3, doorX, 0.125, depth / 2 + 0.45);
  if (!enterable) {
    return { object: group, colliders: [box(width / 2 + 0.15, (ridgeY + 0.2) / 2, depth / 2 + 0.15, 0, (ridgeY + 0.2) / 2, 0, 0), stepCollider], lights: [outsideLight], door };
  }
  // Walk-in cottage: plinth to stand on, wall slabs (the door adds its own leaf
  // collider), and a ceiling/roof block so the camera stays inside the room.
  const ceilingY = 0.5 + wallHeight;
  const colliders = [
    box(width / 2 + 0.15, 0.35, depth / 2 + 0.15, 0, 0.15, 0),
    stepCollider,
    ...slabs.map(([sx, sy, sz, px, py, pz]) => box(sx / 2, sy / 2, sz / 2, px, py, pz)),
    box(width / 2 + 0.15, (ridgeY - ceilingY) / 2 + 0.1, depth / 2 + 0.15, 0, (ridgeY + ceilingY) / 2, 0),
  ];
  return {
    object: group,
    colliders,
    lights: [outsideLight, { x: -2.1, y: 1.4, z: -1.4, color: artPalette.ember, intensity: 3.2, distance: 8, flicker: 0.5 }],
    door,
  };
}

/** Furnishings for a cottage you can walk into: floor, ceiling, hearth, bed, table, rug. */
function addCottageInterior(group: THREE.Group, width: number, depth: number, wallHeight: number, thick: number): void {
  const tex = textures();
  const innerW = width - thick * 2;
  const innerD = depth - thick * 2;
  const floor = mesh(new THREE.PlaneGeometry(innerW, innerD).rotateX(-Math.PI / 2), m(tex.plankFlat), 0, 0.51, 0);
  scaleUv(floor.geometry, innerW / 2, innerD / 2);
  group.add(floor);
  const ceiling = mesh(new THREE.PlaneGeometry(innerW, innerD).rotateX(Math.PI / 2), m(tex.plankFlat), 0, 0.5 + wallHeight - 0.01, 0);
  scaleUv(ceiling.geometry, innerW / 2, innerD / 2);
  group.add(ceiling);
  for (const beamX of [-1.6, 0, 1.6]) group.add(mesh(new THREE.BoxGeometry(0.18, 0.2, innerD), m(tex.bark), beamX, 0.5 + wallHeight - 0.12, 0));

  // Hearth against the back wall, with a fire.
  const back = -depth / 2 + thick;
  group.add(mesh(worldUvBox(1.5, 1.3, 0.7, 1), m(tex.stoneBrick), -2.0, 0.5 + 0.65, back + 0.35));
  group.add(mesh(new THREE.BoxGeometry(0.8, 0.5, 0.1), emissive(0x1a0c06), -2.0, 0.5 + 0.38, back + 0.71));
  group.add(mesh(new THREE.BoxGeometry(0.5, 0.26, 0.12), emissive(artPalette.ember), -2.0, 0.5 + 0.2, back + 0.72));
  const fireGlow = glowSprite(artPalette.ember, 1.6, 0.7);
  fireGlow.position.set(-2.0, 0.5 + 0.4, back + 0.9);
  group.add(fireGlow);
  group.add(mesh(worldUvBox(0.7, wallHeight - 1.3, 0.5, 1), m(tex.stoneBrick), -2.0, 0.5 + 1.3 + (wallHeight - 1.3) / 2, back + 0.25));

  // Bed in the back-right corner.
  const bedX = width / 2 - thick - 0.6;
  group.add(mesh(worldUvBox(1.0, 0.35, 2.0, 1), m(tex.plank), bedX, 0.5 + 0.2, back + 1.1));
  group.add(mesh(new THREE.BoxGeometry(0.96, 0.12, 1.5), m(tex.scarf), bedX, 0.5 + 0.42, back + 1.35));
  group.add(mesh(new THREE.BoxGeometry(0.6, 0.14, 0.35), m(tex.robe), bedX, 0.5 + 0.44, back + 0.35));

  // Table, stools and a candle.
  group.add(mesh(worldUvBox(1.1, 0.08, 0.7, 1), m(tex.plank), 0.4, 0.5 + 0.78, -0.4));
  for (const [lx, lz] of [[-0.45, -0.28], [0.45, -0.28], [-0.45, 0.28], [0.45, 0.28]]) group.add(mesh(new THREE.BoxGeometry(0.08, 0.74, 0.08), m(tex.bark), 0.4 + lx, 0.5 + 0.37, -0.4 + lz));
  for (const sx of [-0.45, 1.25]) group.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.45, 6), m(tex.plank), sx, 0.5 + 0.22, -0.4));
  group.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 5), emissive(0xfff0d0), 0.5, 0.5 + 0.9, -0.4));
  const candle = glowSprite(artPalette.windowGlow, 0.6, 0.8);
  candle.position.set(0.5, 0.5 + 1.02, -0.4);
  group.add(candle);

  // Rug by the door and a shelf with pots.
  group.add(mesh(new THREE.PlaneGeometry(1.6, 1.0).rotateX(-Math.PI / 2), m(tex.robe), -1.0, 0.52, 0.9));
  group.add(mesh(new THREE.BoxGeometry(1.4, 0.08, 0.35), m(tex.plank), 1.2, 0.5 + 1.7, back + 0.2));
  for (const px of [0.8, 1.2, 1.55]) group.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.22, 6), m(tex.rock), px, 0.5 + 1.85, back + 0.2));
}

function well(): PropBuild {
  const tex = textures();
  const group = new THREE.Group();
  const ring = new THREE.CylinderGeometry(1, 1.05, 0.9, 10, 1, true);
  scaleUv(ring, 4, 0.6);
  group.add(mesh(ring, m(tex.mossBrick, THREE.DoubleSide), 0, 0.45, 0));
  const rim = new THREE.TorusGeometry(1, 0.12, 4, 10).rotateX(Math.PI / 2);
  group.add(mesh(rim, m(tex.stoneBrick), 0, 0.92, 0));
  group.add(mesh(new THREE.CircleGeometry(0.95, 10).rotateX(-Math.PI / 2), m(tex.water), 0, 0.4, 0));
  for (const side of [-1, 1]) group.add(mesh(worldUvBox(0.16, 2.3, 0.16, 1), m(tex.plank), side * 0.95, 1.15, 0));
  group.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.1, 6).rotateZ(Math.PI / 2), m(tex.bark), 0, 1.9, 0));
  for (const side of [1, -1]) {
    const roof = mesh(worldUvBox(2.5, 0.08, 1.05, 1.2), m(tex.thatch), 0, 2.45, side * 0.42);
    roof.rotation.x = side * 0.62;
    group.add(roof);
  }
  const bucket = mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.25, 7), m(tex.plank), 0.3, 1.35, 0);
  group.add(bucket);
  group.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 3), m(tex.leather), 0.3, 1.7, 0));
  return { object: group, colliders: [{ shape: "cylinder", radius: 1.15, halfHeight: 1.2, x: 0, y: 1.2, z: 0 }], lights: [] };
}

// ---------------------------------------------------------------- nature

function oak(seed: number, scale: number): PropBuild {
  const tex = textures();
  const rng = makeRng(seed);
  const group = new THREE.Group();
  const trunkHeight = 2.4;
  const trunk = new THREE.CylinderGeometry(0.2, 0.34, trunkHeight, 6, 2);
  trunk.translate(0, trunkHeight / 2, 0);
  jitterGeometry(trunk, 0.08, seed);
  scaleUv(trunk, 2, 1.5);
  group.add(mesh(trunk, m(tex.bark)));
  // Roots.
  for (let root = 0; root < 3; root += 1) {
    const angle = (root / 3) * Math.PI * 2 + rng();
    const rootMesh = mesh(new THREE.ConeGeometry(0.16, 0.8, 4).rotateZ(Math.PI / 2 - 0.35), m(tex.bark), Math.cos(angle) * 0.35, 0.1, Math.sin(angle) * 0.35);
    rootMesh.rotation.y = -angle;
    group.add(rootMesh);
  }
  const blobs: THREE.BufferGeometry[] = [];
  const count = 4 + Math.floor(rng() * 3);
  for (let blob = 0; blob < count; blob += 1) {
    const radius = range(rng, 0.9, 1.45);
    const geometry = new THREE.IcosahedronGeometry(radius, 1);
    jitterGeometry(geometry, 0.3, seed + blob * 7);
    const angle = rng() * Math.PI * 2;
    const spread = blob === 0 ? 0 : range(rng, 0.6, 1.3);
    geometry.translate(Math.cos(angle) * spread, trunkHeight + 0.6 + range(rng, 0, 1.3), Math.sin(angle) * spread);
    blobs.push(geometry.index ? geometry.toNonIndexed() : geometry);
  }
  const foliage = mergeGeometries(blobs);
  if (foliage) {
    foliage.computeVertexNormals();
    scaleUv(foliage, 2.5, 2.5);
    group.add(mesh(foliage, windMaterial(tex.leaves, 0.012)));
  }
  group.scale.setScalar(scale);
  return { object: group, colliders: [{ shape: "cylinder", radius: 0.38 * scale, halfHeight: 1.6 * scale, x: 0, y: 1.6 * scale, z: 0 }], lights: [] };
}

function pine(seed: number, scale: number): PropBuild {
  const tex = textures();
  const rng = makeRng(seed);
  const group = new THREE.Group();
  const trunk = new THREE.CylinderGeometry(0.12, 0.28, 2.2, 6);
  trunk.translate(0, 1.1, 0);
  scaleUv(trunk, 2, 1.5);
  group.add(mesh(trunk, m(tex.bark)));
  const tiers: THREE.BufferGeometry[] = [];
  const tierCount = 4;
  for (let tier = 0; tier < tierCount; tier += 1) {
    const radius = 1.9 - tier * 0.38 + range(rng, -0.1, 0.1);
    const height = 2.2 - tier * 0.25;
    const cone = new THREE.ConeGeometry(radius, height, 7, 2);
    jitterGeometry(cone, 0.18, seed + tier * 13);
    cone.rotateY(rng() * Math.PI);
    cone.translate(0, 1.6 + tier * 1.15 + height / 2, 0);
    tiers.push(cone.toNonIndexed());
  }
  const foliage = mergeGeometries(tiers);
  if (foliage) {
    foliage.computeVertexNormals();
    scaleUv(foliage, 3, 2);
    group.add(mesh(foliage, windMaterial(tex.pine, 0.008)));
  }
  group.scale.setScalar(scale);
  return { object: group, colliders: [{ shape: "cylinder", radius: 0.32 * scale, halfHeight: 1.6 * scale, x: 0, y: 1.6 * scale, z: 0 }], lights: [] };
}

function deadTree(seed: number, scale: number): PropBuild {
  const tex = textures();
  const rng = makeRng(seed);
  const group = new THREE.Group();
  const trunk = new THREE.CylinderGeometry(0.12, 0.3, 3.6, 5, 3);
  trunk.translate(0, 1.8, 0);
  jitterGeometry(trunk, 0.12, seed);
  group.add(mesh(trunk, m(tex.huskBark)));
  for (let branch = 0; branch < 4; branch += 1) {
    const length = range(rng, 0.9, 1.6);
    const geometry = new THREE.CylinderGeometry(0.03, 0.08, length, 4);
    geometry.translate(0, length / 2, 0);
    const limb = mesh(geometry, m(tex.huskBark), 0, range(rng, 1.8, 3.2), 0);
    limb.rotation.set(range(rng, 0.6, 1.1), rng() * Math.PI * 2, 0, "YXZ");
    group.add(limb);
  }
  group.scale.setScalar(scale);
  return { object: group, colliders: [{ shape: "cylinder", radius: 0.32 * scale, halfHeight: 1.6 * scale, x: 0, y: 1.6 * scale, z: 0 }], lights: [] };
}

function rock(seed: number, scale: number, big: boolean): PropBuild {
  const tex = textures();
  const geometry = new THREE.IcosahedronGeometry(1, big ? 1 : 0);
  jitterGeometry(geometry, big ? 0.35 : 0.25, seed);
  geometry.scale(1.25 * scale, 0.8 * scale, scale);
  geometry.translate(0, 0.25 * scale, 0);
  scaleUv(geometry, 2, 2);
  const rockMesh = mesh(geometry, m(tex.rock));
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  return {
    object: rockMesh,
    colliders: scale > 0.5 ? [{ shape: "hull", points: new Float32Array(position.array), x: 0, y: 0, z: 0 }] : [],
    lights: [],
  };
}

function stump(seed: number): PropBuild {
  const tex = textures();
  const group = new THREE.Group();
  const geometry = new THREE.CylinderGeometry(0.38, 0.48, 0.55, 7);
  jitterGeometry(geometry, 0.05, seed);
  group.add(mesh(geometry, m(tex.bark), 0, 0.27, 0));
  group.add(mesh(new THREE.CircleGeometry(0.37, 7).rotateX(-Math.PI / 2), m(tex.plankFlat), 0, 0.56, 0));
  return { object: group, colliders: [{ shape: "cylinder", radius: 0.45, halfHeight: 0.3, x: 0, y: 0.3, z: 0 }], lights: [] };
}

function mushrooms(seed: number): PropBuild {
  const rng = makeRng(seed);
  const group = new THREE.Group();
  const stem = emissive(0xb8d8c8);
  const colors = [0x6ff0e0, 0x8fb8ff, 0xc890ff];
  const capColor = colors[Math.floor(rng() * colors.length)];
  const cap = emissive(capColor);
  for (let index = 0; index < 4; index += 1) {
    const x = range(rng, -0.35, 0.35);
    const z = range(rng, -0.35, 0.35);
    const height = range(rng, 0.12, 0.32);
    group.add(mesh(new THREE.CylinderGeometry(0.025, 0.035, height, 4), stem, x, height / 2, z));
    group.add(mesh(new THREE.SphereGeometry(range(rng, 0.07, 0.12), 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), cap, x, height, z));
  }
  const glow = glowSprite(capColor, 1.1, 0.28);
  glow.position.y = 0.25;
  group.add(glow);
  return { object: group, colliders: [], lights: [] };
}

function pond(radius: number): PropBuild {
  const tex = textures();
  const group = new THREE.Group();
  const water = mesh(new THREE.CircleGeometry(radius, 16).rotateX(-Math.PI / 2), cachedMaterial("pond-water", () => lambert({ map: tex.water, transparent: true, opacity: 0.88 })), 0, -0.25, 0);
  scaleUv(water.geometry, radius / 1.5, radius / 1.5);
  water.name = "water";
  group.add(water);
  const rng = makeRng(radius * 31);
  for (let index = 0; index < 14; index += 1) {
    const angle = (index / 14) * Math.PI * 2 + rng() * 0.2;
    const stone = rock(index * 5 + 3, range(rng, 0.35, 0.6), false).object;
    stone.position.set(Math.cos(angle) * (radius + 0.1), -0.15, Math.sin(angle) * (radius + 0.1));
    group.add(stone);
  }
  return { object: group, colliders: [{ shape: "cylinder", radius: radius - 0.3, halfHeight: 1.5, x: 0, y: 0.5, z: 0 }], lights: [] };
}

// ---------------------------------------------------------------- village bits

function fence(length: number): PropBuild {
  const tex = textures();
  const group = new THREE.Group();
  const posts = Math.max(2, Math.round(length / 1.5) + 1);
  for (let post = 0; post < posts; post += 1) {
    const x = -length / 2 + (post / (posts - 1)) * length;
    group.add(mesh(worldUvBox(0.14, 1.1, 0.14, 1), m(tex.plank), x, 0.55, 0));
  }
  for (const y of [0.45, 0.85]) group.add(mesh(worldUvBox(length, 0.1, 0.06, 1.5), m(tex.plankFlat), 0, y, 0.06));
  return { object: group, colliders: [box(length / 2, 0.6, 0.12, 0, 0.6, 0, 0)], lights: [] };
}

function palisade(length: number): PropBuild {
  const tex = textures();
  const group = new THREE.Group();
  const logs = Math.max(1, Math.round(length / 0.42));
  const rng = makeRng(Math.round(length * 10));
  for (let log = 0; log < logs; log += 1) {
    const height = range(rng, 2.6, 3.1);
    const x = -length / 2 + (log + 0.5) * (length / logs);
    const geometry = new THREE.CylinderGeometry(0.2, 0.22, height, 6);
    scaleUv(geometry, 1, 2);
    group.add(mesh(geometry, m(tex.bark), x, height / 2, 0));
    group.add(mesh(new THREE.ConeGeometry(0.2, 0.45, 6), m(tex.bark), x, height + 0.22, 0));
  }
  group.add(mesh(worldUvBox(length, 0.16, 0.1, 1.5), m(tex.plankFlat), 0, 1.9, 0.24));
  return { object: group, colliders: [box(length / 2, 1.8, 0.3, 0, 1.8, 0, 0)], lights: [] };
}

function lampPost(): PropBuild {
  const tex = textures();
  const group = new THREE.Group();
  group.add(mesh(worldUvBox(0.18, 3, 0.18, 1), m(tex.plank), 0, 1.5, 0));
  group.add(mesh(worldUvBox(0.8, 0.12, 0.12, 1), m(tex.plank), 0.35, 2.85, 0));
  group.add(mesh(new THREE.BoxGeometry(0.3, 0.06, 0.3), m(tex.steel), 0.6, 2.62, 0));
  group.add(mesh(new THREE.BoxGeometry(0.2, 0.28, 0.2), emissive(artPalette.windowGlow), 0.6, 2.45, 0));
  group.add(mesh(new THREE.ConeGeometry(0.2, 0.18, 4).rotateY(Math.PI / 4), m(tex.steel), 0.6, 2.68, 0));
  const glow = glowSprite(artPalette.lanternLight, 2.2, 0.5);
  glow.position.set(0.6, 2.45, 0);
  group.add(glow);
  return {
    object: group,
    colliders: [box(0.15, 1.5, 0.15, 0, 1.5, 0, 0)],
    lights: [{ x: 0.6, y: 2.4, z: 0, color: artPalette.lanternLight, intensity: 5, distance: 9, flicker: 0.25 }],
  };
}

function signpost(): PropBuild {
  const tex = textures();
  const group = new THREE.Group();
  group.add(mesh(worldUvBox(0.14, 1.8, 0.14, 1), m(tex.plank), 0, 0.9, 0));
  const board = mesh(worldUvBox(1.1, 0.35, 0.06, 1), m(tex.plankFlat), 0.3, 1.5, 0);
  board.rotation.z = 0.05;
  group.add(board);
  return { object: group, colliders: [box(0.12, 0.9, 0.12, 0, 0.9, 0, 0)], lights: [] };
}

function bench(): PropBuild {
  const tex = textures();
  const group = new THREE.Group();
  group.add(mesh(worldUvBox(1.8, 0.1, 0.45, 1), m(tex.plankFlat), 0, 0.48, 0));
  for (const x of [-0.75, 0.75]) group.add(mesh(worldUvBox(0.12, 0.45, 0.4, 1), m(tex.plank), x, 0.22, 0));
  return { object: group, colliders: [box(0.9, 0.3, 0.25, 0, 0.3, 0, 0)], lights: [] };
}

function anvil(): PropBuild {
  const tex = textures();
  const group = new THREE.Group();
  group.add(mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.6, 7), m(tex.bark), 0, 0.3, 0));
  group.add(mesh(new THREE.BoxGeometry(0.7, 0.22, 0.28), m(tex.steel), 0, 0.72, 0));
  group.add(mesh(new THREE.ConeGeometry(0.12, 0.35, 4).rotateZ(Math.PI / 2), m(tex.steel), 0.5, 0.76, 0));
  return { object: group, colliders: [{ shape: "cylinder", radius: 0.4, halfHeight: 0.45, x: 0, y: 0.45, z: 0 }], lights: [] };
}

function logProp(seed: number): PropBuild {
  const tex = textures();
  const geometry = new THREE.CylinderGeometry(0.35, 0.4, 4, 7);
  jitterGeometry(geometry, 0.05, seed);
  geometry.rotateZ(Math.PI / 2);
  scaleUv(geometry, 2, 3);
  return { object: mesh(geometry, m(tex.bark), 0, 0.33, 0), colliders: [box(2, 0.38, 0.38, 0, 0.33, 0, 0)], lights: [] };
}

// ---------------------------------------------------------------- shrine

function pillar(shrine: boolean, broken: boolean, seed: number): PropBuild {
  const tex = textures();
  const group = new THREE.Group();
  const brick = shrine ? tex.shrineBrick : tex.mossBrick;
  const height = broken ? 1.6 + makeRng(seed)() * 1.4 : 5.2;
  group.add(mesh(worldUvBox(1.5, 0.4, 1.5, 1.5), m(brick), 0, 0.2, 0));
  const shaft = new THREE.CylinderGeometry(0.55, 0.6, height, 8, broken ? 3 : 1);
  if (broken) {
    const position = shaft.getAttribute("position") as THREE.BufferAttribute;
    const rng = makeRng(seed);
    for (let index = 0; index < position.count; index += 1) if (position.getY(index) > height / 2 - 0.01) position.setY(index, position.getY(index) - rng() * 0.7);
    shaft.computeVertexNormals();
  }
  scaleUv(shaft, 3, height / 1.5);
  group.add(mesh(shaft, m(brick), 0, 0.4 + height / 2, 0));
  if (!broken) {
    group.add(mesh(worldUvBox(1.4, 0.35, 1.4, 1.5), m(brick), 0, 0.4 + height + 0.17, 0));
  } else {
    for (let chunk = 0; chunk < 3; chunk += 1) {
      const rubble = rock(seed + chunk, 0.3, false).object;
      rubble.position.set(Math.cos(chunk * 2.1) * 1.1, 0, Math.sin(chunk * 2.1) * 1.1);
      group.add(rubble);
    }
  }
  const total = 0.4 + height + (broken ? 0 : 0.35);
  return { object: group, colliders: [{ shape: "cylinder", radius: 0.65, halfHeight: total / 2, x: 0, y: total / 2, z: 0 }], lights: [] };
}

function shrineWall(length: number): PropBuild {
  const tex = textures();
  const group = new THREE.Group();
  group.add(mesh(worldUvBox(length, 3.6, 1, 1.5), m(tex.shrineBrick), 0, 1.8, 0));
  group.add(mesh(worldUvBox(length + 0.2, 0.3, 1.2, 1.5), m(tex.shrineBrick), 0, 3.75, 0));
  return { object: group, colliders: [box(length / 2, 2, 0.5, 0, 2, 0, 0)], lights: [] };
}

// ---------------------------------------------------------------- interactive visuals

export function crateMesh(): THREE.Object3D {
  const tex = textures();
  const group = new THREE.Group();
  group.add(mesh(worldUvBox(0.9, 0.9, 0.9, 0.9), m(tex.plankFlat)));
  const trim = m(tex.plank);
  for (const z of [0.46, -0.46]) {
    const brace = mesh(new THREE.BoxGeometry(1.18, 0.1, 0.04), trim, 0, 0, z);
    brace.rotation.z = Math.PI / 4;
    group.add(brace);
  }
  for (const [x, z] of [
    [0.44, 0.44],
    [-0.44, 0.44],
    [0.44, -0.44],
    [-0.44, -0.44],
  ]) group.add(mesh(new THREE.BoxGeometry(0.08, 0.92, 0.08), trim, x, 0, z));
  return group;
}

export function barrelMesh(): THREE.Object3D {
  const tex = textures();
  const group = new THREE.Group();
  const profile = [
    new THREE.Vector2(0.3, -0.5),
    new THREE.Vector2(0.37, -0.25),
    new THREE.Vector2(0.39, 0),
    new THREE.Vector2(0.37, 0.25),
    new THREE.Vector2(0.3, 0.5),
  ];
  const geometry = new THREE.LatheGeometry(profile, 10);
  scaleUv(geometry, 3, 1);
  group.add(mesh(geometry, m(tex.plank)));
  for (const y of [-0.3, 0.3]) group.add(mesh(new THREE.CylinderGeometry(0.385, 0.385, 0.06, 10, 1, true), m(tex.steel, THREE.DoubleSide), 0, y, 0));
  for (const y of [-0.5, 0.5]) group.add(mesh(new THREE.CircleGeometry(0.3, 10).rotateX(y > 0 ? -Math.PI / 2 : Math.PI / 2), m(tex.plankFlat), 0, y, 0));
  return group;
}

export function potMesh(): THREE.Object3D {
  const tex = textures();
  const profile = [
    new THREE.Vector2(0.01, -0.3),
    new THREE.Vector2(0.18, -0.3),
    new THREE.Vector2(0.28, -0.12),
    new THREE.Vector2(0.27, 0.08),
    new THREE.Vector2(0.15, 0.22),
    new THREE.Vector2(0.17, 0.3),
  ];
  const geometry = new THREE.LatheGeometry(profile, 8);
  scaleUv(geometry, 2, 1);
  return mesh(geometry, cachedMaterial("pot", () => lambert({ map: tex.dirt, color: 0xd09070, side: THREE.DoubleSide })));
}

export function brazierMesh(): { group: THREE.Group; fireAnchor: THREE.Object3D } {
  const tex = textures();
  const group = new THREE.Group();
  const pedestal = new THREE.CylinderGeometry(0.3, 0.45, 0.9, 8);
  scaleUv(pedestal, 2, 1);
  group.add(mesh(pedestal, m(tex.shrineBrick), 0, 0.45, 0));
  const bowl = new THREE.LatheGeometry([new THREE.Vector2(0.2, 0), new THREE.Vector2(0.55, 0.15), new THREE.Vector2(0.62, 0.38), new THREE.Vector2(0.55, 0.4)], 9);
  group.add(mesh(bowl, m(tex.steel, THREE.DoubleSide), 0, 0.9, 0));
  group.add(mesh(new THREE.CircleGeometry(0.5, 9).rotateX(-Math.PI / 2), m(tex.huskBark), 0, 1.15, 0));
  const fireAnchor = new THREE.Object3D();
  fireAnchor.position.y = 1.3;
  group.add(fireAnchor);
  return { group, fireAnchor };
}

export function plateMesh(): { group: THREE.Group; top: THREE.Object3D; rune: THREE.Mesh } {
  const tex = textures();
  const group = new THREE.Group();
  group.add(mesh(worldUvBox(1.7, 0.12, 1.7, 1.7), m(tex.stoneBrick), 0, 0.02, 0));
  const top = new THREE.Group();
  top.add(mesh(worldUvBox(1.35, 0.14, 1.35, 1.35), m(tex.flagstone)));
  const rune = mesh(new THREE.RingGeometry(0.32, 0.42, 8).rotateX(-Math.PI / 2), cachedMaterial("plate-rune", () => unlit({ color: 0x4a6a8a })), 0, 0.075, 0);
  top.add(rune);
  top.position.y = 0.13;
  group.add(top);
  return { group, top, rune };
}

export function gateMesh(width: number): { group: THREE.Group; bars: THREE.Group } {
  const tex = textures();
  const group = new THREE.Group();
  for (const side of [-1, 1]) {
    group.add(mesh(worldUvBox(1, 4.2, 1, 1.5), m(tex.mossBrick), side * (width / 2 + 0.5), 2.1, 0));
    group.add(mesh(new THREE.ConeGeometry(0.6, 0.6, 4).rotateY(Math.PI / 4), m(tex.mossBrick), side * (width / 2 + 0.5), 4.5, 0));
  }
  const bars = new THREE.Group();
  const barCount = Math.round(width / 0.4);
  for (let bar = 0; bar < barCount; bar += 1) {
    const x = -width / 2 + (bar + 0.5) * (width / barCount);
    bars.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.8, 5), m(tex.steel), x, 1.9, 0));
    bars.add(mesh(new THREE.ConeGeometry(0.08, 0.25, 4), m(tex.steel), x, 3.9, 0));
  }
  for (const y of [0.6, 2.0, 3.3]) bars.add(mesh(new THREE.BoxGeometry(width, 0.1, 0.1), m(tex.steel), 0, y, 0));
  group.add(bars);
  group.add(mesh(worldUvBox(width + 2, 0.5, 1, 1.5), m(tex.mossBrick), 0, 4.2, 0));
  return { group, bars };
}

export function chestMesh(): { group: THREE.Group; lid: THREE.Group } {
  const tex = textures();
  const group = new THREE.Group();
  group.add(mesh(worldUvBox(1.1, 0.55, 0.7, 1), m(tex.plankFlat), 0, 0.28, 0));
  for (const x of [-0.5, 0.5]) group.add(mesh(new THREE.BoxGeometry(0.08, 0.57, 0.72), m(tex.gold), x, 0.28, 0));
  const lid = new THREE.Group();
  lid.position.set(0, 0.55, -0.35);
  const lidGeometry = new THREE.CylinderGeometry(0.35, 0.35, 1.1, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(Math.PI / 2);
  lidGeometry.translate(0, 0, 0.35);
  lid.add(mesh(lidGeometry, m(tex.plank)));
  lid.add(mesh(new THREE.BoxGeometry(0.14, 0.18, 0.06), m(tex.gold), 0, 0.02, 0.72));
  group.add(lid);
  return { group, lid };
}

export function wayLanternMesh(great: boolean): { group: THREE.Group; flame: THREE.Mesh; glow: THREE.Sprite } {
  const tex = textures();
  const group = new THREE.Group();
  const scale = great ? 2.6 : 1;
  group.add(mesh(worldUvBox(0.9 * scale, 0.5 * scale, 0.9 * scale, 1), m(great ? tex.shrineBrick : tex.stoneBrick), 0, 0.25 * scale, 0));
  group.add(mesh(new THREE.CylinderGeometry(0.18 * scale, 0.26 * scale, 1.1 * scale, 6), m(great ? tex.shrineBrick : tex.stoneBrick), 0, 1.05 * scale, 0));
  const cage = new THREE.Group();
  cage.position.y = 1.85 * scale;
  for (let corner = 0; corner < 4; corner += 1) {
    const angle = (corner / 4) * Math.PI * 2 + Math.PI / 4;
    cage.add(mesh(new THREE.BoxGeometry(0.05 * scale, 0.55 * scale, 0.05 * scale), m(tex.steel), Math.cos(angle) * 0.22 * scale, 0, Math.sin(angle) * 0.22 * scale));
  }
  cage.add(mesh(new THREE.ConeGeometry(0.36 * scale, 0.3 * scale, 4).rotateY(Math.PI / 4), m(tex.steel), 0, 0.42 * scale, 0));
  cage.add(mesh(new THREE.BoxGeometry(0.42 * scale, 0.06 * scale, 0.42 * scale), m(tex.steel), 0, -0.28 * scale, 0));
  const flame = mesh(new THREE.OctahedronGeometry(0.12 * scale), cachedMaterial(`flame-${great}`, () => unlit({ color: 0x5a6a8a })));
  cage.add(flame);
  const glow = glowSprite(artPalette.lanternLight, 3 * scale, 0.0);
  glow.material = glow.material.clone();
  cage.add(glow);
  group.add(cage);
  return { group, flame, glow };
}

// ---------------------------------------------------------------- dispatcher

/** Static props (no runtime behaviour beyond their colliders and lights). */
export function buildStaticProp(kind: string, seed: number, scale: number, variant?: string, length?: number, enterable = false): PropBuild | null {
  switch (kind) {
    case "cottage":
      return cottage(variant, enterable);
    case "well":
      return well();
    case "oak":
      return oak(seed, scale);
    case "pine":
      return pine(seed, scale);
    case "deadTree":
      return deadTree(seed, scale);
    case "rock":
      return rock(seed, scale, false);
    case "boulder":
      return rock(seed, scale * 1.8, true);
    case "stump":
      return stump(seed);
    case "mushrooms":
      return mushrooms(seed);
    case "pond":
      return pond(length ?? 5);
    case "fence":
      return fence(length ?? 3);
    case "palisade":
      return palisade(length ?? 6);
    case "lampPost":
      return lampPost();
    case "signpost":
      return signpost();
    case "bench":
      return bench();
    case "anvil":
      return anvil();
    case "log":
      return logProp(seed);
    case "pillar":
      return pillar(variant === "shrine", false, seed);
    case "brokenPillar":
      return pillar(variant === "shrine", true, seed);
    case "shrineWall":
      return shrineWall(length ?? 6);
    default:
      return null;
  }
}
