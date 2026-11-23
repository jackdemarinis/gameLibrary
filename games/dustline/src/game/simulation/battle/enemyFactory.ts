import { battleConfig } from "../../config/battleConfig";
import type { EnemyArchetype } from "../../content/levelTypes";
import type { DifficultyTuning, TankState } from "./types";

/** Builds an enemy tank from its archetype profile, scaled for difficulty. */
export function createEnemyTank(
  id: string,
  x: number,
  y: number,
  archetype: EnemyArchetype,
  patrolPoints: readonly { x: number; y: number }[],
  difficultyTuning: DifficultyTuning,
): TankState {
  const profile = battleConfig.enemy.archetypes[archetype];
  const weapon = battleConfig.weapons[profile.weapon];
  const maxHealth = Math.round(profile.maxHealth * difficultyTuning.enemyHealthMultiplier);
  const projectileDamage = Math.round(profile.projectileDamage * difficultyTuning.enemyDamageMultiplier);
  const fireCooldownMs = Math.round(
    profile.fireCooldownMs * difficultyTuning.enemyFireCooldownMultiplier,
  );

  return {
    id,
    faction: "enemy",
    archetype,
    position: { x, y },
    hullRotation: Math.PI,
    turretRotation: Math.PI,
    radius: profile.radius,
    health: maxHealth,
    maxHealth,
    moveSpeed: profile.moveSpeed,
    turretTurnSpeed: 0,
    fireCooldownMs,
    fireCooldownRemainingMs: 220 + (hashString(id) % 360),
    weapon: profile.weapon,
    shotCount: profile.shotCount,
    spreadRadians: profile.spreadRadians,
    aimJitterRadians: weapon.jitterRadians,
    projectileRangePx: weapon.rangePx,
    projectileRadius: weapon.radius,
    projectileBounces: Math.min(weapon.bounces, battleConfig.enemyMaxBounces),
    projectilePierce: 0,
    navWaypoint: null,
    navRefreshMs: 0,
    projectileSpeed: profile.projectileSpeed,
    projectileDamage,
    muzzleOffset: battleConfig.enemy.muzzleOffset + (profile.radius - battleConfig.enemy.radius),
    recoilKick: profile.recoilKick,
    recoilRecoveryPerSecond: profile.recoilRecoveryPerSecond,
    recoilOffset: 0,
    recentDamageMs: 0,
    rewardCredits: profile.rewardCredits,
    rewardScore: profile.rewardScore,
    sightRange: profile.sightRange,
    nearbyRange: battleConfig.enemy.nearbyDetectionRange,
    preferredRange: profile.preferredRange,
    engageRange: profile.engageRange,
    aimInaccuracyRadians: profile.aimInaccuracyRadians,
    repositionDistance: profile.repositionDistance,
    patrolPoints: patrolPoints.map((point) => ({ x: point.x, y: point.y })),
    aiState: patrolPoints.length > 0 ? "patrol" : "idle",
    aiStateElapsedMs: 0,
    patrolIndex: 0,
    lastKnownPlayerPosition: null,
    repositionTarget: null,
    behaviorSeed: hashString(id),
    strafeLeg: 0,
    strafeLegEndMs: 0,
    alive: true,
  };
}

export function hashString(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}
