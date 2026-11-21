import Phaser from "phaser";
import { goToLibrary } from "../../shared/libraryNav";
import { adventureContent, type PropKind } from "../../game/adventure/adventureContent";
import {
  AdventureSimulation,
  getInteractPrompt,
  getObjective,
  isBossCharging,
  isGateOpen,
  type AdventureEvent,
  type AdventureState,
} from "../../game/adventure/AdventureSimulation";
import {
  barrelSprite,
  berryBushSprite,
  bossSprite,
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
  playerRunCycle,
  playerTextureKey,
  portraitSprite,
  rockSprite,
  shadeSprite,
  staffItemSprite,
  stumpSprite,
  timberItemSprite,
  torchSprite,
  treeSprite,
  tuftSprite,
  wellSprite,
  workbenchSprite,
} from "../../game/adventure/adventureSprites";
import { adventureTheme as t, nightDarknessByStep } from "../../game/config/adventureTheme";
import type { AppChrome, HudViewModel } from "../../ui/AppChrome";
import { ensureLanternwakeTextures, lanternwakeTextureKeys, spriteDataUrl } from "../adventure/lanternwakeTextures";

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

/** Seconds per run-cycle frame at full speed. */
const runFrameSeconds = 0.1;

const controls = [
  "WASD / Arrows: move",
  "Space: swing your staff (only the Ember Lantern can banish shades)",
  "E: gather or forge at the workbench",
  "Esc: back to the library",
];

/** Actors and props sort by their feet so overlaps read correctly. */
const actorDepthBase = 10;
const healthBarDepth = 60;
const nightDepth = 50;
const glowDepth = 51;
const promptDepth = 62;
const signDepth = 70;
const lightTextureSize = 256;
const decorCount = 70;
/** Extra camera room so the objective sign (top) and DOM HUD (bottom) never cover the playfield. */
const viewPadTop = 90;
const viewPadBottom = 110;

export class AdventureScene extends Phaser.Scene {
  private readonly chrome: AppChrome;
  private simulation!: AdventureSimulation;
  private keys!: Record<"up" | "down" | "left" | "right" | "w" | "a" | "s" | "d" | "attack" | "interact", Phaser.Input.Keyboard.Key>;
  private player!: Phaser.GameObjects.Image;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private lanternGlow!: Phaser.GameObjects.Image;
  private gate!: Phaser.GameObjects.TileSprite;
  private pulseRing!: Phaser.GameObjects.Arc;
  private promptText!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;
  private objectiveSign!: Phaser.GameObjects.Graphics;
  private night!: Phaser.GameObjects.RenderTexture;
  private lightStamp!: Phaser.GameObjects.Image;
  private readonly nodeViews = new Map<string, Phaser.GameObjects.Image>();
  private readonly foeViews = new Map<string, FoeView>();
  private readonly pixelTexts: Phaser.GameObjects.Text[] = [];
  private torchLights: LightSource[] = [];
  private helpOpen = false;
  private resultShown = false;
  private lastHudSignature = "";
  private lastObjectiveText = "";
  private darkness: number = nightDarknessByStep[0];
  private lastPlayerX = 0;
  private lastPlayerY = 0;
  private runClock = 0;
  private hudIcons: Record<"portrait" | "staff" | "lanternLit" | "lanternDim" | "timber" | "ironstone", string> | null = null;

  constructor(chrome: AppChrome) {
    super("adventure");
    this.chrome = chrome;
  }

  create(): void {
    this.simulation = new AdventureSimulation();
    this.helpOpen = false;
    this.resultShown = false;
    this.lastHudSignature = "";
    this.lastObjectiveText = "";
    this.darkness = nightDarknessByStep[0];
    this.pixelTexts.length = 0;

    ensureLanternwakeTextures(this);

    const { world } = adventureContent;
    this.cameras.main.setBackgroundColor(t.grassDark);
    this.cameras.main.setBounds(0, -viewPadTop, world.width, world.height + viewPadTop + viewPadBottom);
    this.drawWorld();
    this.createActors();
    this.createLighting();
    this.createLabels();
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.bindKeys();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.handleShutdown());
    this.loadPixelFont();

    const state = this.simulation.getState();
    this.lastPlayerX = state.player.x;
    this.lastPlayerY = state.player.y;
    this.runClock = 0;
    this.sync(state, 0);
  }

  update(_time: number, delta: number): void {
    const k = this.keys;
    // Always read one-shot presses so a press made while paused can't fire later.
    const attack = Phaser.Input.Keyboard.JustDown(k.attack);
    const interact = Phaser.Input.Keyboard.JustDown(k.interact);

    if (!this.helpOpen && !this.resultShown) {
      const events = this.simulation.advance(delta, {
        moveX: Number(k.right.isDown || k.d.isDown) - Number(k.left.isDown || k.a.isDown),
        moveY: Number(k.down.isDown || k.s.isDown) - Number(k.up.isDown || k.w.isDown),
        attack,
        interact,
      });
      const state = this.simulation.getState();
      events.forEach((event) => this.playEvent(event, state));
    }

    const state = this.simulation.getState();
    this.sync(state, delta);

    if (state.status !== "active" && !this.resultShown) {
      this.showResult(state);
    }
  }

  private bindKeys(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error("Lanternwake needs keyboard input.");
    }
    const codes = Phaser.Input.Keyboard.KeyCodes;
    this.keys = keyboard.addKeys({
      up: codes.UP,
      down: codes.DOWN,
      left: codes.LEFT,
      right: codes.RIGHT,
      w: codes.W,
      a: codes.A,
      s: codes.S,
      d: codes.D,
      attack: codes.SPACE,
      interact: codes.E,
    }) as AdventureScene["keys"];
    keyboard.on("keydown-ESC", () => {
      if (this.helpOpen) {
        this.setHelpOpen(false);
        return;
      }
      goToLibrary();
    });
  }

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
    this.playerShadow = this.addShadow(state.player.x, state.player.y + 22, 30);

    this.player = this.add.image(state.player.x, state.player.y, playerTextureKey(false, "idle")).setOrigin(0.5, 0.62);
    this.pulseRing = this.add
      .circle(0, 0, bossStats.pulseRadius)
      .setStrokeStyle(6, t.pulse, 0.85)
      .setVisible(false)
      .setDepth(actorDepthBase - 1);

    state.foes.forEach((foe, index) => {
      const key = foe.kind === "boss" ? bossSprite.key : shadeSprite.key;
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
    this.objectiveSign = this.add.graphics().setScrollFactor(0).setDepth(signDepth);
    this.objectiveText = this.add
      .text(this.scale.width / 2, 22, "", { ...this.labelStyle(18), align: "center" })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(signDepth + 1);
    this.pixelTexts.push(this.promptText, this.objectiveText);
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

  private sync(state: AdventureState, deltaMs: number): void {
    const { player } = state;
    const movedX = player.x - this.lastPlayerX;
    const movedY = player.y - this.lastPlayerY;
    if (Math.abs(movedX) > 0.01) {
      this.player.setFlipX(movedX < 0);
    }
    this.lastPlayerX = player.x;
    this.lastPlayerY = player.y;

    // Run cycle while moving (by actual displacement, so walls stop the legs too); breathe while idle.
    const running = state.status === "active" && Math.hypot(movedX, movedY) > 0.05;
    let pose: Parameters<typeof playerTextureKey>[1] = "idle";
    let bob = 0;
    if (running) {
      this.runClock += deltaMs / 1000;
      const frame = Math.floor(this.runClock / runFrameSeconds) % playerRunCycle.length;
      pose = playerRunCycle[frame];
      bob = pose === "pass" ? -3 : 0;
    } else {
      this.runClock = 0;
      bob = state.status === "active" ? Math.round(Math.sin(state.elapsed * 3)) : 0;
    }
    this.player
      .setTexture(playerTextureKey(state.hasLantern, pose))
      .setPosition(player.x, player.y + bob)
      .setDepth(depthFor(player.y));
    this.playerShadow.setPosition(player.x, player.y + 22);

    const prompt = getInteractPrompt(state);
    this.promptText.setText(prompt ?? "").setPosition(player.x, player.y - 46);

    this.nodeViews.forEach((view, id) => {
      const depleted = state.depletedNodeIds.includes(id);
      view.setAlpha(depleted ? 0.35 : 1);
      if (depleted) {
        view.setTint(t.stoneDark);
      }
    });

    const gateOpen = isGateOpen(state);
    this.gate.setAlpha(gateOpen ? 0.25 : 1);

    state.foes.forEach((foe) => {
      const view = this.foeViews.get(foe.id);
      if (!view) {
        return;
      }
      const float = foe.kind === "shade" ? Math.sin(state.elapsed * 3 + view.bobPhase) * 3 : 0;
      view.body.setPosition(foe.x, foe.y + float).setVisible(foe.alive).setDepth(depthFor(foe.y));
      view.shadow.setPosition(foe.x, foe.y + foe.radius).setVisible(foe.alive);
      if (foe.stagger > 0) {
        view.body.setTint(t.staggerTint);
      } else {
        view.body.clearTint();
      }
      if (foe.kind === "boss") {
        const charging = isBossCharging(state);
        this.pulseRing.setPosition(foe.x, foe.y).setVisible(charging);
        view.body.setScale(charging ? 1 + Math.sin(state.elapsed * 30) * 0.04 : 1);
      }
      this.drawHealthBar(view.healthBar, foe.alive && foe.health < foe.maxHealth, foe.x, foe.y - foe.radius - 14, foe.radius * 2, foe.health / foe.maxHealth);
    });

    this.drawNight(state, deltaMs);

    const objective = getObjective(state);
    this.setObjectiveText(`${objective.text}\n${state.message}`);
    if (!this.resultShown) {
      this.renderHud(state);
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

    const flicker = 1 + Math.sin(state.elapsed * 9) * 0.03 + Math.sin(state.elapsed * 23) * 0.02;
    const lights: LightSource[] = [
      { x: state.player.x, y: state.player.y, radius: (state.hasLantern ? 230 : 120) * flicker },
      ...this.torchLights.map((light) => ({ ...light, radius: light.radius * flicker })),
    ];
    const boss = state.foes.find((foe) => foe.kind === "boss");
    if (boss?.alive) {
      lights.push({ x: boss.x, y: boss.y, radius: isBossCharging(state) ? 200 : 110 });
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

  private playEvent(event: AdventureEvent, state: AdventureState): void {
    switch (event.type) {
      case "swing": {
        const ring = this.add
          .circle(event.x, event.y, event.range)
          .setStrokeStyle(6, state.hasLantern ? t.swing : t.staffWood, 0.8)
          .setDepth(glowDepth + 1)
          .setScale(0.6);
        this.tweens.add({ targets: ring, alpha: 0, scale: 1.05, duration: 180, onComplete: () => ring.destroy() });
        break;
      }
      case "pulse": {
        const ring = this.add.circle(event.x, event.y, event.radius, t.pulse, 0.3).setDepth(glowDepth + 1);
        this.tweens.add({ targets: ring, alpha: 0, duration: 320, onComplete: () => ring.destroy() });
        break;
      }
      case "playerHurt":
        this.cameras.main.shake(90, 0.004);
        this.player.setTint(t.hurtTint);
        this.time.delayedCall(140, () => this.player.clearTint());
        break;
      case "gathered": {
        const node = adventureContent.resourceNodes.find((candidate) => candidate.id === event.nodeId);
        if (node) {
          const colors = event.kind === "timber" ? [t.leafLight, t.leafMid, t.trunkLight] : [t.stoneLight, t.oreFleck, t.oreShine];
          this.burst(node.x, node.y - 10, colors);
        }
        break;
      }
      case "foeDefeated": {
        const foe = state.foes.find((candidate) => candidate.id === event.foeId);
        if (foe) {
          this.burst(foe.x, foe.y, [t.shadeBody, t.shadeEye, t.lanternCore], foe.kind === "boss" ? 28 : 12);
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

  private getHudIcons(): NonNullable<AdventureScene["hudIcons"]> {
    this.hudIcons ??= {
      portrait: spriteDataUrl(portraitSprite),
      staff: spriteDataUrl(staffItemSprite),
      lanternLit: spriteDataUrl(lanternLitItemSprite),
      lanternDim: spriteDataUrl(lanternDimItemSprite),
      timber: spriteDataUrl(timberItemSprite),
      ironstone: spriteDataUrl(ironstoneItemSprite),
    };
    return this.hudIcons;
  }

  private renderHud(state: AdventureState): void {
    const objective = getObjective(state);
    const icons = this.getHudIcons();
    const { recipe } = adventureContent;
    const needsMaterials = !state.hasLantern;
    const model: HudViewModel = {
      layout: "active",
      skin: "lanternwake",
      title: adventureContent.title,
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
        { label: "Staff", iconUrl: icons.staff, active: !state.hasLantern },
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
        { label: "Empty slot" },
        { label: "Empty slot" },
      ],
      notes: controls,
      helpOpen: this.helpOpen,
      helpAction: { label: "?", tone: "secondary", onPress: () => this.setHelpOpen(true) },
      helpBackAction: { label: "Back", tone: "primary", onPress: () => this.setHelpOpen(false) },
      actions: [
        { label: "Restart", tone: "secondary", onPress: () => this.scene.restart() },
        { label: "Back To JackGames", tone: "danger", onPress: () => goToLibrary() },
      ],
    };
    this.showHudIfChanged(model);
  }

  private showResult(state: AdventureState): void {
    this.resultShown = true;
    const won = state.status === "won";
    const minutes = Math.floor(state.elapsed / 60);
    const seconds = Math.floor(state.elapsed % 60).toString().padStart(2, "0");

    this.time.delayedCall(250, () => {
      this.showHudIfChanged({
        layout: "result",
        skin: "lanternwake",
        title: `${adventureContent.title}: ${won ? "Dawn" : "Lost to the Fog"}`,
        copy: state.message,
        objective: won ? "Cinderhollow wakes to its first morning in a season." : "Rest, then try the night again.",
        kpis: [
          { label: "Time", value: `${minutes}:${seconds}` },
          { label: "Lantern", value: state.hasLantern ? "Forged" : "Unlit" },
        ],
        notes: [],
        actions: [
          { label: "Play Again", tone: "primary", onPress: () => this.scene.restart() },
          { label: "Back To JackGames", tone: "secondary", onPress: () => goToLibrary() },
        ],
      });
    });
  }

  private showHudIfChanged(model: HudViewModel): void {
    const signature = JSON.stringify(model);
    if (signature === this.lastHudSignature) {
      return;
    }
    this.lastHudSignature = signature;
    this.chrome.renderHud(model);
  }

  private setHelpOpen(open: boolean): void {
    if (this.resultShown || this.helpOpen === open) {
      return;
    }
    this.helpOpen = open;
    if (open) {
      this.tweens.pauseAll();
    } else {
      this.tweens.resumeAll();
    }
    this.renderHud(this.simulation.getState());
  }

  private handleShutdown(): void {
    this.tweens.resumeAll();
    this.nodeViews.clear();
    this.foeViews.clear();
    this.pixelTexts.length = 0;
    this.lightStamp.destroy();
    this.chrome.clear();
  }
}

function depthFor(y: number): number {
  return actorDepthBase + y / 1000;
}
