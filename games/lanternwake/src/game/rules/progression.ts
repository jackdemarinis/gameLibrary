// Levelling and hero stats. Pure functions: no Three.js, no DOM, so they are unit-tested.

export const maxLevel = 20;

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  return Math.round(30 * Math.pow(level, 1.4));
}

export interface LevelProgress {
  level: number;
  /** XP earned inside the current level. */
  intoLevel: number;
  /** XP the current level needs in total (0 at max level). */
  needed: number;
}

export function levelForXp(totalXp: number): LevelProgress {
  let level = 1;
  let remaining = Math.max(0, Math.floor(totalXp));
  while (level < maxLevel && remaining >= xpToNext(level)) {
    remaining -= xpToNext(level);
    level += 1;
  }
  return { level, intoLevel: level >= maxLevel ? 0 : remaining, needed: level >= maxLevel ? 0 : xpToNext(level) };
}

export interface HeroStats {
  /** Whole hearts; health is counted in half hearts. */
  maxHearts: number;
  swordDamage: number;
  maxOil: number;
  flareCost: number;
}

export function statsFor(level: number, heartContainers: number): HeroStats {
  const clamped = Math.max(1, Math.min(maxLevel, Math.floor(level)));
  return {
    maxHearts: 3 + Math.max(0, heartContainers) + Math.floor((clamped - 1) / 3),
    swordDamage: 2 + Math.floor((clamped - 1) / 2),
    maxOil: 100 + 10 * (clamped - 1),
    flareCost: 30,
  };
}

/** XP each foe kind is worth. */
export const foeXp: Record<string, number> = {
  shade: 12,
  husk: 20,
  warden: 150,
};
