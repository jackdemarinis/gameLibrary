import { describe, expect, it } from "vitest";
import { canPurchaseUpgrade, getUpgradePrice, purchaseUpgrade } from "./shop";
import { createInitialSave } from "./state";

describe("shop", () => {
  it("scales upgrade prices nonlinearly", () => {
    const save = createInitialSave();
    const level0Price = getUpgradePrice(save, "maxHealth");
    const level1Price = getUpgradePrice(
      {
        ...save,
        upgrades: {
          ...save.upgrades,
          maxHealth: 1,
        },
      },
      "maxHealth",
    );
    const level2Price = getUpgradePrice(
      {
        ...save,
        upgrades: {
          ...save.upgrades,
          maxHealth: 2,
        },
      },
      "maxHealth",
    );

    expect(level0Price).toBe(60);
    expect(level1Price).toBeGreaterThan(level0Price ?? 0);
    expect((level2Price ?? 0) - (level1Price ?? 0)).toBeGreaterThan(
      (level1Price ?? 0) - (level0Price ?? 0),
    );
  });

  it("buys a permanent upgrade and spends coins once", () => {
    const save = {
      ...createInitialSave(),
      credits: 200,
    };

    expect(canPurchaseUpgrade(save, "weaponDamage")).toBe(true);

    const updated = purchaseUpgrade(save, "weaponDamage");

    expect(updated.credits).toBeLessThan(save.credits);
    expect(updated.upgrades.weaponDamage).toBe(1);
  });
});
