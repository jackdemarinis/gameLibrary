export const battleConfig = {
  fixedStepMs: 1000 / 120,
  player: {
    radius: 28,
    maxHealth: 100,
    moveSpeed: 228,
    fireCooldownMs: 220,
    projectileSpeed: 620,
    projectileDamage: 34,
    muzzleOffset: 42,
  },
  enemy: {
    radius: 28,
    maxHealth: 70,
    moveSpeed: 118,
    fireCooldownMs: 820,
    projectileSpeed: 440,
    projectileDamage: 14,
    muzzleOffset: 38,
    aggroRange: 620,
    preferredRange: 290,
  },
  projectile: {
    radius: 6,
    ttlMs: 1400,
  },
  pickup: {
    radius: 18,
    coinValue: 35,
    collectRadius: 34,
  },
  world: {
    maxSimulationDeltaMs: 64,
  },
} as const;
