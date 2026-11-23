import Phaser from "phaser";
import { tankTheme, worldTheme } from "../../game/config/theme";
import { BattleSimulation } from "../../game/simulation/battle/BattleSimulation";
import type {
  BattleHudSnapshot,
  BattleInput,
  BattleSnapshot,
  PickupSnapshot,
  ProjectileSnapshot,
  TankSnapshot,
} from "../../game/simulation/battle/types";
import { SceneBridge } from "../adapters/sceneBridge";
import { createCameraRig } from "../view/createCameraRig";
import {
  createBreakableObstacleLayer,
  type BreakableObstacleLayer,
} from "../view/createBreakableObstacleLayer";
import { createFogOfWarLayer, type FogOfWarLayer } from "../view/createFogOfWarLayer";
import {
  createTankSprite,
  drawPixelHealthBar,
  syncTankPose,
  type TankArtPalette,
  type TankSprite,
} from "../view/drawTank";
import {
  ensureBattlefieldTexture,
  ensureCoinTexture,
  ensureRapidFireTexture,
  ensureRepairTexture,
  ensureShotTexture,
} from "../view/dustlinePixelArt";
import { spawnSimulationEffect } from "../view/spawnSimulationEffect";

export class BattleScene extends Phaser.Scene {
  private readonly bridge: SceneBridge;
  private simulation!: BattleSimulation;
  private movementKeys?: {
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
  };
  private arrowKeys?: Phaser.Types.Input.Keyboard.CursorKeys;
  private playerSprite!: TankSprite;
  private readonly enemySprites = new Map<string, TankSprite>();
  private readonly projectileSprites = new Map<string, Phaser.GameObjects.Image>();
  private readonly pickupSprites = new Map<string, Phaser.GameObjects.Image>();
  private breakableObstacleLayer!: BreakableObstacleLayer;
  private fogLayer!: FogOfWarLayer;
  private lastHudSignature = "";
  private lastSavedCredits = -1;
  private lastSavedTotalScore = -1;
  private currentSnapshot!: BattleSnapshot;
  private currentHud!: BattleHudSnapshot;
  private helpModalOpen = false;
  private resultsQueued = false;

  constructor(bridge: SceneBridge) {
    super("battle");
    this.bridge = bridge;
  }

  create(): void {
    const save = this.bridge.loadOrCreateSave();
    const level = this.bridge.getBattleLevel();
    this.simulation = new BattleSimulation(level, save);
    this.resultsQueued = false;
    this.helpModalOpen = false;
    this.lastHudSignature = "";

    const snapshot = this.simulation.getSnapshot();
    const hud = this.simulation.getHudSnapshot();
    this.currentSnapshot = snapshot;
    this.currentHud = hud;

    this.cameras.main.setBackgroundColor(worldTheme.background);
    this.drawBattlefield(level.id, snapshot.worldWidth, snapshot.worldHeight, snapshot.indestructibleWalls);
    this.createSprites(snapshot);
    this.breakableObstacleLayer = createBreakableObstacleLayer(this);
    this.fogLayer = createFogOfWarLayer(this);
    this.syncSnapshot(snapshot);
    createCameraRig(this.cameras.main, this.playerSprite.container, snapshot.worldWidth, snapshot.worldHeight);

    this.lastSavedCredits = snapshot.credits;
    this.lastSavedTotalScore = snapshot.totalScore;
    this.bridge.persistRunProgress({
      credits: snapshot.credits,
      totalScore: snapshot.totalScore,
    });
    this.renderHud(hud);

    this.input.mouse?.disableContextMenu();
    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.movementKeys = {
        left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      };
      this.arrowKeys = keyboard.createCursorKeys();
    }

    keyboard?.on("keydown-ESC", () => {
      if (this.helpModalOpen) {
        this.setHelpModalOpen(false);
        return;
      }

      this.scene.start("menu");
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.handleShutdown());
  }

  update(_time: number, delta: number): void {
    if (this.helpModalOpen) {
      this.renderHud(this.currentHud);
      return;
    }

    const input = this.readInput();
    const result = this.simulation.advance(delta, input);
    this.currentSnapshot = result.snapshot;
    this.currentHud = result.hud;

    result.effects.forEach((effect) => {
      spawnSimulationEffect(this, effect);
    });

    this.syncSnapshot(result.snapshot);

    if (
      result.snapshot.credits !== this.lastSavedCredits ||
      result.snapshot.totalScore !== this.lastSavedTotalScore
    ) {
      this.bridge.persistRunProgress({
        credits: result.snapshot.credits,
        totalScore: result.snapshot.totalScore,
      });
      this.lastSavedCredits = result.snapshot.credits;
      this.lastSavedTotalScore = result.snapshot.totalScore;
    }

    if (result.snapshot.status !== "active") {
      this.queueResults();
      return;
    }

    this.renderHud(result.hud);
  }

  private createSprites(snapshot: BattleSnapshot): void {
    this.playerSprite = createTankSprite(this, snapshot.player.x, snapshot.player.y, playerPalette);

    snapshot.enemies.forEach((enemy) => {
      if (!enemy.alive) {
        return;
      }

      this.enemySprites.set(
        enemy.id,
        createTankSprite(this, enemy.x, enemy.y, getEnemyPalette(enemy)),
      );
    });
  }

  private syncSnapshot(snapshot: BattleSnapshot): void {
    this.breakableObstacleLayer.sync(snapshot.breakableObstacles);
    this.syncTankSprite(this.playerSprite, snapshot.player);
    this.syncEnemySprites(snapshot.enemies);
    this.syncProjectiles(snapshot.projectiles);
    this.syncPickups(snapshot.pickups);
    this.fogLayer.sync(snapshot.visibility);
  }

  private syncEnemySprites(enemies: TankSnapshot[]): void {
    enemies.forEach((enemy) => {
      const existing = this.enemySprites.get(enemy.id);

      if (!enemy.alive) {
        if (existing) {
          existing.container.destroy(true);
          this.enemySprites.delete(enemy.id);
        }
        return;
      }

      if (!existing) {
        this.enemySprites.set(
          enemy.id,
          createTankSprite(this, enemy.x, enemy.y, getEnemyPalette(enemy)),
        );
      }

      const sprite = this.enemySprites.get(enemy.id);

      if (sprite) {
        this.syncTankSprite(sprite, enemy);
      }
    });
  }

  private syncProjectiles(projectiles: ProjectileSnapshot[]): void {
    const activeIds = new Set(projectiles.map((projectile) => projectile.id));

    this.projectileSprites.forEach((sprite, id) => {
      if (activeIds.has(id)) {
        return;
      }

      sprite.destroy();
      this.projectileSprites.delete(id);
    });

    projectiles.forEach((projectile) => {
      const existing = this.projectileSprites.get(projectile.id);

      if (!existing) {
        const key =
          projectile.faction === "player"
            ? ensureShotTexture(this, "player", worldTheme.accentSoft)
            : ensureShotTexture(this, "enemy", worldTheme.enemyGlow);
        const shot = this.add.image(projectile.x, projectile.y, key);
        shot.setDepth(5);
        this.projectileSprites.set(projectile.id, shot);
      }

      const sprite = this.projectileSprites.get(projectile.id);

      if (sprite) {
        sprite.setPosition(projectile.x, projectile.y);
      }
    });
  }

  private syncPickups(pickups: PickupSnapshot[]): void {
    const activeIds = new Set(pickups.map((pickup) => pickup.id));

    this.pickupSprites.forEach((sprite, id) => {
      if (activeIds.has(id)) {
        return;
      }

      sprite.destroy();
      this.pickupSprites.delete(id);
    });

    pickups.forEach((pickup) => {
      if (!this.pickupSprites.has(pickup.id)) {
        const key =
          pickup.kind === "repair"
            ? ensureRepairTexture(this)
            : pickup.kind === "rapidFire"
              ? ensureRapidFireTexture(this)
              : ensureCoinTexture(this);
        const sprite = this.add.image(pickup.x, pickup.y, key);
        sprite.setDepth(4);
        // Coins spin like a flipbook; power-ups bob in two hard steps.
        this.tweens.add(
          pickup.kind === "coin"
            ? { targets: sprite, scaleX: 0.25, duration: 520, yoyo: true, repeat: -1, ease: "Stepped", easeParams: [3] }
            : { targets: sprite, y: pickup.y - 6, duration: 420, yoyo: true, repeat: -1, ease: "Stepped", easeParams: [2] },
        );
        this.pickupSprites.set(pickup.id, sprite);
      }

      const sprite = this.pickupSprites.get(pickup.id);

      if (sprite && pickup.kind === "coin") {
        sprite.setPosition(pickup.x, pickup.y);
      }
    });
  }

  private syncTankSprite(sprite: TankSprite, tank: TankSnapshot): void {
    syncTankPose(sprite, tank.x, tank.y, tank.hullRotation, tank.turretRotation, tank.recoilOffset);
    sprite.container.setAlpha(tank.alive ? 1 : 0.28);
    this.renderEnemyHealthBar(sprite, tank);
  }

  private readInput(): BattleInput {
    const pointer = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const moveLeft = (this.movementKeys?.left.isDown ?? false) || (this.arrowKeys?.left.isDown ?? false);
    const moveRight =
      (this.movementKeys?.right.isDown ?? false) || (this.arrowKeys?.right.isDown ?? false);
    const moveUp = (this.movementKeys?.up.isDown ?? false) || (this.arrowKeys?.up.isDown ?? false);
    const moveDown = (this.movementKeys?.down.isDown ?? false) || (this.arrowKeys?.down.isDown ?? false);

    return {
      movementX: Number(moveRight) - Number(moveLeft),
      movementY: Number(moveDown) - Number(moveUp),
      aim: {
        x: worldPoint.x,
        y: worldPoint.y,
      },
      firing: pointer.leftButtonDown(),
    };
  }

  private renderHud(hud: BattleHudSnapshot): void {
    const activeKpis = [
      {
        label: "Health",
        meter: {
          current: Math.max(0, hud.health),
          max: hud.maxHealth,
        },
      },
      { label: "Score", value: `${hud.totalScore}` },
      { label: "Credits", value: `$${hud.credits}` },
      { label: "Enemies", value: `${hud.enemiesRemaining}` },
      { label: "Time", value: formatTime(this.currentSnapshot.elapsedMs) },
      ...(hud.rapidFireSeconds > 0 ? [{ label: "Rapid Fire", value: `${hud.rapidFireSeconds}s` }] : []),
    ];
    const viewModel = {
      layout: "active" as const,
      title: hud.title,
      copy: hud.summary,
      objective: hud.objective,
      kpis: activeKpis,
      notes: hud.controls,
      helpOpen: this.helpModalOpen,
      helpAction: {
        label: "?",
        tone: "secondary" as const,
        onPress: () => this.setHelpModalOpen(true),
      },
      helpBackAction: {
        label: "Back",
        tone: "primary" as const,
        onPress: () => this.setHelpModalOpen(false),
      },
      actions: [
        {
          label: "Restart Encounter",
          tone: "secondary" as const,
          onPress: () => this.scene.restart(),
        },
        {
          label: "Back To Menu",
          tone: "danger" as const,
          onPress: () => this.scene.start("menu"),
        },
      ],
    };

    const signature = JSON.stringify(viewModel);

    if (signature === this.lastHudSignature) {
      return;
    }

    this.lastHudSignature = signature;
    this.bridge.showHud(viewModel);
  }

  private setHelpModalOpen(open: boolean): void {
    if (this.resultsQueued || this.helpModalOpen === open) {
      return;
    }

    this.helpModalOpen = open;

    if (open) {
      this.tweens.pauseAll();
    } else {
      this.tweens.resumeAll();
    }

    this.renderHud(this.currentHud);
  }

  private queueResults(): void {
    if (this.resultsQueued) {
      return;
    }

    this.resultsQueued = true;

    if (this.helpModalOpen) {
      this.setHelpModalOpen(false);
    }

    const summary = this.simulation.getResultSummary();
    const flow = this.bridge.finalizeBattle(summary);

    this.time.delayedCall(220, () => {
      this.scene.start("results", {
        result: summary,
        flow,
      });
    });
  }

  private handleShutdown(): void {
    this.tweens.resumeAll();
    this.enemySprites.forEach((sprite) => sprite.container.destroy(true));
    this.enemySprites.clear();
    this.projectileSprites.forEach((sprite) => sprite.destroy());
    this.projectileSprites.clear();
    this.pickupSprites.forEach((sprite) => sprite.destroy());
    this.pickupSprites.clear();
    this.breakableObstacleLayer.destroy();
    this.fogLayer.destroy();
    this.bridge.clearChrome();
  }

  /** Ground and indestructible walls are baked into one pixel-art image per level. */
  private drawBattlefield(
    levelId: string,
    worldWidth: number,
    worldHeight: number,
    walls: BattleSnapshot["indestructibleWalls"],
  ): void {
    const key = ensureBattlefieldTexture(this, levelId, worldWidth, worldHeight, walls);
    this.add.image(0, 0, key).setOrigin(0).setDepth(0);
  }

  private renderEnemyHealthBar(sprite: TankSprite, tank: TankSnapshot): void {
    if (tank.faction !== "enemy" || !tank.showHealthBar || !tank.alive) {
      sprite.healthBar.clear();
      return;
    }

    drawPixelHealthBar(sprite.healthBar, tank.health / tank.maxHealth, worldTheme.enemyHealthBarFill);
  }
}

function formatTime(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

const playerPalette: TankArtPalette = {
  name: "player",
  hull: tankTheme.playerHull,
  turret: tankTheme.playerTurret,
  accent: tankTheme.playerTurret,
  width: 16,
  length: 18,
  treadWidth: 4,
  hullStyle: "standard",
  turretStyle: "dome",
  domeRadius: 4,
  barrelLength: 9,
  barrelCount: 1,
};

/**
 * One look per enemy type: colour first, then silhouette.
 * Raider: red, cross stripe. Skirmisher: teal, small, arrow chevron.
 * Bulwark: slate, wide with armour skirts, square twin-barrel turret.
 * Lancer: purple, long hull and long barrel. Warden: black and gold, triple barrel.
 */
const enemyPalettes: Record<NonNullable<TankSnapshot["archetype"]>, TankArtPalette> = {
  raider: {
    name: "raider",
    hull: tankTheme.raiderHull,
    turret: tankTheme.raiderTurret,
    accent: tankTheme.raiderAccent,
    width: 14,
    length: 16,
    treadWidth: 4,
    hullStyle: "standard",
    turretStyle: "dome",
    domeRadius: 4,
    barrelLength: 8,
    barrelCount: 1,
  },
  skirmisher: {
    name: "skirmisher",
    hull: tankTheme.skirmisherHull,
    turret: tankTheme.skirmisherTurret,
    accent: tankTheme.skirmisherAccent,
    width: 12,
    length: 13,
    treadWidth: 3,
    hullStyle: "light",
    turretStyle: "dome",
    domeRadius: 3,
    barrelLength: 7,
    barrelCount: 1,
  },
  bulwark: {
    name: "bulwark",
    hull: tankTheme.bulwarkHull,
    turret: tankTheme.bulwarkTurret,
    accent: tankTheme.bulwarkAccent,
    width: 18,
    length: 18,
    treadWidth: 5,
    hullStyle: "armoured",
    turretStyle: "square",
    domeRadius: 5,
    barrelLength: 8,
    barrelCount: 2,
  },
  lancer: {
    name: "lancer",
    hull: tankTheme.lancerHull,
    turret: tankTheme.lancerTurret,
    accent: tankTheme.lancerAccent,
    width: 12,
    length: 18,
    treadWidth: 3,
    hullStyle: "long",
    turretStyle: "dome",
    domeRadius: 3,
    barrelLength: 14,
    barrelCount: 1,
  },
  warden: {
    name: "warden",
    hull: tankTheme.wardenHull,
    turret: tankTheme.wardenTurret,
    accent: tankTheme.wardenAccent,
    width: 22,
    length: 22,
    treadWidth: 5,
    hullStyle: "fortress",
    turretStyle: "square",
    domeRadius: 6,
    barrelLength: 10,
    barrelCount: 3,
  },
};

function getEnemyPalette(enemy: TankSnapshot): TankArtPalette {
  return enemyPalettes[enemy.archetype ?? "raider"];
}
