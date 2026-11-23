// One loaded area: terrain, static props + colliders, scattered foliage, the
// interactive pieces, foes, NPCs and ambient motes. Built from an AreaDef and torn
// down completely (physics world included) when the player leaves.
import * as THREE from "three";
import { textures } from "../engine/pixelTextures";
import { cachedMaterial, lambert, retroUniforms } from "../engine/retroMaterials";
import { makeRng, range } from "../engine/rng";
import type { LightPool } from "../engine/lightPool";
import { ParticleSystem } from "../engine/particles";
import type { AreaDef, ScatterDef } from "../game/content/areaTypes";
import { PuzzleTracker } from "../game/rules/puzzleLogic";
import { buildStaticProp } from "../world/props";
import { buildTerrain, makeGroundSampler, slopeAt } from "../world/terrain";
import { Foe, Warden, createFoe } from "./foes";
import { Brazier, Chest, Door, DynamicProp, Gate, Npc, Pickup, Plate, Shards, WayLantern } from "./interactables";
import { Physics } from "./physics";

export class AreaRuntime {
  readonly def: AreaDef;
  readonly root = new THREE.Group();
  readonly physics = new Physics();
  readonly ground: (x: number, z: number) => number;
  readonly dynamics: DynamicProp[] = [];
  readonly plates: Plate[] = [];
  readonly braziers: Brazier[] = [];
  readonly gates: Gate[] = [];
  readonly doors: Door[] = [];
  readonly chests: Chest[] = [];
  readonly lanterns: WayLantern[] = [];
  readonly foes: Foe[] = [];
  readonly npcs: Npc[] = [];
  readonly pickups: Pickup[] = [];
  readonly shards: Shards[] = [];
  readonly puzzles: PuzzleTracker;
  readonly motes: ParticleSystem;
  private readonly lights: LightPool;
  private readonly occupied: Array<[number, number, number]> = [];
  private moteTimer = 0;
  private spawnCount = 0;

  constructor(def: AreaDef, lights: LightPool, flags: ReadonlySet<string>) {
    this.def = def;
    this.lights = lights;
    this.ground = makeGroundSampler(def);
    const solved = def.puzzles.filter((puzzle) => flags.has(puzzle.setsFlag)).map((puzzle) => puzzle.id);
    this.puzzles = new PuzzleTracker(def.puzzles, solved);

    const terrain = buildTerrain(def);
    this.root.add(terrain.group);
    this.physics.addTrimesh(terrain.colliderVertices, terrain.colliderIndices);
    this.addBoundary();

    for (const placement of def.props) this.placeProp(placement, flags);
    for (const npc of def.npcs) {
      const built = new Npc(npc, this.physics, this.ground(npc.x, npc.z));
      this.npcs.push(built);
      this.root.add(built.rig.root);
      this.occupied.push([npc.x, npc.z, 1.5]);
    }
    for (const scatter of def.scatter) this.scatter(scatter);
    for (const foe of def.foes) {
      if (foe.kind === "warden" && flags.has("bossDefeated")) continue;
      this.addFoe(createFoe(foe.kind, foe.id, this.physics, foe.x, this.ground(foe.x, foe.z), foe.z));
    }

    this.motes = new ParticleSystem(260, true, retroUniforms.uSnap);
    this.root.add(this.motes.points);
  }

  addFoe(foe: Foe): void {
    this.foes.push(foe);
    this.root.add(foe.root);
  }

  spawnFoe(kind: "shade", x: number, z: number): void {
    this.spawnCount += 1;
    this.addFoe(createFoe(kind, `spawn${this.spawnCount}`, this.physics, x, this.ground(x, z), z));
  }

  get warden(): Warden | null {
    return (this.foes.find((foe) => foe instanceof Warden && !foe.removed) as Warden | undefined) ?? null;
  }

  /** Invisible walls around the area so nobody walks off the edge of the world. */
  private addBoundary(): void {
    const half = this.def.size / 2 - 1;
    for (const [x, z, hx, hz] of [
      [0, -half, half, 0.5],
      [0, half, half, 0.5],
      [-half, 0, 0.5, half],
      [half, 0, 0.5, half],
    ]) {
      this.physics.addStatic({ shape: "box", hx, hy: 30, hz, x: 0, y: 0, z: 0, rotY: 0 }, x, 0, z, 0);
    }
  }

  private placeProp(placement: AreaDef["props"][number], flags: ReadonlySet<string>): void {
    const { kind, x, z } = placement;
    const rot = placement.rot ?? 0;
    const y = this.ground(x, z) + (placement.raise ?? 0);
    const id = placement.id ?? `${kind}@${x},${z}`;
    switch (kind) {
      case "crate":
      case "barrel":
      case "pot": {
        const prop = new DynamicProp(kind, this.physics, x, y, z, rot, placement.contents);
        this.dynamics.push(prop);
        this.root.add(prop.object);
        prop.sync();
        break;
      }
      case "plate": {
        const plate = new Plate(id, x, y, z);
        this.plates.push(plate);
        this.root.add(plate.object);
        break;
      }
      case "brazier": {
        const brazier = new Brazier(id, x, y, z, placement.variant === "lit", { lights: this.lights });
        if (this.puzzles.isActive(id)) brazier.setLit(true, null);
        this.braziers.push(brazier);
        this.root.add(brazier.object);
        this.physics.addStatic({ shape: "cylinder", radius: 0.45, halfHeight: 0.6, x: 0, y: 0.6, z: 0 }, x, y, z, 0);
        break;
      }
      case "gate": {
        const gate = new Gate(id, this.physics, x, y, z, rot, placement.length ?? 6, placement.flag, placement.closedWhile, this.gateOpen(placement.flag, placement.closedWhile, flags), placement.lockedText);
        this.gates.push(gate);
        this.root.add(gate.object);
        break;
      }
      case "chest": {
        const chest = new Chest(id, this.physics, x, y, z, rot, placement.contents ?? "heart", flags.has(`opened:${id}`));
        this.chests.push(chest);
        this.root.add(chest.object);
        break;
      }
      case "wayLantern":
      case "greatLantern": {
        const great = kind === "greatLantern";
        const lit = great ? flags.has(placement.flag ?? "bossDefeated") : flags.has(`lit:${id}`);
        const lantern = new WayLantern(id, this.physics, x, y, z, great, lit, this.lights);
        this.lanterns.push(lantern);
        this.root.add(lantern.object);
        break;
      }
      default: {
        const enterable = Boolean(placement.enterable);
        const built = buildStaticProp(kind, Math.floor((x * 73 + z * 31) * 10), placement.scale ?? 1, placement.variant, placement.length, enterable);
        if (!built) return;
        if (built.door) {
          const door = new Door(id, this.physics, built.door, new THREE.Vector3(x, y, z), rot, enterable, placement.lockedText ?? "It's locked.", flags.has(`opened:${id}`));
          this.doors.push(door);
        }
        built.object.position.set(x, y, z);
        built.object.rotation.y = rot;
        this.root.add(built.object);
        for (const collider of built.colliders) this.physics.addStatic(collider, x, y, z, rot);
        for (const light of built.lights) {
          const cos = Math.cos(rot);
          const sin = Math.sin(rot);
          this.lights.add({
            position: new THREE.Vector3(x + light.x * cos + light.z * sin, y + light.y, z - light.x * sin + light.z * cos),
            color: new THREE.Color(light.color),
            intensity: light.intensity,
            distance: light.distance,
            flicker: light.flicker,
            enabled: true,
          });
        }
      }
    }
    const footprint = kind === "cottage" ? 6 : kind === "pond" ? (placement.length ?? 5) + 1 : kind === "gate" ? (placement.length ?? 6) / 2 + 1.5 : 1.6;
    this.occupied.push([x, z, footprint]);
  }

  private gateOpen(flag: string | undefined, closedWhile: string | undefined, flags: ReadonlySet<string>): boolean {
    if (closedWhile) return !flags.has(closedWhile);
    return flag ? flags.has(flag) : true;
  }

  private isFree(x: number, z: number, spacing: number): boolean {
    return !this.occupied.some(([ox, oz, radius]) => Math.hypot(x - ox, z - oz) < radius + spacing * 0.5);
  }

  private scatter(def: ScatterDef): void {
    const rng = makeRng(def.seed);
    const half = this.def.size / 2 - 2;
    const isGrass = def.kind === "grass" || def.kind === "flowers";
    const placed: Array<{ x: number; z: number; y: number; scale: number; rot: number }> = [];
    const spacing = def.spacing ?? 0;
    let attempts = 0;
    while (placed.length < def.count && attempts < def.count * 25) {
      attempts += 1;
      const x = range(rng, -half, half);
      const z = range(rng, -half, half);
      const y = this.ground(x, z);
      if (!def.where(x, z, y, slopeAt(this.def, x, z))) continue;
      if (!isGrass) {
        if (!this.isFree(x, z, Math.max(1.2, spacing))) continue;
        if (spacing > 0 && placed.some((other) => Math.hypot(other.x - x, other.z - z) < spacing)) continue;
      } else if (!this.isFree(x, z, 0)) {
        continue;
      }
      placed.push({ x, z, y, scale: range(rng, def.scaleMin ?? 0.85, def.scaleMax ?? 1.25), rot: rng() * Math.PI * 2 });
    }
    if (isGrass) {
      this.instanceTufts(placed, def.kind === "flowers" ? "flowers" : this.def.mood === "village" ? "grass" : "forest");
      return;
    }
    placed.forEach((item, index) => {
      const built = buildStaticProp(def.kind, def.seed * 1000 + index, item.scale);
      if (!built) return;
      built.object.position.set(item.x, item.y - 0.05, item.z);
      built.object.rotation.y = item.rot;
      this.root.add(built.object);
      for (const collider of built.colliders) this.physics.addStatic(collider, item.x, item.y, item.z, item.rot);
      this.occupied.push([item.x, item.z, 0.8 * item.scale]);
    });
  }

  /** Grass and flowers: one instanced draw of crossed alpha-cut quads that sway in the wind. */
  private instanceTufts(items: Array<{ x: number; z: number; y: number; scale: number; rot: number }>, kind: "grass" | "flowers" | "forest"): void {
    if (items.length === 0) return;
    const tex = textures();
    const map = kind === "flowers" ? tex.flowerTuft : kind === "forest" ? tex.forestTuft : tex.grassTuft;
    // Single-sided material: each card is duplicated with reversed winding instead of
    // DoubleSide, so both faces keep the "up" normal and light like the ground.
    const material = cachedMaterial(`tuft-${kind}`, () => lambert({ map, alphaTest: 0.5 }, { wind: 0.06 }));
    const quadA = new THREE.PlaneGeometry(0.9, 0.55).translate(0, 0.27, 0);
    const quadB = quadA.clone().rotateY(Math.PI / 2);
    const geometry = new THREE.BufferGeometry();
    const positions = [...quadA.getAttribute("position").array, ...quadB.getAttribute("position").array];
    const uvs = [...quadA.getAttribute("uv").array, ...quadB.getAttribute("uv").array];
    const normals = new Array((positions.length / 3) * 3).fill(0).map((_, index) => (index % 3 === 1 ? 1 : 0));
    const indexA = Array.from(quadA.getIndex()!.array);
    const reversed: number[] = [];
    for (let index = 0; index < indexA.length; index += 3) reversed.push(indexA[index], indexA[index + 2], indexA[index + 1]);
    const indices = [...indexA, ...reversed, ...indexA.map((value) => value + 4), ...reversed.map((value) => value + 4)];
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geometry.setIndex(indices);
    const instanced = new THREE.InstancedMesh(geometry, material, items.length);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();
    items.forEach((item, index) => {
      quaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, item.rot);
      scale.set(item.scale, item.scale * (kind === "flowers" ? 1 : 0.9 + (index % 5) * 0.08), item.scale);
      matrix.compose(position.set(item.x, item.y - 0.03, item.z), quaternion, scale);
      instanced.setMatrixAt(index, matrix);
    });
    instanced.computeBoundingSphere();
    this.root.add(instanced);
  }

  /** Ambient fireflies / embers / spirits drifting around the player. */
  updateMotes(dt: number, focus: THREE.Vector3): void {
    this.moteTimer += dt;
    const kind = this.def.motes;
    const rate = kind === "fireflies" ? 0.08 : kind === "embers" ? 0.05 : 0.07;
    while (this.moteTimer > rate) {
      this.moteTimer -= rate;
      const angle = Math.random() * Math.PI * 2;
      const distance = 3 + Math.random() * 16;
      const x = focus.x + Math.cos(angle) * distance;
      const z = focus.z + Math.sin(angle) * distance;
      const y = this.ground(x, z) + 0.4 + Math.random() * (kind === "embers" ? 0.5 : 2.5);
      const color = kind === "fireflies" ? 0xd8ff7a : kind === "embers" ? 0xffa040 : 0xa890ff;
      this.motes.emit({ count: 1, position: new THREE.Vector3(x, y, z), spread: 0, speed: 0.35, up: kind === "embers" ? 0.6 : 0.1, drag: 0.2, life: 3 + Math.random() * 2, size: 0.07, color });
    }
    this.motes.update(dt);
  }

  dispose(): void {
    for (const foe of this.foes) foe.dispose();
    for (const shards of this.shards) shards.dispose();
    this.root.removeFromParent();
    this.root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      // Materials are cached and shared between areas; only free per-area geometry.
      if (mesh.isMesh && mesh.geometry) mesh.geometry.dispose();
    });
    this.lights.clear();
    this.physics.free();
  }
}
