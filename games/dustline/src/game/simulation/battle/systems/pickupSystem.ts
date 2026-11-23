import { battleConfig } from "../../../config/battleConfig";
import { distanceBetween } from "../geometry";
import type { BattleState, PickupState, SimulationEffect } from "../types";

const pickupColors: Record<PickupState["kind"], number> = {
  coin: 0xf1c24c,
  repair: 0x8fe07a,
  rapidFire: 0xff7a3d,
  freeze: 0x8fdcff,
};

export function runPickupSystem(state: BattleState): SimulationEffect[] {
  if (!state.player.alive) {
    return [];
  }

  const effects: SimulationEffect[] = [];
  const player = state.player;

  state.pickups = state.pickups.filter((pickup) => {
    const distance = distanceBetween(player.position, pickup.position);
    const collected = distance <= battleConfig.pickup.collectRadius + player.radius;

    if (!collected) {
      return true;
    }

    // A repair kit stays on the floor while the tank is already at full health.
    if (pickup.kind === "repair") {
      if (player.health >= player.maxHealth) {
        return true;
      }
      player.health = Math.min(
        player.maxHealth,
        player.health + Math.round(player.maxHealth * battleConfig.pickup.repairFraction),
      );
    } else if (pickup.kind === "rapidFire") {
      state.rapidFireRemainingMs = battleConfig.pickup.rapidFireDurationMs;
    } else if (pickup.kind === "freeze") {
      state.freezeRemainingMs = battleConfig.pickup.freezeDurationMs;
    } else {
      state.credits += pickup.value;
      state.creditsEarned += pickup.value;
    }

    state.pointsEarned += pickup.scoreValue;
    state.totalScore += pickup.scoreValue;
    effects.push({
      type: "pickup",
      sound: pickup.kind,
      x: pickup.position.x,
      y: pickup.position.y,
      color: pickupColors[pickup.kind],
      size: pickup.kind === "coin" ? 22 : 30,
    });
    return false;
  });

  return effects;
}
