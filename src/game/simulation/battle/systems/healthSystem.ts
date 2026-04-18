import { battleConfig } from "../../../config/battleConfig";
import type { BattleState, SimulationEffect, TankState } from "../types";

export function damageTank(
  state: BattleState,
  target: TankState,
  amount: number,
): SimulationEffect[] {
  if (!target.alive || amount <= 0) {
    return [];
  }

  target.health = Math.max(0, target.health - amount);

  if (target.health > 0) {
    return [];
  }

  target.alive = false;

  const effects: SimulationEffect[] = [
    {
      type: "explosion",
      x: target.position.x,
      y: target.position.y,
      color: target.faction === "player" ? 0xf27f48 : 0xf1c24c,
      size: 42,
    },
  ];

  if (target.faction === "enemy") {
    state.pickups.push({
      id: `pickup-${state.nextPickupId}`,
      kind: "coin",
      position: { ...target.position },
      radius: battleConfig.pickup.radius,
      value: target.rewardCredits,
    });
    state.nextPickupId += 1;
  }

  return effects;
}
