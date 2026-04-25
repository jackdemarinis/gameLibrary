import type { BattleHudSnapshot, BattleState } from "../types";

export function buildBattleHudSnapshot(state: BattleState): BattleHudSnapshot {
  const enemiesRemaining = state.enemies.filter((enemy) => enemy.alive).length;

  return {
    title: state.level.name,
    summary: state.level.briefing,
    objective: `Enemy tanks remaining: ${enemiesRemaining}.`,
    health: state.player.health,
    maxHealth: state.player.maxHealth,
    credits: state.credits,
    totalScore: state.totalScore,
    enemiesRemaining,
    controls: [
      "WASD or arrow keys to move",
      "Mouse to aim the turret",
      "Left click to fire",
    ],
  };
}
