import Phaser from "phaser";
import { goToLibrary } from "../../shared/libraryNav";
import { adventureContent, type PropKind } from "../../game/adventure/adventureContent";
import {
  AdventureSimulation,
  checkpointFrom,
  getInteractPrompt,
  getObjective,
  getObjectiveTarget,
  isBossCharging,
  isGateOpen,
  type AdventureEvent,
  type AdventureInput,
  type AdventureState,
  type FoeState,
} from "../../game/adventure/AdventureSimulation";
import {
  barrelSprite,
  berryBushSprite,
  bushSprite,
  cottageBlueSprite,
  cottageRedSprite,
  crateSprite,
  fenceSprite,
  flowerSprite,
  ironstoneItemSprite,
  lanternDimItemSprite,
  lanternLitItemSprite,
  mushroomSprite,
  pixelHash,
  portraitSprite,
  rockSprite,
  stumpSprite,
  timberItemSprite,
  torchSprite,
  treeSprite,
  tuftSprite,
  wellSprite,
  workbenchSprite,
} from "../../game/adventure/adventureSprites";
import {
  bossTextureKey,
  emberSwordItemSprite,
  heartSprite,
  keeperFeetRow,
  keeperFrameCounts,
  keeperFrameSeconds,
  keeperGridSize,
  keeperTextureKey,
  shadeTextureKey,
  slashFrameCount,
  slashTextureKey,
  swordItemSprite,
  type KeeperDir,
  type KeeperPose,
} from "../../game/adventure/characterFrames";
import { adventureTheme as t, nightDarknessByStep } from "../../game/config/adventureTheme";
import type { AppChrome, HudViewModel } from "../../ui/AppChrome";
import { ensureLanternwakeTextures, lanternwakeTextureKeys, spriteDataUrl } from "../adventure/lanternwakeTextures";

type Phase = "title" | "playing" | "paused" | "over";

interface FoeView {
  body: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  healthBar: Phaser.GameObjects.Graphics;
  bobPhase: number;
}

interface LightSource {
  x: number;
  y: number;
  radius: number;
}

const propTextures: Record<PropKind, string> = {
  cottageRed: cottageRedSprite.key,
  cottageBlue: cottageBlueSprite.key,
  well: wellSprite.key,
  fence: fenceSprite.key,
  crate: crateSprite.key,
  barrel: barrelSprite.key,
  bush: bushSprite.key,
  berryBush: berryBushSprite.key,
  mushroom: mushroomSprite.key,
  stump: stumpSprite.key,
};

/** Props big enough to cast a ground shadow, with its width. */
const propShadowWidth: Partial<Record<PropKind, number>> = {
  well: 40,
  barrel: 26,
  crate: 28,
  bush: 40,
  berryBush: 40,
  stump: 34,
};

const controls = [
  "Move: WASD or Arrow keys (gamepad: left stick / D-pad)",
  "Attack: J or Left-click — click aims the swing (gamepad: X)",
  "Dodge roll: Space or Shift — you can't be hurt mid-roll (gamepad: B)",
  "Interact / forge: E or Enter (gamepad: A)",
  "Pause: Esc or P (gamepad: Start)",
  "Lost? Follow the orange marker, or the arrow at the screen edge.",
];
const keyHint = "WASD move · J / Click attack · Space dodge · E interact · Esc pause";

/** Actors and props sort by their feet so overlaps read correctly. */
const actorDepthBase = 10;
const healthBarDepth = 60;
const nightDepth = 50;
const glowDepth = 51;
const promptDepth = 62;
const signDepth = 70;
const bannerDepth = 80;
const lightTextureSize = 256;
const decorCount = 70;
/** Extra camera room so the objective sign (top) and DOM HUD (bottom) never cover the playfield. */
const viewPadTop = 90;
const viewPadBottom = 110;
/** Where the keeper's feet sit below the simulation point. */
const keeperFootOffset = 20;
/** A short freeze when a hit lands, so blows feel heavy. */
const hitStopSeconds = 0.06;

export class AdventureScene extends Phaser.Scene {
  private readonly chrome: AppChrome;
  private simulation!: AdventureSimulation;
  private keys!: Record<
    "up" | "down" | "left" | "right" | "w" | "a" | "s" | "d" | "j" | "k" | "space" | "shift" | "e" | "enter",
    Phaser.Input.Keyboard.Key
  >;
  private player!: Phaser.GameObjects.Image;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private lanternGlow!: Phaser.GameObjects.Image;
  private gate!: Phaser.GameObjects.TileSprite;
  private pulseRing!: Phaser.GameObjects.Arc;
  private promptText!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;
  private objectiveSign!: Phaser.GameObjects.Graphics;
  private hintText!: Phaser.GameObjects.Text;
  private marker!: Phaser.GameObjects.Triangle;
  private edgeArrow!: Phaser.GameObjects.Triangle;
  private night!: Phaser.GameObjects.RenderTexture;
  private lightStamp!: Phaser.GameObjects.Image;
  private readonly nodeViews = new Map<string, Phaser.GameObjects.Image>();
  private readonly foeViews = new Map<string, FoeView>();
  private readonly pickupViews = new Map<string, Phaser.GameObjects.Image>();
  private readonly pixelTexts: Phaser.GameObjects.Text[] = [];
  private torchLights: LightSource[] = [];
  private phase: Phase = "title";
  private lastHudSignature = "";
  private lastObjectiveText = "";
  private lastStep = 0;
  private checkpoint: AdventureState | null = null;
  private darkness: number = nightDarknessByStep[0];
  private animClock = 0;
  private hitStop = 0;
  private pendingClickAim: { x: number; y: number } | null = null;
  private padPrevious: boolean[] = [];
  private hudIcons: Record<
    "portrait" | "sword" | "emberSword" | "lanternLit" | "lanternDim" | "timber" | "ironstone",
    string
  > | null = null;

  constructor(chrome: AppChrome) {
    super("adventure");
    this.chrome = chrome;
  }

  /** `data.skipTitle` restarts straight into play (Restart / Play Again). */
  create(data: { skipTitle?: boolean } = {}): void {
    this.simulation = new AdventureSimulation();
    this.lastHudSignature = "";
    this.lastObjectiveText = "";
    this.lastStep = 0;
    this.darkness = nightDarknessByStep[0];
    this.pixelTexts.length = 0;
    this.hitStop = 0;
    this.pendingClickAim = null;
    this.padPrevious = [];

    ensureLanternwakeTextures(this);

    const { world } = adventureContent;
    this.cameras.main.setBackgroundColor(t.grassDark);
    this.cameras.main.setBounds(0, -viewPadTop, world.width, world.height + viewPadTop + viewPadBottom);
    this.drawWorld();
    this.createActors();
    this.createLighting();
    this.createLabels();
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.bindInput();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.handleShutdown());
    this.loadPixelFont();

    const state = this.simulation.getState();
    this.checkpoint = checkpointFrom(state);
    this.sync(state, 0);

    if (data.skipTitle) {
      this.startPlaying();
    } else {
      this.showTitle();
    }
  }

  update(_time: number, delta: number): void {
    const input = this.readInput();
    if (input.pause) {
      this.togglePause();
    }

    if (this.phase === "title") {
      if (input.attack || input.interact || input.dodge || input.confirm) {
        this.startPlaying();
      }
    } else if (this.phase === "playing") {
      if (this.hitStop > 0) {
        this.hitStop -= delta / 1000;
      } else {
        const events = this.simulation.advance(delta, input.sim);
        const state = this.simulation.getState();
        events.forEach((event) => this.playEvent(event, state));
      }
    }

    const state = this.simulation.getState();
    if (this.phase !== "paused") {
      this.animClock += delta / 1000;
    }
    this.sync(state, this.phase === "paused" ? 0 : delta);

    if (state.status !== "active" && this.phase === "playing") {
      this.phase = "over";
      this.showResult(state);
    }
  }

  // ------------------------------------------------------------------ input

  private bindInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error("Lanternwake needs keyboard input.");
    }
    const codes = Phaser.Input.Keyboard.KeyCodes;
    this.keys = keyboard.addKeys(
      {
        up: codes.UP,
        down: codes.DOWN,
        left: codes.LEFT,
        right: codes.RIGHT,
        w: codes.W,
        a: codes.A,
        s: codes.S,
        d: codes.D,
        j: codes.J,
        k: codes.K,
        space: codes.SPACE,
        shift: codes.SHIFT,
        e: codes.E,
        enter: codes.ENTER,
      },
      true,
    ) as AdventureScene["keys"];
    keyboard.on("keydown-ESC", () => this.queuePause());
    keyboard.on("keydown-P", () => this.queuePause());

    // Left-click swings toward the cursor (clicks on DOM HUD buttons never reach the canvas).
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) return;
      const world = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      this.pendingClickAim = { x: world.x, y: world.y };
    });
  }

  private pauseQueued = false;
  private queuePause(): void {
    this.pauseQueued = true;
  }

  private readInput(): {
    sim: AdventureInput;
    attack: boolean;
    interact: boolean;
    dodge: boolean;
    confirm: boolean;
    pause: boolean;
  } {
    const k = this.keys;
    const just = Phaser.Input.Keyboard.JustDown;
    // Always read one-shot presses so a press made while paused can't fire later.
    let attack = just(k.j);
    let dodge = just(k.space) || just(k.shift) || just(k.k);
    let interact = just(k.e);
    const confirm = just(k.enter);
    interact ||= confirm;
    let pause = this.pauseQueued;
    this.pauseQueued = false;

    let moveX = Number(k.right.isDown || k.d.isDown) - Number(k.left.isDown || k.a.isDown);
    let moveY = Number(k.down.isDown || k.s.isDown) - Number(k.up.isDown || k.w.isDown);

    // Gamepad: Xbox layout — A interact, B dodge, X attack, Start pause.
    const pad = this.input.gamepad?.total ? this.input.gamepad.getPad(0) : null;
    if (pad) {
      const pressed = pad.buttons.map((button) => button.pressed);
      const padJust = (index: number) => Boolean(pressed[index] && !this.padPrevious[index]);
      attack ||= padJust(2) || padJust(5) || padJust(7);
      interact ||= padJust(0);
      dodge ||= padJust(1) || padJust(4);
      pause ||= padJust(9);
      this.padPrevious = pressed;
      const stickX = Math.abs(pad.leftStick.x) > 0.25 ? pad.leftStick.x : 0;
      const stickY = Math.abs(pad.leftStick.y) > 0.25 ? pad.leftStick.y : 0;
      moveX += stickX + Number(pad.right) - Number(pad.left);
      moveY += stickY + Number(pad.down) - Number(pad.up);
    }

    let aimX: number | undefined;
    let aimY: number | undefined;
    if (this.pendingClickAim) {
      attack = true;
      const state = this.simulation.getState();
      aimX = this.pendingClickAim.x - state.player.x;
      aimY = this.pendingClickAim.y - state.player.y;
      this.pendingClickAim = null;
    }

    return {
      sim: { moveX: clampUnit(moveX), moveY: clampUnit(moveY), attack, interact, dodge, aimX, aimY },
      attack,
      interact,
      dodge,
      confirm,
      pause,
    };
  }

  // ------------------------------------------------------------------ world

  private drawWorld(): void {
    const { world, gateX, workbench, playerSpawn } = adventureContent;

    const fullHeight = world.height + viewPadTop + viewPadBottom;
    this.add.tileSprite(0, -viewPadTop, gateX, fullHeight, lanternwakeTextureKeys.grass).setOrigin(0);
    this.add.tileSprite(gateX, -viewPadTop, world.width - gateX, fullHeight, lanternwakeTextureKeys.shrine).setOrigin(0);
    // Dirt road from the village east to the shrine gate.
    this.add.tileSprite(0, playerSpawn.y - 24, gateX, 48, lanternwakeTextureKeys.path).setOrigin(0);
    for (const path of adventureContent.cobblePaths) {
      this.add.tileSprite(path.x, path.y, path.w, path.h, lanternwakeTextureKeys.cobble).setOrigin(0);
    }
    this.gate = this.add.tileSprite(gateX - 12, -viewPadTop, 24, fullHeight, lanternwakeTextureKeys.gate).setOrigin(0).setDepth(actorDepthBase);

    this.scatterDecor();
    this.placeProps();

    this.addShadow(workbench.x, workbench.y + 16, 66);
    this.add.image(workbench.x, workbench.y, workbenchSprite.key).setDepth(depthFor(workbench.y));
    this.torchLights = [-52, 52].map((offset) => {
      const x = workbench.x + offset;
      const y = workbench.y - 4;
      this.add.image(x, y, torchSprite.key).setOrigin(0.5, 1).setDepth(depthFor(y));
      return { x, y: y - 16, radius: 120 };
    });

    for (const node of adventureContent.resourceNodes) {
      const isTree = node.kind === "timber";
      this.addShadow(node.x, node.y + (isTree ? 10 : 12), isTree ? 40 : 44);
      const art = this.add
        .image(node.x, node.y, isTree ? treeSprite.key : rockSprite.key)
        .setOrigin(0.5, isTree ? 0.78 : 0.55)
        .setDepth(depthFor(node.y));
      this.nodeViews.set(node.id, art);
    }
  }

  /** Cottages, fences and greenery from the content layout, depth-sorted by their feet. */
  private placeProps(): void {
    adventureContent.props.forEach((prop, index) => {
      const shadow = propShadowWidth[prop.kind];
      if (shadow) {
        this.addShadow(prop.x, prop.y - 3, shadow);
      }
      const art = this.add.image(prop.x, prop.y, propTextures[prop.kind]).setOrigin(0.5, 1).setDepth(depthFor(prop.y));
      // Mirror some greenery so repeats don't look stamped.
      if ((prop.kind === "bush" || prop.kind === "mushroom" || prop.kind === "stump") && pixelHash(index, 9, 61) < 0.5) {
        art.setFlipX(true);
      }
    });
  }

  /** Deterministic grass tufts and flowers that avoid the road, nodes and props. */
  private scatterDecor(): void {
    const { world, gateX, playerSpawn, workbench, resourceNodes } = adventureContent;
    const blockers = [workbench, playerSpawn, ...resourceNodes, ...adventureContent.props];
    const inside = (x: number, y: number) =>
      [...adventureContent.obstacles, ...adventureContent.cobblePaths].some(
        (box) => x > box.x - 16 && x < box.x + box.w + 16 && y > box.y - 70 && y < box.y + box.h + 16,
      );

    for (let i = 0; i < decorCount; i += 1) {
      const x = 20 + pixelHash(i, 1, 41) * (gateX - 60);
      const y = 20 + pixelHash(i, 2, 43) * (world.height - 40);
      const onRoad = Math.abs(y - playerSpawn.y) < 40;
      const crowded = blockers.some((point) => Math.hypot(point.x - x, point.y - y) < 60);
      if (onRoad || crowded || inside(x, y)) {
        continue;
      }
      const key = pixelHash(i, 3, 47) < 0.3 ? flowerSprite.key : tuftSprite.key;
      this.add.image(x, y, key).setDepth(depthFor(y) - 1);
    }
  }

  private addShadow(x: number, y: number, width: number): Phaser.GameObjects.Ellipse {
    return this.add.ellipse(x, y, width, width * 0.32, t.groundShadow, 0.35).setDepth(actorDepthBase - 2);
  }

  private createActors(): void {
    const state = this.simulation.getState();
    const { bossStats } = adventureContent;
    this.playerShadow = this.addShadow(state.player.x, state.player.y + keeperFootOffset, 30);

    this.player = this.add
      .image(state.player.x, state.player.y, keeperTextureKey(false, "side", "idle", 0))
      .setOrigin(0.5, (keeperFeetRow + 1) / keeperGridSize);
    this.pulseRing = this.add
      .circle(0, 0, bossStats.pulseRadius)
      .setStrokeStyle(6, t.pulse, 0.85)
      .setVisible(false)
      .setDepth(actorDepthBase - 1);

    state.foes.forEach((foe, index) => {
      const key = foe.kind === "boss" ? bossTextureKey("idle", 0) : shadeTextureKey("float", 0);
      const shadow = this.addShadow(foe.x, foe.y + foe.radius, foe.radius * 1.6);
      const body = this.add.image(foe.x, foe.y, key);
      this.foeViews.set(foe.id, { body, shadow, healthBar: this.add.graphics().setDepth(healthBarDepth), bobPhase: index * 1.7 });
    });
  }

  private createLighting(): void {
    const { world } = adventureContent;
    this.night = this.add
      .renderTexture(0, -viewPadTop, world.width, world.height + viewPadTop + viewPadBottom)
      .setOrigin(0)
      .setDepth(nightDepth);
    this.lightStamp = this.make.image({ key: lanternwakeTextureKeys.light, add: false }).setOrigin(0.5);
    this.lanternGlow = this.add
      .image(0, 0, lanternwakeTextureKeys.light)
      .setTint(t.lanternBody)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(glowDepth);
  }

  private createLabels(): void {
    const { workbench } = adventureContent;
    this.pixelTexts.push(
      this.add
        .text(workbench.x, workbench.y + 30, "Workbench", this.labelStyle(14))
        .setOrigin(0.5, 0)
        .setDepth(depthFor(workbench.y + 30)),
    );
    this.promptText = this.add.text(0, 0, "", this.labelStyle(16)).setOrigin(0.5).setDepth(promptDepth);
    // Bouncing marker over the current target, plus a screen-edge arrow when it is off-screen.
    this.marker = this.add.triangle(0, 0, 0, 0, 24, 0, 12, 18, t.lanternBody).setStrokeStyle(3, t.signEdge).setDepth(promptDepth);
    this.edgeArrow = this.add
      .triangle(0, 0, 0, 0, 30, 12, 0, 24, t.lanternBody)
      .setStrokeStyle(3, t.signEdge)
      .setScrollFactor(0)
      .setDepth(signDepth);
    this.objectiveSign = this.add.graphics().setScrollFactor(0).setDepth(signDepth);
    this.objectiveText = this.add
      .text(this.scale.width / 2, 22, "", { ...this.labelStyle(18), align: "center" })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(signDepth + 1);
    this.hintText = this.add
      .text(this.scale.width - 16, this.scale.height - 128, keyHint, this.labelStyle(13))
      .setOrigin(1, 1)
      .setScrollFactor(0)
      .setAlpha(0.85)
      .setDepth(signDepth);
    this.pixelTexts.push(this.promptText, this.objectiveText, this.hintText);
  }

  private labelStyle(size: number): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: t.signFont,
      fontSize: `${size}px`,
      color: t.signText,
      stroke: t.signStroke,
      strokeThickness: 4,
    };
  }

  /** Canvas text draws once; redraw labels after the pixel web font arrives. */
  private loadPixelFont(): void {
    if (!("fonts" in document)) {
      return;
    }
    document.fonts
      .load(`16px ${t.signFont}`)
      .then(() => {
        this.pixelTexts.forEach((text) => text.active && text.updateText());
        this.lastObjectiveText = "";
      })
      .catch(() => undefined);
  }

  // ------------------------------------------------------------------ per-frame view sync

  private sync(state: AdventureState, deltaMs: number): void {
    this.syncPlayer(state);

    const prompt = this.phase === "playing" ? getInteractPrompt(state) : null;
    this.promptText.setText(prompt ?? "").setPosition(state.player.x, state.player.y - 62);

    this.nodeViews.forEach((view, id) => {
      const depleted = state.depletedNodeIds.includes(id);
      view.setAlpha(depleted ? 0.35 : 1);
      if (depleted) {
        view.setTint(t.stoneDark);
      }
    });

    this.gate.setAlpha(isGateOpen(state) ? 0.25 : 1);
    state.foes.forEach((foe) => this.syncFoe(state, foe));
    this.syncPickups(state);

    this.drawNight(state, deltaMs);
    this.updateMarker(state);

    const objective = getObjective(state);
    if (objective.step !== this.lastStep) {
      this.lastStep = objective.step;
      this.checkpoint = checkpointFrom(state);
      if (state.status === "active") this.showBanner(objective.chapter);
    }
    this.setObjectiveText(`${objective.text}\n${state.message}`);
    if (this.phase === "playing" || this.phase === "paused") {
      this.renderHud(state);
    }
  }

  private syncPlayer(state: AdventureState): void {
    const p = state.player;
    const { player: tuning } = adventureContent;
    const dir: KeeperDir = Math.abs(p.facingY) > Math.abs(p.facingX) + 0.01 ? (p.facingY < 0 ? "up" : "down") : "side";
    let pose: KeeperPose = "idle";
    let frame = 0;
    if (p.dodgeTimer > 0) {
      pose = "roll";
      frame = Math.min(3, Math.floor((1 - p.dodgeTimer / tuning.dodgeSeconds) * 4));
    } else if (p.stunTimer > 0) {
      pose = "hurt";
    } else if (p.swingTimer > 0) {
      pose = "attack";
      frame = Math.min(3, Math.floor((1 - p.swingTimer / tuning.swingSeconds) * 4));
    } else if (p.moving && this.phase === "playing") {
      pose = "run";
      frame = Math.floor(this.animClock / keeperFrameSeconds.run) % keeperFrameCounts.run;
    } else {
      frame = Math.floor(this.animClock / keeperFrameSeconds.idle) % keeperFrameCounts.idle;
    }
    const flip = pose === "roll" ? p.dodgeX < 0 : dir === "side" && p.facingX < 0;
    // Blink while invulnerable after a hit.
    const blinking = state.status === "active" && p.stunTimer <= 0 && p.dodgeTimer <= 0 && this.isHurtBlink(state);
    this.player
      .setTexture(keeperTextureKey(state.hasLantern, dir, pose, frame))
      .setFlipX(flip)
      .setPosition(p.x, p.y + keeperFootOffset)
      .setAlpha(blinking ? 0.4 : 1)
      .setDepth(depthFor(p.y));
    if (pose === "hurt") this.player.setTint(t.hurtTint);
    else this.player.clearTint();
    this.playerShadow.setPosition(p.x, p.y + keeperFootOffset);
  }

  private isHurtBlink(state: AdventureState): boolean {
    return state.hurtTimer > 0 && Math.floor(state.hurtTimer * 14) % 2 === 0;
  }

  private syncFoe(state: AdventureState, foe: FoeState): void {
    const view = this.foeViews.get(foe.id);
    if (!view) {
      return;
    }
    const { shade } = adventureContent;
    let key: string;
    let float = 0;
    if (foe.kind === "shade") {
      float = foe.mode === "lunge" ? 0 : Math.sin(this.animClock * 3 + view.bobPhase) * 3;
      if (foe.hitFlash > 0) key = shadeTextureKey("hurt", 0);
      else if (foe.mode === "windup") key = shadeTextureKey("windup", foe.modeTimer < shade.windupSeconds / 2 ? 1 : 0);
      else if (foe.mode === "lunge") key = shadeTextureKey("lunge", 0);
      else key = shadeTextureKey("float", Math.floor(this.animClock * 8 + view.bobPhase) % 4);
      view.body.setFlipX(state.player.x < foe.x);
    } else {
      const charging = isBossCharging(state);
      if (foe.hitFlash > 0 || foe.mode === "daze") key = bossTextureKey("hurt", 0);
      else if (charging) key = bossTextureKey("charge", Math.floor(this.animClock * 10) % 2);
      else key = bossTextureKey("idle", Math.floor(this.animClock * 3) % 4);
      this.pulseRing.setPosition(foe.x, foe.y).setVisible(charging && foe.alive);
      const pump = charging ? 1 + Math.sin(this.animClock * 30) * 0.05 : 1;
      view.body.setScale(pump, foe.mode === "daze" ? 0.92 : pump);
      float = Math.sin(this.animClock * 2) * 2;
    }
    view.body.setTexture(key).setPosition(foe.x, foe.y + float).setVisible(foe.alive).setDepth(depthFor(foe.y));
    if (foe.hitFlash > 0) view.body.setTintFill(0xffffff);
    else if (foe.kind === "boss" && foe.mode === "daze") view.body.setTint(t.staggerTint);
    else view.body.clearTint();
    view.shadow.setPosition(foe.x, foe.y + foe.radius).setVisible(foe.alive);
    const showBar = foe.alive && (foe.health < foe.maxHealth || (foe.kind === "boss" && isGateOpen(state)));
    this.drawHealthBar(view.healthBar, showBar, foe.x, foe.y - foe.radius - 16, foe.radius * 2, foe.health / foe.maxHealth);
  }

  private syncPickups(state: AdventureState): void {
    const live = new Set(state.pickups.map((pickup) => pickup.id));
    this.pickupViews.forEach((view, id) => {
      if (!live.has(id)) {
        view.destroy();
        this.pickupViews.delete(id);
      }
    });
    for (const pickup of state.pickups) {
      let view = this.pickupViews.get(pickup.id);
      if (!view) {
        view = this.add.image(pickup.x, pickup.y, heartSprite.key).setDepth(depthFor(pickup.y));
        this.pickupViews.set(pickup.id, view);
      }
      view.setY(pickup.y - 6 + Math.sin(this.animClock * 5) * 4);
    }
  }

  private updateMarker(state: AdventureState): void {
    const target = this.phase === "playing" ? getObjectiveTarget(state) : null;
    if (!target) {
      this.marker.setVisible(false);
      this.edgeArrow.setVisible(false);
      return;
    }
    const view = this.cameras.main.worldView;
    const bob = Math.sin(this.animClock * 5) * 6;
    const markY = target.y - 70 + bob;
    this.marker.setVisible(true).setPosition(target.x, markY);
    const onScreen = view.contains(target.x, markY);
    this.edgeArrow.setVisible(!onScreen);
    if (!onScreen) {
      const cx = this.scale.width / 2;
      const cy = this.scale.height / 2;
      const angle = Math.atan2(target.y - view.centerY, target.x - view.centerX);
      const rx = cx - 60;
      const ry = cy - 120;
      const scale = Math.min(rx / Math.abs(Math.cos(angle) || 1e-6), ry / Math.abs(Math.sin(angle) || 1e-6));
      this.edgeArrow.setPosition(cx + Math.cos(angle) * scale, cy + Math.sin(angle) * scale).setRotation(angle);
    }
  }

  private drawHealthBar(bar: Phaser.GameObjects.Graphics, visible: boolean, x: number, y: number, width: number, fraction: number): void {
    bar.clear();
    if (!visible) {
      return;
    }
    const left = Math.round(x - width / 2);
    bar.fillStyle(t.healthBack, 1);
    bar.fillRect(left - 2, y - 2, width + 4, 9);
    bar.fillStyle(t.healthFill, 1);
    bar.fillRect(left, y, Math.round(width * fraction), 5);
  }

  /** Night overlay with soft holes cut for the lantern, village torches and the boss's eye. */
  private drawNight(state: AdventureState, deltaMs: number): void {
    const target = nightDarknessByStep[getObjective(state).step];
    this.darkness += (target - this.darkness) * Math.min(1, (deltaMs / 1000) * 1.2);

    const flicker = 1 + Math.sin(this.animClock * 9) * 0.03 + Math.sin(this.animClock * 23) * 0.02;
    const lights: LightSource[] = [
      { x: state.player.x, y: state.player.y, radius: (state.hasLantern ? 240 : 160) * flicker },
      ...this.torchLights.map((light) => ({ ...light, radius: light.radius * flicker })),
    ];
    const boss = state.foes.find((foe) => foe.kind === "boss");
    if (boss?.alive) {
      lights.push({ x: boss.x, y: boss.y, radius: isBossCharging(state) ? 200 : 120 });
    }

    this.night.clear();
    this.night.fill(t.night, this.darkness);
    for (const light of lights) {
      // The overlay starts at y = -viewPadTop, so shift into its local space.
      this.lightStamp.setPosition(light.x, light.y + viewPadTop).setScale((light.radius * 2) / lightTextureSize);
      this.night.erase(this.lightStamp);
    }

    const glowRadius = state.hasLantern ? 120 * flicker : 0;
    this.lanternGlow
      .setVisible(glowRadius > 0)
      .setPosition(state.player.x, state.player.y)
      .setScale((glowRadius * 2) / lightTextureSize)
      .setAlpha(0.22);
  }

  private setObjectiveText(text: string): void {
    if (text === this.lastObjectiveText) {
      return;
    }
    this.lastObjectiveText = text;
    this.objectiveText.setText(text);

    // A chunky wooden sign behind the objective, sized to the text.
    const padX = 18;
    const padY = 10;
    const width = Math.ceil(this.objectiveText.width + padX * 2);
    const height = Math.ceil(this.objectiveText.height + padY * 2);
    const left = Math.round(this.objectiveText.x - width / 2);
    const top = Math.round(this.objectiveText.y - padY);
    const notch = 4;
    this.objectiveSign.clear();
    this.objectiveSign.fillStyle(t.signEdge, 1);
    this.objectiveSign.fillRect(left + notch, top, width - notch * 2, height);
    this.objectiveSign.fillRect(left, top + notch, width, height - notch * 2);
    this.objectiveSign.fillStyle(t.signWood, 0.94);
    this.objectiveSign.fillRect(left + notch, top + notch, width - notch * 2, height - notch * 2);
  }

  /** Big chapter title that fades in and out mid-screen. */
  private showBanner(text: string): void {
    const banner = this.add
      .text(this.scale.width / 2, this.scale.height * 0.36, text, { ...this.labelStyle(40), strokeThickness: 8 })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(bannerDepth)
      .setAlpha(0);
    this.tweens.add({
      targets: banner,
      alpha: 1,
      y: banner.y - 12,
      duration: 400,
      hold: 1400,
      yoyo: true,
      onComplete: () => banner.destroy(),
    });
  }

  // ------------------------------------------------------------------ events and effects

  private playEvent(event: AdventureEvent, state: AdventureState): void {
    switch (event.type) {
      case "swing":
        this.spawnSlash(event.x, event.y, event.angle, state.hasLantern);
        break;
      case "dodge":
        this.dust(state.player.x, state.player.y + keeperFootOffset);
        break;
      case "foeHit": {
        const foe = state.foes.find((candidate) => candidate.id === event.foeId);
        this.hitStop = hitStopSeconds;
        this.cameras.main.shake(70, 0.003);
        if (foe) {
          this.floatText(foe.x, foe.y - foe.radius - 10, `${event.damage}`, state.hasLantern ? t.lanternCore : t.slashSteel);
          this.burst(foe.x, foe.y, state.hasLantern ? [t.lanternBody, t.lanternCore] : [t.slashSteel, t.shadeBody], 6);
        }
        break;
      }
      case "foeBlocked": {
        const foe = state.foes.find((candidate) => candidate.id === event.foeId);
        if (foe) this.floatText(foe.x, foe.y - foe.radius - 10, "No effect!", t.slashSteelEdge);
        break;
      }
      case "pulse": {
        const ring = this.add.circle(event.x, event.y, event.radius, t.pulse, 0.3).setDepth(glowDepth + 1);
        this.tweens.add({ targets: ring, alpha: 0, scale: 1.1, duration: 320, onComplete: () => ring.destroy() });
        this.cameras.main.shake(160, 0.006);
        break;
      }
      case "playerHurt":
        this.cameras.main.shake(120, 0.006);
        this.floatText(state.player.x, state.player.y - 50, `-${event.damage}`, t.healthFill);
        break;
      case "healed":
        this.floatText(state.player.x, state.player.y - 50, `+${event.amount} HP`, t.leafLight);
        break;
      case "gathered": {
        const node = adventureContent.resourceNodes.find((candidate) => candidate.id === event.nodeId);
        if (node) {
          const isTree = event.kind === "timber";
          const colors = isTree ? [t.leafLight, t.leafMid, t.trunkLight] : [t.stoneLight, t.oreFleck, t.oreShine];
          this.burst(node.x, node.y - 10, colors);
          this.floatText(node.x, node.y - 50, `+1 ${event.kind}`, t.lanternCore);
          const view = this.nodeViews.get(node.id);
          if (view) {
            this.tweens.add({ targets: view, x: node.x + 4, duration: 40, yoyo: true, repeat: 3, onComplete: () => view.setX(node.x) });
          }
        }
        break;
      }
      case "foeDefeated": {
        const foe = state.foes.find((candidate) => candidate.id === event.foeId);
        if (foe) {
          this.burst(foe.x, foe.y, [t.shadeBody, t.shadeEye, t.lanternCore], foe.kind === "boss" ? 28 : 14);
        }
        break;
      }
      case "crafted":
      case "gateOpened": {
        const { r, g, b } = Phaser.Display.Color.IntegerToRGB(t.lanternBody);
        this.cameras.main.flash(240, r, g, b);
        break;
      }
      default:
        break;
    }
  }

  /** The sword's crescent smear, animated over four frames in the swing direction. */
  private spawnSlash(x: number, y: number, angle: number, lit: boolean): void {
    const reach = 34;
    const slash = this.add
      .image(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach + 4, slashTextureKey(lit, 0))
      .setRotation(angle)
      .setDepth(glowDepth + 2);
    for (let frame = 1; frame <= slashFrameCount; frame += 1) {
      this.time.delayedCall(frame * 55, () => {
        if (frame === slashFrameCount) slash.destroy();
        else slash.setTexture(slashTextureKey(lit, frame));
      });
    }
  }

  private floatText(x: number, y: number, text: string, color: number): void {
    const label = this.add
      .text(x, y, text, { ...this.labelStyle(16), color: `#${color.toString(16).padStart(6, "0")}` })
      .setOrigin(0.5)
      .setDepth(promptDepth + 1);
    this.tweens.add({ targets: label, y: y - 30, alpha: 0, duration: 800, ease: "Cubic.easeOut", onComplete: () => label.destroy() });
  }

  private dust(x: number, y: number): void {
    for (let i = 0; i < 5; i += 1) {
      const puff = this.add.rectangle(x + (i - 2) * 6, y, 6, 6, t.dirtLight, 0.8).setDepth(actorDepthBase - 1);
      this.tweens.add({ targets: puff, y: y - 10 - (i % 2) * 6, alpha: 0, duration: 300, onComplete: () => puff.destroy() });
    }
  }

  /** Square pixel shards flying outward, to match the art style. */
  private burst(x: number, y: number, colors: readonly number[], count = 10): void {
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      const distance = 30 + (i % 3) * 14;
      const shard = this.add.rectangle(x, y, 6, 6, colors[i % colors.length]).setDepth(glowDepth + 1);
      this.tweens.add({
        targets: shard,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        duration: 420,
        ease: "Cubic.easeOut",
        onComplete: () => shard.destroy(),
      });
    }
  }

  // ------------------------------------------------------------------ HUD, title, pause, results

  private getHudIcons(): NonNullable<AdventureScene["hudIcons"]> {
    this.hudIcons ??= {
      portrait: spriteDataUrl(portraitSprite),
      sword: spriteDataUrl(swordItemSprite),
      emberSword: spriteDataUrl(emberSwordItemSprite),
      lanternLit: spriteDataUrl(lanternLitItemSprite),
      lanternDim: spriteDataUrl(lanternDimItemSprite),
      timber: spriteDataUrl(timberItemSprite),
      ironstone: spriteDataUrl(ironstoneItemSprite),
    };
    return this.hudIcons;
  }

  private showTitle(): void {
    this.phase = "title";
    this.objectiveSign.setVisible(false);
    this.objectiveText.setVisible(false);
    this.hintText.setVisible(false);
    this.showHudIfChanged({
      layout: "result",
      skin: "lanternwake",
      title: adventureContent.title,
      heading: "How to play",
      copy: adventureContent.story,
      objective: "",
      kpis: [],
      notes: [...adventureContent.howToPlay, ...controls.slice(0, 5)],
      actions: [
        { label: "Start (Enter)", tone: "primary", onPress: () => this.startPlaying() },
        { label: "Back To JackGames", tone: "secondary", onPress: () => goToLibrary() },
      ],
    });
  }

  private startPlaying(): void {
    if (this.phase === "playing") return;
    this.phase = "playing";
    this.objectiveSign.setVisible(true);
    this.objectiveText.setVisible(true);
    this.hintText.setVisible(true);
    this.lastHudSignature = "";
    // Drop any presses made on the title so the first frame doesn't swing.
    this.pendingClickAim = null;
    this.showBanner(getObjective(this.simulation.getState()).chapter);
    this.renderHud(this.simulation.getState());
  }

  private togglePause(): void {
    if (this.phase === "playing") {
      this.phase = "paused";
      this.tweens.pauseAll();
      this.time.paused = true;
    } else if (this.phase === "paused") {
      this.resume();
      return;
    } else {
      return;
    }
    this.renderHud(this.simulation.getState());
  }

  private resume(): void {
    if (this.phase !== "paused") return;
    this.phase = "playing";
    this.tweens.resumeAll();
    this.time.paused = false;
    this.renderHud(this.simulation.getState());
  }

  private renderHud(state: AdventureState): void {
    const objective = getObjective(state);
    const icons = this.getHudIcons();
    const { recipe } = adventureContent;
    const needsMaterials = !state.hasLantern;
    const model: HudViewModel = {
      layout: "active",
      skin: "lanternwake",
      title: `${adventureContent.title} · Paused`,
      copy: adventureContent.story,
      objective: `${objective.chapter} · ${objective.text}`,
      kpis: [],
      status: {
        portraitUrl: icons.portrait,
        name: "Lantern-keeper",
        caption: objective.chapter,
        meter: { label: "Health", current: state.player.health, max: state.player.maxHealth },
      },
      hotbar: [
        {
          label: state.hasLantern ? "Ember blade" : "Iron blade",
          iconUrl: state.hasLantern ? icons.emberSword : icons.sword,
          active: true,
        },
        {
          label: state.hasLantern ? "Ember Lantern" : "Lantern (unlit)",
          iconUrl: state.hasLantern ? icons.lanternLit : icons.lanternDim,
          active: state.hasLantern,
          dim: !state.hasLantern,
        },
        {
          label: "Timber",
          iconUrl: icons.timber,
          count: needsMaterials ? `${state.inventory.timber}/${recipe.timber}` : `${state.inventory.timber}`,
          dim: state.inventory.timber === 0,
        },
        {
          label: "Ironstone",
          iconUrl: icons.ironstone,
          count: needsMaterials ? `${state.inventory.ironstone}/${recipe.ironstone}` : `${state.inventory.ironstone}`,
          dim: state.inventory.ironstone === 0,
        },
      ],
      notes: controls,
      helpOpen: this.phase === "paused",
      helpAction: { label: "II", tone: "secondary", onPress: () => this.togglePause() },
      helpBackAction: { label: "Resume", tone: "primary", onPress: () => this.resume() },
      actions: [
        { label: "Restart night", tone: "secondary", onPress: () => this.restart() },
        { label: "Back To JackGames", tone: "danger", onPress: () => goToLibrary() },
      ],
    };
    this.showHudIfChanged(model);
  }

  private showResult(state: AdventureState): void {
    const won = state.status === "won";
    const minutes = Math.floor(state.elapsed / 60);
    const seconds = Math.floor(state.elapsed % 60).toString().padStart(2, "0");
    const actions: HudViewModel["actions"] = won
      ? [
          { label: "Play Again", tone: "primary", onPress: () => this.restart() },
          { label: "Back To JackGames", tone: "secondary", onPress: () => goToLibrary() },
        ]
      : [
          { label: "Retry from checkpoint", tone: "primary", onPress: () => this.retryFromCheckpoint() },
          { label: "Restart night", tone: "secondary", onPress: () => this.restart() },
          { label: "Back To JackGames", tone: "secondary", onPress: () => goToLibrary() },
        ];

    this.time.delayedCall(450, () => {
      this.showHudIfChanged({
        layout: "result",
        skin: "lanternwake",
        title: `${adventureContent.title}: ${won ? "Dawn" : "Lost to the Fog"}`,
        heading: won ? "Victory" : "Defeated",
        copy: state.message,
        objective: won
          ? "Cinderhollow wakes to its first morning in a season."
          : `You'll restart at "${getObjective(state).chapter}" with full health and your items. Tip: roll (Space) through lunges and the red pulse.`,
        kpis: [
          { label: "Time", value: `${minutes}:${seconds}` },
          { label: "Lantern", value: state.hasLantern ? "Forged" : "Unlit" },
        ],
        notes: [],
        actions,
      });
    });
  }

  private retryFromCheckpoint(): void {
    if (!this.checkpoint) {
      this.restart();
      return;
    }
    this.simulation.loadState(this.checkpoint);
    this.phase = "playing";
    this.lastHudSignature = "";
    this.renderHud(this.simulation.getState());
  }

  private restart(): void {
    this.tweens.resumeAll();
    this.time.paused = false;
    this.scene.restart({ skipTitle: true });
  }

  private showHudIfChanged(model: HudViewModel): void {
    const signature = JSON.stringify(model);
    if (signature === this.lastHudSignature) {
      return;
    }
    this.lastHudSignature = signature;
    this.chrome.renderHud(model);
  }

  private handleShutdown(): void {
    this.tweens.resumeAll();
    this.time.paused = false;
    this.input.off(Phaser.Input.Events.POINTER_DOWN);
    this.input.keyboard?.off("keydown-ESC");
    this.input.keyboard?.off("keydown-P");
    this.nodeViews.clear();
    this.foeViews.clear();
    this.pickupViews.clear();
    this.pixelTexts.length = 0;
    this.lightStamp.destroy();
    this.chrome.clear();
  }
}

function depthFor(y: number): number {
  return actorDepthBase + y / 1000;
}

function clampUnit(value: number): number {
  return Math.max(-1, Math.min(1, value));
}
