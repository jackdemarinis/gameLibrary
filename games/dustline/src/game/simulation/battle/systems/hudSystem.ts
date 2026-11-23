import type { BattleHudSnapshot, BattleState } from "../types";

export function buildBattleHudSnapshot(state: BattleState): BattleHudSnapshot {
  const enemiesRemaining = state.enemies.filter((enemy) => enemy.alive).length;
  const spawnersRemaining = state.breakableObstacles.filter(
    (obstacle) => obstacle.kind === "spawner" && obstacle.alive,
  ).length;

  return {
    title: state.level.name,
    summary: state.level.briefing,
    objective:
      spawnersRemaining > 0
        ? `Enemy tanks remaining: ${enemiesRemaining}. Spawners remaining: ${spawnersRemaining}.`
        : `Enemy tanks remaining: ${enemiesRemaining}.`,
    health: state.player.health,
    maxHealth: state.player.maxHealth,
    credits: state.credits,
    totalScore: state.totalScore,
    enemiesRemaining,
    rapidFireSeconds: Math.ceil(state.rapidFireRemainingMs / 1000),
    freezeSeconds: Math.ceil(state.freezeRemainingMs / 1000),
    spawnersRemaining,
    weapons: state.playerLoadout.map((weapon, index) => ({
      slot: index + 1,
      kind: weapon.kind,
      shortName: weapon.shortName,
      level: weapon.level,
      active: index === state.activeWeaponIndex,
    })),
    controls: [
      "WASD or arrow keys to move",
      "Mouse to aim the turret",
      "Left click to fire (hold for the autocannon)",
      "1-6, the mouse wheel or a click on the inventory to switch cannons",
    ],
  };
}
