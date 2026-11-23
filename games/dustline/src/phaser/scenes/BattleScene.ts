import Phaser from "phaser";
import { pixelTheme, tankTheme, worldTheme } from "../../game/config/theme";
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
  setTankWeapon,
  syncTankPose,
  type TankArtPalette,
  type TankSprite,
} from "../view/drawTank";
import {
  ensureBattlefieldTexture,
  ensureCoinTexture,
  ensureFreezeTexture,
  ensureRapidFireTexture,
  ensureProjectileTexture,
  ensureRepairTexture,
} from "../view/dustlinePixelArt";
import { spawnSimulationEffect } from "../view/spawnSimulationEffect";
import { isSoundMuted, playSound, setChannelVolumes, toggleSoundMuted, unlockSound } from "../audio/dustlineSound";
import { startMusic } from "../audio/dustlineMusic";
import {
  bindKey,
  bindingActions,
  bindingLabels,
  getSettings,
  keyLabel,
  resetBindings,
  updateSettings,
  type BindingAction,
} from "../settings/dustlineSettings";

export class BattleScene extends Phaser.Scene {
  private readonly bridge: SceneBridge;
  private simulation!: BattleSimulation;
  /** Physical keys held right now (KeyboardEvent.code), read against the player's bindings. */
  private readonly pressedCodes = new Set<string>();
  /** Set while the settings window waits for a key to bind. */
  private rebinding: BindingAction | null = null;
  private arrowKeys?: Phaser.Types.Input.Keyboard.CursorKeys;
  private playerSprite!: TankSprite;
  private readonly enemySprites = new Map<string, TankSprite>();
  private readonly projectileSprites = new Map<string, Phaser.GameObjects.Image>();
  private readonly pickupSprites = new Map<string, Phaser.GameObjects.Image>();
  private breakableObstacleLayer!: BreakableObstacleLayer;
  private fogLayer!: FogOfWarLayer;
  private lastHudSignature = "";
  private lastSavedTotalScore = -1;
  private currentSnapshot!: BattleSnapshot;
  private currentHud!: BattleHudSnapshot;
  private settingsOpen = false;
  private lastWheelSwitchAt = 0;
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
    this.settingsOpen = false;
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

    this.lastSavedTotalScore = snapshot.totalScore;
    this.bridge.persistRunProgress({ totalScore: snapshot.totalScore });
    this.renderHud(hud);

    this.input.mouse?.disableContextMenu();
    // The level was started by a click or key press, so audio is allowed now;
    // the listeners cover browsers that want the gesture inside the scene.
    unlockSound();
    this.input.on("pointerdown", unlockSound);
    this.input.keyboard?.on("keydown", unlockSound);
    startMusic("battle");
    const keyboard = this.input.keyboard;
    if (keyboard) {
      // Arrow keys always drive too, whatever the bindings.
      this.arrowKeys = keyboard.createCursorKeys();
    }
    this.rebinding = null;
    this.pressedCodes.clear();
    window.addEventListener("keydown", this.handleKeyDown, true);
    window.addEventListener("keyup", this.handleKeyUp, true);
    window.addEventListener("blur", this.handleBlur);

    // Inventory: number keys pick a slot, the mouse wheel steps through them.
    ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX"].forEach((keyName, index) => {
      keyboard?.on(`keydown-${keyName}`, () => this.simulation.selectWeapon(index));
    });
    this.input.on("wheel", (_pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, deltaY: number) => {
      const now = this.time.now;
      // Trackpads send a burst of wheel events per swipe: one step per 120ms.
      if (deltaY === 0 || now - this.lastWheelSwitchAt < 120) {
        return;
      }
      this.lastWheelSwitchAt = now;
      this.simulation.cycleWeapon(deltaY > 0 ? 1 : -1);
    });
    keyboard?.on("keydown-ESC", () => {
      if (this.rebinding) {
        // Esc cancels a rebind instead of closing the window.
        this.rebinding = null;
        this.renderHud(this.currentHud);
        return;
      }

      this.setSettingsOpen(!this.settingsOpen);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.handleShutdown());
  }

  update(_time: number, delta: number): void {
    if (this.settingsOpen) {
      this.renderHud(this.currentHud);
      return;
    }

    const input = this.readInput();
    const result = this.simulation.advance(delta, input);
    this.currentSnapshot = result.snapshot;
    this.currentHud = result.hud;

    const listener = result.snapshot.player;
    result.effects.forEach((effect) => {
      spawnSimulationEffect(this, effect);
      if (effect.sound) {
        playSound(effect.sound, effect, listener);
      }
    });

    this.syncSnapshot(result.snapshot);

    // Coins are only banked when the level is won (see SceneBridge.finalizeBattle).
    if (result.snapshot.totalScore !== this.lastSavedTotalScore) {
      this.bridge.persistRunProgress({ totalScore: result.snapshot.totalScore });
      this.lastSavedTotalScore = result.snapshot.totalScore;
    }

    if (result.snapshot.status !== "active") {
      this.queueResults();
      return;
    }

    this.renderHud(result.hud);
  }

  private createSprites(snapshot: BattleSnapshot): void {
    this.playerSprite = createTankSprite(this, snapshot.player.x, snapshot.player.y, playerPalette, snapshot.player.weapon);

    snapshot.enemies.forEach((enemy) => {
      if (!enemy.alive) {
        return;
      }

      this.enemySprites.set(
        enemy.id,
        createTankSprite(this, enemy.x, enemy.y, getEnemyPalette(enemy), enemy.weapon),
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
          createTankSprite(this, enemy.x, enemy.y, getEnemyPalette(enemy), enemy.weapon),
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
        const key = ensureProjectileTexture(this, projectile.kind, projectile.faction);
        const shot = this.add.image(projectile.x, projectile.y, key);
        // The nose of the sprite sits on the shell's position, the trail behind it.
        shot.setOrigin(0.75, 0.5).setDepth(5);
        this.projectileSprites.set(projectile.id, shot);
      }

      const sprite = this.projectileSprites.get(projectile.id);

      if (sprite) {
        sprite.setPosition(projectile.x, projectile.y);
        sprite.setRotation(projectile.rotation);
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
              : pickup.kind === "freeze"
                ? ensureFreezeTexture(this)
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
    setTankWeapon(this, sprite, tank.weapon);
    syncTankPose(sprite, tank.x, tank.y, tank.hullRotation, tank.turretRotation, tank.recoilOffset);
    sprite.container.setAlpha(tank.alive ? 1 : 0.28);
    if (tank.frozen) {
      sprite.hull.setTint(pixelTheme.frozenTint);
      sprite.turret.setTint(pixelTheme.frozenTint);
    } else {
      sprite.hull.clearTint();
      sprite.turret.clearTint();
    }
    this.renderEnemyHealthBar(sprite, tank);
  }

  private readInput(): BattleInput {
    const pointer = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const moveLeft = this.isBound("left") || (this.arrowKeys?.left.isDown ?? false);
    const moveRight = this.isBound("right") || (this.arrowKeys?.right.isDown ?? false);
    const moveUp = this.isBound("up") || (this.arrowKeys?.up.isDown ?? false);
    const moveDown = this.isBound("down") || (this.arrowKeys?.down.isDown ?? false);

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
      ...(hud.spawnersRemaining > 0 ? [{ label: "Spawners", value: `${hud.spawnersRemaining}` }] : []),
      { label: "Time", value: formatTime(this.currentSnapshot.elapsedMs) },
      ...(hud.rapidFireSeconds > 0 ? [{ label: "Rapid Fire", value: `${hud.rapidFireSeconds}s` }] : []),
      ...(hud.freezeSeconds > 0 ? [{ label: "Freeze", value: `${hud.freezeSeconds}s` }] : []),
    ];
    const viewModel = {
      layout: "active" as const,
      title: hud.title,
      copy: hud.summary,
      objective: hud.objective,
      kpis: activeKpis,
      notes: [...hud.controls, isSoundMuted() ? "M to turn sound on" : "M to mute sound"],
      weapons: hud.weapons.map((weapon) => ({
        slot: weapon.slot,
        label: weapon.shortName,
        level: weapon.level,
        kind: weapon.kind,
        active: weapon.active,
        onPress: () => this.simulation.selectWeapon(weapon.slot - 1),
      })),
      settingsOpen: this.settingsOpen,
      settings: this.buildSettingsViewModel(),
      settingsAction: {
        label: "Settings",
        tone: "secondary" as const,
        onPress: () => this.setSettingsOpen(true),
      },
      resumeAction: {
        label: "Resume",
        tone: "primary" as const,
        onPress: () => this.setSettingsOpen(false),
      },
      actions: [
        {
          label: "Restart Encounter",
          tone: "secondary" as const,
          onPress: () => this.scene.restart(),
        },
        {
          label: "Main Menu",
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

  private buildSettingsViewModel() {
    const settings = getSettings();
    const applyLive = (channel: "music" | "effects", value: number): void => {
      const current = getSettings();
      setChannelVolumes(
        channel === "music" ? value / 100 : current.musicVolume,
        channel === "effects" ? value / 100 : current.effectsVolume,
      );
    };

    return {
      musicVolume: Math.round(settings.musicVolume * 100),
      effectsVolume: Math.round(settings.effectsVolume * 100),
      muted: isSoundMuted(),
      bindings: bindingActions.map((action) => ({
        id: action,
        label: bindingLabels[action],
        key: keyLabel(settings.bindings[action]),
        waiting: this.rebinding === action,
      })),
      fixedControls: [
        "Arrow keys: drive (always)",
        "Mouse: aim, left click to fire",
        "1-6, mouse wheel: pick a cannon",
        "Esc: this menu",
      ],
      onVolumeInput: applyLive,
      onVolumeCommit: (channel: "music" | "effects", value: number) => {
        applyLive(channel, value);
        updateSettings(channel === "music" ? { musicVolume: value / 100 } : { effectsVolume: value / 100 });
        if (channel === "effects") {
          playSound("playerShot");
        }
        this.renderHud(this.currentHud);
      },
      onToggleMute: () => {
        unlockSound();
        toggleSoundMuted();
        this.renderHud(this.currentHud);
      },
      onRebind: (id: string) => {
        this.rebinding = this.rebinding === id ? null : (id as BindingAction);
        this.renderHud(this.currentHud);
      },
      onResetBindings: () => {
        resetBindings();
        this.rebinding = null;
        this.renderHud(this.currentHud);
      },
    };
  }

  private setSettingsOpen(open: boolean): void {
    if (this.resultsQueued || this.settingsOpen === open) {
      return;
    }

    this.settingsOpen = open;
    this.rebinding = null;
    this.pressedCodes.clear();

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

    if (this.settingsOpen) {
      this.setSettingsOpen(false);
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

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (this.rebinding) {
      if (event.code !== "Escape") {
        event.preventDefault();
        event.stopPropagation();
        bindKey(this.rebinding, event.code);
        this.rebinding = null;
        this.renderHud(this.currentHud);
      }
      return;
    }

    if (event.repeat) {
      this.pressedCodes.add(event.code);
      return;
    }
    this.pressedCodes.add(event.code);

    const bindings = getSettings().bindings;
    if (event.code === bindings.mute) {
      toggleSoundMuted();
      this.renderHud(this.currentHud);
    } else if (!this.settingsOpen && event.code === bindings.nextWeapon) {
      this.simulation.cycleWeapon(1);
    } else if (!this.settingsOpen && event.code === bindings.prevWeapon) {
      this.simulation.cycleWeapon(-1);
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.pressedCodes.delete(event.code);
  };

  /** Keys released while the window was in the background would otherwise stick. */
  private readonly handleBlur = (): void => {
    this.pressedCodes.clear();
  };

  private isBound(action: BindingAction): boolean {
    return this.pressedCodes.has(getSettings().bindings[action]);
  }

  private handleShutdown(): void {
    window.removeEventListener("keydown", this.handleKeyDown, true);
    window.removeEventListener("keyup", this.handleKeyUp, true);
    window.removeEventListener("blur", this.handleBlur);
    this.pressedCodes.clear();
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

/** Tank art is in tank art pixels (3 world px each). */
const playerPalette: TankArtPalette = {
  name: "player",
  faction: "player",
  hull: tankTheme.playerHull,
  turret: tankTheme.playerTurret,
  accent: tankTheme.playerTurret,
  width: 21,
  length: 24,
  treadWidth: 5,
  hullStyle: "standard",
  turretStyle: "dome",
  domeRadius: 5,
  barrelLength: 12,
  barrelCount: 1,
};

/**
 * One look per enemy type: colour first, then silhouette, then the cannon on top.
 * Raider: red, cross stripe, cannon. Skirmisher: teal, small, chevron, autocannon.
 * Bulwark: slate, wide with skirts, square turret, twin scatterguns.
 * Lancer: purple, long hull, laser. Warden: black and gold, triple rebound cannons.
 * Hunter: mustard, square turret with a missile pod.
 */
const enemyPalettes: Record<NonNullable<TankSnapshot["archetype"]>, TankArtPalette> = {
  raider: {
    name: "raider",
    faction: "enemy",
    hull: tankTheme.raiderHull,
    turret: tankTheme.raiderTurret,
    accent: tankTheme.raiderAccent,
    width: 19,
    length: 21,
    treadWidth: 5,
    hullStyle: "standard",
    turretStyle: "dome",
    domeRadius: 5,
    barrelLength: 11,
    barrelCount: 1,
  },
  skirmisher: {
    name: "skirmisher",
    faction: "enemy",
    hull: tankTheme.skirmisherHull,
    turret: tankTheme.skirmisherTurret,
    accent: tankTheme.skirmisherAccent,
    width: 16,
    length: 17,
    treadWidth: 4,
    hullStyle: "light",
    turretStyle: "dome",
    domeRadius: 4,
    barrelLength: 10,
    barrelCount: 1,
  },
  bulwark: {
    name: "bulwark",
    faction: "enemy",
    hull: tankTheme.bulwarkHull,
    turret: tankTheme.bulwarkTurret,
    accent: tankTheme.bulwarkAccent,
    width: 24,
    length: 24,
    treadWidth: 6,
    hullStyle: "armoured",
    turretStyle: "square",
    domeRadius: 6,
    barrelLength: 15,
    barrelCount: 2,
  },
  lancer: {
    name: "lancer",
    faction: "enemy",
    hull: tankTheme.lancerHull,
    turret: tankTheme.lancerTurret,
    accent: tankTheme.lancerAccent,
    width: 16,
    length: 24,
    treadWidth: 4,
    hullStyle: "long",
    turretStyle: "dome",
    domeRadius: 4,
    barrelLength: 16,
    barrelCount: 1,
  },
  warden: {
    name: "warden",
    faction: "enemy",
    hull: tankTheme.wardenHull,
    turret: tankTheme.wardenTurret,
    accent: tankTheme.wardenAccent,
    width: 29,
    length: 29,
    treadWidth: 7,
    hullStyle: "fortress",
    turretStyle: "square",
    domeRadius: 8,
    barrelLength: 13,
    barrelCount: 3,
  },
  hunter: {
    name: "hunter",
    faction: "enemy",
    hull: tankTheme.hunterHull,
    turret: tankTheme.hunterTurret,
    accent: tankTheme.hunterAccent,
    width: 20,
    length: 22,
    treadWidth: 5,
    hullStyle: "standard",
    turretStyle: "square",
    domeRadius: 5,
    barrelLength: 12,
    barrelCount: 1,
  },
};

function getEnemyPalette(enemy: TankSnapshot): TankArtPalette {
  return enemyPalettes[enemy.archetype ?? "raider"];
}
