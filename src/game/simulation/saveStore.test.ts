import { describe, expect, it } from "vitest";
import { createSaveStore } from "./saveStore";

class MemoryStorage implements Storage {
  private readonly state = new Map<string, string>();

  get length(): number {
    return this.state.size;
  }

  clear(): void {
    this.state.clear();
  }

  getItem(key: string): string | null {
    return this.state.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.state.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.state.delete(key);
  }

  setItem(key: string, value: string): void {
    this.state.set(key, value);
  }
}

describe("save store", () => {
  it("creates and persists the current campaign save shape", () => {
    const storage = new MemoryStorage();
    const store = createSaveStore(storage);
    const save = store.loadOrCreate();

    expect(save.version).toBe(3);
    expect(save.currentLevelId).toBe("training-yard");
    expect(save.totalScore).toBe(0);
    expect(save.hasSelectedDifficulty).toBe(false);
    expect(save.unlockedLevelIds).toEqual(["training-yard"]);
    expect(save.completedLevelIds).toEqual([]);
    expect(save.unlockedWeapons).toEqual(["starter-cannon"]);
    expect(store.load()).toEqual(save);
  });

  it("ignores malformed stored data", () => {
    const storage = new MemoryStorage();
    storage.setItem("dustline-brigade/save", JSON.stringify({ bad: true }));

    const store = createSaveStore(storage);

    expect(store.load()).toBeNull();
  });

  it("migrates legacy upgrade saves into the new schema", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "dustline-brigade/save",
      JSON.stringify({
        version: 1,
        profileName: "legacy-operator",
        createdAt: "2026-04-01T12:00:00.000Z",
        credits: 255,
        currentLevelId: "relay-station",
        difficulty: "normal",
        upgrades: {
          armor: 2,
          optics: 1,
          movement: 3,
          turret: 2,
        },
        unlockedWeapons: ["starter-cannon"],
        completedPrompts: [0, 4],
      }),
    );

    const store = createSaveStore(storage);
    const save = store.loadOrCreate();

    expect(save.version).toBe(3);
    expect(save.currentLevelId).toBe("relay-station");
    expect(save.totalScore).toBe(0);
    expect(save.hasSelectedDifficulty).toBe(true);
    expect(save.unlockedLevelIds).toEqual(["training-yard", "relay-station"]);
    expect(save.upgrades).toMatchObject({
      maxHealth: 2,
      visibilityRadius: 1,
      movementSpeed: 3,
      weaponDamage: 2,
      fireRate: 2,
      turretRotationSpeed: 1,
    });
  });

  it("clears the saved profile cleanly", () => {
    const storage = new MemoryStorage();
    const store = createSaveStore(storage);

    store.loadOrCreate();
    store.clear();

    expect(store.load()).toBeNull();
  });
});
