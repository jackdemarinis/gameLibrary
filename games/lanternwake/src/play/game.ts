// The game: owns the renderer, scene, player, camera and HUD, loads areas, and runs
// the state machine (title -> playing <-> paused/dialogue/transition -> dead/victory).
import * as THREE from "three";
import { Input, type Action } from "../engine/input";
import { LightPool } from "../engine/lightPool";
import { ParticleSystem } from "../engine/particles";
import { textures } from "../engine/pixelTextures";
import { retroUniforms } from "../engine/retroMaterials";
import { RetroPipeline } from "../engine/retroPipeline";
import { damp } from "../engine/rng";
import { sfx, type Sound } from "../engine/sfx";
import { areas } from "../game/content/areas";
import type { DialogueDef, PickupKind } from "../game/content/areaTypes";
import { foeXp, levelForXp, statsFor } from "../game/rules/progression";
import { clearSave, loadSave, newSave, writeSave, type SaveData } from "../game/rules/saveData";
import { moodPresets } from "../world/artPalette";
import { Sky } from "../world/sky";
import { AreaRuntime } from "./areaRuntime";
import { CameraRig } from "./cameraRig";
import type { Hittable, PlayContext } from "./context";
import { Warden } from "./foes";
import { Hud } from "./hud";
import { Pickup, Shards } from "./interactables";
import { initPhysics } from "./physics";
import { Player, type ControlSource } from "./player";

type GameState = "loading" | "title" | "playing" | "paused" | "dialogue" | "transition" | "dead" | "victory";

/** Flags that only matter while an area is loaded; never written to the save. */
const transientFlags = ["bossActive"];

/** Input buffer: a press waits up to `bufferSeconds` for the hero to be able to act
 * on it (mid-flinch, end of a swing), and is consumed the moment it's read. */
const bufferSeconds = 0.2;

class BufferedControls implements ControlSource {
  private readonly pending = new Map<Action, number>();
  constructor(private readonly input: Input) {}
  capture(actions: Action[]): void {
    for (const action of actions) if (this.input.wasPressed(action)) this.pending.set(action, bufferSeconds);
  }
  move(): { x: number; y: number } {
    return this.input.move();
  }
  wasPressed(action: Action): boolean {
    return this.pending.delete(action);
  }
  sprintHeld(): boolean {
    return this.input.sprintHeld();
  }
  age(dt: number): void {
    for (const [action, left] of this.pending) {
      if (left - dt <= 0) this.pending.delete(action);
      else this.pending.set(action, left - dt);
    }
  }
}

export class Game {
  private frameLook = { x: 0, y: 0 };
  private readonly pipeline: RetroPipeline;
  private readonly scene = new THREE.Scene();
  private readonly input: Input;
  private readonly controls: BufferedControls;
  private readonly hud: Hud;
  private readonly cameraRig = new CameraRig();
  private readonly player = new Player();
  private readonly sky = new Sky();
  private readonly lights: LightPool;
  private readonly hemi = new THREE.HemisphereLight(0x26355c, 0x0b0d10, 1);
  private readonly moon = new THREE.DirectionalLight(0x8fa8ff, 0.5);
  private readonly glow = new ParticleSystem(1600, true, retroUniforms.uSnap);
  private readonly dust = new ParticleSystem(700, false, retroUniforms.uSnap);
  private readonly fxRoot = new THREE.Group();
  private readonly playerShadow: THREE.Mesh;
  private readonly timer = new THREE.Timer();
  private area: AreaRuntime | null = null;
  private state: GameState = "loading";
  private save: SaveData = newSave();
  private readonly flags = new Set<string>();
  private time = 0;
  private hitStopTimer = 0;
  private flashAmount = 0;
  private readonly flashColor = new THREE.Color();
  private transition: { phase: "out" | "in"; t: number; then: () => void } | null = null;
  private dialogue: { def: DialogueDef; index: number; npc: { talking: boolean } | null } | null = null;
  private deadTimer = 0;
  private victoryTimer = -1;
  private readonly context: PlayContext;

  constructor(gameRoot: HTMLElement, hudRoot: HTMLElement) {
    this.pipeline = new RetroPipeline(gameRoot);
    this.input = new Input(this.pipeline.canvas);
    this.controls = new BufferedControls(this.input);
    this.hud = new Hud(hudRoot);
    this.lights = new LightPool(this.scene, 6);
    this.scene.add(this.hemi, this.moon, this.moon.target, this.sky.group, this.fxRoot, this.glow.points, this.dust.points);
    this.scene.add(this.player.rig.root, this.player.trail.mesh, this.player.lanternLight);
    this.playerShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 1.1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: textures().blobShadow, transparent: true, depthWrite: false, color: 0x000000, opacity: 0.55 }),
    );
    this.playerShadow.renderOrder = 1;
    this.scene.add(this.playerShadow);
    this.context = this.makeContext();

    document.addEventListener("pointerlockchange", () => {
      if (!this.input.pointerLocked && this.state === "playing") this.pause();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.state === "playing") this.pause();
    });
    // Any click/keypress may start audio (browsers need a user gesture).
    const unlock = (): void => sfx.unlock();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    window.addEventListener("keydown", (event) => this.menuKeys(event));
  }

  async start(): Promise<void> {
    await initPhysics();
    const saved = loadSave();
    this.loadArea(saved?.areaId ?? "wickmoor", saved?.spawnId ?? "start", false);
    this.showTitle();
    this.timer.connect(document);
    const frame = (timestamp: number): void => {
      this.timer.update(timestamp);
      this.frame(Math.min(0.05, this.timer.getDelta()));
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /** Dev/test helper: jump to a spot in the current area (or another area). */
  debugTeleport(x: number, z: number, areaId?: string): void {
    if (areaId && areaId !== this.area?.def.id) this.loadArea(areaId, Object.keys(areas[areaId].spawns)[0], true);
    if (!this.area) return;
    this.player.teleport(x, this.area.ground(x, z) + 0.1, z);
  }

  // ---------------------------------------------------------------- context

  private makeContext(): PlayContext {
    const game = this;
    return {
      get physics() {
        return game.area!.physics;
      },
      fxRoot: this.fxRoot,
      glow: this.glow,
      dust: this.dust,
      lights: this.lights,
      flags: this.flags,
      time: 0,
      ground: (x, z) => (this.area ? this.area.ground(x, z) : 0),
      play: (sound: Sound) => sfx.play(sound),
      shake: (amount) => this.cameraRig.shake(amount),
      flash: (color, amount) => {
        this.flashColor.set(color);
        this.flashAmount = Math.max(this.flashAmount, amount);
      },
      hitStop: (seconds) => (this.hitStopTimer = Math.max(this.hitStopTimer, seconds)),
      addXp: (amount) => this.addXp(amount),
      spawnPickup: (kind, at) => this.spawnPickup(kind, at, true),
      banner: (title, subtitle) => this.hud.showBanner(title, subtitle),
      toast: (text) => this.hud.toast(text),
      setFlag: (flag) => this.flags.add(flag),
      clearFlag: (flag) => this.flags.delete(flag),
      hittables: () => this.hittables(),
      playerPosition: () => this.player.position,
      damagePlayer: (halfHearts, from, knock) => this.player.receiveHit(halfHearts, from, knock, this.context),
      playerInvulnerable: () => this.player.isInvulnerable(),
      spawnFoe: (kind, x, z) => this.area?.spawnFoe(kind, x, z),
      onFoeDefeated: (kind, at) => this.onFoeDefeated(kind, at),
      flareAt: (at) => this.onFlare(at),
    };
  }

  private hittables(): Hittable[] {
    if (!this.area) return [];
    const list: Hittable[] = [];
    for (const foe of this.area.foes) if (foe.alive) list.push(foe);
    for (const prop of this.area.dynamics) if (prop.alive) list.push(prop);
    return list;
  }

  // ---------------------------------------------------------------- areas

  private loadArea(areaId: string, spawnId: string, announce: boolean): void {
    const def = areas[areaId] ?? areas.wickmoor;
    if (this.area) {
      this.player.removeBody(this.area.physics);
      this.area.dispose();
    }
    this.glow.clear();
    this.dust.clear();
    for (const transient of transientFlags) this.flags.delete(transient);
    this.area = new AreaRuntime(def, this.lights, this.flags);
    this.scene.add(this.area.root);

    const mood = moodPresets[def.mood];
    this.scene.fog = new THREE.FogExp2(mood.fog, mood.fogDensity);
    this.scene.background = new THREE.Color(mood.fog);
    this.hemi.color.set(mood.sky);
    this.hemi.groundColor.set(mood.ground);
    this.hemi.intensity = mood.ambient * 2.4;
    this.moon.color.set(mood.moon);
    this.moon.intensity = mood.moonIntensity * 1.6;
    this.sky.setMood(mood.sky, mood.fog, mood.moon);
    sfx.setAmbient(def.mood);

    const spawn = def.spawns[spawnId] ?? Object.values(def.spawns)[0];
    this.player.spawn(this.area.physics, spawn.x, this.area.ground(spawn.x, spawn.z) + 0.05, spawn.z, spawn.yaw);
    this.refreshStats(false);
    this.cameraRig.snap(this.player.position, spawn.yaw);
    for (const gate of this.area.gates) gate.sync(this.flags);
    if (announce) {
      this.hud.showBanner(def.name, def.subtitle);
      this.persist(areaId, spawnId);
    }
  }

  private persist(areaId = this.area?.def.id ?? "wickmoor", spawnId = this.save.spawnId): void {
    this.save.areaId = areaId;
    this.save.spawnId = spawnId;
    this.save.flags = [...this.flags].filter((flag) => !transientFlags.includes(flag));
    writeSave(this.save);
  }

  private refreshStats(heal: boolean): void {
    const progress = levelForXp(this.save.xp);
    this.player.stats = statsFor(progress.level, this.save.heartContainers);
    if (heal) {
      this.player.hp = this.player.stats.maxHearts * 2;
      this.player.oil = this.player.stats.maxOil;
    } else {
      this.player.hp = Math.min(this.player.hp, this.player.stats.maxHearts * 2);
    }
  }

  // ---------------------------------------------------------------- menus

  private showTitle(): void {
    this.state = "title";
    this.hud.setPlaying(false);
    this.input.captureEnabled = false;
    this.player.freeze(true);
    const saved = loadSave();
    const options = [];
    if (saved) options.push({ label: "Continue", action: () => this.begin(saved) });
    options.push({
      label: saved ? "New Game" : "Begin",
      action: () => {
        clearSave();
        this.begin(newSave());
      },
    });
    this.hud.showMenu("title", "Lanternwake", "The lanterns of the moor are going out. Carry the last flame into the dark.", options);
  }

  private begin(save: SaveData): void {
    sfx.unlock();
    // Grab the mouse now, while we're still inside the click; after the fade it's too late.
    this.input.capturePointer();
    this.save = save;
    this.flags.clear();
    for (const flag of save.flags) this.flags.add(flag);
    this.hud.hideMenu();
    this.fadeThen(() => {
      this.loadArea(save.areaId, save.spawnId, true);
      this.refreshStats(true);
      this.state = "playing";
      this.hud.setPlaying(true);
      this.input.captureEnabled = true;
      this.input.capturePointer();
    });
  }

  private pause(): void {
    if (this.state !== "playing") return;
    this.state = "paused";
    this.input.captureEnabled = false;
    this.input.releasePointer();
    this.hud.showMenu("pause", "Paused", "", [
      { label: "Resume", action: () => this.resume() },
      {
        label: "Return to title",
        action: () => {
          this.hud.hideMenu();
          this.fadeThen(() => {
            const saved = loadSave();
            this.flags.clear();
            for (const flag of saved?.flags ?? []) this.flags.add(flag);
            this.loadArea(saved?.areaId ?? "wickmoor", saved?.spawnId ?? "start", false);
            this.showTitle();
          });
        },
      },
    ]);
  }

  private resume(): void {
    this.hud.hideMenu();
    this.state = "playing";
    this.input.captureEnabled = true;
    this.input.capturePointer();
  }

  private menuKeys(event: KeyboardEvent): void {
    if (!this.hud.menuOpen) return;
    if (event.code === "ArrowUp" || event.code === "KeyW") this.hud.menuMove(-1);
    else if (event.code === "ArrowDown" || event.code === "KeyS") this.hud.menuMove(1);
    else if (event.code === "Enter" || event.code === "Space" || event.code === "KeyE" || event.code === "KeyF") {
      event.preventDefault();
      this.hud.menuConfirm();
    } else if ((event.code === "Escape" || event.code === "KeyP") && this.state === "paused") {
      this.resume();
      // Don't let the same key press re-open the pause menu next frame.
      this.input.endFrame();
    }
  }

  private fadeThen(then: () => void): void {
    const previous = this.state;
    this.state = "transition";
    this.transition = {
      phase: "out",
      t: 0,
      then: () => {
        then();
        if (this.state === "transition") this.state = previous === "transition" ? "playing" : previous;
      },
    };
  }

  // ---------------------------------------------------------------- progression

  private addXp(amount: number): void {
    const before = levelForXp(this.save.xp).level;
    this.save.xp += amount;
    const after = levelForXp(this.save.xp).level;
    if (after > before) {
      this.refreshStats(true);
      sfx.play("levelUp");
      this.hud.showBanner(`Level ${after}`, "Your flame burns stronger. Health and oil restored.");
      this.glow.emit({ count: 60, position: this.player.position.clone().setY(this.player.position.y + 1), spread: 0.6, speed: 2.5, up: 4, drag: 1.5, life: 1.2, size: 0.1, color: 0xffe08a, colorJitter: 0.2 });
    }
  }

  private onFoeDefeated(kind: string, at: THREE.Vector3): void {
    this.addXp(foeXp[kind] ?? 10);
    const roll = Math.random();
    if (kind === "warden") {
      this.onBossDefeated();
      return;
    }
    if (roll < 0.28) this.spawnPickup("heart", at.clone().setY(at.y + 0.6), true);
    else if (roll < 0.5) this.spawnPickup("oil", at.clone().setY(at.y + 0.6), true);
  }

  private onBossDefeated(): void {
    const area = this.area;
    if (!area) return;
    this.flags.add("bossDefeated");
    this.flags.delete("bossActive");
    this.hud.setBoss(null);
    for (const foe of area.foes) if (foe.alive) foe.takeHit(999, foe.position(), 0);
    for (const lantern of area.lanterns) if (lantern.great) lantern.kindle();
    sfx.play("solve");
    this.context.flash(0xffe6a8, 0.8);
    this.cameraRig.shake(0.6);
    this.hud.showBanner("The great lantern wakes", "Light pours back across the moor.");
    this.spawnPickup("heartContainer", new THREE.Vector3(14, area.ground(14, 0) + 1.5, 0), true);
    this.persist();
    this.victoryTimer = 7;
  }

  private spawnPickup(kind: PickupKind, at: THREE.Vector3, pop: boolean): void {
    if (!this.area) return;
    const pickup = new Pickup(kind, at, pop);
    this.area.pickups.push(pickup);
    this.area.root.add(pickup.object);
  }

  private collect(kind: PickupKind): void {
    sfx.play("pickup");
    if (kind === "heart") this.player.heal(2);
    else if (kind === "oil") this.player.oil = Math.min(this.player.stats.maxOil, this.player.oil + 45);
    else {
      this.save.heartContainers += 1;
      this.refreshStats(true);
      sfx.play("levelUp");
      this.hud.showBanner("Heart Vessel", "Your maximum health grows by one heart.");
      this.persist();
    }
  }

  private onFlare(at: THREE.Vector3): void {
    const area = this.area;
    if (!area) return;
    for (const brazier of area.braziers) {
      if (brazier.lit || brazier.position.distanceTo(at) > 5.5) continue;
      brazier.setLit(true, null);
      area.puzzles.setActive(brazier.id, true, this.time);
      sfx.play("ignite");
      this.glow.emit({ count: 30, position: brazier.position, spread: 0.3, speed: 3, up: 3, life: 0.7, size: 0.1, color: 0xffb050 });
    }
  }

  // ---------------------------------------------------------------- frame

  private frame(dt: number): void {
    this.input.poll();
    retroUniforms.uTime.value += dt;
    this.hud.update(dt);
    this.updateTransition(dt);
    switch (this.state) {
      case "playing":
        this.updatePlaying(dt);
        break;
      case "dialogue":
        this.updateDialogue();
        this.simulate(dt, true);
        break;
      case "dead":
        this.simulate(dt, true);
        this.deadTimer += dt;
        if (this.deadTimer > 2.2 && !this.hud.menuOpen) this.showDeath();
        break;
      case "victory":
      case "paused":
      case "title":
      case "transition":
      case "loading":
        if (this.state === "title") this.titleCamera(dt);
        break;
    }
    if (this.input.wasPressed("pause") && this.state === "playing") this.pause();
    // Read this frame's mouse/stick look before endFrame() clears the deltas.
    this.frameLook = this.state === "playing" ? this.input.look(dt) : { x: 0, y: 0 };
    this.input.endFrame();
    this.render(dt);
  }

  private updatePlaying(dt: number): void {
    const area = this.area;
    if (!area) return;
    this.save.playSeconds += dt;
    if (this.input.wasPressed("lockOn")) this.player.toggleLock(area.foes.filter((foe) => foe.alive && !(foe instanceof Warden && !foe.active)), this.cameraRig.yaw);
    this.simulate(dt, false);
    if (this.player.state === "dead") {
      this.state = "dead";
      this.deadTimer = 0;
      this.player.lockTarget = null;
      this.input.captureEnabled = false;
      this.input.releasePointer();
      return;
    }
    this.updateWorld(dt);
    this.updateInteraction();
    this.updateTriggers();
    this.updateExits();
    if (this.victoryTimer > 0) {
      this.victoryTimer -= dt;
      if (this.victoryTimer <= 0) this.showVictory();
    }
  }

  /** Fixed-step physics + simulation; `passive` freezes the player's controls. */
  private simulate(dt: number, passive: boolean): void {
    const area = this.area;
    if (!area) return;
    this.controls.capture(["attack", "jump", "flare"]);
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }
    const idle: ControlSource = { move: () => ({ x: 0, y: 0 }), wasPressed: () => false, sprintHeld: () => false };
    area.physics.step(dt, (step) => {
      this.time += step;
      this.context.time = this.time;
      this.player.step(step, passive ? idle : this.controls, this.cameraRig.yaw, this.context);
      this.controls.age(step);
      for (const foe of area.foes) foe.step(step, this.context);
    });
    for (let index = area.foes.length - 1; index >= 0; index -= 1) if (area.foes[index].removed) area.foes.splice(index, 1);
  }

  private updateWorld(dt: number): void {
    const area = this.area!;
    // Physics props: sync visuals, smash pots.
    for (let index = area.dynamics.length - 1; index >= 0; index -= 1) {
      const prop = area.dynamics[index];
      if (prop.isBroken) {
        const at = prop.centre();
        sfx.play("break");
        area.shards.push(new Shards(area.physics, area.root, at));
        this.dust.emit({ count: 12, position: at, spread: 0.3, speed: 1.5, up: 1, gravity: 4, life: 0.6, size: 0.1, color: 0x8a6048 });
        if (prop.contents) this.spawnPickup(prop.contents, at.clone().setY(at.y + 0.3), true);
        prop.remove();
        area.dynamics.splice(index, 1);
        continue;
      }
      prop.sync();
    }
    for (let index = area.shards.length - 1; index >= 0; index -= 1) if (!area.shards[index].update(dt)) area.shards.splice(index, 1);

    // Pressure plates: only something heavy (a crate or barrel) holds a ward-plate down.
    const weights = area.dynamics.filter((prop) => prop.kind !== "pot").map((prop) => prop.centre());
    const playerOnPlate = area.plates.find((plate) => plate.test([this.player.position.clone().setY(this.player.position.y + 0.5)]) && !plate.pressed);
    if (playerOnPlate && !this.flags.has("plateTooLightShown")) {
      this.flags.add("plateTooLightShown");
      this.hud.toast("The plate barely shifts under you. It wants something heavier.");
    }
    for (const plate of area.plates) {
      const pressed = plate.test(weights);
      if (pressed !== plate.pressed) {
        plate.pressed = pressed;
        sfx.play(pressed ? "gate" : "step");
      }
      area.puzzles.setActive(plate.id, pressed, this.time);
    }
    for (const event of area.puzzles.update(this.time)) {
      if (event.type === "solved" && event.flag) {
        this.flags.add(event.flag);
        sfx.play("solve");
        this.hud.toast("Somewhere, a gate grinds open.");
      } else if (event.type === "memberOut" && event.memberId) {
        area.braziers.find((brazier) => brazier.id === event.memberId)?.setLit(false, null);
        this.hud.toast("A brazier gutters out. Light them all before the flames die.");
      }
    }
    for (const brazier of area.braziers) if (brazier.lit && !brazier.alwaysLit) brazier.setLit(true, area.puzzles.burnLeft(brazier.id, this.time));

    for (const gate of area.gates) {
      if (gate.sync(this.flags)) {
        sfx.play("gate");
        this.cameraRig.shake(0.25);
      }
    }

    // Pickups.
    for (let index = area.pickups.length - 1; index >= 0; index -= 1) {
      const pickup = area.pickups[index];
      if (pickup.update(dt, this.context)) {
        this.collect(pickup.kind);
        area.pickups.splice(index, 1);
      }
    }

    const warden = area.warden;
    this.hud.setBoss(warden && warden.active && warden.alive ? "The Hollow Warden" : null, warden?.bossProgress ?? 0);
  }

  /** Finds the nearest thing to talk to / open / rest at, shows the prompt, acts on F. */
  private updateInteraction(): void {
    const area = this.area!;
    const position = this.player.position;
    let best: { distance: number; label: string; act: () => void } | null = null;
    const consider = (distance: number, range: number, label: string, act: () => void): void => {
      if (distance < range && (!best || distance < best.distance)) best = { distance, label, act };
    };
    for (const npc of area.npcs) {
      consider(npc.position.distanceTo(position), 2.8, `F  Talk to ${npc.placement.name}`, () => this.openDialogue(npc.dialogue(this.flags), npc));
    }
    for (const chest of area.chests) {
      if (chest.opened) continue;
      consider(chest.position.distanceTo(position), 2, "F  Open chest", () => {
        chest.opened = true;
        this.flags.add(`opened:${chest.id}`);
        sfx.play("chest");
        this.spawnPickup(chest.contents, chest.position.clone().setY(chest.position.y + 0.9), true);
        this.persist();
      });
    }
    for (const lantern of area.lanterns) {
      if (lantern.great) continue;
      consider(lantern.position.distanceTo(position), 2.4, lantern.lit ? "F  Rest at the lantern" : "F  Kindle the way-lantern", () => this.restAt(lantern));
    }
    for (const door of area.doors) {
      if (door.open) continue;
      consider(door.position.distanceTo(position), 1.9, door.enterable ? "F  Open door" : "F  Try the door", () => {
        if (door.tryOpen()) {
          sfx.play("doorOpen");
          this.flags.add(`opened:${door.id}`);
          this.persist();
        } else {
          sfx.play("locked");
          this.cameraRig.shake(0.06);
          this.hud.toast(door.lockedText);
        }
      });
    }
    for (const gate of area.gates) {
      if (gate.isOpen) continue;
      consider(gate.distanceTo(position) + 0.3, 2.4, "F  Try the gate", () => {
        gate.rattle();
        sfx.play("locked");
        this.cameraRig.shake(0.08);
        this.hud.toast(gate.lockedText);
      });
    }
    const found = best as { distance: number; label: string; act: () => void } | null;
    this.hud.setPrompt(found ? found.label : null);
    if (found && this.input.wasPressed("interact") && this.player.state === "move") found.act();
  }

  private restAt(lantern: AreaRuntime["lanterns"][number]): void {
    const first = !lantern.lit;
    lantern.kindle();
    this.flags.add(`lit:${lantern.id}`);
    this.refreshStats(true);
    sfx.play(first ? "ignite" : "pickup");
    this.glow.emit({ count: 40, position: lantern.position.clone().setY(lantern.position.y + 1.8), spread: 0.2, speed: 2, up: 2, life: 1, size: 0.09, color: 0xffd27a });
    const spawnId = this.area!.def.spawns[lantern.id] ? lantern.id : this.save.spawnId;
    this.persist(this.area!.def.id, spawnId);
    this.hud.showBanner(first ? "Way-lantern kindled" : "Rested", "Health and oil restored. Your journey is saved.");
  }

  private openDialogue(def: DialogueDef, npc: { talking: boolean } | null): void {
    this.dialogue = { def, index: 0, npc };
    if (npc) npc.talking = true;
    this.state = "dialogue";
    this.hud.setPrompt(null);
    this.hud.openDialogue(def.speaker, def.lines[0]);
    sfx.play("talk");
  }

  private updateDialogue(): void {
    const dialogue = this.dialogue;
    if (!dialogue) return;
    if (!this.input.wasPressed("interact") && !this.input.wasPressed("attack")) return;
    if (this.hud.skipTyping()) return;
    dialogue.index += 1;
    if (dialogue.index < dialogue.def.lines.length) {
      this.hud.openDialogue(dialogue.def.speaker, dialogue.def.lines[dialogue.index]);
      sfx.play("talk");
      return;
    }
    this.hud.closeDialogue();
    if (dialogue.npc) dialogue.npc.talking = false;
    if (dialogue.def.setsFlag && !this.flags.has(dialogue.def.setsFlag)) {
      this.flags.add(dialogue.def.setsFlag);
      this.persist();
    }
    this.dialogue = null;
    this.state = "playing";
  }

  private updateTriggers(): void {
    const area = this.area!;
    for (const trigger of area.def.triggers) {
      if (this.flags.has(trigger.onceFlag)) continue;
      if (trigger.requiresFlag && !this.flags.has(trigger.requiresFlag)) continue;
      if (Math.hypot(this.player.position.x - trigger.x, this.player.position.z - trigger.z) > trigger.radius) continue;
      if (trigger.kind === "hint") {
        this.flags.add(trigger.onceFlag);
        if (trigger.text) this.hud.toast(trigger.text);
      } else if (trigger.kind === "bossArena") {
        const warden = area.warden;
        if (this.flags.has("bossDefeated") || !warden) continue;
        this.flags.add(trigger.onceFlag);
        warden.active = true;
        sfx.play("bossRoar");
        this.cameraRig.shake(0.7);
        this.hud.showBanner("The Hollow Warden", "keeper of the drowned flame");
      }
    }
  }

  private updateExits(): void {
    const area = this.area!;
    const position = this.player.position;
    for (const exit of area.def.exits) {
      if (Math.abs(position.x - exit.x) > exit.halfWidth || Math.abs(position.z - exit.z) > exit.halfDepth) continue;
      this.player.freeze(true);
      this.fadeThen(() => {
        this.loadArea(exit.toArea, exit.toSpawn, true);
        this.player.freeze(false);
      });
      return;
    }
  }

  private showDeath(): void {
    this.hud.showMenu("dead", "The flame gutters", "You fall in the dark, but the last lantern you kindled still burns.", [
      {
        label: "Rise at the lantern",
        action: () => {
          this.hud.hideMenu();
          const saved = loadSave() ?? newSave();
          // Keep experience earned since the checkpoint; roll back world flags.
          this.save = { ...saved, xp: Math.max(saved.xp, this.save.xp), playSeconds: this.save.playSeconds };
          this.flags.clear();
          for (const flag of saved.flags) this.flags.add(flag);
          this.state = "transition";
          this.fadeThen(() => {
            this.loadArea(saved.areaId, saved.spawnId, false);
            this.refreshStats(true);
            this.state = "playing";
            this.input.captureEnabled = true;
            this.input.capturePointer();
          });
        },
      },
    ]);
  }

  private showVictory(): void {
    this.state = "victory";
    this.input.captureEnabled = false;
    this.input.releasePointer();
    const minutes = Math.round(this.save.playSeconds / 60);
    this.hud.showMenu("victory", "Chapter One complete", `The Sunken Shrine burns bright again. Level ${levelForXp(this.save.xp).level} · ${minutes} min. More of the moor waits in the dark.`, [
      {
        label: "Keep exploring",
        action: () => {
          this.hud.hideMenu();
          this.resume();
        },
      },
      { label: "Return to title", action: () => this.showTitleFromGame() },
    ]);
  }

  private showTitleFromGame(): void {
    this.hud.hideMenu();
    this.showTitle();
  }

  // ---------------------------------------------------------------- presentation

  private updateTransition(dt: number): void {
    const transition = this.transition;
    if (!transition) return;
    transition.t += dt / 0.45;
    if (transition.phase === "out") {
      this.pipeline.fade = Math.min(1, transition.t);
      if (transition.t >= 1) {
        transition.then();
        transition.phase = "in";
        transition.t = 0;
      }
    } else {
      this.pipeline.fade = Math.max(0, 1 - transition.t);
      if (transition.t >= 1) this.transition = null;
    }
  }

  private titleCamera(dt: number): void {
    this.cameraRig.update(dt, this.player.position, { x: dt * 0.05, y: 0 }, null, this.area?.physics ?? null);
  }

  private render(dt: number): void {
    const area = this.area;
    if (!area) return;
    const alpha = 1;
    this.player.render(dt, alpha, this.context);
    for (const foe of area.foes) foe.render(dt, this.time, this.context);
    for (const npc of area.npcs) npc.render(dt, this.player.position);
    for (const plate of area.plates) plate.render(dt, area.puzzles.isActive(plate.id));
    for (const brazier of area.braziers) brazier.render(dt, this.context);
    for (const gate of area.gates) gate.render(dt);
    for (const chest of area.chests) chest.render(dt);
    for (const door of area.doors) door.render(dt);
    for (const lantern of area.lanterns) lantern.render(dt, this.context);

    const lock = this.player.lockTarget?.position() ?? null;
    if (this.state === "playing" || this.state === "dialogue" || this.state === "dead") {
      this.cameraRig.update(dt, this.player.rig.root.position, this.frameLook, lock, area.physics);
      this.cameraRig.setSprint(this.state === "playing" && this.player.sprinting, dt);
    }
    this.hud.setLock(lock ? this.project(lock.clone().setY(lock.y + 1.2)) : null);

    const focus = this.player.rig.root.position;
    retroUniforms.uCam.value.copy(this.cameraRig.camera.position);
    retroUniforms.uFocus.value.set(focus.x, focus.y + 1.1, focus.z);
    retroUniforms.uSeeThrough.value = 1;
    this.lights.update(dt, focus);
    area.updateMotes(dt, focus);
    this.glow.update(dt);
    this.dust.update(dt);
    this.sky.follow(this.cameraRig.camera.position);
    this.moon.position.copy(focus).add(new THREE.Vector3(-20, 30, -25));
    this.moon.target.position.copy(focus);
    this.playerShadow.position.set(focus.x, area.ground(focus.x, focus.z) + 0.04, focus.z);
    this.playerShadow.visible = this.player.alive;

    this.flashAmount *= 1 - damp(6, dt);
    this.pipeline.flash(this.flashColor, this.flashAmount);
    const stats = this.player.stats;
    const progress = levelForXp(this.save.xp);
    this.hud.status({ hp: this.player.hp, maxHearts: stats.maxHearts, oil: this.player.oil, maxOil: stats.maxOil, flareCost: stats.flareCost, level: progress.level, xpInto: progress.intoLevel, xpNeeded: progress.needed });
    this.hud.setObjective(area.def.objective(this.flags));
    this.pipeline.render(this.scene, this.cameraRig.camera);
  }

  private project(point: THREE.Vector3): { x: number; y: number } | null {
    const projected = point.project(this.cameraRig.camera);
    if (projected.z > 1) return null;
    return { x: (projected.x + 1) / 2, y: (1 - projected.y) / 2 };
  }
}
