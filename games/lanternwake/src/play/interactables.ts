// Interactive world objects: physics props (crates, barrels, breakable pots),
// pressure plates, braziers, gates, chests, waypoint lanterns, pickups and NPCs.
import * as THREE from "three";
import type { LightSource } from "../engine/lightPool";
import { textures } from "../engine/pixelTextures";
import { cachedMaterial, lambert, unlit } from "../engine/retroMaterials";
import { clamp, damp } from "../engine/rng";
import type { DialogueDef, NpcPlacement, PickupKind } from "../game/content/areaTypes";
import { angleDelta, yawTowards } from "../game/rules/combat";
import { artPalette } from "../world/artPalette";
import { HumanoidRig, elderLook, smithLook } from "../world/humanoidRig";
import { villagerPose } from "../world/rigAnimations";
import { barrelMesh, brazierMesh, chestMesh, crateMesh, gateMesh, glowSprite, plateMesh, potMesh, wayLanternMesh } from "../world/props";
import type { Hittable, PlayContext } from "./context";
import { RAPIER, groupDebris, groupProp, groupWorld, type Physics } from "./physics";

// ---------------------------------------------------------------- physics props

export type DynamicKind = "crate" | "barrel" | "pot";

export class DynamicProp implements Hittable {
  readonly kind: DynamicKind;
  readonly object: THREE.Object3D;
  readonly body: RAPIER.RigidBody;
  readonly radius: number;
  readonly contents?: PickupKind;
  private broken = false;
  private readonly physics: Physics;
  private readonly scratch = new THREE.Vector3();

  constructor(kind: DynamicKind, physics: Physics, x: number, y: number, z: number, rot: number, contents?: PickupKind) {
    this.kind = kind;
    this.physics = physics;
    this.contents = contents;
    this.object = kind === "crate" ? crateMesh() : kind === "barrel" ? barrelMesh() : potMesh();
    const half = { x: 0, y: Math.sin(rot / 2), z: 0, w: Math.cos(rot / 2) };
    const lift = kind === "crate" ? 0.46 : kind === "barrel" ? 0.51 : 0.31;
    this.body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y + lift, z)
        .setRotation(half)
        .setLinearDamping(kind === "crate" ? 2.5 : 0.4)
        .setAngularDamping(kind === "crate" ? 2 : 0.6)
        .setCcdEnabled(true),
    );
    const collider =
      kind === "crate"
        ? RAPIER.ColliderDesc.cuboid(0.45, 0.45, 0.45).setDensity(55).setFriction(0.55)
        : kind === "barrel"
          ? RAPIER.ColliderDesc.cylinder(0.5, 0.38).setDensity(30).setFriction(0.5)
          : RAPIER.ColliderDesc.cylinder(0.3, 0.26).setDensity(60).setFriction(0.6);
    physics.world.createCollider(collider.setCollisionGroups(groupProp).setRestitution(0.1), this.body);
    this.radius = kind === "crate" ? 0.55 : 0.4;
  }

  get alive(): boolean {
    return !this.broken;
  }

  position(): THREE.Vector3 {
    const translation = this.body.translation();
    return this.scratch.set(translation.x, translation.y - 0.4, translation.z);
  }

  takeHit(_damage: number, from: THREE.Vector3, knock: number): boolean {
    if (this.broken) return false;
    if (this.kind === "pot") {
      this.broken = true;
      return true;
    }
    const at = this.body.translation();
    const away = new THREE.Vector3(at.x - from.x, 0, at.z - from.z).normalize();
    const mass = this.body.mass();
    const strength = this.kind === "crate" ? knock * 0.35 : knock * 0.8;
    this.body.applyImpulse({ x: away.x * strength * mass, y: strength * mass * 0.25, z: away.z * strength * mass }, true);
    this.body.applyTorqueImpulse({ x: (Math.random() - 0.5) * mass, y: (Math.random() - 0.5) * mass, z: (Math.random() - 0.5) * mass }, true);
    return true;
  }

  /** Whether this pot was smashed this frame (the area turns it into shards + loot). */
  get isBroken(): boolean {
    return this.broken;
  }

  sync(): void {
    const translation = this.body.translation();
    const rotation = this.body.rotation();
    this.object.position.set(translation.x, translation.y, translation.z);
    this.object.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
  }

  remove(): void {
    this.physics.world.removeRigidBody(this.body);
    this.object.removeFromParent();
  }

  /** Centre of the prop for plate checks. */
  centre(): THREE.Vector3 {
    const translation = this.body.translation();
    return new THREE.Vector3(translation.x, translation.y, translation.z);
  }
}

/** Clay shards that tumble and fade after a pot breaks. */
export class Shards {
  private readonly pieces: Array<{ body: RAPIER.RigidBody; mesh: THREE.Mesh }> = [];
  private age = 0;
  private readonly physics: Physics;

  constructor(physics: Physics, root: THREE.Object3D, at: THREE.Vector3) {
    this.physics = physics;
    const material = cachedMaterial("pot", () => lambert({ map: textures().dirt, color: 0xd09070, side: THREE.DoubleSide }));
    for (let index = 0; index < 7; index += 1) {
      const size = 0.08 + Math.random() * 0.1;
      const mesh = new THREE.Mesh(new THREE.TetrahedronGeometry(size), material);
      const body = physics.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(at.x + (Math.random() - 0.5) * 0.3, at.y + 0.2 + Math.random() * 0.3, at.z + (Math.random() - 0.5) * 0.3)
          .setLinvel((Math.random() - 0.5) * 5, 2 + Math.random() * 3, (Math.random() - 0.5) * 5)
          .setAngvel({ x: Math.random() * 10, y: Math.random() * 10, z: Math.random() * 10 }),
      );
      physics.world.createCollider(RAPIER.ColliderDesc.ball(size * 0.7).setCollisionGroups(groupDebris).setRestitution(0.3), body);
      root.add(mesh);
      this.pieces.push({ body, mesh });
    }
  }

  /** Returns false once the shards have faded and been removed. */
  update(dt: number): boolean {
    this.age += dt;
    for (const piece of this.pieces) {
      const t = piece.body.translation();
      const r = piece.body.rotation();
      piece.mesh.position.set(t.x, t.y, t.z);
      piece.mesh.quaternion.set(r.x, r.y, r.z, r.w);
      piece.mesh.scale.setScalar(clamp(3.5 - this.age, 0, 1));
    }
    if (this.age > 3.5) {
      this.dispose();
      return false;
    }
    return true;
  }

  dispose(): void {
    for (const piece of this.pieces) {
      if (this.physics.world.getRigidBody(piece.body.handle)) this.physics.world.removeRigidBody(piece.body);
      piece.mesh.removeFromParent();
    }
    this.pieces.length = 0;
  }
}

// ---------------------------------------------------------------- puzzle pieces

export class Plate {
  readonly id: string;
  readonly object: THREE.Group;
  readonly x: number;
  readonly z: number;
  readonly y: number;
  pressed = false;
  private readonly top: THREE.Object3D;
  private readonly rune: THREE.Mesh;
  private sink = 0;

  constructor(id: string, x: number, y: number, z: number) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.z = z;
    const built = plateMesh();
    this.object = built.group;
    this.top = built.top;
    this.rune = built.rune;
    this.object.position.set(x, y, z);
  }

  /** Something heavy within the plate's footprint presses it. */
  test(points: THREE.Vector3[]): boolean {
    return points.some((point) => Math.abs(point.x - this.x) < 0.95 && Math.abs(point.z - this.z) < 0.95 && point.y - this.y < 1.6 && point.y - this.y > -0.5);
  }

  render(dt: number, latched: boolean): void {
    const down = this.pressed || latched;
    this.sink += ((down ? 1 : 0) - this.sink) * damp(10, dt);
    this.top.position.y = 0.13 - this.sink * 0.09;
    this.rune.material = down
      ? cachedMaterial("plate-rune-on", () => unlit({ color: 0x7fe0ff }))
      : cachedMaterial("plate-rune", () => unlit({ color: 0x4a6a8a }));
  }
}

export class Brazier {
  readonly id: string;
  readonly object: THREE.Group;
  readonly position: THREE.Vector3;
  lit = false;
  readonly alwaysLit: boolean;
  private readonly fireAnchor: THREE.Object3D;
  private readonly light: LightSource;
  private readonly glow: THREE.Sprite;
  private burnLeft: number | null = null;

  constructor(id: string, x: number, y: number, z: number, alwaysLit: boolean, context: { lights: { add(source: LightSource): LightSource } }) {
    this.id = id;
    this.alwaysLit = alwaysLit;
    this.lit = alwaysLit;
    const built = brazierMesh();
    this.object = built.group;
    this.fireAnchor = built.fireAnchor;
    this.object.position.set(x, y, z);
    this.position = new THREE.Vector3(x, y + 1.3, z);
    this.glow = glowSprite(artPalette.fireMid, 3.2, 0.55);
    this.glow.position.y = 1.5;
    this.object.add(this.glow);
    this.light = context.lights.add({ position: this.position.clone().setY(y + 1.8), color: new THREE.Color(artPalette.fireMid), intensity: 7, distance: 11, flicker: 1, enabled: alwaysLit });
  }

  setLit(lit: boolean, burnLeft: number | null): void {
    this.lit = lit || this.alwaysLit;
    this.burnLeft = burnLeft;
    this.light.enabled = this.lit;
  }

  render(dt: number, context: PlayContext): void {
    this.glow.visible = this.lit;
    if (!this.lit) return;
    const anchor = this.fireAnchor.getWorldPosition(new THREE.Vector3());
    // Fire: a few rising sparks every frame, colour shifting core -> edge.
    const dying = this.burnLeft !== null && this.burnLeft < 4;
    const rate = dying ? (Math.sin(context.time * 12) > 0 ? 3 : 0) : 5;
    for (let index = 0; index < rate; index += 1) {
      const pick = Math.random();
      context.glow.emit({
        count: 1,
        position: anchor,
        spread: 0.35,
        speed: 0.3,
        up: 1.6 + Math.random(),
        drag: 1,
        life: 0.55,
        size: 0.13,
        color: pick < 0.35 ? artPalette.fireCore : pick < 0.8 ? artPalette.fireMid : artPalette.fireEdge,
      });
    }
    this.glow.scale.setScalar(3 + Math.sin(context.time * 15) * 0.2);
    void dt;
  }
}

export class Gate {
  readonly id: string;
  readonly object: THREE.Group;
  readonly flag?: string;
  readonly closedWhile?: string;
  private readonly bars: THREE.Group;
  private collider: RAPIER.Collider | null = null;
  private readonly physics: Physics;
  private readonly spec: { x: number; y: number; z: number; rot: number; width: number };
  private openAmount: number;
  private open: boolean;

  constructor(id: string, physics: Physics, x: number, y: number, z: number, rot: number, width: number, flag: string | undefined, closedWhile: string | undefined, startOpen: boolean) {
    this.id = id;
    this.physics = physics;
    this.flag = flag;
    this.closedWhile = closedWhile;
    const built = gateMesh(width);
    this.object = built.group;
    this.bars = built.bars;
    this.object.position.set(x, y, z);
    this.object.rotation.y = rot;
    this.spec = { x, y, z, rot, width };
    this.open = startOpen;
    this.openAmount = startOpen ? 1 : 0;
    // Pillars are always solid.
    for (const side of [-1, 1]) {
      const px = x + Math.cos(rot) * side * (width / 2 + 0.5);
      const pz = z - Math.sin(rot) * side * (width / 2 + 0.5);
      physics.world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 2.2, 0.5).setTranslation(px, y + 2.1, pz).setCollisionGroups(groupWorld));
    }
    if (!startOpen) this.addBarCollider();
    this.bars.position.y = -this.openAmount * 3.9;
  }

  private addBarCollider(): void {
    const half = this.spec.rot / 2;
    this.collider = this.physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(this.spec.width / 2, 2.2, 0.25)
        .setTranslation(this.spec.x, this.spec.y + 2.1, this.spec.z)
        .setRotation({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) })
        .setCollisionGroups(groupWorld),
    );
  }

  /** Decide open/closed from flags; returns true when the state changed. */
  sync(flags: ReadonlySet<string>): boolean {
    let shouldOpen = true;
    if (this.flag) shouldOpen = flags.has(this.flag);
    if (this.closedWhile) shouldOpen = !flags.has(this.closedWhile);
    if (shouldOpen === this.open) return false;
    this.open = shouldOpen;
    if (shouldOpen && this.collider) {
      this.physics.world.removeCollider(this.collider, false);
      this.collider = null;
    } else if (!shouldOpen && !this.collider) {
      this.addBarCollider();
    }
    return true;
  }

  render(dt: number): void {
    this.openAmount += ((this.open ? 1 : 0) - this.openAmount) * damp(this.open ? 1.6 : 6, dt);
    this.bars.position.y = -this.openAmount * 3.9;
  }
}

export class Chest {
  readonly id: string;
  readonly object: THREE.Group;
  readonly position: THREE.Vector3;
  readonly contents: PickupKind;
  opened: boolean;
  private readonly lid: THREE.Group;
  private openAmount: number;

  constructor(id: string, physics: Physics, x: number, y: number, z: number, rot: number, contents: PickupKind, opened: boolean) {
    this.id = id;
    this.contents = contents;
    this.opened = opened;
    const built = chestMesh();
    this.object = built.group;
    this.lid = built.lid;
    this.object.position.set(x, y, z);
    this.object.rotation.y = rot;
    this.position = new THREE.Vector3(x, y, z);
    this.openAmount = opened ? 1 : 0;
    const half = rot / 2;
    physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.55, 0.45, 0.36)
        .setTranslation(x, y + 0.45, z)
        .setRotation({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) })
        .setCollisionGroups(groupWorld),
    );
  }

  render(dt: number): void {
    this.openAmount += ((this.opened ? 1 : 0) - this.openAmount) * damp(4, dt);
    this.lid.rotation.x = -this.openAmount * 1.9;
  }
}

export class WayLantern {
  readonly id: string;
  readonly object: THREE.Group;
  readonly position: THREE.Vector3;
  lit: boolean;
  readonly great: boolean;
  private readonly flame: THREE.Mesh;
  private readonly glow: THREE.Sprite;
  private readonly light: LightSource;
  private readonly flameY: number;

  constructor(id: string, physics: Physics, x: number, y: number, z: number, great: boolean, lit: boolean, lights: { add(source: LightSource): LightSource }) {
    this.id = id;
    this.great = great;
    this.lit = lit;
    const built = wayLanternMesh(great);
    this.object = built.group;
    this.flame = built.flame;
    this.glow = built.glow;
    this.object.position.set(x, y, z);
    this.position = new THREE.Vector3(x, y, z);
    const scale = great ? 2.6 : 1;
    this.flameY = y + 1.85 * scale;
    physics.world.createCollider(
      RAPIER.ColliderDesc.cylinder(1.1 * scale, 0.35 * scale)
        .setTranslation(x, y + 1.1 * scale, z)
        .setCollisionGroups(groupWorld),
    );
    this.light = lights.add({
      position: new THREE.Vector3(x, this.flameY, z),
      color: new THREE.Color(artPalette.lanternLight),
      intensity: great ? 30 : 6,
      distance: great ? 40 : 10,
      flicker: 0.4,
      enabled: lit,
    });
    this.applyLook();
  }

  kindle(): void {
    this.lit = true;
    this.applyLook();
  }

  private applyLook(): void {
    this.light.enabled = this.lit;
    this.flame.material = this.lit
      ? cachedMaterial("flame-lit", () => unlit({ color: artPalette.lanternCore }))
      : cachedMaterial(`flame-${this.great}`, () => unlit({ color: 0x5a6a8a }));
    (this.glow.material as THREE.SpriteMaterial).opacity = this.lit ? 0.7 : 0;
  }

  render(dt: number, context: PlayContext): void {
    this.flame.rotation.y += dt * 1.5;
    this.flame.scale.setScalar(this.lit ? 1 + Math.sin(context.time * 9) * 0.12 : 0.7);
    if (this.lit && Math.random() < dt * (this.great ? 30 : 6)) {
      context.glow.emit({ count: 1, position: new THREE.Vector3(this.position.x, this.flameY, this.position.z), spread: this.great ? 0.6 : 0.15, speed: 0.2, up: 1.2, life: 1, size: this.great ? 0.16 : 0.07, color: artPalette.ember });
    }
  }
}

// ---------------------------------------------------------------- pickups

export class Pickup {
  readonly kind: PickupKind;
  readonly object = new THREE.Group();
  readonly position: THREE.Vector3;
  private readonly velocity = new THREE.Vector3();
  private age = 0;
  collected = false;

  constructor(kind: PickupKind, at: THREE.Vector3, pop: boolean) {
    this.kind = kind;
    this.position = at.clone();
    if (pop) this.velocity.set((Math.random() - 0.5) * 2.5, 4.5, (Math.random() - 0.5) * 2.5);
    const tex = textures();
    if (kind === "oil") {
      const glass = cachedMaterial("oil-glass", () => lambert({ color: 0xffb347, emissive: 0x6a3a08, transparent: true, opacity: 0.85 }));
      this.object.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.24, 6), glass));
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 6), glass);
      neck.position.y = 0.17;
      this.object.add(neck);
      const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 6), cachedMaterial("cork", () => lambert({ map: tex.plank })));
      cork.position.y = 0.25;
      this.object.add(cork);
      this.object.add(glowSprite(artPalette.ember, 1, 0.4));
    } else {
      const scale = kind === "heartContainer" ? 1.8 : 1;
      const color = kind === "heartContainer" ? 0xff5a6a : 0xe5483f;
      const heart = cachedMaterial(`heart-${kind}`, () => lambert({ color, emissive: kind === "heartContainer" ? 0x601018 : 0x400808 }));
      for (const side of [-1, 1]) {
        const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.09 * scale, 6, 5), heart);
        lobe.position.set(side * 0.075 * scale, 0.05 * scale, 0);
        this.object.add(lobe);
      }
      const point = new THREE.Mesh(new THREE.ConeGeometry(0.155 * scale, 0.2 * scale, 6), heart);
      point.rotation.z = Math.PI;
      point.position.y = -0.07 * scale;
      this.object.add(point);
      if (kind === "heartContainer") {
        const frame = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 4, 10), cachedMaterial("gold", () => lambert({ map: tex.gold })));
        this.object.add(frame);
      }
      this.object.add(glowSprite(color, kind === "heartContainer" ? 2.2 : 1, 0.35));
    }
    this.object.position.copy(this.position);
  }

  /** Returns true the frame it's collected. */
  update(dt: number, context: PlayContext): boolean {
    if (this.collected) return false;
    this.age += dt;
    const floor = context.ground(this.position.x, this.position.z) + 0.45;
    this.velocity.y -= 14 * dt;
    this.position.addScaledVector(this.velocity, dt);
    if (this.position.y < floor) {
      this.position.y = floor;
      this.velocity.set(this.velocity.x * 0.5, Math.abs(this.velocity.y) > 1.5 ? -this.velocity.y * 0.35 : 0, this.velocity.z * 0.5);
    }
    const player = context.playerPosition();
    const toPlayer = new THREE.Vector3(player.x - this.position.x, player.y + 0.8 - this.position.y, player.z - this.position.z);
    const distance = toPlayer.length();
    if (this.age > 0.5 && distance < 2.6) this.position.addScaledVector(toPlayer.normalize(), dt * 9);
    this.object.position.copy(this.position);
    this.object.position.y += Math.sin(this.age * 3) * 0.06;
    this.object.rotation.y += dt * 2.2;
    if (this.age > 0.5 && distance < 0.8) {
      this.collected = true;
      this.object.removeFromParent();
      return true;
    }
    return false;
  }
}

// ---------------------------------------------------------------- NPCs

export class Npc {
  readonly placement: NpcPlacement;
  readonly rig: HumanoidRig;
  readonly position: THREE.Vector3;
  talking = false;
  private yaw: number;
  private time = Math.random() * 10;

  constructor(placement: NpcPlacement, physics: Physics, y: number) {
    this.placement = placement;
    this.rig = new HumanoidRig(placement.look === "elder" ? elderLook() : smithLook());
    this.position = new THREE.Vector3(placement.x, y, placement.z);
    this.yaw = placement.rot;
    this.rig.root.position.copy(this.position);
    this.rig.snapTo(villagerPose(0, false));
    physics.world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.35).setTranslation(placement.x, y + 0.85, placement.z).setCollisionGroups(groupWorld));
  }

  dialogue(flags: ReadonlySet<string>): DialogueDef {
    return this.placement.dialogue(flags);
  }

  render(dt: number, playerPosition: THREE.Vector3): void {
    this.time += dt;
    const distance = playerPosition.distanceTo(this.position);
    const target = distance < 5 ? yawTowards(this.position, playerPosition) : this.placement.rot;
    this.yaw += angleDelta(this.yaw, target) * damp(4, dt);
    this.rig.root.rotation.y = this.yaw;
    this.rig.blendTo(villagerPose(this.time, this.talking), 8, dt);
    this.rig.apply(dt, this.time, 0);
  }
}
