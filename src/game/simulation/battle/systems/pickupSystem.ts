import { battleConfig } from "../../../config/battleConfig";
import { distanceBetween } from "../geometry";
import type { BattleState, SimulationEffect } from "../types";

export function runPickupSystem(state: BattleState): SimulationEffect[] {
  if (!state.player.alive) {
    return [];
  }

  const effects: SimulationEffect[] = [];

  state.pickups = state.pickups.filter((pickup) => {
    const distance = distanceBetween(state.player.position, pickup.position);
    const collected = distance <= battleConfig.pickup.collectRadius + state.player.radius;

    if (!collected) {
      return true;
    }

    state.credits += pickup.value;
    effects.push({
      type: "pickup",
      x: pickup.position.x,
      y: pickup.position.y,
      color: 0xf1c24c,
      size: 22,
    });
    return false;
  });

  return effects;
}
