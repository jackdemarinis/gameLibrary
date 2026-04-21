import { battleConfig } from "../../../config/battleConfig";
import { circleIntersectsCircle, circleIntersectsRect, forwardFromRotation } from "../geometry";
import type { BattleState, ProjectileState, SimulationEffect, TankState } from "../types";
import { damageTank } from "./healthSystem";
import {
  damageBreakableObstacle,
  findBreakableObstacleAtPoint,
} from "./destructibleSystem";

export function spawnProjectile(
  state: BattleState,
  shooter: TankState,
  rotationOffset = 0,
): SimulationEffect[] {
  if (!shooter.alive) {
    return [];
  }

  const firingRotation = shooter.turretRotation + rotationOffset;
  const forward = forwardFromRotation(firingRotation);
  const projectile: ProjectileState = {
    id: `projectile-${state.nextProjectileId}`,
    ownerId: shooter.id,
    faction: shooter.faction,
    position: {
      x: shooter.position.x + forward.x * shooter.muzzleOffset,
      y: shooter.position.y + forward.y * shooter.muzzleOffset,
    },
    velocity: {
      x: forward.x * shooter.projectileSpeed,
      y: forward.y * shooter.projectileSpeed,
    },
    radius: battleConfig.projectile.radius,
    damage: shooter.projectileDamage,
    ttlMs: battleConfig.projectile.ttlMs,
  };

  state.projectiles.push(projectile);
  shooter.fireCooldownRemainingMs = shooter.fireCooldownMs;
  shooter.recoilOffset = Math.min(shooter.recoilKick * 1.45, shooter.recoilOffset + shooter.recoilKick);
  state.nextProjectileId += 1;

  return [
    {
      type: "muzzleFlash",
      x: projectile.position.x,
      y: projectile.position.y,
      color: 0xffe18a,
      size: shooter.faction === "player" ? 22 : 18,
      rotation: firingRotation,
      lifetimeMs: 70,
    },
  ];
}

export function runProjectileSystem(state: BattleState, deltaSeconds: number): SimulationEffect[] {
  const effects: SimulationEffect[] = [];
  const nextProjectiles: ProjectileState[] = [];

  state.projectiles.forEach((projectile) => {
    const movedProjectile: ProjectileState = {
      ...projectile,
      position: {
        x: projectile.position.x + projectile.velocity.x * deltaSeconds,
        y: projectile.position.y + projectile.velocity.y * deltaSeconds,
      },
      ttlMs: projectile.ttlMs - deltaSeconds * 1000,
    };

    if (movedProjectile.ttlMs <= 0) {
      return;
    }

    const breakableObstacle = findBreakableObstacleAtPoint(
      state,
      movedProjectile.position,
      movedProjectile.radius,
    );

    if (breakableObstacle) {
      effects.push({
        type: "impact",
        x: movedProjectile.position.x,
        y: movedProjectile.position.y,
        color: breakableObstacle.kind === "crate" ? 0xf1c24c : 0xd6c08a,
        size: 14,
        rotation: Math.atan2(movedProjectile.velocity.y, movedProjectile.velocity.x),
      });
      effects.push(...damageBreakableObstacle(state, breakableObstacle, movedProjectile.damage));
      return;
    }

    if (
      state.level.indestructibleWalls.some((rect) =>
        circleIntersectsRect(movedProjectile.position, movedProjectile.radius, rect),
      )
    ) {
      effects.push({
        type: "impact",
        x: movedProjectile.position.x,
        y: movedProjectile.position.y,
        color: 0xcfd2bf,
        size: 13,
        rotation: Math.atan2(movedProjectile.velocity.y, movedProjectile.velocity.x),
      });
      return;
    }

    const target =
      movedProjectile.faction === "player"
        ? state.enemies.find(
            (enemy) =>
              enemy.alive &&
              circleIntersectsCircle(movedProjectile.position, movedProjectile.radius, enemy.position, enemy.radius),
          )
        : state.player.alive &&
            circleIntersectsCircle(movedProjectile.position, movedProjectile.radius, state.player.position, state.player.radius)
          ? state.player
          : null;

    if (target) {
      effects.push({
        type: "impact",
        x: movedProjectile.position.x,
        y: movedProjectile.position.y,
        color: movedProjectile.faction === "player" ? 0xf1c24c : 0xf27f48,
        size: 16,
        rotation: Math.atan2(movedProjectile.velocity.y, movedProjectile.velocity.x),
      });
      effects.push(...damageTank(state, target, movedProjectile.damage));
      return;
    }

    nextProjectiles.push(movedProjectile);
  });

  state.projectiles = nextProjectiles;
  return effects;
}
