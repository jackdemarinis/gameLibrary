import type { BattleHudSnapshot, BattleState } from "../types";

export function buildBattleHudSnapshot(state: BattleState): BattleHudSnapshot {
  const enemiesRemaining = state.enemies.filter((enemy) => enemy.alive).length;

  if (state.status === "won") {
    return {
      status: state.status,
      title: "Mission Complete",
      summary: "Hostile armor neutralized.",
      objective:
        state.pickups.length > 0
          ? "Sweep the dropped credits, or restart the encounter from the HUD."
          : "Area is clear. Return to the menu or restart the encounter.",
      health: Math.max(0, state.player.health),
      maxHealth: state.player.maxHealth,
      credits: state.credits,
      enemiesRemaining,
      controls: [
        "WASD to move",
        "Mouse to aim",
        "Left click to fire",
      ],
    };
  }

  if (state.status === "lost") {
    return {
      status: state.status,
      title: "Tank Disabled",
      summary: "Health was depleted before the enemy was cleared.",
      objective: "Restart the encounter or return to the menu.",
      health: 0,
      maxHealth: state.player.maxHealth,
      credits: state.credits,
      enemiesRemaining,
      controls: [
        "WASD to move",
        "Mouse to aim",
        "Left click to fire",
      ],
    };
  }

  return {
    status: state.status,
    title: "Training Yard",
    summary: "Destroy the enemy tank, collect the dropped credits, and survive.",
    objective: `Enemy tanks remaining: ${enemiesRemaining}.`,
    health: state.player.health,
    maxHealth: state.player.maxHealth,
    credits: state.credits,
    enemiesRemaining,
    controls: [
      "WASD to move",
      "Mouse to aim the turret",
      "Left click to fire",
    ],
  };
}
