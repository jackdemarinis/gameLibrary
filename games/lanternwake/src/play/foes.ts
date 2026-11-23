// Foes: physics-driven bodies (knockback is a real impulse) with simple, readable
// attack patterns: telegraph -> strike -> recover. The lantern flare stuns them.
import * as THREE from "three";
import { clamp, damp } from "../engine/rng";
import { angleDelta, applyDamage, yawTowards } from "../game/rules/combat";
import type { FoeKind } from "../game/content/areaTypes";
import { HuskRig, ShadeRig, type FoeAnimState } from "../world/foeRigs";
import { HumanoidRig, restPose, wardenLook, keyframePose, type Pose } from "../world/humanoidRig";
import { deathPose, idlePose, locomotionPose } from "../world/rigAnimations";
import { glowSprite } from "../world/props";
import { artPalette } from "../world/artPalette";
import type { LightSource } from "../engine/lightPool";
import type { Hittable, PlayContext } from "./context";
import { RAPIER, groupFoe, type Physics } from "./physics";

export abstract class Foe implements Hittable {
  abstract readonly kind: FoeKind;
  abstract readonly radius: number;
  readonly id: string;
  readonly root = new THREE.Group();
  hp: number;
  readonly maxHp: number;
  state: FoeAnimState = "idle";
  stateTime = 0;
  yaw = 0;
  removed = false;
  protected deathTimer = 0;
  protected readonly home: THREE.Vector3;
  protected body: RAPIER.RigidBody;
  protected readonly pos = new THREE.Vector3();
  protected readonly physics: Physics;
  protected stunMultiplier = 1;

  constructor(id: string, physics: Physics, x: number, y: number, z: number, hp: number, collider: RAPIER.ColliderDesc, options: { gravity: number; mass: number }) {
    this.id = id;
    this.physics = physics;
    this.hp = hp;
    this.maxHp = hp;
    this.home = new THREE.Vector3(x, y, z);
    this.body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .lockRotations()
        .setGravityScale(options.gravity)
        .setLinearDamping(options.gravity === 0 ? 3 : 1.5)
        .setCcdEnabled(true),
    );
    // Frictionless against the floor: movement comes from steering + damping, and
    // ground friction on a heavy body would otherwise cancel the steering outright.
    physics.world.createCollider(
      collider.setCollisionGroups(groupFoe).setMass(options.mass).setFriction(0).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min),
      this.body,
    );
    this.pos.set(x, y, z);
  }

  get alive(): boolean {
    return this.state !== "dying" && !this.removed;
  }

  position(): THREE.Vector3 {
    return this.pos;
  }

  protected enter(state: FoeAnimState): void {
    this.state = state;
    this.stateTime = 0;
  }

  takeHit(damage: number, from: THREE.Vector3, knock: number): boolean {
    if (!this.alive) return false;
    this.hp = applyDamage(this.hp, damage * this.stunMultiplier);
    const away = new THREE.Vector3().subVectors(this.pos, from).setY(0).normalize();
    const mass = this.body.mass();
    this.body.applyImpulse({ x: away.x * knock * mass * this.knockScale(), y: knock * mass * 0.15 * this.knockScale(), z: away.z * knock * mass * this.knockScale() }, true);
    this.onHurt();
    return true;
  }

  protected knockScale(): number {
    return 1;
  }

  protected onHurt(): void {
    if (this.hp <= 0) {
      this.enter("dying");
      return;
    }
    if (this.state !== "stunned") this.enter("hurt");
  }

  /** Steer by blending the body's horizontal velocity toward a target. */
  protected steer(targetX: number, targetZ: number, rate: number, dt: number): void {
    const velocity = this.body.linvel();
    const t = damp(rate, dt);
    this.body.setLinvel({ x: velocity.x + (targetX - velocity.x) * t, y: velocity.y, z: velocity.z + (targetZ - velocity.z) * t }, true);
  }

  protected faceTowards(target: THREE.Vector3, rate: number, dt: number): void {
    this.yaw += angleDelta(this.yaw, yawTowards(this.pos, target)) * damp(rate, dt);
  }

  step(dt: number, context: PlayContext): void {
    if (this.removed) return;
    const translation = this.body.translation();
    this.pos.set(translation.x, translation.y - this.centreOffset(), translation.z);
    this.stateTime += dt;
    if (this.state === "dying") {
      this.deathTimer += dt;
      this.steer(0, 0, 4, dt);
      if (this.deathTimer > this.deathDuration()) this.remove(context);
      return;
    }
    this.think(dt, context);
  }

  protected deathDuration(): number {
    return 0.9;
  }

  protected abstract centreOffset(): number;
  protected abstract think(dt: number, context: PlayContext): void;
  abstract render(dt: number, time: number, context: PlayContext): void;

  onFlare?(distance: number, context: PlayContext): void;

  protected remove(context: PlayContext): void {
    this.removed = true;
    this.physics.world.removeRigidBody(this.body);
    this.root.removeFromParent();
    context.onFoeDefeated(this.kind, this.pos.clone());
  }

  dispose(): void {
    this.root.removeFromParent();
  }
}

/** How many foes are mid-attack right now (packs take turns instead of dog-piling). */
function attackersNear(context: PlayContext): number {
  let count = 0;
  for (const target of context.hittables()) if (target instanceof Foe && (target.state === "windup" || target.state === "strike")) count += 1;
  return count;
}

// ---------------------------------------------------------------- Shade

export class Shade extends Foe {
  readonly kind = "shade" as const;
  readonly radius = 0.45;
  private readonly rig = new ShadeRig();
  private readonly lungeDir = new THREE.Vector3();
  private hitPlayer = false;
  private cooldown = 0;
  private wanderPhase = Math.random() * 10;

  constructor(id: string, physics: Physics, x: number, y: number, z: number) {
    super(id, physics, x, y + 1, z, 6, RAPIER.ColliderDesc.ball(0.45), { gravity: 0, mass: 3 });
    this.root.add(this.rig.root);
  }

  protected centreOffset(): number {
    return 1;
  }

  protected think(dt: number, context: PlayContext): void {
    const player = context.playerPosition();
    const toPlayer = new THREE.Vector3().subVectors(player, this.pos).setY(0);
    const distance = toPlayer.length();
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.stunMultiplier = this.state === "stunned" ? 2 : 1;
    // Hover at a fixed height over the ground.
    const hover = context.ground(this.pos.x, this.pos.z) + (this.state === "stunned" ? 0.4 : 1);
    const velocity = this.body.linvel();
    this.body.setLinvel({ x: velocity.x, y: (hover - this.pos.y) * 4, z: velocity.z }, true);

    switch (this.state) {
      case "idle": {
        this.wanderPhase += dt * 0.4;
        const wanderX = this.home.x + Math.cos(this.wanderPhase) * 2.5 - this.pos.x;
        const wanderZ = this.home.z + Math.sin(this.wanderPhase * 1.3) * 2.5 - this.pos.z;
        this.steer(wanderX * 0.8, wanderZ * 0.8, 2, dt);
        this.yaw += angleDelta(this.yaw, Math.atan2(wanderX, wanderZ)) * damp(2, dt);
        if (distance < 13) {
          this.enter("chase");
          context.play("shadeCry");
        }
        break;
      }
      case "chase": {
        this.faceTowards(player, 6, dt);
        const desired = distance > 3.2 ? 3.6 : distance < 2.2 ? -1.5 : 0;
        toPlayer.normalize();
        // Circle a little while closing in.
        const orbit = Math.sin(context.time * 0.9 + this.wanderPhase) * 1.6;
        this.steer(toPlayer.x * desired - toPlayer.z * orbit, toPlayer.z * desired + toPlayer.x * orbit, 3, dt);
        if (distance < 4.2 && this.cooldown <= 0 && attackersNear(context) < 2) this.enter("windup");
        if (distance > 22) this.enter("idle");
        break;
      }
      case "windup":
        this.faceTowards(player, 10, dt);
        this.steer(-toPlayer.x * 0.4, -toPlayer.z * 0.4, 4, dt);
        if (this.stateTime > 0.65) {
          this.lungeDir.copy(toPlayer).normalize();
          this.hitPlayer = false;
          this.enter("strike");
        }
        break;
      case "strike":
        this.steer(this.lungeDir.x * 11, this.lungeDir.z * 11, 20, dt);
        if (!this.hitPlayer && distance < 1.2 && !context.playerInvulnerable()) {
          this.hitPlayer = true;
          context.damagePlayer(1, this.pos, 6);
        }
        if (this.stateTime > 0.38) {
          this.cooldown = 1.4 + Math.random();
          this.enter("recover");
        }
        break;
      case "recover":
        this.steer(0, 0, 3, dt);
        if (this.stateTime > 0.8) this.enter("chase");
        break;
      case "hurt":
        if (this.stateTime > 0.4) this.enter("chase");
        break;
      case "stunned":
        this.steer(0, 0, 3, dt);
        if (this.stateTime > 3.2) this.enter("chase");
        break;
    }
  }

  onFlare(distance: number, context: PlayContext): void {
    if (!this.alive || distance > 8) return;
    this.hp = applyDamage(this.hp, 2);
    if (this.hp <= 0) {
      this.enter("dying");
      return;
    }
    this.enter("stunned");
    context.glow.emit({ count: 12, position: this.pos.clone().setY(this.pos.y + 1.5), spread: 0.4, speed: 1.5, up: 1, life: 0.8, size: 0.08, color: artPalette.shadeEye });
  }

  render(dt: number, time: number, context: PlayContext): void {
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
    const progress = this.state === "windup" ? clamp(this.stateTime / 0.65, 0, 1) : 0;
    this.rig.update(dt, time, this.state, progress);
    if (Math.random() < dt * 14) {
      context.dust.emit({ count: 1, position: this.pos.clone().setY(this.pos.y + 0.5), spread: 0.4, speed: 0.2, up: -0.3, drag: 1, life: 1.2, size: 0.12, color: 0x120a1e });
    }
    if (this.state === "dying") {
      const fade = clamp(this.deathTimer / this.deathDuration(), 0, 1);
      this.root.scale.set(1 + fade * 0.6, 1 - fade * 0.9, 1 + fade * 0.6);
      if (Math.random() < 0.6) context.glow.emit({ count: 3, position: this.pos.clone().setY(this.pos.y + 1.2), spread: 0.5, speed: 1, up: 2, life: 0.8, size: 0.09, color: 0x9a80ff });
    }
  }
}

// ---------------------------------------------------------------- Husk

export class Husk extends Foe {
  readonly kind = "husk" as const;
  readonly radius = 0.7;
  private readonly rig = new HuskRig();
  private hitDone = false;
  private speed = 0;

  constructor(id: string, physics: Physics, x: number, y: number, z: number) {
    super(id, physics, x, y + 1.1, z, 14, RAPIER.ColliderDesc.capsule(0.45, 0.6), { gravity: 1, mass: 140 });
    this.root.add(this.rig.root);
    this.root.scale.setScalar(1.15);
  }

  protected centreOffset(): number {
    return 1.05;
  }

  protected knockScale(): number {
    return this.state === "windup" ? 0.15 : 0.45;
  }

  protected onHurt(): void {
    if (this.hp <= 0) {
      this.enter("dying");
      return;
    }
    // Husks shrug off hits mid-windup (super armour) but flinch otherwise.
    if (this.state !== "windup" && this.state !== "strike") this.enter("hurt");
  }

  protected think(dt: number, context: PlayContext): void {
    const player = context.playerPosition();
    const toPlayer = new THREE.Vector3().subVectors(player, this.pos).setY(0);
    const distance = toPlayer.length();
    toPlayer.normalize();
    this.stunMultiplier = this.state === "recover" || this.state === "stunned" ? 1.5 : 1;
    const velocity = this.body.linvel();
    this.speed = Math.hypot(velocity.x, velocity.z);
    switch (this.state) {
      case "idle":
        this.steer(0, 0, 4, dt);
        if (distance < 12) this.enter("chase");
        break;
      case "chase":
        this.faceTowards(player, 4, dt);
        this.steer(Math.sin(this.yaw) * 2.3, Math.cos(this.yaw) * 2.3, 4, dt);
        if (distance < 2.8) this.enter("windup");
        if (distance > 24) this.enter("idle");
        break;
      case "windup":
        this.faceTowards(player, 2.5, dt);
        this.steer(0, 0, 8, dt);
        if (this.stateTime > 0.95) {
          this.hitDone = false;
          this.enter("strike");
        }
        break;
      case "strike":
        this.steer(Math.sin(this.yaw) * 3, Math.cos(this.yaw) * 3, 10, dt);
        if (!this.hitDone && this.stateTime > 0.1) {
          this.hitDone = true;
          context.play("slam");
          context.shake(0.45);
          const impact = this.pos.clone().add(new THREE.Vector3(Math.sin(this.yaw) * 1.6, 0.1, Math.cos(this.yaw) * 1.6));
          context.dust.emit({ count: 26, position: impact, spread: 0.8, speed: 3.5, up: 2, gravity: 8, life: 0.8, size: 0.14, color: 0x5d4a38 });
          context.glow.emit({ count: 10, position: impact, spread: 0.5, speed: 3, up: 3, gravity: 9, life: 0.5, size: 0.07, color: artPalette.huskCore });
          const reachDistance = player.distanceTo(impact);
          if (reachDistance < 1.9 && !context.playerInvulnerable()) context.damagePlayer(2, impact, 8);
        }
        if (this.stateTime > 0.3) this.enter("recover");
        break;
      case "recover":
        this.steer(0, 0, 6, dt);
        if (this.stateTime > 1.3) this.enter("chase");
        break;
      case "hurt":
        if (this.stateTime > 0.35) this.enter("chase");
        break;
      case "stunned":
        this.steer(0, 0, 6, dt);
        if (this.stateTime > 2) this.enter("chase");
        break;
    }
  }

  onFlare(distance: number, context: PlayContext): void {
    if (!this.alive || distance > 6) return;
    this.hp = applyDamage(this.hp, 1);
    if (this.hp <= 0) this.enter("dying");
    else if (this.state !== "strike") this.enter("stunned");
    void context;
  }

  protected deathDuration(): number {
    return 1.2;
  }

  render(dt: number, time: number, context: PlayContext): void {
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
    const progress = this.state === "windup" ? clamp(this.stateTime / 0.95, 0, 1) : 0;
    this.rig.update(dt, time, this.state === "dying" ? "stunned" : this.state, progress, this.speed);
    if (this.state === "dying") {
      const fade = clamp(this.deathTimer / this.deathDuration(), 0, 1);
      this.root.rotation.x = fade * 1.3;
      this.root.position.y -= fade * 0.6;
      if (Math.random() < 0.5) context.glow.emit({ count: 2, position: this.pos.clone().setY(this.pos.y + 1), spread: 0.6, speed: 1, up: 1.5, life: 0.7, size: 0.08, color: artPalette.huskCore });
    }
  }
}

// ---------------------------------------------------------------- Warden (boss)

type WardenMove = "sweep" | "slam";

export class Warden extends Foe {
  readonly kind = "warden" as const;
  readonly radius = 1.2;
  readonly rig = new HumanoidRig(wardenLook(), 2.1);
  private move: WardenMove = "sweep";
  private moveCount = 0;
  private hitDone = false;
  private speed = 0;
  private phaseTwo = false;
  private roaring = 0;
  private readonly rings: Array<{ mesh: THREE.Mesh; age: number; centre: THREE.Vector3; hit: boolean }> = [];
  private readonly coreGlow: THREE.Sprite;
  private animTime = 0;
  private coreLight: LightSource | null = null;
  active = false;

  constructor(id: string, physics: Physics, x: number, y: number, z: number) {
    super(id, physics, x, y + 1.9, z, 80, RAPIER.ColliderDesc.capsule(1.0, 0.8), { gravity: 1, mass: 900 });
    this.root.add(this.rig.root);
    this.coreGlow = glowSprite(artPalette.wardenCore, 1.6, 0.6);
    this.coreGlow.material = this.coreGlow.material.clone();
    this.rig.core?.add(this.coreGlow);
    this.yaw = -Math.PI / 2;
  }

  protected centreOffset(): number {
    return 1.8;
  }

  protected knockScale(): number {
    return this.state === "stunned" ? 0.04 : 0.015;
  }

  protected onHurt(): void {
    if (this.hp <= 0) {
      this.enter("dying");
      return;
    }
  }

  protected deathDuration(): number {
    return 3.2;
  }

  takeHit(damage: number, from: THREE.Vector3, knock: number): boolean {
    if (!this.active) return false;
    // The armour turns most of a blow unless the core is exposed (stunned or recovering).
    this.stunMultiplier = this.state === "stunned" ? 2.5 : this.state === "recover" ? 1.4 : 0.6;
    return super.takeHit(damage, from, knock);
  }

  protected think(dt: number, context: PlayContext): void {
    this.updateRings(dt, context);
    if (!this.active) {
      this.steer(0, 0, 6, dt);
      return;
    }
    const player = context.playerPosition();
    const toPlayer = new THREE.Vector3().subVectors(player, this.pos).setY(0);
    const distance = toPlayer.length();
    const velocity = this.body.linvel();
    this.speed = Math.hypot(velocity.x, velocity.z);
    if (!this.phaseTwo && this.hp < this.maxHp / 2) {
      this.phaseTwo = true;
      this.roaring = 1.6;
      context.play("bossRoar");
      context.shake(0.8);
      context.banner("The Warden rages", "its blade burns violet");
      context.spawnFoe("shade", this.pos.x + 5, this.pos.z + 5);
      context.spawnFoe("shade", this.pos.x + 5, this.pos.z - 5);
    }
    if (this.roaring > 0) {
      this.roaring -= dt;
      this.steer(0, 0, 8, dt);
      return;
    }
    const tempo = this.phaseTwo ? 0.8 : 1;
    switch (this.state) {
      case "idle":
      case "chase":
      case "hurt":
        if (this.state !== "chase") this.enter("chase");
        this.faceTowards(player, 3, dt);
        this.steer(Math.sin(this.yaw) * (this.phaseTwo ? 3.2 : 2.6), Math.cos(this.yaw) * (this.phaseTwo ? 3.2 : 2.6), 3, dt);
        if (distance < (this.move === "slam" ? 4.2 : 4.6) && this.stateTime > 0.4) {
          this.hitDone = false;
          this.enter("windup");
          context.play("shadeCry");
        }
        break;
      case "windup":
        this.faceTowards(player, this.move === "slam" ? 3 : 1.6, dt);
        this.steer(0, 0, 8, dt);
        if (this.stateTime > (this.move === "slam" ? 1.15 : 0.95) * tempo) this.enter("strike");
        break;
      case "strike": {
        const strikeTime = this.move === "slam" ? 0.25 : 0.42;
        this.steer(Math.sin(this.yaw) * 4, Math.cos(this.yaw) * 4, 6, dt);
        if (!this.hitDone && this.stateTime > strikeTime * 0.5) {
          this.hitDone = true;
          if (this.move === "sweep") {
            context.play("swing");
            const facing = Math.abs(angleDelta(this.yaw, yawTowards(this.pos, player)));
            if (distance < 5.2 && facing < 1.9 && !context.playerInvulnerable()) context.damagePlayer(2, this.pos, 10);
          } else {
            context.play("slam");
            context.shake(1);
            const impact = this.pos.clone().add(new THREE.Vector3(Math.sin(this.yaw) * 3, 0.1, Math.cos(this.yaw) * 3));
            context.dust.emit({ count: 40, position: impact, spread: 1, speed: 5, up: 3, gravity: 9, life: 1, size: 0.18, color: 0x3a3048 });
            context.glow.emit({ count: 30, position: impact, spread: 0.6, speed: 6, up: 3, gravity: 6, life: 0.7, size: 0.1, color: artPalette.wardenCore });
            if (player.distanceTo(impact) < 2.6 && !context.playerInvulnerable()) context.damagePlayer(3, impact, 12);
            this.spawnRing(impact, context);
            if (this.phaseTwo) window.setTimeout(() => this.alive && this.spawnRing(impact, context), 450);
          }
        }
        if (this.stateTime > strikeTime) {
          this.moveCount += 1;
          const wasSlam = this.move === "slam";
          this.move = this.moveCount % (this.phaseTwo ? 2 : 3) === 0 ? "slam" : "sweep";
          this.enter(wasSlam ? "recover" : "chase");
        }
        break;
      }
      case "recover":
        // Blade stuck in the floor: the opening.
        this.steer(0, 0, 8, dt);
        if (this.stateTime > 2.2 * tempo) this.enter("chase");
        break;
      case "stunned":
        this.steer(0, 0, 8, dt);
        if (this.stateTime > 3.4) this.enter("chase");
        break;
    }
  }

  private spawnRing(centre: THREE.Vector3, context: PlayContext): void {
    const geometry = new THREE.RingGeometry(0.85, 1, 32).rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({ color: artPalette.wardenCore, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(centre).setY(context.ground(centre.x, centre.z) + 0.15);
    context.fxRoot.add(mesh);
    this.rings.push({ mesh, age: 0, centre: centre.clone(), hit: false });
  }

  private updateRings(dt: number, context: PlayContext): void {
    for (const ring of this.rings) {
      ring.age += dt;
      const radius = 0.5 + ring.age * 9;
      ring.mesh.scale.setScalar(radius);
      (ring.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.85 - ring.age * 0.9);
      const playerDistance = context.playerPosition().distanceTo(ring.centre);
      const playerHeight = context.playerPosition().y - context.ground(ring.centre.x, ring.centre.z);
      if (!ring.hit && Math.abs(playerDistance - radius) < 0.6 && playerHeight < 0.6 && !context.playerInvulnerable()) {
        ring.hit = true;
        context.damagePlayer(2, ring.centre, 7);
      }
    }
    for (let index = this.rings.length - 1; index >= 0; index -= 1) {
      if (this.rings[index].age > 0.9) {
        this.rings[index].mesh.removeFromParent();
        this.rings[index].mesh.geometry.dispose();
        this.rings.splice(index, 1);
      }
    }
  }

  onFlare(distance: number, context: PlayContext): void {
    if (!this.alive || !this.active || distance > 9 || this.state === "strike") return;
    this.enter("stunned");
    context.play("bossRoar");
    context.toast("The Warden reels! Its core is exposed.");
  }

  get bossProgress(): number {
    return this.hp / this.maxHp;
  }

  render(dt: number, time: number, context: PlayContext): void {
    this.animTime += dt;
    if (!this.coreLight) {
      this.coreLight = context.lights.add({ position: new THREE.Vector3(), color: new THREE.Color(artPalette.wardenCore), intensity: 10, distance: 13, flicker: 0.3, enabled: true });
    }
    this.coreLight.position.set(this.pos.x, this.pos.y + 3.4, this.pos.z);
    const exposedNow = this.state === "stunned" || this.state === "recover";
    this.coreLight.intensity = this.state === "dying" ? Math.max(0, 14 - this.deathTimer * 5) : exposedNow ? 16 : this.state === "windup" ? 12 : 8;
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
    const pose = this.targetPose(time);
    this.rig.blendTo(pose, this.state === "strike" ? 26 : 9, dt);
    this.rig.apply(dt, time, Math.min(1, this.speed / 3));
    const exposed = this.state === "stunned" || this.state === "recover";
    (this.coreGlow.material as THREE.SpriteMaterial).opacity = exposed ? 0.9 + Math.sin(time * 18) * 0.1 : 0.35;
    this.coreGlow.scale.setScalar(exposed ? 2.6 : 1.4);
    if (this.state === "windup" && Math.random() < 0.5) {
      const blade = this.rig.held;
      if (blade) context.glow.emit({ count: 1, position: blade.localToWorld(new THREE.Vector3(0, -1.2, 0)), spread: 0.3, speed: 0.4, up: 0.5, life: 0.6, size: 0.12, color: artPalette.wardenCore });
    }
    if (this.state === "dying" && Math.random() < 0.8) {
      context.glow.emit({ count: 4, position: this.pos.clone().setY(this.pos.y + 2 + Math.random() * 2), spread: 1.2, speed: 1.5, up: 2.5, life: 1.2, size: 0.12, color: artPalette.wardenCore });
    }
  }

  private targetPose(time: number): Pose {
    const base = restPose();
    if (this.state === "dying") return deathPose(clamp(this.deathTimer / 2.4, 0, 1));
    if (this.roaring > 0) {
      return { ...base, spineX: -0.35, neckX: -0.5, shoulderLX: -0.6, shoulderLZ: 1.2, shoulderRX: -0.4, shoulderRZ: -1.2, elbowLX: -0.6, elbowRX: -0.6, wristRX: -0.4 };
    }
    switch (this.state) {
      case "windup":
        return this.move === "slam"
          ? { ...base, shoulderRX: -3.0, shoulderLX: -2.6, elbowRX: -0.4, elbowLX: -0.9, wristRX: 0.2, spineX: -0.25, bodyY: base.bodyY + 0.05 }
          : { ...base, shoulderRX: -1.3, shoulderRY: -1.8, wristRX: -0.3, spineY: -0.7, hipLX: -0.3, kneeLX: 0.3, bodyY: base.bodyY - 0.06 };
      case "strike":
        return this.move === "slam"
          ? { ...base, shoulderRX: -0.9, shoulderLX: -0.9, elbowLX: -0.6, wristRX: -0.2, spineX: 0.6, bodyY: base.bodyY - 0.18, kneeLX: 0.6, kneeRX: 0.6, hipLX: -0.4 }
          : { ...base, shoulderRX: -1.4, shoulderRY: 1.3, wristRX: -0.2, spineY: 0.6, hipLX: -0.3, kneeLX: 0.3, capeLift: 0.8 };
      case "recover":
        return { ...base, shoulderRX: -0.95, shoulderLX: -0.95, elbowLX: -0.6, wristRX: -0.25, spineX: 0.55, neckX: -0.2, bodyY: base.bodyY - 0.16, kneeLX: 0.6, kneeRX: 0.6, hipLX: -0.4, capeLift: 0.3 };
      case "stunned":
        return keyframePose(
          base,
          [
            [0, { spineX: -0.4, neckX: -0.6, shoulderLZ: 1, shoulderRZ: -1 }],
            [1, { spineX: 0.5 + Math.sin(time * 3) * 0.05, neckX: 0.4, bodyY: base.bodyY - 0.2, kneeLX: 0.7, kneeRX: 0.7, hipLX: -0.5, shoulderRX: -0.2, wristRX: -0.5 }],
          ],
          clamp(this.stateTime * 2, 0, 1),
        );
      default:
        if (this.speed > 0.4) return locomotionPose(this.animTime * 5.5, 0.1, true);
        return idlePose(time);
    }
  }

  dispose(): void {
    for (const ring of this.rings) ring.mesh.removeFromParent();
    this.rings.length = 0;
    super.dispose();
  }
}

export function createFoe(kind: FoeKind, id: string, physics: Physics, x: number, y: number, z: number): Foe {
  if (kind === "shade") return new Shade(id, physics, x, y, z);
  if (kind === "husk") return new Husk(id, physics, x, y, z);
  return new Warden(id, physics, x, y, z);
}
