import Phaser from "phaser";
import { gameConfig } from "../../game/config/gameConfig";
import { worldTheme } from "../../game/config/theme";
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
import { createTankSprite, type TankSprite } from "../view/drawTank";
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
  private readonly projectileSprites = new Map<string, Phaser.GameObjects.Arc>();
  private readonly pickupSprites = new Map<string, Phaser.GameObjects.Arc>();
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
    this.simulation = new BattleSimulation(this.bridge.getBattleLevel(), save);
    this.resultsQueued = false;
    this.helpModalOpen = false;
    this.lastHudSignature = "";

    const snapshot = this.simulation.getSnapshot();
    const hud = this.simulation.getHudSnapshot();
    this.currentSnapshot = snapshot;
    this.currentHud = hud;

    this.cameras.main.setBackgroundColor(worldTheme.background);
    this.drawGround();
    this.drawIndestructibleWalls(snapshot.indestructibleWalls);
    this.createSprites(snapshot);
    this.breakableObstacleLayer = createBreakableObstacleLayer(this);
    this.fogLayer = createFogOfWarLayer(this);
    this.syncSnapshot(snapshot);
    createCameraRig(this.cameras.main, this.playerSprite.container);

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
    this.playerSprite = createTankSprite(this, snapshot.player.x, snapshot.player.y, {
      hull: worldTheme.playerHull,
      turret: worldTheme.playerTurret,
      shadowAlpha: 0.32,
      scale: 1,
    });

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
      const color = projectile.faction === "player" ? worldTheme.accentSoft : worldTheme.enemyGlow;
      const existing = this.projectileSprites.get(projectile.id);

      if (!existing) {
        const circle = this.add.circle(projectile.x, projectile.y, projectile.radius, color, 1);
        circle.setDepth(5);
        this.projectileSprites.set(projectile.id, circle);
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
        const coin = this.add.circle(pickup.x, pickup.y, pickup.radius, worldTheme.accentSoft, 0.92);
        coin.setStrokeStyle(4, 0x4a3400, 0.95);
        coin.setDepth(4);
        this.tweens.add({
          targets: coin,
          scaleX: 1.12,
          scaleY: 1.12,
          alpha: 0.7,
          duration: 440,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
        this.pickupSprites.set(pickup.id, coin);
      }

      const sprite = this.pickupSprites.get(pickup.id);

      if (sprite) {
        sprite.setPosition(pickup.x, pickup.y);
      }
    });
  }

  private syncTankSprite(sprite: TankSprite, tank: TankSnapshot): void {
    sprite.container.setPosition(tank.x, tank.y);
    sprite.container.setRotation(tank.hullRotation);
    sprite.artContainer.setY(-tank.recoilOffset);
    sprite.turret.setRotation(tank.turretRotation - tank.hullRotation);
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

  private drawGround(): void {
    const graphics = this.add.graphics();

    graphics.fillStyle(worldTheme.ground, 1);
    graphics.fillRect(0, 0, gameConfig.worldWidth, gameConfig.worldHeight);

    for (let x = 0; x < gameConfig.worldWidth; x += gameConfig.gridSize) {
      for (let y = 0; y < gameConfig.worldHeight; y += gameConfig.gridSize) {
        const useAlt = (x / gameConfig.gridSize + y / gameConfig.gridSize) % 2 === 0;

        graphics.fillStyle(useAlt ? worldTheme.groundStripe : worldTheme.ground, 0.24);
        graphics.fillRect(x, y, gameConfig.gridSize - 2, gameConfig.gridSize - 2);
      }
    }

    for (let index = 0; index < 70; index += 1) {
      graphics.fillStyle(worldTheme.floorDust, 0.11);
      graphics.fillCircle(
        Phaser.Math.Between(0, gameConfig.worldWidth),
        Phaser.Math.Between(0, gameConfig.worldHeight),
        Phaser.Math.Between(2, 5),
      );
    }
  }

  private drawIndestructibleWalls(walls: readonly { x: number; y: number; width: number; height: number }[]): void {
    const graphics = this.add.graphics();
    graphics.setDepth(1);

    walls.forEach((wall) => {
      graphics.fillStyle(worldTheme.wallFill, 1);
      graphics.lineStyle(4, worldTheme.wallStroke, 0.95);
      graphics.fillRoundedRect(wall.x, wall.y, wall.width, wall.height, 10);
      graphics.strokeRoundedRect(wall.x, wall.y, wall.width, wall.height, 10);
    });
  }

  private renderEnemyHealthBar(sprite: TankSprite, tank: TankSnapshot): void {
    const width = 56;
    const height = 8;

    sprite.healthBar.clear();

    if (tank.faction !== "enemy" || !tank.showHealthBar || !tank.alive) {
      return;
    }

    const fillWidth = Math.max(0, Math.min(width, (tank.health / tank.maxHealth) * width));

    sprite.healthBar.fillStyle(worldTheme.enemyHealthBarBack, 0.92);
    sprite.healthBar.fillRoundedRect(-width / 2 - 2, -height / 2 - 2, width + 4, height + 4, 5);
    sprite.healthBar.fillStyle(worldTheme.enemyHealthBarFill, 1);
    sprite.healthBar.fillRoundedRect(-width / 2, -height / 2, fillWidth, height, 4);
  }
}

function formatTime(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getEnemyPalette(enemy: TankSnapshot) {
  switch (enemy.archetype) {
    case "heavy":
      return {
        hull: 0x6f6d60,
        turret: 0xf0d58a,
        shadowAlpha: 0.26,
        scale: 1,
      };
    case "flanker":
      return {
        hull: 0x4c6f82,
        turret: 0xc8e0ef,
        shadowAlpha: 0.2,
        scale: 0.88,
      };
    case "chaser":
    default:
      return {
        hull: worldTheme.enemyHull,
        turret: worldTheme.accentSoft,
        shadowAlpha: 0.22,
        scale: 0.92,
      };
  }
}
