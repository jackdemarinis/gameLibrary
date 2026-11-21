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

  const appliedDamage = Math.min(target.health, amount);
  target.health = Math.max(0, target.health - amount);
  target.recentDamageMs = battleConfig.destructible.healthBarVisibleMs;

  if (target.faction === "player") {
    state.damageTaken += appliedDamage;
  }

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
      shakeDurationMs: 110,
      shakeIntensity: target.faction === "player" ? 0.0034 : 0.0026,
    },
    {
      type: "debris",
      x: target.position.x,
      y: target.position.y,
      color: target.faction === "player" ? 0x8aa95a : 0xb38a62,
      size: 16,
      count: 9,
      lifetimeMs: 340,
    },
  ];

  if (target.faction === "enemy") {
    state.pointsEarned += target.rewardScore;
    state.totalScore += target.rewardScore;
    state.pickups.push({
      id: `pickup-${state.nextPickupId}`,
      kind: "coin",
      position: { ...target.position },
      radius: battleConfig.pickup.radius,
      value: target.rewardCredits,
      scoreValue: target.rewardCredits,
    });
    state.nextPickupId += 1;
  }

  return effects;
}
