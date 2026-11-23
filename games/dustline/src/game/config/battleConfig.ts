import { gameConfig } from "./gameConfig";

export const battleConfig = {
  fixedStepMs: 1000 / 120,
  player: {
    radius: 28,
    maxHealth: 75,
    moveSpeed: 228,
    muzzleOffset: 42,
    /** Short pause after switching cannons, so swapping can't skip a reload. */
    weaponSwitchDelayMs: 140,
    recoilRecoveryPerSecond: 42,
    turretTurnSpeedRadiansPerSecond: 10.2,
  },
  enemy: {
    radius: 28,
    muzzleOffset: 38,
    patrolArrivalRadius: 24,
    investigateArrivalRadius: 28,
    repositionArrivalRadius: 36,
    nearbyDetectionRange: 228,
    investigateDurationMs: 2200,
    repositionDurationMs: 1000,
    /** Enemies produced by a spawner pay this share of the normal reward. */
    spawnedRewardMultiplier: 0.25,
    /**
     * In range, enemies keep moving at their normal speed instead of parking: they
     * pick a new random heading around the player every so often (switchMs per type,
     * stretched or shortened at random), and drift in or out to hold their range.
     * No bursts of speed: tanks only ever drive at moveSpeed.
     */
    strafe: {
      lookAheadDistance: 80,
      maxRangeCorrection: 0.6,
      /** Each leg lasts switchMs times a random factor in this range. */
      legLengthMin: 0.5,
      legLengthMax: 1.6,
      /** Random heading spread either side of a pure sideways move, in radians. */
      headingJitterRadians: 0.9,
      switchMs: {
        raider: 1700,
        skirmisher: 950,
        bulwark: 2800,
        lancer: 3200,
        warden: 2300,
        hunter: 2000,
      },
    },
    /**
     * The enemy roster. Each type reads differently on screen (colour + silhouette,
     * see enemyTankArt in BattleScene) and in how it fights.
     * radius: collision size. weapon: which cannon it carries (see weapons).
     * shotCount/spreadRadians: shells per volley and fan.
     */
    archetypes: {
      raider: {
        maxHealth: 290,
        moveSpeed: 165,
        fireCooldownMs: 920,
        projectileSpeed: 440,
        projectileDamage: 12,
        recoilKick: 4,
        recoilRecoveryPerSecond: 34,
        sightRange: 690,
        preferredRange: 280,
        engageRange: 640,
        aimInaccuracyRadians: 0.08,
        repositionDistance: 112,
        rewardCredits: 35,
        rewardScore: 140,
        radius: 28,
        weapon: "cannon",
        shotCount: 1,
        spreadRadians: 0,
      },
      skirmisher: {
        maxHealth: 200,
        moveSpeed: 205,
        fireCooldownMs: 300,
        projectileSpeed: 560,
        projectileDamage: 4,
        recoilKick: 3.6,
        recoilRecoveryPerSecond: 40,
        sightRange: 620,
        preferredRange: 236,
        engageRange: 540,
        aimInaccuracyRadians: 0.13,
        repositionDistance: 168,
        rewardCredits: 45,
        rewardScore: 180,
        radius: 24,
        weapon: "autocannon",
        shotCount: 1,
        spreadRadians: 0,
      },
      bulwark: {
        maxHealth: 580,
        moveSpeed: 106,
        fireCooldownMs: 1240,
        projectileSpeed: 420,
        projectileDamage: 6,
        recoilKick: 6,
        recoilRecoveryPerSecond: 26,
        sightRange: 740,
        preferredRange: 210,
        engageRange: 360,
        aimInaccuracyRadians: 0.05,
        repositionDistance: 84,
        rewardCredits: 65,
        rewardScore: 240,
        radius: 30,
        weapon: "scattergun",
        shotCount: 5,
        spreadRadians: 0.5,
      },
      lancer: {
        maxHealth: 240,
        moveSpeed: 98,
        fireCooldownMs: 1900,
        projectileSpeed: 1500,
        projectileDamage: 24,
        recoilKick: 7,
        recoilRecoveryPerSecond: 22,
        sightRange: 980,
        preferredRange: 560,
        engageRange: 940,
        aimInaccuracyRadians: 0.02,
        repositionDistance: 96,
        rewardCredits: 55,
        rewardScore: 220,
        radius: 26,
        weapon: "laser",
        shotCount: 1,
        spreadRadians: 0,
      },
      warden: {
        maxHealth: 2100,
        moveSpeed: 88,
        fireCooldownMs: 1350,
        projectileSpeed: 420,
        projectileDamage: 15,
        recoilKick: 6,
        recoilRecoveryPerSecond: 24,
        sightRange: 820,
        preferredRange: 320,
        engageRange: 760,
        aimInaccuracyRadians: 0.04,
        repositionDistance: 96,
        rewardCredits: 250,
        rewardScore: 900,
        radius: 40,
        weapon: "ricochet",
        shotCount: 3,
        spreadRadians: 0.3,
      },
      hunter: {
        maxHealth: 320,
        moveSpeed: 124,
        fireCooldownMs: 2300,
        projectileSpeed: 330,
        projectileDamage: 20,
        recoilKick: 5,
        recoilRecoveryPerSecond: 26,
        sightRange: 860,
        preferredRange: 430,
        engageRange: 820,
        aimInaccuracyRadians: 0.1,
        repositionDistance: 110,
        rewardCredits: 60,
        rewardScore: 230,
        radius: 27,
        weapon: "missile",
        shotCount: 1,
        spreadRadians: 0,
      },
    },
  },
  /**
   * Enemy spawners: armoured structures that keep producing tanks while the player
   * is within activationRange, up to maxAlive at a time. A level is not won until
   * every spawner is destroyed.
   */
  spawner: {
    maxHealth: 900,
    spawnIntervalMs: 5200,
    firstSpawnDelayMs: 1800,
    maxAlive: 3,
    activationRange: 820,
    rewardCredits: 120,
    rewardScore: 600,
  },
  supplyCrate: {
    maxHealth: 60,
    rewardScore: 30,
  },
  /**
   * Cannons. The player's stats come straight from here (plus upgrades). Enemies
   * use the weapon for its behaviour (range, bounces, piercing, jitter, shell
   * size) but keep their own damage, reload and shell speed from their archetype.
   * rangePx: how far a shell flies. bounces: walls it rebounds off. pierce: extra
   * tanks it passes through. jitterRadians: random wobble per shell.
   */
  weapons: {
    cannon: {
      damage: 34,
      cooldownMs: 220,
      projectileSpeed: 900,
      rangePx: 1260,
      shotCount: 1,
      spreadRadians: 0,
      jitterRadians: 0,
      bounces: 0,
      pierce: 0,
      radius: 5,
      recoilKick: 7,
    },
    autocannon: {
      damage: 15,
      cooldownMs: 75,
      projectileSpeed: 1040,
      rangePx: 980,
      shotCount: 1,
      spreadRadians: 0,
      jitterRadians: 0.07,
      bounces: 0,
      pierce: 0,
      radius: 4,
      recoilKick: 2.5,
    },
    scattergun: {
      damage: 13,
      cooldownMs: 480,
      projectileSpeed: 820,
      rangePx: 340,
      shotCount: 7,
      spreadRadians: 0.6,
      jitterRadians: 0.05,
      bounces: 0,
      pierce: 0,
      radius: 4,
      recoilKick: 10,
    },
    ricochet: {
      damage: 30,
      cooldownMs: 300,
      projectileSpeed: 700,
      rangePx: 2100,
      shotCount: 1,
      spreadRadians: 0,
      jitterRadians: 0,
      bounces: 5,
      pierce: 0,
      radius: 6,
      recoilKick: 6,
    },
    laser: {
      damage: 58,
      cooldownMs: 520,
      projectileSpeed: 2400,
      rangePx: 980,
      shotCount: 1,
      spreadRadians: 0,
      jitterRadians: 0,
      bounces: 0,
      pierce: 3,
      radius: 4,
      recoilKick: 4,
    },
    missile: {
      damage: 62,
      cooldownMs: 950,
      projectileSpeed: 480,
      rangePx: 1500,
      shotCount: 1,
      spreadRadians: 0,
      jitterRadians: 0,
      bounces: 0,
      pierce: 0,
      radius: 6,
      recoilKick: 5,
    },
  },
  /**
   * Seeker missiles turn toward the nearest target in front of them within
   * seekRangePx, at most turnRadiansPerSecond (enemy missiles turn slower so
   * the player can outdrive them).
   */
  missileHoming: {
    seekRangePx: 640,
    playerTurnRadiansPerSecond: 3.6,
    enemyTurnRadiansPerSecond: 1.7,
    /** Flies straight this long first, so it clears the launcher. */
    armMs: 120,
  },
  /** Each damage level bought in the shop adds this share of the weapon's base damage. */
  weaponUpgrades: {
    damagePerLevel: 0.2,
    maxLevel: 4,
  },
  /** Enemy ricochet shells rebound at most this many times (the player's get the full 5). */
  enemyMaxBounces: 2,
  pickup: {
    radius: 18,
    coinValue: 35,
    collectRadius: 34,
    /** Repair kit restores this share of max health. */
    repairFraction: 0.4,
    /** Rapid-fire charge: fire cooldown multiplier and how long it lasts. */
    rapidFireCooldownMultiplier: 0.5,
    rapidFireDurationMs: 9000,
    /** Freeze: enemies and spawners stop for this long. */
    freezeDurationMs: 5000,
  },
  destructible: {
    healthBarVisibleMs: 1100,
    weakWallScore: 35,
    crateScore: 20,
    /**
     * Plain crates sometimes hide a power-up (no marking, so it's a surprise).
     * chance: share of plain crates that hold one; weights pick which. Fixed per
     * crate id, so a level always hides the same things.
     */
    crateDrops: {
      chance: 0.34,
      weights: { repair: 0.45, rapidFire: 0.33, freeze: 0.22 },
    },
  },
  upgrades: {
    maxHealthPerLevel: 20,
    movementSpeedPerLevel: 18,
    visibilityRadiusTilesPerLevel: 0.55,
    /** Each Fire Rate level cuts every cannon's reload by this share. */
    fireRateReductionPerLevel: 0.07,
    turretRotationSpeedPerLevel: 1.45,
  },
  shop: {
    maxUpgradeLevel: 4,
  },
  difficulty: {
    rookie: {
      enemyHealthMultiplier: 0.84,
      enemyDamageMultiplier: 0.82,
      enemyFireCooldownMultiplier: 1.08,
    },
    normal: {
      enemyHealthMultiplier: 1,
      enemyDamageMultiplier: 1,
      enemyFireCooldownMultiplier: 1,
    },
    ace: {
      enemyHealthMultiplier: 1.18,
      enemyDamageMultiplier: 1.16,
      enemyFireCooldownMultiplier: 0.92,
    },
  },
  world: {
    maxSimulationDeltaMs: 64,
  },
  visibility: {
    tileSize: gameConfig.gridSize,
    worldWidth: gameConfig.worldWidth,
    worldHeight: gameConfig.worldHeight,
    radiusTiles: 3.4,
    refreshDistance: 18,
  },
} as const;
