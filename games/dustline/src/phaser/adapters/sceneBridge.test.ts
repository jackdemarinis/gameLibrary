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
    expect(bridge.loadOrCreateSave().currentLevelId).toBe("relay-station");
    expect(bridge.loadOrCreateSave().unlockedLevelIds).toEqual([
      "training-yard",
      "relay-station",
    ]);
    expect(bridge.loadOrCreateSave().completedLevelIds).toEqual(["training-yard"]);
    expect(bridge.loadOrCreateSave().credits).toBe(120);
  });

  it("won't start a level until the one before it is cleared", () => {
    let save = createInitialSave();
    const bridge = new SceneBridge({
      chrome: createChromeStub(),
      saveStore: createMemorySaveStore(() => save, (nextSave) => {
        save = nextSave;
      }),
    });

    expect(bridge.loadOrCreateSave().unlockedLevelIds).toEqual(["training-yard"]);
    expect(bridge.selectLevel("relay-station").currentLevelId).toBe("training-yard");
    expect(bridge.selectLevel("dustline-citadel").currentLevelId).toBe("training-yard");
  });

  it("banks no coins from a failed run", () => {
    let save = { ...createInitialSave(), credits: 50 };
    const bridge = new SceneBridge({
      chrome: createChromeStub(),
      saveStore: createMemorySaveStore(() => save, (nextSave) => {
        save = nextSave;
      }),
    });

    bridge.persistRunProgress({ totalScore: 90 });
    bridge.finalizeBattle({
      status: "lost",
      levelId: "training-yard",
      levelName: "Training Yard",
      creditsEarned: 120,
      pointsEarned: 90,
      totalScore: 90,
      damageTaken: 75,
      completionTimeMs: 30000,
    });

    expect(bridge.loadOrCreateSave().credits).toBe(50);
    expect(bridge.loadOrCreateSave().currentLevelId).toBe("training-yard");
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
