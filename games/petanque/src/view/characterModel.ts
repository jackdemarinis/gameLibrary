// Late-2000s sports-party characters: grown-up proportions with a slightly
// big head, a simple rig (spine, shoulders, elbows, hips, knees), painted
// faces that change expression and blink, real clothes with printed fabric,
// and sculpted hairstyles. Glossy Phong with a rim light, like the hardware
// of the time. Characters face -z.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { CharacterDefinition } from "../content/characters";
import { worldTheme } from "../config/theme";
import { wiiMaterial } from "./materials";
import { blobShadowTexture, fabricTexture, faceTexture, hairTexture, seeded, type FaceExpression } from "./textures";

export type CharacterMood = "idle" | "throw" | "cheer" | "sulk" | "clap";

export interface CharacterView {
  root: THREE.Group;
  hand: THREE.Object3D;
  // Head pivot, used to frame portraits.
  head: THREE.Object3D;
  setMood(mood: CharacterMood): void;
  hold(item: THREE.Object3D | null): void;
  update(dt: number): void;
  throwProgress: number;
}

export const throwTiming = {
  windUpSeconds: 0.55,
  releaseSeconds: 0.74,
  totalSeconds: 1.25,
} as const;

// Body dimensions in metres for a height-1.0 character (about 1.72 m tall).
const dims = {
  hipHeight: 0.9,
  thigh: 0.43,
  shin: 0.43,
  torso: 0.56,
  upperArm: 0.29,
  forearm: 0.26,
  headRadius: 0.142,
};

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const result = new THREE.Mesh(geometry, material);
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

function lathe(points: Array<[number, number]>, material: THREE.Material, segments = 20): THREE.Mesh {
  return mesh(new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments), material);
}

// A limb segment hanging down from its pivot: tapered capsule from 0 to -length.
function limb(length: number, top: number, bottom: number, material: THREE.Material): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(top, bottom, length, 10, 1);
  geometry.translate(0, -length / 2, 0);
  const result = mesh(geometry, material);
  const cap = new THREE.SphereGeometry(top, 10, 6);
  const joint = mesh(cap, material);
  result.add(joint);
  return result;
}

// Merge a group's direct mesh children that share a material: a character is
// ~60 parts but only ~20 draw calls after this.
function compact(group: THREE.Object3D): void {
  const byMaterial = new Map<THREE.Material, THREE.Mesh[]>();
  for (const child of [...group.children]) {
    if (!(child instanceof THREE.Mesh) || child.children.length > 0 || child.userData.keep) continue;
    const list = byMaterial.get(child.material as THREE.Material) ?? [];
    list.push(child);
    byMaterial.set(child.material as THREE.Material, list);
  }
  for (const [material, meshes] of byMaterial) {
    if (meshes.length < 2) continue;
    const geometries = meshes.map((part) => {
      part.updateMatrix();
      const geometry = (part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone()).applyMatrix4(part.matrix);
      for (const name of Object.keys(geometry.attributes)) if (!["position", "normal", "uv"].includes(name)) geometry.deleteAttribute(name);
      if (!geometry.attributes.uv) geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
      geometry.clearGroups();
      return geometry;
    });
    const merged = mergeGeometries(geometries, false);
    if (!merged) continue;
    for (const part of meshes) group.remove(part);
    group.add(mesh(merged, material));
  }
}

// ---------- hair & headwear ----------

function buildHair(definition: CharacterDefinition, material: THREE.Material, random: () => number): THREE.Group {
  const hair = new THREE.Group();
  const r = dims.headRadius;
  // frontGap (radians either side of the nose) leaves the face open on long styles.
  const cap = (scale: number, thetaLength: number, tilt: number, y = 0, frontGap = 0) => {
    const phiStart = frontGap > 0 ? Math.PI * 1.5 + frontGap : 0;
    const piece = mesh(new THREE.SphereGeometry(r * scale, 22, 14, phiStart, Math.PI * 2 - frontGap * 2, 0, thetaLength), material);
    // Extra tilt lifts every front hairline clear of the brows.
    piece.rotation.x = tilt + 0.25;
    piece.position.y = y;
    hair.add(piece);
    return piece;
  };
  const blob = (x: number, y: number, z: number, sx: number, sy: number, sz: number, detail = 1) => {
    const piece = mesh(new THREE.IcosahedronGeometry(r, detail), material);
    // Fringe pieces sit above the brow line.
    piece.position.set(x * r, (y + (z < -0.3 ? 0.16 : 0)) * r, z * r);
    piece.scale.set(sx, sy, sz);
    hair.add(piece);
    return piece;
  };

  switch (definition.hairStyle) {
    case "buzz":
      cap(1.03, 1.75, 0.42);
      break;
    case "bald":
      // Horseshoe of short hair around the back and sides.
      {
        const band = mesh(new THREE.TorusGeometry(r * 0.93, r * 0.16, 6, 20, Math.PI * 1.25), material);
        band.rotation.set(Math.PI / 2, 0, Math.PI * -0.125 + Math.PI);
        band.position.set(0, -r * 0.05, r * 0.08);
        band.scale.set(1, 1, 0.6);
        hair.add(band);
      }
      break;
    case "swept":
      cap(1.07, 1.85, 0.4);
      // Long fringe swept over to one side.
      blob(-0.15, 0.62, -0.62, 0.95, 0.38, 0.55).rotation.z = 0.45;
      blob(0.45, 0.72, -0.35, 0.6, 0.35, 0.65).rotation.z = 0.3;
      blob(0, 0.9, 0.15, 0.95, 0.4, 0.95);
      break;
    case "spiky":
      cap(1.06, 1.8, 0.4);
      for (let i = 0; i < 9; i++) {
        const spike = mesh(new THREE.ConeGeometry(r * 0.22, r * 0.75, 5), material);
        const angle = (i / 9) * Math.PI * 2;
        spike.position.set(Math.sin(angle) * r * 0.55, r * 0.85, Math.cos(angle) * r * 0.5);
        spike.rotation.set(Math.cos(angle) * 0.6, 0, -Math.sin(angle) * 0.6);
        hair.add(spike);
      }
      break;
    case "bob":
      cap(1.1, 1.45, 0.25, -r * 0.02);
      cap(1.1, 2.25, 0.25, -r * 0.02, 0.95);
      blob(0, 0.68, -0.62, 1.0, 0.4, 0.45);
      for (const side of [-1, 1]) blob(side * 0.85, -0.35, 0.1, 0.42, 0.85, 0.85);
      break;
    case "ponytail":
      cap(1.07, 1.95, 0.38);
      blob(0, 0.7, -0.6, 0.95, 0.35, 0.45);
      {
        const tail = mesh(new THREE.CapsuleGeometry(r * 0.26, r * 1.6, 4, 8), material);
        tail.position.set(0, -r * 0.05, r * 1.25);
        tail.rotation.x = 0.55;
        hair.add(tail);
        const tie = mesh(new THREE.TorusGeometry(r * 0.24, r * 0.07, 6, 10), wiiMaterial(worldTheme.hairTie, { sheen: 0.6 }));
        tie.position.set(0, r * 0.4, r * 0.95);
        tie.rotation.x = 0.55 + Math.PI / 2;
        hair.add(tie);
      }
      break;
    case "bun":
      cap(1.06, 1.85, 0.36);
      blob(0, 0.85, 0.6, 0.55, 0.5, 0.55);
      break;
    case "pixie":
      cap(1.07, 1.8, 0.42);
      for (let i = 0; i < 5; i++) blob(-0.5 + i * 0.25, 0.7 - Math.abs(i - 2) * 0.05, -0.62, 0.35, 0.3, 0.4).rotation.z = (i - 2) * 0.2;
      break;
    case "afro":
      {
        const geometry = new THREE.IcosahedronGeometry(r * 1.38, 3);
        const position = geometry.attributes.position;
        for (let i = 0; i < position.count; i++) {
          const v = new THREE.Vector3().fromBufferAttribute(position, i);
          v.multiplyScalar(1 + (random() - 0.5) * 0.08);
          position.setXYZ(i, v.x, v.y, v.z);
        }
        geometry.computeVertexNormals();
        const puff = mesh(geometry, material);
        // Set up and back so the face stays clear below the hairline.
        puff.position.set(0, r * 0.62, r * 0.5);
        puff.scale.set(1.12, 0.92, 0.95);
        hair.add(puff);
      }
      break;
    case "curly":
      cap(1.06, 1.85, 0.4);
      for (let i = 0; i < 26; i++) {
        const theta = random() * Math.PI * 2;
        const phi = random() * 1.25;
        const curl = blob(Math.sin(phi) * Math.cos(theta) * 1.02, Math.cos(phi) * 1.02 + 0.08, Math.sin(phi) * Math.sin(theta) * 1.02 + 0.12, 0.27, 0.27, 0.27, 0);
        if (curl.position.z < -r * 0.55 && curl.position.y < r * 0.6) hair.remove(curl);
      }
      break;
  }
  return hair;
}

function buildHeadwear(definition: CharacterDefinition): THREE.Group | null {
  if (definition.headwear === "none") return null;
  const r = dims.headRadius;
  const group = new THREE.Group();
  const material = wiiMaterial(definition.headwearColor, { sheen: 0.2, rim: 0.4 });
  switch (definition.headwear) {
    case "headband": {
      const band = mesh(new THREE.CylinderGeometry(r * 1.08, r * 1.1, r * 0.32, 20, 1, true), material);
      band.position.y = r * 0.45;
      band.rotation.x = 0.3;
      group.add(band);
      break;
    }
    case "cap": {
      const crown = mesh(new THREE.SphereGeometry(r * 1.1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), material);
      crown.position.y = r * 0.2;
      crown.rotation.x = 0.15;
      const brim = mesh(new THREE.CylinderGeometry(r * 0.75, r * 0.75, r * 0.06, 16, 1, false, Math.PI / 2, Math.PI), material);
      brim.position.set(0, r * 0.34, -r * 0.9);
      brim.scale.set(1.1, 1, 0.9);
      group.add(crown, brim);
      break;
    }
    case "flatCap": {
      const crown = mesh(new THREE.SphereGeometry(r * 1.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), material);
      crown.scale.set(1, 0.42, 1.12);
      crown.position.set(0, r * 0.62, -r * 0.05);
      crown.rotation.x = 0.12;
      const brim = mesh(new THREE.CylinderGeometry(r * 0.7, r * 0.7, r * 0.05, 14, 1, false, Math.PI / 2, Math.PI), material);
      brim.position.set(0, r * 0.62, -r * 1.05);
      brim.rotation.x = 0.25;
      group.add(crown, brim);
      break;
    }
    case "bandana": {
      const wrap = mesh(new THREE.SphereGeometry(r * 1.09, 20, 12, 0, Math.PI * 2, 0, 1.5), material);
      wrap.rotation.x = 0.35;
      const knot = mesh(new THREE.SphereGeometry(r * 0.22, 8, 6), material);
      knot.position.set(0, r * 0.15, r * 1.0);
      const tail = mesh(new THREE.BoxGeometry(r * 0.35, r * 0.7, r * 0.05), material);
      tail.position.set(r * 0.12, -r * 0.25, r * 1.05);
      tail.rotation.set(0.3, 0, 0.3);
      group.add(wrap, knot, tail);
      break;
    }
  }
  return group;
}

// ---------- body ----------

export function createCharacter(definition: CharacterDefinition, teamColor: number): CharacterView {
  const random = seeded(definition.id.split("").reduce((sum, letter) => sum + letter.charCodeAt(0), 0));
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(definition.height);
  root.add(body);

  const build = definition.build;
  const limbScale = Math.sqrt(build);
  const skin = wiiMaterial(definition.skin, { sheen: 0.32, rim: 0.55 });
  const top = definition.top;
  const hasSleeves = top.style !== "tank";
  const longSleeves = top.style === "cardigan" || top.style === "breton";
  const shirt = wiiMaterial(0xffffff, {
    map: fabricTexture({ style: top.style, color: top.color, trim: top.trim, number: 2 + (random() * 97) | 0 }),
    sheen: top.style === "jersey" ? 0.45 : 0.15,
    rim: 0.5,
  });
  const sleeve = wiiMaterial(top.style === "breton" ? top.trim : top.color, { sheen: 0.15, rim: 0.5 });
  const trim = wiiMaterial(top.trim, { sheen: 0.2, rim: 0.4 });
  const bottom = wiiMaterial(definition.bottom.color, { sheen: 0.12, rim: 0.4 });
  const shoe = wiiMaterial(definition.shoes.color, { sheen: 0.5, rim: 0.3 });
  const shoeAccent = wiiMaterial(definition.shoes.accent, { sheen: 0.4 });
  const sole = wiiMaterial(worldTheme.shoeSole, { sheen: 0.2 });
  const team = wiiMaterial(teamColor, { sheen: 0.35, rim: 0.6 });
  const hairMaterial = wiiMaterial(definition.hair, { map: hairTexture(), sheen: 0.6, rim: 0.5 });

  // Contact shadow and a team ring at the feet.
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.9),
    new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false, opacity: 0.7 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.4, 0.46, 32),
    new THREE.MeshBasicMaterial({ color: teamColor, transparent: true, opacity: 0.65, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.014;
  root.add(shadow, ring);

  // ---- hips & legs ----
  const hips = new THREE.Group();
  hips.position.y = dims.hipHeight;
  body.add(hips);
  const pelvis = lathe(
    [
      [0.0, -0.14],
      [0.15 * build, -0.13],
      [0.175 * build, -0.06],
      [0.172 * build, 0.04],
      [0.0, 0.05],
    ],
    bottom,
  );
  pelvis.scale.z = 0.78;
  hips.add(pelvis);
  if (definition.bottom.style === "skirt") {
    const skirt = lathe(
      [
        [0.17 * build, 0.02],
        [0.2 * build, -0.12],
        [0.27 * build, -0.4],
        [0.28 * build, -0.42],
      ],
      bottom,
    );
    skirt.scale.z = 0.85;
    hips.add(skirt);
  }
  // Belt for trousers and shorts.
  if (definition.bottom.style !== "skirt") {
    const belt = mesh(new THREE.CylinderGeometry(0.176 * build, 0.176 * build, 0.04, 20, 1, true), wiiMaterial(worldTheme.belt, { sheen: 0.5 }));
    belt.scale.z = 0.78;
    belt.position.y = 0.025;
    hips.add(belt);
  }

  const legs: Array<{ thigh: THREE.Group; knee: THREE.Group; ankle: THREE.Group }> = [];
  for (const side of [-1, 1]) {
    const thigh = new THREE.Group();
    thigh.position.set(side * 0.095 * build, -0.05, 0);
    hips.add(thigh);
    const thighCloth = definition.bottom.style === "skirt" ? skin : bottom;
    thigh.add(limb(dims.thigh, 0.082 * limbScale, 0.062 * limbScale, thighCloth));
    if (definition.bottom.style === "shorts") {
      // Shorts end above the knee: skin below.
      const knee = limb(dims.thigh * 0.4, 0.064 * limbScale, 0.058 * limbScale, skin);
      knee.position.y = -dims.thigh * 0.6;
      thigh.add(knee);
      const hem = mesh(new THREE.CylinderGeometry(0.075 * limbScale, 0.078 * limbScale, 0.06, 12), bottom);
      hem.position.y = -dims.thigh * 0.58;
      thigh.add(hem);
    }
    const knee = new THREE.Group();
    knee.position.y = -dims.thigh;
    thigh.add(knee);
    const shinMaterial = definition.bottom.style === "trousers" ? bottom : skin;
    knee.add(limb(dims.shin, 0.06 * limbScale, 0.045 * limbScale, shinMaterial));
    // Sports socks in the team colour.
    if (definition.bottom.style !== "trousers") {
      const sock = mesh(new THREE.CylinderGeometry(0.05, 0.047, 0.1, 10), team);
      sock.position.y = -dims.shin + 0.06;
      knee.add(sock);
    }
    const ankle = new THREE.Group();
    ankle.position.y = -dims.shin;
    knee.add(ankle);
    const upper = mesh(new THREE.CapsuleGeometry(0.052, 0.14, 4, 10), shoe);
    upper.rotation.x = Math.PI / 2;
    upper.scale.set(1.05, 1, 0.82);
    upper.position.set(0, -0.025, -0.05);
    const soleMesh = mesh(new THREE.BoxGeometry(0.1, 0.028, 0.26), sole);
    soleMesh.position.set(0, -0.06, -0.05);
    const stripe = mesh(new THREE.BoxGeometry(0.108, 0.02, 0.12), shoeAccent);
    stripe.position.set(0, -0.025, -0.04);
    ankle.add(upper, soleMesh, stripe);
    compact(ankle);
    legs.push({ thigh, knee, ankle });
  }

  // ---- spine, torso ----
  const spine = new THREE.Group();
  spine.position.y = dims.hipHeight + 0.02;
  body.add(spine);
  const torsoPoints: Array<[number, number]> = [
    [0.168, 0.0],
    [0.172, 0.08],
    [0.165, 0.18],
    [0.178, 0.3],
    [0.192, 0.4],
    [0.19, 0.47],
    [0.165, 0.52],
    [0.1, 0.56],
    [0.065, 0.575],
  ];
  const torso = lathe(
    torsoPoints.map(([radius, y]) => [radius * build, y]),
    shirt,
    24,
  );
  // Lathe u = 0 is +z; turn it so the shirt's front (u = 0) faces -z.
  torso.rotation.y = Math.PI;
  torso.scale.z = 0.7;
  spine.add(torso);
  if (top.style === "polo" || top.style === "jersey") {
    const collar = mesh(new THREE.TorusGeometry(0.068, 0.018, 6, 16), trim);
    collar.rotation.x = Math.PI / 2;
    collar.scale.y = 0.8;
    collar.position.y = 0.57;
    spine.add(collar);
  }
  if (top.style === "tank") {
    // Bare shoulders.
    for (const side of [-1, 1]) {
      const shoulderSkin = mesh(new THREE.SphereGeometry(0.07 * limbScale, 10, 8), skin);
      shoulderSkin.position.set(side * 0.19 * build, 0.48, 0);
      spine.add(shoulderSkin);
    }
  }
  const neck = mesh(new THREE.CylinderGeometry(0.052, 0.06, 0.08, 10), skin);
  neck.position.y = 0.58;
  spine.add(neck);

  // ---- head ----
  const head = new THREE.Group();
  head.position.y = 0.6 + dims.headRadius * 0.95;
  spine.add(head);
  const faceOptions = {
    skin: definition.skin,
    eyes: definition.eyes,
    hair: definition.hair,
    facialHair: definition.facialHair,
    freckles: definition.freckles,
    elder: definition.elder,
  };
  const faceMaterial = wiiMaterial(0xffffff, { map: faceTexture(faceOptions, "neutral"), sheen: 0.32, rim: 0.55 });
  const skull = mesh(new THREE.SphereGeometry(dims.headRadius, 28, 18), faceMaterial);
  skull.scale.set(0.9, 1.05, 1.0);
  skull.userData.keep = true;
  head.add(skull);
  const jaw = mesh(new THREE.SphereGeometry(dims.headRadius * 0.82, 16, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), skin);
  jaw.position.set(0, -dims.headRadius * 0.12, -dims.headRadius * 0.04);
  jaw.scale.set(0.95, 1, 1);
  // The jaw sits inside the skull; it only shapes the chin silhouette.
  head.add(jaw);
  const nose = mesh(new THREE.ConeGeometry(0.019, 0.05, 6), skin);
  nose.rotation.x = -Math.PI / 2 - 0.35;
  nose.position.set(0, -dims.headRadius * 0.15, -dims.headRadius * 0.97);
  head.add(nose);
  for (const side of [-1, 1]) {
    const ear = mesh(new THREE.SphereGeometry(0.026, 8, 6), skin);
    ear.scale.set(0.45, 1, 0.75);
    ear.position.set(side * dims.headRadius * 0.9, -0.005, 0.01);
    head.add(ear);
  }
  if (definition.facialHair === "mustache") {
    for (const side of [-1, 1]) {
      const half = mesh(new THREE.SphereGeometry(0.026, 8, 6), hairMaterial);
      half.scale.set(1.3, 0.5, 0.6);
      half.position.set(side * 0.022, -0.034, -dims.headRadius * 0.95);
      half.rotation.z = side * -0.3;
      head.add(half);
    }
  }
  if (definition.facialHair === "beard") {
    const beard = mesh(new THREE.SphereGeometry(dims.headRadius * 0.98, 16, 10, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.52, Math.PI * 0.4), hairMaterial);
    beard.rotation.y = Math.PI;
    beard.position.set(0, -0.006, 0.004);
    head.add(beard);
  }
  if (definition.glasses) {
    const frame = wiiMaterial(worldTheme.glassesFrame, { sheen: 0.8 });
    for (const side of [-1, 1]) {
      const rim = mesh(new THREE.TorusGeometry(0.021, 0.0035, 5, 14), frame);
      rim.position.set(side * 0.034, 0.001, -dims.headRadius * 1.04);
      rim.scale.set(1.15, 0.85, 1);
      const arm = mesh(new THREE.BoxGeometry(0.004, 0.004, 0.12), frame);
      arm.position.set(side * dims.headRadius * 0.86, 0.003, -0.06);
      head.add(rim, arm);
    }
    const bridge = mesh(new THREE.BoxGeometry(0.018, 0.004, 0.004), frame);
    bridge.position.set(0, 0.005, -dims.headRadius * 1.05);
    head.add(bridge);
  }
  head.add(buildHair(definition, hairMaterial, random));
  const headwear = buildHeadwear(definition);
  if (headwear) head.add(headwear);
  compact(head);

  // ---- arms ----
  const arms: Array<{ shoulder: THREE.Group; elbow: THREE.Group; wrist: THREE.Group }> = [];
  let hand: THREE.Object3D = root;
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.205 * build, 0.47, 0);
    spine.add(shoulder);
    shoulder.add(limb(dims.upperArm, 0.056 * limbScale, 0.046 * limbScale, skin));
    if (hasSleeves) {
      const sleeveLength = longSleeves ? dims.upperArm : dims.upperArm * 0.5;
      const sleeveMesh = limb(sleeveLength, 0.07 * limbScale, 0.06 * limbScale, sleeve);
      sleeveMesh.position.y = 0.01;
      shoulder.add(sleeveMesh);
      const cuff = mesh(new THREE.CylinderGeometry(0.062 * limbScale, 0.062 * limbScale, 0.03, 10), trim);
      cuff.position.y = -sleeveLength + 0.01;
      shoulder.add(cuff);
    }
    const elbow = new THREE.Group();
    elbow.position.y = -dims.upperArm;
    shoulder.add(elbow);
    elbow.add(limb(dims.forearm, 0.044 * limbScale, 0.034 * limbScale, longSleeves && top.style === "cardigan" ? sleeve : skin));
    const band = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 10), team);
    band.position.y = -dims.forearm + 0.04;
    elbow.add(band);
    const wrist = new THREE.Group();
    wrist.position.y = -dims.forearm;
    elbow.add(wrist);
    const palm = mesh(new THREE.BoxGeometry(0.075, 0.085, 0.03), skin);
    palm.position.y = -0.045;
    const fingers = mesh(new THREE.CapsuleGeometry(0.016, 0.055, 3, 6), skin);
    fingers.rotation.z = Math.PI / 2;
    fingers.position.set(0, -0.095, -0.012);
    fingers.scale.set(1, 1.4, 1);
    const thumb = mesh(new THREE.CapsuleGeometry(0.012, 0.03, 3, 6), skin);
    thumb.position.set(-side * 0.042, -0.04, -0.016);
    thumb.rotation.z = side * 0.5;
    wrist.add(palm, fingers, thumb);
    compact(wrist);
    compact(elbow);
    compact(shoulder);
    if (side === 1) {
      hand = new THREE.Object3D();
      hand.position.set(0, -0.08, -0.07);
      wrist.add(hand);
    }
    arms.push({ shoulder, elbow, wrist });
  }
  compact(spine);
  compact(hips);
  for (const leg of legs) {
    compact(leg.thigh);
    compact(leg.knee);
  }
  const [leftArm, rightArm] = arms;

  let mood: CharacterMood = "idle";
  let clock = random() * 10;
  let heldItem: THREE.Object3D | null = null;
  let blinkTimer = 1 + random() * 3;
  let expression: FaceExpression = "neutral";
  const pace = definition.elder ? 0.75 : 1;

  const setExpression = (next: FaceExpression) => {
    if (next === expression) return;
    expression = next;
    faceMaterial.map = faceTexture(faceOptions, next);
    faceMaterial.needsUpdate = true;
  };

  const moodExpression = (): FaceExpression =>
    mood === "cheer" || mood === "clap" ? "happy" : mood === "sulk" ? "sad" : mood === "throw" ? "focus" : "neutral";

  // Bend both knees by `amount` radians with the feet staying under the hips.
  const squat = (amount: number) => {
    for (const leg of legs) {
      leg.thigh.rotation.x = amount;
      leg.knee.rotation.x = -amount * 2;
      leg.ankle.rotation.x = amount;
    }
    body.position.y = -(dims.thigh + dims.shin) * (1 - Math.cos(amount)) * definition.height;
  };

  const pose = (arm: (typeof arms)[number], shoulderX: number, shoulderZ: number, elbowX: number) => {
    arm.shoulder.rotation.set(shoulderX, 0, shoulderZ);
    arm.elbow.rotation.set(elbowX, 0, 0);
  };

  const view: CharacterView = {
    root,
    hand,
    head,
    throwProgress: 0,
    setMood(next) {
      mood = next;
      view.throwProgress = 0;
      setExpression(moodExpression());
    },
    hold(item) {
      if (heldItem) hand.remove(heldItem);
      heldItem = item;
      if (item) {
        item.position.set(0, 0, 0);
        hand.add(item);
      }
    },
    update(dt) {
      clock += dt * pace;
      body.position.set(0, 0, 0);
      body.rotation.set(0, 0, 0);
      spine.rotation.set(definition.elder ? 0.12 : 0, 0, 0);
      head.rotation.set(0, 0, 0);
      hips.rotation.set(0, 0, 0);
      squat(0);

      blinkTimer -= dt;
      const baseExpression = moodExpression();
      let shown = baseExpression;
      if (blinkTimer < 0 && (baseExpression === "neutral" || baseExpression === "focus")) {
        shown = "blink";
        if (blinkTimer < -0.12) blinkTimer = 2 + Math.random() * 3.5;
      }
      setExpression(shown);

      if (mood === "idle") {
        const breathe = Math.sin(clock * 2.0);
        const shift = Math.sin(clock * 0.7);
        hips.rotation.z = shift * 0.03;
        spine.rotation.z = -shift * 0.04;
        spine.rotation.x += breathe * 0.012;
        pose(leftArm, breathe * 0.04 + 0.05, -0.1, -0.15);
        pose(rightArm, -breathe * 0.04 + 0.05, 0.1, -0.15);
        head.rotation.y = Math.sin(clock * 0.5) * 0.3;
        head.rotation.x = Math.sin(clock * 0.8) * 0.05;
        squat(0.05 + breathe * 0.01);
      } else if (mood === "throw") {
        view.throwProgress += dt;
        const t = view.throwProgress;
        const { windUpSeconds, releaseSeconds, totalSeconds } = throwTiming;
        // Pointer's crouch: drop into a squat, swing back, swing through, follow up.
        let swing: number;
        let crouch: number;
        if (t < windUpSeconds) {
          const k = easeOut(t / windUpSeconds);
          swing = -1.25 * k;
          crouch = 0.95 * k;
        } else if (t < releaseSeconds + 0.08) {
          const k = easeIn((t - windUpSeconds) / (releaseSeconds + 0.08 - windUpSeconds));
          swing = -1.25 + 2.45 * k;
          crouch = 0.95 - 0.15 * k;
        } else {
          const k = Math.min(1, (t - releaseSeconds - 0.08) / (totalSeconds - releaseSeconds));
          swing = 1.2 + 0.25 * easeOut(k);
          crouch = 0.8 - 0.35 * easeOut(k);
        }
        squat(crouch);
        spine.rotation.x = -0.45 * (crouch / 0.95) + (definition.elder ? 0.05 : 0);
        head.rotation.x = 0.35 * (crouch / 0.95);
        pose(rightArm, swing, 0.08, swing > 0 ? -0.15 : -0.05);
        // Off hand rests on the knee.
        pose(leftArm, 0.75 * (crouch / 0.95), -0.25, -0.9 * (crouch / 0.95));
      } else if (mood === "cheer") {
        const hop = Math.abs(Math.sin(clock * 6.5));
        body.position.y = hop * 0.22;
        squat((1 - hop) * 0.3);
        const pump = Math.sin(clock * 13) * 0.25;
        pose(leftArm, Math.PI - 0.3 + pump, -0.35, -0.9);
        pose(rightArm, Math.PI - 0.3 - pump, 0.35, -0.9);
        head.rotation.x = -0.25;
        head.rotation.z = Math.sin(clock * 6.5) * 0.1;
      } else if (mood === "clap") {
        const clap = Math.abs(Math.sin(clock * 9));
        pose(leftArm, 0.9, 0.35 + clap * 0.35, -1.0);
        pose(rightArm, 0.9, -0.35 - clap * 0.35, -1.0);
        body.position.y = Math.abs(Math.sin(clock * 4.5)) * 0.03;
        head.rotation.y = Math.sin(clock * 1.2) * 0.15;
      } else {
        // Sulk: hands on hips, head down, slow shake.
        spine.rotation.x = 0.18;
        head.rotation.x = 0.45;
        head.rotation.y = Math.sin(clock * 1.6) * 0.3;
        pose(leftArm, -0.25, -0.7, -1.6);
        pose(rightArm, -0.25, 0.7, -1.6);
        squat(0.08);
      }
    },
  };

  shadow.castShadow = false;
  ring.castShadow = false;
  return view;
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function easeIn(t: number): number {
  return t * t;
}
