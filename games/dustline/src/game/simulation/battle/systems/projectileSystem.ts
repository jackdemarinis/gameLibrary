import { battleConfig } from "../../../config/battleConfig";
import type { WeaponKind } from "../../../content/weaponCatalog";
import { circleIntersectsCircle, circleIntersectsRect, forwardFromRotation } from "../geometry";
import type {
  BattleState,
  ProjectileState,
  SimulationEffect,
  SoundCue,
  TankFaction,
  TankState,
  Vector2,
} from "../types";
import { damageTank } from "./healthSystem";
import {
  damageBreakableObstacle,
  findBreakableObstacleAtPoint,
} from "./destructibleSystem";

/** Muzzle flash colour per cannon. */
const muzzleColor: Record<WeaponKind, number> = {
  cannon: 0xffe18a,
  autocannon: 0xffd24a,
  scattergun: 0xffa63f,
  ricochet: 0xd59cff,
  laser: 0x8fe8ff,
  missile: 0xff9a4a,
};

/** Fires one volley from the shooter's cannon: shotCount shells fanned across spreadRadians. */
export function spawnProjectile(
  state: BattleState,
  shooter: TankState,
  rotationOffset = 0,
): SimulationEffect[] {
  if (!shooter.alive) {
    return [];
  }

  const baseRotation = shooter.turretRotation + rotationOffset;
  const shots = Math.max(1, shooter.shotCount);
  const ttlMs = (shooter.projectileRangePx / Math.max(1, shooter.projectileSpeed)) * 1000;

  for (let shot = 0; shot < shots; shot += 1) {
    const fan = shots === 1 ? 0 : (shot / (shots - 1) - 0.5) * shooter.spreadRadians;
    const jitter = (projectileNoise(state.nextProjectileId) * 2 - 1) * shooter.aimJitterRadians;
    const forward = forwardFromRotation(baseRotation + fan + jitter);
    // Pellets leave at slightly different speeds so a scattergun blast spreads in depth too.
    const speed = shooter.projectileSpeed * (shots > 2 ? 0.9 + projectileNoise(state.nextProjectileId + 7919) * 0.2 : 1);
    state.projectiles.push({
      id: `projectile-${state.nextProjectileId}`,
      ownerId: shooter.id,
      faction: shooter.faction,
      position: {
        x: shooter.position.x + forward.x * shooter.muzzleOffset,
        y: shooter.position.y + forward.y * shooter.muzzleOffset,
      },
      velocity: {
        x: forward.x * speed,
        y: forward.y * speed,
      },
      radius: shooter.projectileRadius,
      damage: shooter.projectileDamage,
      ttlMs,
      kind: shooter.weapon,
      bouncesLeft: shooter.projectileBounces,
      pierceLeft: shooter.projectilePierce,
      hitTankIds: [],
      ageMs: 0,
    });
    state.nextProjectileId += 1;
  }

  const rapidFire = shooter.faction === "player" && state.rapidFireRemainingMs > 0;
  shooter.fireCooldownRemainingMs =
    shooter.fireCooldownMs * (rapidFire ? battleConfig.pickup.rapidFireCooldownMultiplier : 1);
  shooter.recoilOffset = Math.min(shooter.recoilKick * 1.45, shooter.recoilOffset + shooter.recoilKick);

  const muzzle = forwardFromRotation(baseRotation);
  return [
    {
      type: "muzzleFlash",
      sound: shotSound(shooter.weapon, shooter.faction, shots),
      weapon: shooter.weapon,
      faction: shooter.faction,
      x: shooter.position.x + muzzle.x * shooter.muzzleOffset,
      y: shooter.position.y + muzzle.y * shooter.muzzleOffset,
      color: muzzleColor[shooter.weapon],
      size: shooter.faction === "player" ? 22 : 18 + (shots - 1) * 2,
      rotation: baseRotation,
      lifetimeMs: shooter.weapon === "autocannon" ? 50 : 90,
    },
  ];
}

/**
 * Seeker missiles: turn toward the nearest target ahead (enemies for the
 * player's missiles, the player for enemy ones) at a capped rate.
 */
function steerMissile(state: BattleState, projectile: ProjectileState, deltaSeconds: number): ProjectileState {
  const homing = battleConfig.missileHoming;
  const speed = Math.hypot(projectile.velocity.x, projectile.velocity.y);
  if (speed < 1 || projectile.ageMs < homing.armMs) {
    return { ...projectile, ageMs: projectile.ageMs + deltaSeconds * 1000 };
  }
  const heading = { x: projectile.velocity.x / speed, y: projectile.velocity.y / speed };
  const candidates = projectile.faction === "player" ? state.enemies : [state.player];
  let target: TankState | null = null;
  let bestDistance: number = homing.seekRangePx;
  candidates.forEach((tank) => {
    if (!tank.alive || tank.faction === projectile.faction) return;
    const dx = tank.position.x - projectile.position.x;
    const dy = tank.position.y - projectile.position.y;
    const distance = Math.hypot(dx, dy);
    // Only targets roughly in front: a missile doesn't U-turn.
    if (distance < bestDistance && (dx * heading.x + dy * heading.y) / Math.max(1, distance) > -0.2) {
      bestDistance = distance;
      target = tank;
    }
  });

  let velocity = projectile.velocity;
  const locked = target as TankState | null;
  if (locked) {
    const current = Math.atan2(heading.y, heading.x);
    const wanted = Math.atan2(locked.position.y - projectile.position.y, locked.position.x - projectile.position.x);
    const difference = Math.atan2(Math.sin(wanted - current), Math.cos(wanted - current));
    const turnRate =
      projectile.faction === "player" ? homing.playerTurnRadiansPerSecond : homing.enemyTurnRadiansPerSecond;
    const maxTurn = turnRate * deltaSeconds;
    const angle = current + Math.max(-maxTurn, Math.min(maxTurn, difference));
    velocity = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
  }
  return { ...projectile, velocity, ageMs: projectile.ageMs + deltaSeconds * 1000 };
}

function shotSound(weapon: WeaponKind, faction: TankFaction, shots: number): SoundCue {
  switch (weapon) {
    case "autocannon":
      return "autoShot";
    case "scattergun":
      return "scatterShot";
    case "ricochet":
      return "ricochetShot";
    case "laser":
      return "laserShot";
    case "missile":
      return "missileShot";
    case "cannon":
    default:
      return faction === "player" ? "playerShot" : shots > 1 ? "heavyShot" : "enemyShot";
  }
}

export function runProjectileSystem(state: BattleState, deltaSeconds: number): SimulationEffect[] {
  const effects: SimulationEffect[] = [];
  const nextProjectiles: ProjectileState[] = [];

  state.projectiles.forEach((unsteered) => {
    const projectile = unsteered.kind === "missile" ? steerMissile(state, unsteered, deltaSeconds) : unsteered;
    const previous = projectile.position;
    const moved: ProjectileState = {
      ...projectile,
      position: {
        x: previous.x + projectile.velocity.x * deltaSeconds,
        y: previous.y + projectile.velocity.y * deltaSeconds,
      },
      ttlMs: projectile.ttlMs - deltaSeconds * 1000,
    };
    const travelRotation = Math.atan2(moved.velocity.y, moved.velocity.x);

    if (moved.ttlMs <= 0) {
      return;
    }

    const breakableObstacle = findBreakableObstacleAtPoint(state, moved.position, moved.radius);

    if (breakableObstacle) {
      effects.push({
        type: "impact",
        sound:
          moved.bouncesLeft > 0
            ? "ricochet"
            : breakableObstacle.kind === "spawner"
              ? "hitMetal"
              : breakableObstacle.kind === "weakWall"
                ? "hitWall"
                : "hitCrate",
        x: moved.position.x,
        y: moved.position.y,
        color: breakableObstacle.kind === "crate" ? 0xf1c24c : 0xd6c08a,
        size: 14,
        rotation: travelRotation,
      });
      effects.push(...damageBreakableObstacle(state, breakableObstacle, moved.damage));

      if (moved.bouncesLeft > 0) {
        // Smashed it: carry straight on through the gap. Still standing: rebound.
        nextProjectiles.push(breakableObstacle.alive ? bounce(state, moved, previous) : moved);
      }
      return;
    }

    if (hitsWall(state, moved.position, moved.radius)) {
      effects.push({
        type: "impact",
        sound: moved.bouncesLeft > 0 ? "ricochet" : "hitWall",
        x: moved.position.x,
        y: moved.position.y,
        color: moved.bouncesLeft > 0 ? 0xd59cff : 0xcfd2bf,
        size: 13,
        rotation: travelRotation,
      });

      if (moved.bouncesLeft > 0) {
        nextProjectiles.push(bounce(state, moved, previous));
      }
      return;
    }

    const target = findTankHit(state, moved);

    if (target) {
      effects.push({
        type: "impact",
        sound: moved.faction === "player" ? "hitEnemy" : "playerHurt",
        x: moved.position.x,
        y: moved.position.y,
        color: moved.kind === "laser" ? 0x8fe8ff : moved.faction === "player" ? 0xf1c24c : 0xf27f48,
        size: moved.kind === "missile" ? 26 : 16,
        rotation: travelRotation,
      });
      effects.push(...damageTank(state, target, moved.damage));

      // Laser bolts keep going through the line of tanks.
      if (moved.pierceLeft > 0) {
        nextProjectiles.push({
          ...moved,
          pierceLeft: moved.pierceLeft - 1,
          hitTankIds: [...moved.hitTankIds, target.id],
        });
      }
      return;
    }

    nextProjectiles.push(moved);
  });

  state.projectiles = nextProjectiles;
  return effects;
}

function findTankHit(state: BattleState, projectile: ProjectileState): TankState | null {
  const touches = (tank: TankState): boolean =>
    tank.alive &&
    !projectile.hitTankIds.includes(tank.id) &&
    circleIntersectsCircle(projectile.position, projectile.radius, tank.position, tank.radius);

  if (projectile.faction === "player") {
    return state.enemies.find(touches) ?? null;
  }

  return touches(state.player) ? state.player : null;
}

function hitsWall(state: BattleState, point: Vector2, radius: number): boolean {
  return state.level.indestructibleWalls.some((rect) => circleIntersectsRect(point, radius, rect));
}

function hitsAnything(state: BattleState, point: Vector2, radius: number): boolean {
  return state.obstacles.some((rect) => circleIntersectsRect(point, radius, rect));
}

/**
 * Rebound off whatever was hit: step back to where the shell was, then flip the
 * velocity on the axis that ran into the wall (both axes on a corner).
 */
function bounce(state: BattleState, projectile: ProjectileState, previous: Vector2): ProjectileState {
  const blockedX = hitsAnything(state, { x: projectile.position.x, y: previous.y }, projectile.radius);
  const blockedY = hitsAnything(state, { x: previous.x, y: projectile.position.y }, projectile.radius);
  const flipX = blockedX || !blockedY;
  const flipY = blockedY || !blockedX;

  return {
    ...projectile,
    position: { ...previous },
    velocity: {
      x: flipX ? -projectile.velocity.x : projectile.velocity.x,
      y: flipY ? -projectile.velocity.y : projectile.velocity.y,
    },
    bouncesLeft: projectile.bouncesLeft - 1,
    // A rebound can come back through a tank it already passed.
    hitTankIds: [],
  };
}

/** Deterministic 0..1 noise per shell, so replays and tests stay the same. */
function projectileNoise(seed: number): number {
  let value = Math.imul(seed + 1, 2654435761 | 0);
  value = Math.imul(value ^ (value >>> 15), 2246822507 | 0);
  value = Math.imul(value ^ (value >>> 13), 3266489909 | 0);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}
