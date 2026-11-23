// Foe models with their own procedural animation: the drifting Shade and the
// lumbering Husk. (The Warden boss reuses the humanoid rig, armoured and scaled up.)
import * as THREE from "three";
import { textures } from "../engine/pixelTextures";
import { cachedMaterial, jitterGeometry, lambert, scaleUv, unlit } from "../engine/retroMaterials";
import { damp } from "../engine/rng";
import { artPalette } from "./artPalette";
import { glowSprite } from "./props";

export type FoeAnimState = "idle" | "chase" | "windup" | "strike" | "recover" | "stunned" | "hurt" | "dying";

function limb(length: number, top: number, bottom: number, material: THREE.Material): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(top, bottom, length, 5);
  geometry.translate(0, -length / 2, 0);
  return new THREE.Mesh(geometry, material);
}

function pivot(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Group {
  const group = new THREE.Group();
  group.rotation.order = "YXZ";
  group.position.set(x, y, z);
  parent.add(group);
  return group;
}

export class ShadeRig {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly robe: THREE.Mesh;
  private readonly robeBase: Float32Array;
  private readonly armL: THREE.Group;
  private readonly armR: THREE.Group;
  private readonly eyes: THREE.Mesh[] = [];
  private readonly eyeGlow: THREE.Sprite;
  private lean = 0;
  private reach = 0;

  constructor() {
    const tex = textures();
    const robeMaterial = cachedMaterial("shade-robe", () =>
      lambert({ map: tex.shadeRobe, side: THREE.DoubleSide, emissive: 0x150b26, transparent: true, opacity: 0.94 }),
    );
    this.root.add(this.body);
    const robeGeometry = new THREE.CylinderGeometry(0.2, 0.58, 1.5, 9, 4, true);
    robeGeometry.translate(0, -0.45, 0);
    scaleUv(robeGeometry, 2, 1);
    const position = robeGeometry.getAttribute("position") as THREE.BufferAttribute;
    for (let index = 0; index < position.count; index += 1) {
      if (position.getY(index) < -1.15) position.setY(index, position.getY(index) + (index % 2 === 0 ? 0.22 : -0.05));
    }
    this.robeBase = new Float32Array(position.array);
    this.robe = new THREE.Mesh(robeGeometry, robeMaterial);
    this.body.add(this.robe);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.27, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.62), robeMaterial);
    hood.position.y = 0.36;
    hood.rotation.x = -0.25;
    this.body.add(hood);
    const voidFace = new THREE.Mesh(new THREE.CircleGeometry(0.17, 8), cachedMaterial("shade-void", () => unlit({ color: 0x020104 })));
    voidFace.position.set(0, 0.36, 0.2);
    this.body.add(voidFace);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.02), cachedMaterial("shade-eye", () => unlit({ color: artPalette.shadeEye })));
      eye.position.set(side * 0.065, 0.38, 0.215);
      this.body.add(eye);
      this.eyes.push(eye);
    }
    this.eyeGlow = glowSprite(artPalette.shadeEye, 0.9, 0.45);
    this.eyeGlow.material = this.eyeGlow.material.clone();
    this.eyeGlow.position.set(0, 0.38, 0.3);
    this.body.add(this.eyeGlow);
    const clawMaterial = cachedMaterial("shade-claw", () => lambert({ map: tex.shadeRobe, emissive: 0x2a1a44 }));
    const makeArm = (side: number) => {
      const shoulder = pivot(this.body, side * 0.24, 0.2, 0.02);
      shoulder.add(limb(0.75, 0.06, 0.03, robeMaterial));
      for (let claw = -1; claw <= 1; claw += 1) {
        const finger = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.2, 3), clawMaterial);
        finger.position.set(claw * 0.03, -0.82, 0.02);
        finger.rotation.x = Math.PI;
        shoulder.add(finger);
      }
      return shoulder;
    };
    this.armL = makeArm(1);
    this.armR = makeArm(-1);
    this.body.position.y = 1.25;
  }

  update(dt: number, time: number, state: FoeAnimState, progress: number): void {
    let targetLean = 0.1;
    let targetReach = 0.2;
    let bob = Math.sin(time * 2.4) * 0.12;
    if (state === "windup") {
      targetLean = -0.45;
      targetReach = -0.6;
      bob += 0.25 * progress;
    } else if (state === "strike") {
      targetLean = 0.6;
      targetReach = 1.5;
    } else if (state === "stunned") {
      targetLean = 0.5;
      targetReach = -0.2;
      bob = -0.45 + Math.sin(time * 6) * 0.03;
    } else if (state === "hurt") {
      targetLean = -0.6;
      targetReach = 0.8;
    } else if (state === "chase") {
      targetLean = 0.35;
      targetReach = 0.5;
    }
    this.lean += (targetLean - this.lean) * damp(10, dt);
    this.reach += (targetReach - this.reach) * damp(10, dt);
    this.body.rotation.x = this.lean;
    this.body.position.y = 1.25 + bob;
    const sway = Math.sin(time * 3.1) * 0.15;
    this.armL.rotation.set(-this.reach + sway, 0, 0.25);
    this.armR.rotation.set(-this.reach - sway, 0, -0.25);
    const dim = state === "stunned" ? 0.25 : state === "windup" ? 1.4 : 1;
    (this.eyeGlow.material as THREE.SpriteMaterial).opacity = 0.45 * dim;
    this.eyes.forEach((eye) => (eye.visible = state !== "stunned" || Math.sin(time * 20) > 0));
    // Robe hem ripples.
    const position = this.robe.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let index = 0; index < position.count; index += 1) {
      const baseY = this.robeBase[index * 3 + 1];
      if (baseY > -0.5) continue;
      const depth = (-0.5 - baseY) / 0.9;
      const x = this.robeBase[index * 3];
      const z = this.robeBase[index * 3 + 2];
      const wave = Math.sin(time * 5 + Math.atan2(z, x) * 3) * 0.08 * depth;
      position.setXYZ(index, x * (1 + wave), baseY + wave * 0.6, z * (1 + wave) - this.lean * depth * 0.25);
    }
    position.needsUpdate = true;
  }
}

export class HuskRig {
  readonly root = new THREE.Group();
  private readonly torso = new THREE.Group();
  private readonly armL: THREE.Group;
  private readonly armR: THREE.Group;
  private readonly legL: THREE.Group;
  private readonly legR: THREE.Group;
  private readonly core: THREE.Sprite;
  private readonly pose = { lean: 0.3, armX: 0, armSpread: 0.2, hipY: 1.05, legSwing: 0 };

  constructor() {
    const tex = textures();
    const bark = cachedMaterial("husk-bark", () => lambert({ map: tex.huskBark }));
    const mossy = cachedMaterial("husk-moss", () => lambert({ map: tex.leaves }));
    this.root.add(this.torso);
    const chest = new THREE.IcosahedronGeometry(0.55, 1);
    jitterGeometry(chest, 0.14, 91);
    chest.scale(1.1, 1, 0.85);
    chest.translate(0, 0.45, 0);
    scaleUv(chest, 2, 2);
    this.torso.add(new THREE.Mesh(chest, bark));
    const moss = new THREE.IcosahedronGeometry(0.4, 0);
    jitterGeometry(moss, 0.1, 92);
    moss.scale(1.2, 0.5, 0.9);
    moss.translate(0, 0.9, -0.15);
    this.torso.add(new THREE.Mesh(moss, mossy));
    for (let thorn = 0; thorn < 6; thorn += 1) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.45, 4), bark);
      const angle = (thorn / 6) * Math.PI - Math.PI / 2;
      spike.position.set(Math.sin(angle) * 0.45, 0.75 + Math.cos(angle) * 0.1, -0.35);
      spike.rotation.set(-0.9, 0, -Math.sin(angle) * 0.6);
      this.torso.add(spike);
    }
    const head = new THREE.DodecahedronGeometry(0.25, 0);
    jitterGeometry(head, 0.05, 93);
    const headMesh = new THREE.Mesh(head, bark);
    headMesh.position.set(0, 0.75, 0.45);
    this.torso.add(headMesh);
    const ember = cachedMaterial("husk-ember", () => unlit({ color: artPalette.huskCore }));
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.02), ember);
      eye.position.set(side * 0.09, 0.78, 0.68);
      this.torso.add(eye);
    }
    const coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), ember);
    coreMesh.position.set(0, 0.45, 0.45);
    this.torso.add(coreMesh);
    this.core = glowSprite(artPalette.huskCore, 1.4, 0.5);
    this.core.material = this.core.material.clone();
    this.core.position.set(0, 0.45, 0.6);
    this.torso.add(this.core);
    const makeArm = (side: number) => {
      const shoulder = pivot(this.torso, side * 0.6, 0.65, 0.05);
      shoulder.add(limb(0.6, 0.14, 0.1, bark));
      const forearm = pivot(shoulder, 0, -0.6, 0);
      forearm.rotation.x = -0.4;
      forearm.add(limb(0.55, 0.11, 0.16, bark));
      for (let claw = -1; claw <= 1; claw += 1) {
        const finger = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.32, 4), bark);
        finger.position.set(claw * 0.08, -0.68, 0.05);
        finger.rotation.x = Math.PI - 0.3;
        forearm.add(finger);
      }
      return shoulder;
    };
    this.armL = makeArm(1);
    this.armR = makeArm(-1);
    const makeLeg = (side: number) => {
      const hip = pivot(this.root, side * 0.3, 1.0, 0);
      hip.add(limb(0.55, 0.15, 0.12, bark));
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.4), bark);
      foot.position.set(0, -0.95, 0.08);
      const shin = pivot(hip, 0, -0.55, 0);
      shin.add(limb(0.45, 0.12, 0.14, bark));
      foot.position.set(0, -0.48, 0.08);
      shin.add(foot);
      return hip;
    };
    this.legL = makeLeg(1);
    this.legR = makeLeg(-1);
  }

  update(dt: number, time: number, state: FoeAnimState, progress: number, speed: number): void {
    const target = { lean: 0.35, armX: Math.sin(time * 1.5) * 0.1, armSpread: 0.25, hipY: 1.0, legSwing: 0 };
    if (state === "chase" || state === "idle") {
      const phase = time * (3 + speed * 1.8);
      target.legSwing = Math.sin(phase) * Math.min(1, speed / 1.5) * 0.55;
      target.hipY = 1.0 - Math.abs(Math.sin(phase)) * 0.05 * Math.min(1, speed);
      target.armX = Math.sin(phase) * 0.35 * Math.min(1, speed);
    } else if (state === "windup") {
      target.lean = -0.25;
      target.armX = -2.7 * Math.min(1, progress * 1.5);
      target.armSpread = 0.4;
      target.hipY = 1.05;
    } else if (state === "strike") {
      target.lean = 0.9;
      target.armX = -0.5;
      target.armSpread = 0.15;
      target.hipY = 0.82;
    } else if (state === "recover" || state === "stunned") {
      target.lean = 0.7;
      target.armX = 0.1;
      target.armSpread = 0.5;
      target.hipY = 0.85;
    } else if (state === "hurt") {
      target.lean = -0.3;
      target.armX = -0.6;
      target.armSpread = 0.7;
    }
    const rate = state === "strike" ? 28 : 9;
    const t = damp(rate, dt);
    for (const key of Object.keys(target) as Array<keyof typeof target>) this.pose[key] += (target[key] - this.pose[key]) * t;
    this.torso.position.y = this.pose.hipY;
    this.torso.rotation.x = this.pose.lean;
    this.armL.rotation.set(this.pose.armX, 0, this.pose.armSpread);
    this.armR.rotation.set(state === "chase" ? -this.pose.armX : this.pose.armX, 0, -this.pose.armSpread);
    this.legL.rotation.x = -this.pose.legSwing;
    this.legR.rotation.x = this.pose.legSwing;
    this.legL.position.y = this.pose.hipY;
    this.legR.position.y = this.pose.hipY;
    const pulse = state === "stunned" || state === "recover" ? 0.9 + Math.sin(time * 14) * 0.2 : 0.45 + Math.sin(time * 3) * 0.08;
    (this.core.material as THREE.SpriteMaterial).opacity = pulse;
  }
}
