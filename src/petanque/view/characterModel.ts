// Glossy, toy-like party characters: smooth lathed bodies, a big round head with
// a painted face that changes expression and blinks, proper hairstyles, and a
// team-coloured neckerchief. Characters face -z.

import * as THREE from "three";
import type { CharacterDefinition } from "../content/characters";
import { worldTheme } from "../config/theme";
import { blobShadowTexture, faceTexture, type FaceExpression } from "./textures";

export type CharacterMood = "idle" | "throw" | "cheer" | "sulk" | "clap";

export interface CharacterView {
  root: THREE.Group;
  hand: THREE.Object3D;
  setMood(mood: CharacterMood): void;
  hold(item: THREE.Object3D | null): void;
  update(dt: number): void;
  throwProgress: number;
}

export const throwTiming = {
  windUpSeconds: 0.5,
  releaseSeconds: 0.68,
  totalSeconds: 1.15,
} as const;

// Shiny vinyl-toy skin and plastic; cloth is softer with a sheen at the edges.
function plastic(color: number, roughness = 0.42): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({ color, roughness, clearcoat: 0.55, clearcoatRoughness: 0.35 });
}

function cloth(color: number): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.68, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffffff) });
}

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const result = new THREE.Mesh(geometry, material);
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

function lathe(points: Array<[number, number]>, material: THREE.Material): THREE.Mesh {
  return mesh(new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), 40), material);
}

// ---------- hair ----------

function buildHair(definition: CharacterDefinition, headRadius: number): THREE.Group {
  const hair = new THREE.Group();
  const material = plastic(definition.hair, 0.5);
  const shell = headRadius * 1.06;

  const cap = (thetaLength: number, tilt: number) => {
    const piece = mesh(new THREE.SphereGeometry(shell, 40, 20, 0, Math.PI * 2, 0, thetaLength), material);
    piece.rotation.x = tilt;
    return piece;
  };

  switch (definition.hairStyle) {
    case "bald":
      for (const side of [-1, 1]) {
        const tuft = mesh(new THREE.SphereGeometry(headRadius * 0.38, 16, 12), material);
        tuft.scale.set(0.6, 0.75, 1.1);
        tuft.position.set(side * headRadius * 0.86, -headRadius * 0.05, headRadius * 0.28);
        hair.add(tuft);
      }
      break;
    case "short": {
      hair.add(cap(Math.PI * 0.5, 0.45));
      const fringe = mesh(new THREE.SphereGeometry(headRadius * 0.55, 20, 12), material);
      fringe.scale.set(1.35, 0.42, 0.7);
      fringe.position.set(0, headRadius * 0.62, -headRadius * 0.62);
      fringe.rotation.x = -0.5;
      hair.add(fringe);
      break;
    }
    case "bob": {
      hair.add(cap(Math.PI * 0.55, 0.3));
      const skirt = mesh(
        new THREE.CylinderGeometry(shell * 1.0, shell * 1.1, headRadius * 1.0, 40, 1, true, Math.PI + 0.95, Math.PI * 2 - 1.9),
        material,
      );
      (skirt.material as THREE.Material).side = THREE.DoubleSide;
      skirt.position.y = -headRadius * 0.2;
      hair.add(skirt);
      const fringe = mesh(new THREE.SphereGeometry(headRadius * 0.62, 24, 12), material);
      fringe.scale.set(1.45, 0.45, 0.62);
      fringe.position.set(0, headRadius * 0.6, -headRadius * 0.66);
      fringe.rotation.x = -0.45;
      hair.add(fringe);
      break;
    }
    case "ponytail": {
      hair.add(cap(Math.PI * 0.55, 0.32));
      const tail = mesh(new THREE.SphereGeometry(headRadius * 0.42, 20, 16), material);
      tail.scale.set(0.8, 1.6, 0.8);
      tail.position.set(0, -headRadius * 0.15, headRadius * 1.18);
      tail.rotation.x = 0.5;
      const tie = mesh(new THREE.TorusGeometry(headRadius * 0.17, headRadius * 0.06, 8, 16), plastic(worldTheme.flowers[0]));
      tie.position.set(0, headRadius * 0.35, headRadius * 1.0);
      tie.rotation.x = 1.2;
      hair.add(tail, tie);
      break;
    }
    case "buns": {
      hair.add(cap(Math.PI * 0.55, 0.25));
      for (const side of [-1, 1]) {
        const bun = mesh(new THREE.SphereGeometry(headRadius * 0.34, 20, 16), material);
        bun.position.set(side * headRadius * 0.68, headRadius * 0.78, headRadius * 0.15);
        hair.add(bun);
      }
      break;
    }
    case "spiky": {
      hair.add(cap(Math.PI * 0.48, 0.35));
      const spikes = 9;
      for (let i = 0; i < spikes; i++) {
        const spike = mesh(new THREE.ConeGeometry(headRadius * 0.24, headRadius * 0.6, 10), material);
        const angle = (i / spikes) * Math.PI * 1.4 - Math.PI * 0.2;
        const tilt = 0.55 + (i % 2) * 0.25;
        const direction = new THREE.Vector3(Math.cos(angle) * Math.sin(tilt), Math.cos(tilt), Math.sin(angle) * Math.sin(tilt) + 0.25).normalize();
        spike.position.copy(direction).multiplyScalar(shell * 0.95);
        spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
        hair.add(spike);
      }
      break;
    }
    case "curly": {
      const curl = new THREE.SphereGeometry(headRadius * 0.27, 14, 10);
      for (let ring = 0; ring < 4; ring++) {
        const polar = 0.15 + ring * 0.38;
        const count = ring === 0 ? 3 : 7 + ring * 2;
        for (let i = 0; i < count; i++) {
          const azimuth = (i / count) * Math.PI * 2 + ring;
          const direction = new THREE.Vector3(Math.sin(polar) * Math.cos(azimuth), Math.cos(polar), Math.sin(polar) * Math.sin(azimuth));
          if (direction.z < -0.45 && direction.y < 0.75) continue; // keep the face clear
          const bump = mesh(curl, material);
          bump.position.copy(direction).multiplyScalar(shell * 0.98);
          hair.add(bump);
        }
      }
      break;
    }
  }
  return hair;
}

function buildHat(definition: CharacterDefinition, headRadius: number): THREE.Object3D | null {
  const material = cloth(definition.hatColor);
  const hat = new THREE.Group();
  switch (definition.hat) {
    case "beret": {
      const top = mesh(new THREE.SphereGeometry(headRadius * 1.0, 32, 16), material);
      top.scale.set(1.08, 0.34, 1.08);
      const stalk = mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.06, 8), material);
      stalk.position.y = headRadius * 0.36;
      hat.add(top, stalk);
      hat.position.set(headRadius * 0.12, headRadius * 0.86, headRadius * 0.08);
      hat.rotation.z = -0.28;
      return hat;
    }
    case "cap": {
      const dome = mesh(new THREE.SphereGeometry(headRadius * 1.08, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), material);
      const brim = mesh(new THREE.CylinderGeometry(headRadius * 0.62, headRadius * 0.62, 0.025, 28, 1, false, Math.PI / 2, Math.PI), material);
      brim.scale.z = 1.3;
      brim.position.set(0, 0, -headRadius * 0.95);
      const button = mesh(new THREE.SphereGeometry(0.025, 10, 8), material);
      button.position.y = headRadius * 1.08;
      hat.add(dome, brim, button);
      hat.position.y = headRadius * 0.28;
      hat.rotation.x = -0.12;
      return hat;
    }
    case "sunhat": {
      const dome = mesh(new THREE.SphereGeometry(headRadius * 1.04, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), material);
      dome.scale.y = 0.9;
      const brim = mesh(new THREE.CylinderGeometry(headRadius * 1.95, headRadius * 2.05, 0.025, 48), material);
      const band = mesh(new THREE.CylinderGeometry(headRadius * 1.05, headRadius * 1.05, 0.06, 32, 1, true), cloth(worldTheme.flowers[0]));
      band.position.y = 0.035;
      const flower = mesh(new THREE.SphereGeometry(0.045, 12, 10), plastic(worldTheme.flowers[1]));
      flower.position.set(headRadius * 0.95, 0.05, -headRadius * 0.3);
      hat.add(dome, brim, band, flower);
      hat.position.y = headRadius * 0.38;
      hat.rotation.x = 0.12;
      return hat;
    }
    default:
      return null;
  }
}

// ---------- body ----------

export function createCharacter(definition: CharacterDefinition, teamColor: number): CharacterView {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.scale.set(definition.girth, definition.height, definition.girth);
  root.add(body);

  const skin = plastic(definition.skin, 0.38);
  const shirt = cloth(definition.shirt);
  const pants = cloth(definition.pants);
  const team = cloth(teamColor);

  // Soft contact shadow and a team-coloured ring at the feet.
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 1.0),
    new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.36, 0.42, 48),
    new THREE.MeshBasicMaterial({ color: teamColor, transparent: true, opacity: 0.7, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.014;
  root.add(shadow, ring);

  // Legs and shoes
  for (const side of [-1, 1]) {
    const leg = mesh(new THREE.CylinderGeometry(0.075, 0.068, 0.32, 16), pants);
    leg.position.set(side * 0.095, 0.24, 0);
    const shoe = mesh(new THREE.SphereGeometry(0.095, 20, 14), plastic(worldTheme.shoe, 0.5));
    shoe.scale.set(0.95, 0.6, 1.4);
    shoe.position.set(side * 0.1, 0.06, -0.035);
    const sole = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.025, 20), plastic(worldTheme.shoeSole, 0.6));
    sole.scale.set(0.95, 1, 1.4);
    sole.position.set(side * 0.1, 0.015, -0.035);
    body.add(leg, shoe, sole);
  }

  // Hips and torso as smooth lathed shapes.
  body.add(
    lathe(
      [
        [0.0, 0.36],
        [0.12, 0.37],
        [0.175, 0.41],
        [0.19, 0.47],
        [0.188, 0.56],
      ],
      pants,
    ),
  );
  const torso = lathe(
    [
      [0.0, 0.5],
      [0.2, 0.5],
      [0.21, 0.53],
      [0.205, 0.62],
      [0.208, 0.74],
      [0.2, 0.84],
      [0.17, 0.92],
      [0.11, 0.97],
      [0.0, 0.985],
    ],
    shirt,
  );
  torso.scale.z = 0.86;
  body.add(torso);

  // Neckerchief in the team colour, knotted at the front.
  const scarf = mesh(new THREE.TorusGeometry(0.085, 0.035, 10, 28), team);
  scarf.rotation.x = Math.PI / 2;
  scarf.position.set(0, 0.965, 0);
  const knot = mesh(new THREE.ConeGeometry(0.06, 0.12, 3), team);
  knot.rotation.x = Math.PI;
  knot.position.set(0, 0.9, -0.12);
  knot.rotation.z = Math.PI;
  body.add(scarf, knot);

  // Head
  const headRadius = 0.27;
  const head = new THREE.Group();
  head.position.y = 1.25;
  body.add(head);
  const neck = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 12), skin);
  neck.position.y = -headRadius * 0.95;
  head.add(neck);

  const faceOptions = {
    skin: definition.skin,
    hair: definition.hair,
    hasMustache: definition.hasMustache,
    eyeShape: definition.eyeShape,
    hasFreckles: definition.hasFreckles,
  };
  const faceMaterial = new THREE.MeshPhysicalMaterial({
    map: faceTexture(faceOptions, "neutral"),
    roughness: 0.4,
    clearcoat: 0.5,
    clearcoatRoughness: 0.35,
  });
  const skull = mesh(new THREE.SphereGeometry(headRadius, 48, 32), faceMaterial);
  skull.scale.set(1.0, 1.02, 0.96);
  head.add(skull);

  for (const side of [-1, 1]) {
    const ear = mesh(new THREE.SphereGeometry(0.06, 14, 10), skin);
    ear.scale.set(0.5, 1, 0.8);
    ear.position.set(side * headRadius * 0.98, -0.01, 0.02);
    head.add(ear);
  }
  const nose = mesh(new THREE.SphereGeometry(0.045, 16, 12), skin);
  nose.scale.set(1, 0.85, 0.8);
  nose.position.set(0, -0.035, -headRadius * 0.95);
  head.add(nose);

  head.add(buildHair(definition, headRadius));
  const hat = buildHat(definition, headRadius);
  if (hat) head.add(hat);

  // Arms: short sleeve, forearm, mitten hand with a thumb.
  const arms: THREE.Group[] = [];
  let hand: THREE.Object3D = root;
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.225, 0.86, 0);
    const sleeve = mesh(new THREE.CapsuleGeometry(0.072, 0.08, 6, 14), shirt);
    sleeve.position.y = -0.06;
    const forearm = mesh(new THREE.CapsuleGeometry(0.054, 0.16, 6, 12), skin);
    forearm.position.y = -0.21;
    const palm = mesh(new THREE.SphereGeometry(0.068, 16, 12), skin);
    palm.scale.set(0.9, 1.05, 0.8);
    palm.position.y = -0.34;
    const thumb = mesh(new THREE.SphereGeometry(0.028, 10, 8), skin);
    thumb.position.set(-side * 0.05, -0.32, -0.035);
    shoulder.add(sleeve, forearm, palm, thumb);
    shoulder.rotation.z = side * 0.14;
    body.add(shoulder);
    arms.push(shoulder);
    if (side === 1) {
      hand = new THREE.Object3D();
      hand.position.set(0, -0.4, -0.02);
      shoulder.add(hand);
    }
  }
  const [leftArm, rightArm] = arms;

  let mood: CharacterMood = "idle";
  let clock = Math.random() * 10;
  let heldItem: THREE.Object3D | null = null;
  let blinkTimer = 1 + Math.random() * 3;
  let expression: FaceExpression = "neutral";

  const setExpression = (next: FaceExpression) => {
    if (next === expression) return;
    expression = next;
    faceMaterial.map = faceTexture(faceOptions, next);
    faceMaterial.needsUpdate = true;
  };

  const moodExpression = (): FaceExpression =>
    mood === "cheer" || mood === "clap" ? "happy" : mood === "sulk" ? "sad" : mood === "throw" ? "focus" : "neutral";

  const view: CharacterView = {
    root,
    hand,
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
      clock += dt;
      body.position.y = 0;
      body.rotation.x = 0;
      body.rotation.z = 0;
      leftArm.rotation.x = 0;
      rightArm.rotation.x = 0;
      leftArm.rotation.z = -0.14;
      rightArm.rotation.z = 0.14;
      head.rotation.set(0, 0, 0);

      // Blink every few seconds (not while grinning or sulking).
      blinkTimer -= dt;
      const baseExpression = moodExpression();
      let shown = baseExpression;
      if (blinkTimer < 0 && (baseExpression === "neutral" || baseExpression === "focus")) {
        shown = "blink";
        if (blinkTimer < -0.12) blinkTimer = 2 + Math.random() * 3.5;
      }
      setExpression(shown);

      if (mood === "idle") {
        const breathe = Math.sin(clock * 2.2);
        body.scale.y = definition.height * (1 + breathe * 0.01);
        leftArm.rotation.x = breathe * 0.05;
        rightArm.rotation.x = -breathe * 0.05;
        head.rotation.y = Math.sin(clock * 0.6) * 0.15;
        head.rotation.z = Math.sin(clock * 0.9) * 0.04;
      } else if (mood === "throw") {
        view.throwProgress += dt;
        const t = view.throwProgress;
        const { windUpSeconds, releaseSeconds, totalSeconds } = throwTiming;
        let swing: number;
        if (t < windUpSeconds) {
          swing = -1.35 * easeOut(t / windUpSeconds);
        } else if (t < releaseSeconds + 0.1) {
          swing = -1.35 + 2.55 * easeIn((t - windUpSeconds) / (releaseSeconds + 0.1 - windUpSeconds));
        } else {
          swing = 1.2 - 1.2 * Math.min(1, (t - releaseSeconds - 0.1) / (totalSeconds - releaseSeconds));
        }
        rightArm.rotation.x = swing;
        leftArm.rotation.x = -swing * 0.3;
        leftArm.rotation.z = -0.4;
        const crouch = Math.sin(Math.min(1, t / (releaseSeconds + 0.1)) * Math.PI);
        body.position.y = -0.1 * crouch;
        body.rotation.x = -0.22 * crouch;
        head.rotation.x = 0.15 * crouch;
      } else if (mood === "cheer") {
        const hop = Math.abs(Math.sin(clock * 7));
        body.position.y = hop * 0.2;
        body.scale.y = definition.height * (1 + (1 - hop) * 0.04);
        leftArm.rotation.x = 2.8 + Math.sin(clock * 14) * 0.25;
        rightArm.rotation.x = 2.8 - Math.sin(clock * 14) * 0.25;
        leftArm.rotation.z = -0.5;
        rightArm.rotation.z = 0.5;
        head.rotation.z = Math.sin(clock * 7) * 0.12;
      } else if (mood === "clap") {
        const clap = Math.abs(Math.sin(clock * 9));
        leftArm.rotation.x = 1.3;
        rightArm.rotation.x = 1.3;
        leftArm.rotation.z = 0.15 + clap * 0.4;
        rightArm.rotation.z = -0.15 - clap * 0.4;
        body.position.y = Math.abs(Math.sin(clock * 4.5)) * 0.05;
      } else {
        body.rotation.x = -0.14;
        head.rotation.x = 0.35;
        head.rotation.y = Math.sin(clock * 1.5) * 0.25;
        leftArm.rotation.x = 0.1;
        rightArm.rotation.x = 0.1;
      }
    },
  };

  root.traverse((child) => {
    if (child instanceof THREE.Mesh && child !== shadow && child !== ring) child.castShadow = true;
  });
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
