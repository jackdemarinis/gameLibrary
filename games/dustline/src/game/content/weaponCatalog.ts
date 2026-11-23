/**
 * The cannons a tank can carry. Stats live in battleConfig.weapons; this file
 * holds names, shop prices and the order they appear in (and their 1-6 keys).
 */
export const weaponOrder = ["cannon", "autocannon", "scattergun", "ricochet", "laser", "missile"] as const;
export type WeaponKind = (typeof weaponOrder)[number];

export const initialWeaponId: WeaponKind = "cannon";

export interface WeaponDefinition {
  id: WeaponKind;
  name: string;
  /** HUD inventory label. */
  shortName: string;
  /** Shop badge. */
  iconLabel: string;
  summary: string;
  /** Price to buy it (0 = you start with it). */
  price: number;
  /** Damage upgrade cost: baseCost * growth^level. */
  upgradeBaseCost: number;
  upgradeGrowth: number;
}

const definitions: Record<WeaponKind, WeaponDefinition> = {
  cannon: {
    id: "cannon",
    name: "Field Cannon",
    shortName: "Cannon",
    iconLabel: "CAN",
    summary: "Your stock gun. Steady shells with a solid punch.",
    price: 0,
    upgradeBaseCost: 120,
    upgradeGrowth: 1.68,
  },
  autocannon: {
    id: "autocannon",
    name: "Autocannon",
    shortName: "Auto",
    iconLabel: "AUT",
    summary: "Hold the trigger. A stream of light tracer rounds that wanders a little.",
    price: 315,
    upgradeBaseCost: 120,
    upgradeGrowth: 1.68,
  },
  scattergun: {
    id: "scattergun",
    name: "Scattergun",
    shortName: "Scatter",
    iconLabel: "SCT",
    summary: "Seven pellets in a wide fan. Brutal up close, useless at range.",
    price: 385,
    upgradeBaseCost: 130,
    upgradeGrowth: 1.68,
  },
  ricochet: {
    id: "ricochet",
    name: "Rebound Cannon",
    shortName: "Bounce",
    iconLabel: "BNC",
    summary: "Shells bounce off up to five walls. Bank shots around corners.",
    price: 455,
    upgradeBaseCost: 140,
    upgradeGrowth: 1.68,
  },
  laser: {
    id: "laser",
    name: "Beam Laser",
    shortName: "Laser",
    iconLabel: "LSR",
    summary: "Near-instant bolt that pierces through up to four tanks in a line.",
    price: 630,
    upgradeBaseCost: 155,
    upgradeGrowth: 1.68,
  },
  missile: {
    id: "missile",
    name: "Seeker Missile",
    shortName: "Missile",
    iconLabel: "MSL",
    summary: "Slow rockets that steer themselves into the nearest enemy. Hits hard.",
    price: 735,
    upgradeBaseCost: 165,
    upgradeGrowth: 1.68,
  },
};

export function isWeaponKind(value: unknown): value is WeaponKind {
  return typeof value === "string" && (weaponOrder as readonly string[]).includes(value);
}

export function getWeaponDefinition(id: WeaponKind): WeaponDefinition {
  return definitions[id];
}

export function getWeaponLabel(id: WeaponKind): string {
  return definitions[id].name;
}
