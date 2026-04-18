import { battleConfig } from "../../../config/battleConfig";
import { circleIntersectsCircle, circleIntersectsRect, forwardFromRotation } from "../geometry";
import type { BattleState, ProjectileState, SimulationEffect, TankState } from "../types";
import { damageTank } from "./healthSystem";

export function spawnProjectile(state: BattleState, shooter: TankState): void {
  if (!shooter.alive) {
    return;
  }

  const forward = forwardFromRotation(shooter.turretRotation);
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
  state.nextProjectileId += 1;
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

    if (state.obstacles.some((rect) => circleIntersectsRect(movedProjectile.position, movedProjectile.radius, rect))) {
      effects.push({
        type: "impact",
        x: movedProjectile.position.x,
        y: movedProjectile.position.y,
        color: 0xf1c24c,
        size: 16,
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
        size: 18,
      });
      effects.push(...damageTank(state, target, movedProjectile.damage));
      return;
    }

    nextProjectiles.push(movedProjectile);
  });

  state.projectiles = nextProjectiles;
  return effects;
}
