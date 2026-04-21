import { battleConfig } from "../config/battleConfig";
import type { SaveData, UpgradeState } from "./state";

export type UpgradeKey = keyof UpgradeState;

export const shopUpgradeOrder: UpgradeKey[] = ["armor", "optics", "movement", "turret"];

export interface UpgradeDefinition {
  key: UpgradeKey;
  title: string;
  body: string;
  nextBonus: string;
}

const definitions: Record<UpgradeKey, UpgradeDefinition> = {
  armor: {
    key: "armor",
    title: "Armor Plating",
    body: "Thicken the hull so the tank survives longer in open exchanges.",
    nextBonus: `+${battleConfig.upgrades.armorHealthPerLevel} hull`,
  },
  optics: {
    key: "optics",
    title: "Optics Suite",
    body: "Push sight lines farther so threats appear earlier through the dust.",
    nextBonus: `+${battleConfig.upgrades.opticsRadiusTilesPerLevel.toFixed(2)} visibility tiles`,
  },
  movement: {
    key: "movement",
    title: "Drive Train",
    body: "Tighten acceleration and traversal so you can cut angles faster.",
    nextBonus: `+${battleConfig.upgrades.movementSpeedPerLevel} speed`,
  },
  turret: {
    key: "turret",
    title: "Turret Servos",
    body: "Refine the cannon cycle for harder-hitting, faster follow-up shots.",
    nextBonus: `+${battleConfig.upgrades.turretDamagePerLevel} damage / -${battleConfig.upgrades.turretCooldownReductionMsPerLevel}ms cooldown`,
  },
};

export function getUpgradeDefinition(key: UpgradeKey): UpgradeDefinition {
  return definitions[key];
}

export function getUpgradePrice(save: SaveData, key: UpgradeKey): number | null {
  const level = save.upgrades[key];
  return battleConfig.shop.prices[key][level] ?? null;
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
