import Phaser from "phaser";
import { adventureContent } from "../../game/adventure/adventureContent";
import {
  AdventureSimulation,
  getInteractPrompt,
  getObjective,
  isBossCharging,
  isGateOpen,
  type AdventureEvent,
  type AdventureState,
} from "../../game/adventure/AdventureSimulation";
import { adventureTheme } from "../../game/config/adventureTheme";
import type { HudViewModel } from "../../ui/AppChrome";
import { SceneBridge } from "../adapters/sceneBridge";

interface FoeView {
  body: Phaser.GameObjects.Arc;
  healthBar: Phaser.GameObjects.Graphics;
}

const controls = [
  "WASD / Arrows: move",
  "Space: swing your staff",
  "E: gather or forge at the workbench",
  "Esc: back to the library",
];

export class AdventureScene extends Phaser.Scene {
  private readonly bridge: SceneBridge;
  private simulation!: AdventureSimulation;
  private keys!: Record<"up" | "down" | "left" | "right" | "w" | "a" | "s" | "d" | "attack" | "interact", Phaser.Input.Keyboard.Key>;
  private player!: Phaser.GameObjects.Arc;
  private lanternGlow!: Phaser.GameObjects.Arc;
  private gate!: Phaser.GameObjects.Rectangle;
  private pulseRing!: Phaser.GameObjects.Arc;
  private promptText!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;
  private readonly nodeViews = new Map<string, Phaser.GameObjects.Graphics>();
  private readonly foeViews = new Map<string, FoeView>();
  private helpOpen = false;
  private resultShown = false;
  private lastHudSignature = "";

  constructor(bridge: SceneBridge) {
    super("adventure");
    this.bridge = bridge;
  }

  create(): void {
    this.simulation = new AdventureSimulation();
    this.helpOpen = false;
    this.resultShown = false;
    this.lastHudSignature = "";

    const { world } = adventureContent;
    this.cameras.main.setBackgroundColor(adventureTheme.background);
    this.cameras.main.setBounds(0, 0, world.width, world.height);
    this.drawWorld();
    this.createActors();
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

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
      this.scene.start("menu");
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.handleShutdown());

    this.sync(this.simulation.getState());
  }

  update(_time: number, delta: number): void {
    if (this.helpOpen || this.resultShown) {
      return;
    }

    const k = this.keys;
    const events = this.simulation.advance(delta, {
      moveX: Number(k.right.isDown || k.d.isDown) - Number(k.left.isDown || k.a.isDown),
      moveY: Number(k.down.isDown || k.s.isDown) - Number(k.up.isDown || k.w.isDown),
      attack: Phaser.Input.Keyboard.JustDown(k.attack),
      interact: Phaser.Input.Keyboard.JustDown(k.interact),
    });
    const state = this.simulation.getState();

    events.forEach((event) => this.playEvent(event));
    this.sync(state);

    if (state.status !== "active") {
      this.showResult(state);
    }
  }

  private drawWorld(): void {
    const { world, gateX, workbench } = adventureContent;
    const ground = this.add.graphics();
    ground.fillStyle(adventureTheme.ground, 1);
    ground.fillRect(0, 0, gateX, world.height);
    ground.fillStyle(adventureTheme.shrineGround, 1);
    ground.fillRect(gateX, 0, world.width - gateX, world.height);
    ground.fillStyle(adventureTheme.groundPatch, 1);
    // Deterministic decorative fog patches.
    for (let i = 0; i < 18; i += 1) {
      ground.fillCircle((i * 263) % gateX, (i * 397) % world.height, 40 + (i % 4) * 18);
    }

    this.gate = this.add.rectangle(gateX, world.height / 2, 20, world.height, adventureTheme.gateClosed, 1);
    this.add.rectangle(workbench.x, workbench.y, 72, 44, adventureTheme.workbench).setStrokeStyle(3, adventureTheme.workbenchTop);
    this.add
      .text(workbench.x, workbench.y + 36, "Workbench", { fontFamily: "Montserrat, sans-serif", fontSize: "14px", color: adventureTheme.promptText })
      .setOrigin(0.5);

    for (const node of adventureContent.resourceNodes) {
      const art = this.add.graphics({ x: node.x, y: node.y });
      if (node.kind === "timber") {
        art.fillStyle(adventureTheme.timberTrunk, 1);
        art.fillRect(-5, 6, 10, 18);
        art.fillStyle(adventureTheme.timber, 1);
        art.fillTriangle(-22, 10, 22, 10, 0, -28);
      } else {
        art.fillStyle(adventureTheme.ironstone, 1);
        art.fillPoints([
          new Phaser.Math.Vector2(-20, 10),
          new Phaser.Math.Vector2(-12, -14),
          new Phaser.Math.Vector2(10, -18),
          new Phaser.Math.Vector2(22, 4),
          new Phaser.Math.Vector2(8, 18),
        ], true);
      }
      this.nodeViews.set(node.id, art);
    }
  }

  private createActors(): void {
    const state = this.simulation.getState();
    const { bossStats } = adventureContent;

    this.lanternGlow = this.add.circle(state.player.x, state.player.y, 60, adventureTheme.lanternGlow, 0.12).setDepth(4);
    this.player = this.add.circle(state.player.x, state.player.y, state.player.radius, adventureTheme.player).setDepth(6);
    this.player.setStrokeStyle(4, adventureTheme.lantern);
    this.pulseRing = this.add.circle(0, 0, bossStats.pulseRadius).setStrokeStyle(4, adventureTheme.pulse, 0.8).setVisible(false).setDepth(3);
    this.promptText = this.add
      .text(0, 0, "", { fontFamily: "Montserrat, sans-serif", fontSize: "15px", color: adventureTheme.promptText })
      .setOrigin(0.5)
      .setDepth(10);
    this.objectiveText = this.add
      .text(this.scale.width / 2, 24, "", {
        fontFamily: "Montserrat, sans-serif",
        fontSize: "18px",
        color: adventureTheme.promptText,
        align: "center",
        backgroundColor: adventureTheme.textBackdrop,
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(20);

    for (const foe of state.foes) {
      const color = foe.kind === "boss" ? adventureTheme.boss : adventureTheme.shade;
      const body = this.add.circle(foe.x, foe.y, foe.radius, color, 0.92).setDepth(5);
      if (foe.kind === "boss") {
        body.setStrokeStyle(6, adventureTheme.bossCore);
      }
      this.foeViews.set(foe.id, { body, healthBar: this.add.graphics().setDepth(7) });
    }
  }

  private sync(state: AdventureState): void {
    const { player } = state;
    this.player.setPosition(player.x, player.y);
    this.lanternGlow.setPosition(player.x, player.y);
    this.lanternGlow.setRadius(state.hasLantern ? 120 : 60).setAlpha(state.hasLantern ? 0.22 : 0.1);
    this.player.setFillStyle(state.hasLantern ? adventureTheme.lanternGlow : adventureTheme.player);

    const prompt = getInteractPrompt(state);
    this.promptText.setText(prompt ?? "").setPosition(player.x, player.y - 40);

    this.nodeViews.forEach((view, id) => view.setAlpha(state.depletedNodeIds.includes(id) ? 0.18 : 1));
    this.gate.setFillStyle(isGateOpen(state) ? adventureTheme.gateOpen : adventureTheme.gateClosed, isGateOpen(state) ? 0.35 : 1);

    for (const foe of state.foes) {
      const view = this.foeViews.get(foe.id);
      if (!view) {
        continue;
      }
      view.body.setPosition(foe.x, foe.y).setVisible(foe.alive);
      view.healthBar.clear();
      if (foe.alive && foe.health < foe.maxHealth) {
        const width = foe.radius * 2;
        view.healthBar.fillStyle(adventureTheme.healthBack, 1);
        view.healthBar.fillRect(foe.x - width / 2, foe.y - foe.radius - 12, width, 5);
        view.healthBar.fillStyle(adventureTheme.healthFill, 1);
        view.healthBar.fillRect(foe.x - width / 2, foe.y - foe.radius - 12, (width * foe.health) / foe.maxHealth, 5);
      }
      if (foe.kind === "boss") {
        this.pulseRing.setPosition(foe.x, foe.y).setVisible(isBossCharging(state));
      }
    }

    const objective = getObjective(state);
    this.objectiveText.setText(`${objective.text}\n${state.message}`);
    this.renderHud(state);
  }

  private playEvent(event: AdventureEvent): void {
    switch (event.type) {
      case "swing": {
        const arc = this.add.circle(event.x, event.y, event.range, adventureTheme.lantern, 0.18).setDepth(2);
        this.tweens.add({ targets: arc, alpha: 0, scale: 1.1, duration: 160, onComplete: () => arc.destroy() });
        break;
      }
      case "pulse": {
        const ring = this.add.circle(event.x, event.y, event.radius, adventureTheme.pulse, 0.3).setDepth(2);
        this.tweens.add({ targets: ring, alpha: 0, duration: 300, onComplete: () => ring.destroy() });
        break;
      }
      case "playerHurt":
        this.cameras.main.shake(90, 0.004);
        break;
      case "crafted":
      case "gateOpened":
        this.cameras.main.flash(220, 246, 81, 29);
        break;
      default:
        break;
    }
  }

  private renderHud(state: AdventureState): void {
    const objective = getObjective(state);
    const model: HudViewModel = {
      layout: "active",
      title: adventureContent.title,
      copy: adventureContent.story,
      objective: `${objective.chapter} — ${objective.text}`,
      kpis: [
        { label: "Health", meter: { current: state.player.health, max: state.player.maxHealth } },
        { label: "Timber", value: `${state.inventory.timber}` },
        { label: "Ironstone", value: `${state.inventory.ironstone}` },
        { label: "Lantern", value: state.hasLantern ? "Ember" : "Dim" },
        { label: "Chapter", value: objective.chapter },
      ],
      notes: controls,
      helpOpen: this.helpOpen,
      helpAction: { label: "?", tone: "secondary", onPress: () => this.setHelpOpen(true) },
      helpBackAction: { label: "Back", tone: "primary", onPress: () => this.setHelpOpen(false) },
      actions: [
        { label: "Restart", tone: "secondary", onPress: () => this.scene.restart() },
        { label: "Back To Library", tone: "danger", onPress: () => this.scene.start("menu") },
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
        title: `${adventureContent.title} — ${won ? "Dawn" : "Lost to the Fog"}`,
        copy: state.message,
        objective: won ? "Cinderhollow wakes to its first morning in a season." : "Rest, then try the night again.",
        kpis: [
          { label: "Time", value: `${minutes}:${seconds}` },
          { label: "Lantern", value: state.hasLantern ? "Forged" : "Unlit" },
        ],
        notes: [],
        actions: [
          { label: "Play Again", tone: "primary", onPress: () => this.scene.restart() },
          { label: "Back To Library", tone: "secondary", onPress: () => this.scene.start("menu") },
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
    this.bridge.showHud(model);
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
    this.bridge.clearChrome();
  }
}
