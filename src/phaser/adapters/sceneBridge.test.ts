import { describe, expect, it } from "vitest";
import { SceneBridge } from "./sceneBridge";
import type { SaveStore } from "../../game/simulation/saveStore";
import { createInitialSave, type SaveData } from "../../game/simulation/state";
import type { AppChrome } from "../../ui/AppChrome";

describe("SceneBridge", () => {
  it("advances the campaign after a completed level", () => {
    let save = createInitialSave();

    const bridge = new SceneBridge({
      chrome: createChromeStub(),
      saveStore: createMemorySaveStore(() => save, (nextSave) => {
        save = nextSave;
      }),
    });

    const flow = bridge.finalizeBattle({
      status: "won",
      levelId: "training-yard",
      levelName: "Training Yard",
      creditsEarned: 120,
      pointsEarned: 275,
      totalScore: 275,
      damageTaken: 18,
      completionTimeMs: 48000,
    });

    expect(flow.currentLevel.id).toBe("training-yard");
    expect(flow.nextLevel.id).toBe("relay-station");
    expect(flow.shopUnlocked).toBe(true);
    expect(flow.newWeaponUnlocks).toEqual(["Burst Cannon"]);
    expect(bridge.loadOrCreateSave().currentLevelId).toBe("relay-station");
    expect(bridge.loadOrCreateSave().unlockedLevelIds).toEqual([
      "training-yard",
      "relay-station",
    ]);
    expect(bridge.loadOrCreateSave().completedLevelIds).toEqual(["training-yard"]);
    expect(bridge.loadOrCreateSave().unlockedWeapons).toContain("burst-cannon");
  });
});

function createChromeStub(): AppChrome {
  return {
    clear() {},
    renderHud() {},
    renderStart() {},
    renderShop() {},
    renderLevelSelect() {},
    renderLevelIntro() {},
  } as unknown as AppChrome;
}

function createMemorySaveStore(
  getSave: () => SaveData,
  setSave: (save: SaveData) => void,
): SaveStore {
  return {
    key: "test-save",
    load() {
      return getSave();
    },
    loadOrCreate() {
      return getSave();
    },
    write(data) {
      setSave(data);
    },
    clear() {
      setSave(createInitialSave());
    },
  };
}
