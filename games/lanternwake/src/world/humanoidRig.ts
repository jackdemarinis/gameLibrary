// Segmented low-poly humanoid (late-90s style): tapered limbs on a joint hierarchy,
// posed procedurally. Used for the hero, villagers and (scaled up, armoured) the Warden.
import * as THREE from "three";
import { textures } from "../engine/pixelTextures";
import { cachedMaterial, lambert, scaleUv, unlit } from "../engine/retroMaterials";
import { damp } from "../engine/rng";
import { artPalette } from "./artPalette";

export const poseKeys = [
  "bodyY",
  "bodyPitch",
  "bodyRoll",
  "spineX",
  "spineY",
  "spineZ",
  "neckX",
  "neckY",
  "shoulderLX",
  "shoulderLY",
  "shoulderLZ",
  "elbowLX",
  "wristLX",
  "shoulderRX",
  "shoulderRY",
  "shoulderRZ",
  "elbowRX",
  "wristRX",
  "wristRZ",
  "hipLX",
  "hipLZ",
  "kneeLX",
  "footLX",
  "hipRX",
  "hipRZ",
  "kneeRX",
  "footRX",
  "capeLift",
] as const;

export type PoseKey = (typeof poseKeys)[number];
export type Pose = Record<PoseKey, number>;

export const hipHeight = 0.95;

export function restPose(): Pose {
  const pose = {} as Pose;
  for (const key of poseKeys) pose[key] = 0;
  pose.bodyY = hipHeight;
  pose.shoulderLZ = 0.12;
  pose.shoulderRZ = -0.12;
  pose.elbowLX = -0.25;
  pose.elbowRX = -0.35;
  pose.wristRX = -1.3;
  pose.capeLift = 0.08;
  return pose;
}

export function mixPose(a: Pose, b: Pose, t: number, out: Pose = restPose()): Pose {
  for (const key of poseKeys) out[key] = a[key] + (b[key] - a[key]) * t;
  return out;
}

/** Piecewise keyframes over progress 0..1, smoothstepped between frames. Missing keys use `base`. */
export function keyframePose(base: Pose, frames: Array<[number, Partial<Pose>]>, progress: number): Pose {
  const resolved = frames.map(([time, partial]) => [time, { ...base, ...partial }] as const);
  if (progress <= resolved[0][0]) return { ...resolved[0][1] };
  for (let index = 0; index < resolved.length - 1; index += 1) {
    const [t0, p0] = resolved[index];
    const [t1, p1] = resolved[index + 1];
    if (progress <= t1) {
      const local = (progress - t0) / Math.max(1e-5, t1 - t0);
      return mixPose(p0, p1, local * local * (3 - 2 * local));
    }
  }
  return { ...resolved[resolved.length - 1][1] };
}

export type HeldItem = "sword" | "staff" | "hammer" | "greatsword" | "none";

export interface RigLook {
  torso: THREE.Texture;
  skirt: THREE.Texture;
  sleeves: THREE.Texture;
  legs: THREE.Texture;
  boots: THREE.Texture;
  hands: THREE.Texture;
  face: THREE.Texture;
  hair: THREE.Texture;
  belt: THREE.Texture;
  cape?: THREE.Texture;
  /** Long robe to the ankles instead of a tunic skirt. */
  robe?: boolean;
  apron?: THREE.Texture;
  pauldrons?: THREE.Texture;
  helm?: THREE.Texture;
  horns?: boolean;
  core?: number;
  held: HeldItem;
  lantern: boolean;
  bulk?: number;
}

function mat(texture: THREE.Texture, options: { side?: THREE.Side; emissive?: number } = {}): THREE.MeshLambertMaterial {
  return cachedMaterial(`rig-${texture.uuid}-${options.side ?? 0}-${options.emissive ?? 0}`, () =>
    lambert({ map: texture, side: options.side ?? THREE.FrontSide, emissive: options.emissive ?? 0x000000 }),
  );
}

/** Tapered limb whose top sits at the joint origin and extends down -y. */
function limb(length: number, topRadius: number, bottomRadius: number, material: THREE.Material, segments = 6): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(topRadius, bottomRadius, length, segments, 1);
  geometry.translate(0, -length / 2, 0);
  scaleUv(geometry, 2, 2);
  return new THREE.Mesh(geometry, material);
}

function joint(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Group {
  const group = new THREE.Group();
  group.rotation.order = "YXZ";
  group.position.set(x, y, z);
  parent.add(group);
  return group;
}

export function buildSword(scale = 1, glow = false): THREE.Group {
  const tex = textures();
  const sword = new THREE.Group();
  const grip = limb(0.13 * scale, 0.017 * scale, 0.017 * scale, mat(tex.leather), 5);
  grip.position.y = 0.06 * scale;
  sword.add(grip);
  const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(0.028 * scale), mat(tex.gold));
  pommel.position.y = 0.075 * scale;
  sword.add(pommel);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.2 * scale, 0.028 * scale, 0.045 * scale), mat(tex.gold));
  guard.position.y = -0.075 * scale;
  sword.add(guard);
  const bladeLength = 0.78 * scale;
  const bladeGeometry = new THREE.BoxGeometry(0.055 * scale, bladeLength, 0.014 * scale, 1, 4, 1);
  const position = bladeGeometry.getAttribute("position") as THREE.BufferAttribute;
  for (let index = 0; index < position.count; index += 1) {
    const y = position.getY(index);
    // Taper toward the tip (bottom), with a fuller ridge.
    const along = (bladeLength / 2 - y) / bladeLength;
    const taper = along > 0.86 ? Math.max(0.05, (1 - along) / 0.14) : 1 - along * 0.15;
    position.setX(index, position.getX(index) * taper);
  }
  bladeGeometry.computeVertexNormals();
  bladeGeometry.translate(0, -0.09 * scale - bladeLength / 2, 0);
  const bladeMaterial = glow
    ? cachedMaterial("blade-glow", () => lambert({ map: tex.steel, emissive: artPalette.ember, emissiveIntensity: 0.6 }))
    : mat(tex.steel);
  const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
  blade.name = "blade";
  sword.add(blade);
  sword.userData.tipOffset = -(0.09 * scale + bladeLength);
  return sword;
}

export function buildLantern(): { group: THREE.Group; core: THREE.Object3D; glow: THREE.Sprite } {
  const tex = textures();
  const group = new THREE.Group();
  const frame = mat(tex.steel);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.006, 4, 8, Math.PI), frame);
  handle.position.y = -0.02;
  group.add(handle);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.06, 4), frame);
  cap.rotation.y = Math.PI / 4;
  cap.position.y = -0.055;
  group.add(cap);
  for (let corner = 0; corner < 4; corner += 1) {
    const angle = (corner / 4) * Math.PI * 2 + Math.PI / 4;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.12, 0.012), frame);
    post.position.set(Math.cos(angle) * 0.045, -0.145, Math.sin(angle) * 0.045);
    group.add(post);
  }
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.022, 0.1), frame);
  base.position.y = -0.21;
  group.add(base);
  const coreMaterial = cachedMaterial("lantern-core", () => unlit({ color: artPalette.lanternCore }));
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.035), coreMaterial);
  core.position.y = -0.14;
  group.add(core);
  const glow = new THREE.Sprite(
    cachedMaterial("lantern-glow", () =>
      new THREE.SpriteMaterial({ map: tex.glow, color: artPalette.lanternLight, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 }),
    ),
  );
  glow.scale.setScalar(0.7);
  glow.position.y = -0.14;
  group.add(glow);
  return { group, core, glow };
}

export class HumanoidRig {
  readonly root = new THREE.Group();
  readonly body: THREE.Group;
  readonly hips: THREE.Group;
  readonly spine: THREE.Group;
  readonly neck: THREE.Group;
  readonly shoulderL: THREE.Group;
  readonly shoulderR: THREE.Group;
  readonly elbowL: THREE.Group;
  readonly elbowR: THREE.Group;
  readonly wristL: THREE.Group;
  readonly wristR: THREE.Group;
  readonly hipL: THREE.Group;
  readonly hipR: THREE.Group;
  readonly kneeL: THREE.Group;
  readonly kneeR: THREE.Group;
  readonly footL: THREE.Group;
  readonly footR: THREE.Group;
  readonly cape: THREE.Group[] = [];
  readonly pose: Pose = restPose();
  held: THREE.Group | null = null;
  lantern: { pivot: THREE.Group; core: THREE.Object3D; glow: THREE.Sprite } | null = null;
  core: THREE.Mesh | null = null;
  private lanternSwing = 0;
  private lanternSwingVelocity = 0;
  private lastYaw = 0;
  private readonly scratchQuat = new THREE.Quaternion();
  private readonly scratchQuat2 = new THREE.Quaternion();

  constructor(look: RigLook, scale = 1) {
    const bulk = look.bulk ?? 1;
    this.root.scale.setScalar(scale);
    this.body = joint(this.root, 0, hipHeight, 0);
    this.hips = joint(this.body, 0, 0, 0);
    this.spine = joint(this.hips, 0, 0.04, 0);

    // Torso, belt and skirt/robe.
    const torsoGeometry = new THREE.CylinderGeometry(0.19 * bulk, 0.15 * bulk, 0.5, 8);
    torsoGeometry.scale(1, 1, 0.64);
    torsoGeometry.translate(0, 0.25, 0);
    scaleUv(torsoGeometry, 3, 2);
    this.spine.add(new THREE.Mesh(torsoGeometry, mat(look.torso)));
    if (look.apron) {
      const apron = new THREE.Mesh(new THREE.BoxGeometry(0.26 * bulk, 0.62, 0.02), mat(look.apron));
      apron.position.set(0, 0.06, 0.115 * bulk);
      this.spine.add(apron);
    }
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.162 * bulk, 0.162 * bulk, 0.055, 8).scale(1, 1, 0.72), mat(look.belt));
    belt.position.y = 0.02;
    this.hips.add(belt);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.045, 0.02), mat(textures().gold));
    buckle.position.set(0, 0.02, 0.118 * bulk);
    this.hips.add(buckle);
    const skirtLength = look.robe ? 0.88 : 0.32;
    const skirtGeometry = new THREE.CylinderGeometry(0.165 * bulk, (look.robe ? 0.34 : 0.25) * bulk, skirtLength, 9, 2, true);
    skirtGeometry.scale(1, 1, 0.78);
    skirtGeometry.translate(0, -skirtLength / 2 + 0.02, 0);
    scaleUv(skirtGeometry, 3, look.robe ? 3 : 1);
    const skirtPosition = skirtGeometry.getAttribute("position") as THREE.BufferAttribute;
    for (let index = 0; index < skirtPosition.count; index += 1) {
      // Ragged hem: alternate the bottom ring up and down a little.
      if (skirtPosition.getY(index) < -skirtLength + 0.05) skirtPosition.setY(index, skirtPosition.getY(index) + (index % 2 === 0 ? 0.03 : -0.01));
    }
    skirtGeometry.computeVertexNormals();
    this.hips.add(new THREE.Mesh(skirtGeometry, mat(look.skirt, { side: THREE.DoubleSide })));

    // Neck + head.
    this.neck = joint(this.spine, 0, 0.5, 0.01);
    const neckMesh = limb(0.09, 0.05, 0.055, mat(textures().skin));
    neckMesh.position.y = 0.09;
    this.neck.add(neckMesh);
    const headGeometry = new THREE.SphereGeometry(0.125, 10, 8);
    headGeometry.scale(0.92, 1.08, 1);
    const head = new THREE.Mesh(headGeometry, mat(look.face));
    head.position.y = 0.18;
    this.neck.add(head);
    if (look.helm) {
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.62), mat(look.helm));
      helm.position.y = 0.19;
      this.neck.add(helm);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.04), mat(look.helm));
      visor.position.set(0, 0.17, 0.13);
      this.neck.add(visor);
      const slit = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.022, 0.02), cachedMaterial("warden-eyes", () => unlit({ color: artPalette.wardenCore })));
      slit.position.set(0, 0.2, 0.135);
      this.neck.add(slit);
      if (look.horns) {
        for (const side of [-1, 1]) {
          const horn = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.22, 5), mat(textures().huskBark));
          horn.position.set(side * 0.14, 0.3, -0.02);
          horn.rotation.z = -side * 0.7;
          this.neck.add(horn);
        }
      }
    } else {
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.133, 10, 6, Math.PI * 0.9, Math.PI * 1.2, 0, Math.PI * 0.56), mat(look.hair));
      hair.position.y = 0.19;
      hair.scale.set(0.95, 1.08, 1.02);
      this.neck.add(hair);
      const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.135, 10, 4, 0, Math.PI * 2, 0, Math.PI * 0.22), mat(look.hair));
      fringe.position.y = 0.2;
      fringe.scale.set(0.95, 1.08, 1.02);
      this.neck.add(fringe);
    }

    // Arms.
    const sleeve = mat(look.sleeves);
    const hands = mat(look.hands);
    const makeArm = (side: 1 | -1) => {
      const shoulder = joint(this.spine, side * 0.2 * bulk, 0.44, 0);
      shoulder.add(limb(0.27, 0.058 * bulk, 0.048 * bulk, sleeve));
      if (look.pauldrons) {
        const pad = new THREE.Mesh(new THREE.SphereGeometry(0.085 * bulk, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(look.pauldrons));
        pad.position.y = 0.0;
        pad.scale.set(1.1, 0.9, 1);
        shoulder.add(pad);
      }
      const elbow = joint(shoulder, 0, -0.27, 0);
      elbow.add(limb(0.24, 0.047 * bulk, 0.04 * bulk, hands));
      const wrist = joint(elbow, 0, -0.25, 0);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.048 * bulk, 6, 4), hands);
      hand.scale.set(1, 1.2, 0.8);
      wrist.add(hand);
      return { shoulder, elbow, wrist };
    };
    const left = makeArm(1);
    const right = makeArm(-1);
    this.shoulderL = left.shoulder;
    this.elbowL = left.elbow;
    this.wristL = left.wrist;
    this.shoulderR = right.shoulder;
    this.elbowR = right.elbow;
    this.wristR = right.wrist;

    // Legs.
    const legs = mat(look.legs);
    const boots = mat(look.boots);
    const makeLeg = (side: 1 | -1) => {
      const hip = joint(this.hips, side * 0.095 * bulk, -0.02, 0);
      hip.add(limb(0.44, 0.078 * bulk, 0.058 * bulk, legs));
      const knee = joint(hip, 0, -0.44, 0);
      knee.add(limb(0.42, 0.06 * bulk, 0.05 * bulk, boots));
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.068 * bulk, 0.064 * bulk, 0.06, 6), boots);
      cuff.position.y = -0.04;
      knee.add(cuff);
      const foot = joint(knee, 0, -0.42, 0);
      const footMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1 * bulk, 0.07, 0.21 * bulk), boots);
      footMesh.position.set(0, -0.035, 0.045);
      foot.add(footMesh);
      return { hip, knee, foot };
    };
    const leftLeg = makeLeg(1);
    const rightLeg = makeLeg(-1);
    this.hipL = leftLeg.hip;
    this.kneeL = leftLeg.knee;
    this.footL = leftLeg.foot;
    this.hipR = rightLeg.hip;
    this.kneeR = rightLeg.knee;
    this.footR = rightLeg.foot;

    // Cape: three hinged panels down the back.
    if (look.cape) {
      const capeMaterial = mat(look.cape, { side: THREE.DoubleSide });
      let parent: THREE.Object3D = joint(this.spine, 0, 0.47, -0.105 * bulk);
      for (let segment = 0; segment < 3; segment += 1) {
        const width = (0.36 + segment * 0.05) * bulk;
        const geometry = new THREE.PlaneGeometry(width, 0.27, 2, 1);
        geometry.translate(0, -0.135, 0);
        const panel = new THREE.Group();
        panel.rotation.order = "YXZ";
        panel.add(new THREE.Mesh(geometry, capeMaterial));
        parent.add(panel);
        this.cape.push(panel);
        const next = new THREE.Group();
        next.position.y = -0.27;
        panel.add(next);
        parent = next;
      }
    }

    // Scarf ring for the hero look (cape implies the keeper's scarf).
    if (look.cape && !look.helm) {
      const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.04, 5, 9), mat(look.cape));
      scarf.rotation.x = Math.PI / 2;
      scarf.position.y = 0.5;
      this.spine.add(scarf);
    }

    if (look.core !== undefined) {
      this.core = new THREE.Mesh(new THREE.OctahedronGeometry(0.075), cachedMaterial(`core-${look.core}`, () => unlit({ color: look.core })));
      this.core.position.set(0, 0.3, 0.12 * bulk);
      this.spine.add(this.core);
    }

    this.attachHeld(look.held);
    if (look.lantern) {
      const lantern = buildLantern();
      const pivot = new THREE.Group();
      pivot.position.y = -0.03;
      pivot.add(lantern.group);
      this.wristL.add(pivot);
      this.lantern = { pivot, core: lantern.core, glow: lantern.glow };
    }

    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh) object.frustumCulled = true;
    });
  }

  private attachHeld(item: HeldItem): void {
    if (item === "none") return;
    const tex = textures();
    if (item === "sword" || item === "greatsword") {
      this.held = buildSword(item === "greatsword" ? 1.9 : 1);
    } else if (item === "staff") {
      this.held = new THREE.Group();
      const staff = limb(1.5, 0.025, 0.022, mat(tex.bark), 5);
      staff.position.y = 0.5;
      this.held.add(staff);
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), cachedMaterial("staff-crystal", () => unlit({ color: artPalette.lanternCore })));
      crystal.position.y = 0.56;
      this.held.add(crystal);
    } else {
      this.held = new THREE.Group();
      const handle = limb(0.42, 0.02, 0.02, mat(tex.plank), 5);
      handle.position.y = 0.06;
      this.held.add(handle);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.08), mat(tex.steel));
      head.position.y = -0.38;
      this.held.add(head);
    }
    this.held.rotation.order = "YXZ";
    this.wristR.add(this.held);
  }

  /** Ease the live pose toward a target pose. */
  blendTo(target: Pose, rate: number, dt: number): void {
    const t = damp(rate, dt);
    for (const key of poseKeys) this.pose[key] += (target[key] - this.pose[key]) * t;
  }

  snapTo(target: Pose): void {
    for (const key of poseKeys) this.pose[key] = target[key];
  }

  /** Write the pose to the joints, then swing the cape and lantern. */
  apply(dt: number, time: number, speed: number): void {
    const p = this.pose;
    this.body.position.y = p.bodyY;
    this.body.rotation.set(p.bodyPitch, 0, p.bodyRoll);
    this.spine.rotation.set(p.spineX, p.spineY, p.spineZ);
    this.neck.rotation.set(p.neckX, p.neckY, 0);
    this.shoulderL.rotation.set(p.shoulderLX, p.shoulderLY, p.shoulderLZ);
    this.elbowL.rotation.set(p.elbowLX, 0, 0);
    this.wristL.rotation.set(p.wristLX, 0, 0);
    this.shoulderR.rotation.set(p.shoulderRX, p.shoulderRY, p.shoulderRZ);
    this.elbowR.rotation.set(p.elbowRX, 0, 0);
    this.wristR.rotation.set(p.wristRX, 0, p.wristRZ);
    this.hipL.rotation.set(p.hipLX, 0, p.hipLZ);
    this.kneeL.rotation.set(p.kneeLX, 0, 0);
    this.footL.rotation.set(p.footLX, 0, 0);
    this.hipR.rotation.set(p.hipRX, 0, p.hipRZ);
    this.kneeR.rotation.set(p.kneeRX, 0, 0);
    this.footR.rotation.set(p.footRX, 0, 0);
    this.cape.forEach((panel, index) => {
      const flutter = Math.sin(time * (3.2 + speed * 1.5) + index * 1.1) * (0.04 + speed * 0.05);
      panel.rotation.x = p.capeLift * (0.5 + index * 0.35) + flutter - p.spineX * (index === 0 ? 0.8 : 0);
    });

    if (this.lantern) {
      // Lantern hangs plumb from the hand with a damped pendulum driven by turning.
      const yaw = this.root.rotation.y;
      const turn = Math.atan2(Math.sin(yaw - this.lastYaw), Math.cos(yaw - this.lastYaw));
      this.lastYaw = yaw;
      this.lanternSwingVelocity += (-this.lanternSwing * 60 - this.lanternSwingVelocity * 5) * dt + turn * 8 + speed * Math.sin(time * 9) * dt * 2;
      this.lanternSwing += this.lanternSwingVelocity * dt;
      this.root.updateMatrixWorld(true);
      this.lantern.pivot.parent!.getWorldQuaternion(this.scratchQuat).invert();
      this.scratchQuat2.setFromEuler(new THREE.Euler(this.lanternSwing * 0.5 + speed * 0.12, yaw, this.lanternSwing * 0.3, "YXZ"));
      this.lantern.pivot.quaternion.copy(this.scratchQuat.multiply(this.scratchQuat2));
    }
  }
}

// ---------------------------------------------------------------- looks

export function heroLook(): RigLook {
  const tex = textures();
  return {
    torso: tex.tunic,
    skirt: tex.tunic,
    sleeves: tex.tunic,
    legs: tex.boots,
    boots: tex.leather,
    hands: tex.leather,
    face: tex.heroFace,
    hair: tex.hair,
    belt: tex.leather,
    cape: tex.scarf,
    pauldrons: tex.leather,
    held: "sword",
    lantern: true,
  };
}

export function elderLook(): RigLook {
  const tex = textures();
  return {
    torso: tex.robe,
    skirt: tex.robe,
    sleeves: tex.robe,
    legs: tex.robe,
    boots: tex.boots,
    hands: tex.skin,
    face: tex.elderFace,
    hair: tex.hairGrey,
    belt: tex.gold,
    robe: true,
    held: "staff",
    lantern: false,
  };
}

export function smithLook(): RigLook {
  const tex = textures();
  return {
    torso: tex.scarf,
    skirt: tex.leather,
    sleeves: tex.skin,
    legs: tex.boots,
    boots: tex.leather,
    hands: tex.skin,
    face: tex.smithFace,
    hair: tex.hair,
    belt: tex.leather,
    apron: tex.apron,
    held: "hammer",
    lantern: false,
    bulk: 1.15,
  };
}

export function wardenLook(): RigLook {
  const tex = textures();
  return {
    torso: tex.wardenPlate,
    skirt: tex.shadeRobe,
    sleeves: tex.wardenPlate,
    legs: tex.shadeRobe,
    boots: tex.wardenPlate,
    hands: tex.wardenPlate,
    face: tex.wardenPlate,
    hair: tex.wardenPlate,
    belt: tex.gold,
    cape: tex.shadeRobe,
    pauldrons: tex.wardenPlate,
    helm: tex.wardenPlate,
    horns: true,
    core: artPalette.wardenCore,
    held: "greatsword",
    lantern: false,
    bulk: 1.25,
  };
}
