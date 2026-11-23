import { describe, expect, it } from "vitest";
import {
  canPurchaseUpgrade,
  getUpgradePrice,
  getWeaponDamage,
  getWeaponPrice,
  getWeaponUpgradePrice,
  purchaseUpgrade,
  purchaseWeapon,
  purchaseWeaponUpgrade,
} from "./shop";
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

    expect(level0Price).toBe(105);
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

    expect(canPurchaseUpgrade(save, "fireRate")).toBe(true);

    const updated = purchaseUpgrade(save, "fireRate");

    expect(updated.credits).toBeLessThan(save.credits);
    expect(updated.upgrades.fireRate).toBe(1);
  });

  it("sells cannons once, then levels up their damage", () => {
    let save = { ...createInitialSave(), credits: 1000 };

    expect(getWeaponPrice(save, "cannon")).toBeNull();
    expect(getWeaponUpgradePrice(save, "laser")).toBeNull();

    save = purchaseWeapon(save, "laser");
    expect(save.unlockedWeapons).toEqual(["cannon", "laser"]);
    expect(save.credits).toBe(1000 - 630);
    expect(getWeaponPrice(save, "laser")).toBeNull();
    expect(purchaseWeapon(save, "laser")).toBe(save);

    save = purchaseWeaponUpgrade(save, "laser");
    expect(save.weaponLevels.laser).toBe(1);
    expect(getWeaponDamage("laser", 1)).toBeGreaterThan(getWeaponDamage("laser", 0));
  });

  it("won't sell a cannon the player can't afford", () => {
    const save = { ...createInitialSave(), credits: 50 };
    expect(purchaseWeapon(save, "autocannon")).toBe(save);
  });
});
