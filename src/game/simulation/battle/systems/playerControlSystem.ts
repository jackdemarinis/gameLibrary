import {
  moveCircleWithCollisions,
  normalizeVector,
  rotateAngleTowards,
  rotationFromVector,
} from "../geometry";
import type { BattleInput, BattleState, SimulationEffect } from "../types";
import { spawnProjectile } from "./projectileSystem";

export function runPlayerControlSystem(
  state: BattleState,
  input: BattleInput,
  deltaSeconds: number,
): SimulationEffect[] {
  const player = state.player;
  const effects: SimulationEffect[] = [];

  if (!player.alive) {
    return effects;
  }

  const movement = normalizeVector({
    x: input.movementX,
    y: input.movementY,
  });

  if (movement.x !== 0 || movement.y !== 0) {
    const delta = {
      x: movement.x * player.moveSpeed * deltaSeconds,
      y: movement.y * player.moveSpeed * deltaSeconds,
    };

    player.position = moveCircleWithCollisions(player.position, delta, player.radius, state.obstacles);
    player.hullRotation = rotationFromVector(movement);
  }

  const aimVector = {
    x: input.aim.x - player.position.x,
    y: input.aim.y - player.position.y,
  };

  if (aimVector.x !== 0 || aimVector.y !== 0) {
    player.turretRotation = rotateAngleTowards(
      player.turretRotation,
      rotationFromVector(aimVector),
      player.turretTurnSpeed * deltaSeconds,
    );
  }

  if (state.status === "active" && input.firing && player.fireCooldownRemainingMs <= 0) {
    effects.push(...spawnProjectile(state, player));
  }

  return effects;
}
