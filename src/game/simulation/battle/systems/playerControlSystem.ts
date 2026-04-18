import { moveCircleWithCollisions, normalizeVector, rotationFromVector } from "../geometry";
import type { BattleInput, BattleState, SimulationEffect } from "../types";
import { spawnProjectile } from "./projectileSystem";

export function runPlayerControlSystem(
  state: BattleState,
  input: BattleInput,
  deltaSeconds: number,
): SimulationEffect[] {
  const player = state.player;

  if (!player.alive) {
    return [];
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
    player.turretRotation = rotationFromVector(aimVector);
  }

  if (state.status === "active" && input.firing && player.fireCooldownRemainingMs <= 0) {
    spawnProjectile(state, player);
  }

  return [];
}
