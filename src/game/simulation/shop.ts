import { battleConfig } from "../config/battleConfig";
import type { SaveData, UpgradeState } from "./state";

export type UpgradeKey = keyof UpgradeState;

export const shopUpgradeOrder: UpgradeKey[] = [
  "maxHealth",
  "movementSpeed",
  "weaponDamage",
  "visibilityRadius",
  "fireRate",
  "turretRotationSpeed",
];

export interface UpgradeDefinition {
  key: UpgradeKey;
  iconLabel: string;
  category: "Core" | "Bonus";
  title: string;
  body: string;
  nextBonus: string;
  baseCost: number;
  growth: number;
  maxLevel: number;
}

const definitions: Record<UpgradeKey, UpgradeDefinition> = {
  maxHealth: {
    key: "maxHealth",
    iconLabel: "HP",
    category: "Core",
    title: "Max Health",
    body: "Thicker armor plating keeps the hull alive through longer trades.",
    nextBonus: `+${battleConfig.upgrades.maxHealthPerLevel} hull`,
    baseCost: 60,
    growth: 1.58,
    maxLevel: battleConfig.shop.maxUpgradeLevel,
  },
  movementSpeed: {
    key: "movementSpeed",
    iconLabel: "SPD",
    category: "Core",
    title: "Movement Speed",
    body: "Refined drive gearing cuts angles faster and keeps you moving.",
    nextBonus: `+${battleConfig.upgrades.movementSpeedPerLevel} speed`,
    baseCost: 55,
    growth: 1.6,
    maxLevel: battleConfig.shop.maxUpgradeLevel,
  },
  weaponDamage: {
    key: "weaponDamage",
    iconLabel: "DMG",
    category: "Core",
    title: "Weapon Damage",
    body: "Hotter shell loads make every hit matter more.",
    nextBonus: `+${battleConfig.upgrades.weaponDamagePerLevel} damage`,
    baseCost: 70,
    growth: 1.62,
    maxLevel: battleConfig.shop.maxUpgradeLevel,
  },
  visibilityRadius: {
    key: "visibilityRadius",
    iconLabel: "VIS",
    category: "Core",
    title: "Visibility Radius",
    body: "Sharper optics expose threats earlier through the fog of war.",
    nextBonus: `+${battleConfig.upgrades.visibilityRadiusTilesPerLevel.toFixed(2)} tiles`,
    baseCost: 50,
    growth: 1.55,
    maxLevel: battleConfig.shop.maxUpgradeLevel,
  },
  fireRate: {
    key: "fireRate",
    iconLabel: "ROF",
    category: "Bonus",
    title: "Fire Rate",
    body: "Trim the reload cycle for faster follow-up shots.",
    nextBonus: `-${battleConfig.upgrades.fireRateReductionMsPerLevel}ms cooldown`,
    baseCost: 80,
    growth: 1.68,
    maxLevel: battleConfig.shop.maxUpgradeLevel,
  },
  turretRotationSpeed: {
    key: "turretRotationSpeed",
    iconLabel: "TRN",
    category: "Bonus",
    title: "Turret Rotation",
    body: "Servo tuning keeps the gun tracking targets more aggressively.",
    nextBonus: `+${battleConfig.upgrades.turretRotationSpeedPerLevel.toFixed(2)} rad/s`,
    baseCost: 65,
    growth: 1.64,
    maxLevel: battleConfig.shop.maxUpgradeLevel,
  },
};

export function getUpgradeDefinition(key: UpgradeKey): UpgradeDefinition {
  return definitions[key];
}

export function getUpgradePrice(save: SaveData, key: UpgradeKey): number | null {
  const level = save.upgrades[key];
  const definition = getUpgradeDefinition(key);

  if (level >= definition.maxLevel) {
    return null;
  }

  return roundShopPrice(definition.baseCost * Math.pow(definition.growth, level));
}

export function canPurchaseUpgrade(save: SaveData, key: UpgradeKey): boolean {
  const price = getUpgradePrice(save, key);
  return price !== null && save.credits >= price;
}

export function purchaseUpgrade(save: SaveData, key: UpgradeKey): SaveData {
  const price = getUpgradePrice(save, key);

  if (price === null || save.credits < price) {
    return save;
  }

  return {
    ...save,
    credits: save.credits - price,
    upgrades: {
      ...save.upgrades,
      [key]: save.upgrades[key] + 1,
    },
  };
}

function roundShopPrice(value: number): number {
  return Math.round(value / 5) * 5;
}
