import {
  battleLevelOrder,
  getBattleLevelById,
  getNextBattleLevelId,
} from "../../game/content/levelCatalog";
import type { BattleLevelData } from "../../game/content/levelTypes";
import { getWeaponLabel, levelWeaponUnlocks } from "../../game/content/weaponCatalog";
import type { BattleResultSummary } from "../../game/simulation/battle/types";
import type { Difficulty, SaveData } from "../../game/simulation/state";
import { canPurchaseUpgrade, purchaseUpgrade, type UpgradeKey } from "../../game/simulation/shop";
import { createInitialSave } from "../../game/simulation/state";
import type { SaveStore } from "../../game/simulation/saveStore";
import type {
  AppChrome,
  HudViewModel,
  LevelIntroViewModel,
  LevelSelectViewModel,
  ShopViewModel,
  StartViewModel,
} from "../../ui/AppChrome";

export interface SceneBridgeOptions {
  chrome: AppChrome;
  saveStore: SaveStore;
}

export interface BattleFlowResult {
  nextLevel: BattleLevelData;
  currentLevel: BattleLevelData;
  shopUnlocked: boolean;
  loopedCampaign: boolean;
  newWeaponUnlocks: string[];
}

export class SceneBridge {
  readonly chrome: AppChrome;
  readonly saveStore: SaveStore;

  constructor(options: SceneBridgeOptions) {
    this.chrome = options.chrome;
    this.saveStore = options.saveStore;
  }

  loadSave(): SaveData | null {
    return this.saveStore.load();
  }

  loadOrCreateSave(): SaveData {
    return this.saveStore.loadOrCreate();
  }

  startFreshCampaign(difficulty?: Difficulty): SaveData {
    const save = createInitialSave(
      difficulty
        ? {
            difficulty,
          }
        : {},
    );
    this.saveStore.write(save);
    return save;
  }

  clearSave(): void {
    this.saveStore.clear();
  }

  getBattleLevel(): BattleLevelData {
    return getBattleLevelById(this.loadOrCreateSave().currentLevelId);
  }

  getLevelSequence(): readonly BattleLevelData[] {
    return battleLevelOrder;
  }

  getUnlockedLevels(save: SaveData = this.loadOrCreateSave()): BattleLevelData[] {
    const unlocked = new Set(save.unlockedLevelIds);
    return battleLevelOrder.filter((level) => unlocked.has(level.id));
  }

  getUnlockedWeaponLabels(save: SaveData = this.loadOrCreateSave()): string[] {
    return save.unlockedWeapons.map((weaponId) => getWeaponLabel(weaponId));
  }

  selectLevel(levelId: string): SaveData {
    const save = this.loadOrCreateSave();

    if (!save.unlockedLevelIds.includes(levelId)) {
      return save;
    }

    const updated = {
      ...save,
      currentLevelId: getBattleLevelById(levelId).id,
    };
    this.saveStore.write(updated);
    return updated;
  }

  updateDifficulty(difficulty: Difficulty): SaveData {
    const save = this.loadOrCreateSave();
    const updated = {
      ...save,
      difficulty,
      hasSelectedDifficulty: true,
    };
    this.saveStore.write(updated);
    return updated;
  }

  persistRunProgress(progress: { credits: number; totalScore: number }): void {
    const save = this.loadOrCreateSave();

    if (save.credits === progress.credits && save.totalScore === progress.totalScore) {
      return;
    }

    this.saveStore.write({
      ...save,
      credits: progress.credits,
      totalScore: progress.totalScore,
    });
  }

  finalizeBattle(summary: BattleResultSummary): BattleFlowResult {
    const save = this.loadOrCreateSave();
    const currentLevel = getBattleLevelById(save.currentLevelId);
    const baseSave = {
      ...save,
      credits: save.credits,
      totalScore: Math.max(save.totalScore, summary.totalScore),
    };

    if (summary.status !== "won") {
      this.saveStore.write(baseSave);

      return {
        nextLevel: currentLevel,
        currentLevel,
        shopUnlocked: false,
        loopedCampaign: false,
        newWeaponUnlocks: [],
      };
    }

    const nextLevelId = getNextBattleLevelId(save.currentLevelId);
    const nextLevel = getBattleLevelById(nextLevelId);
    const loopedCampaign = nextLevelId === battleLevelOrder[0].id && currentLevel.id !== nextLevelId;
    const unlockedLevelIds = mergeCampaignIds(save.unlockedLevelIds, [save.currentLevelId, nextLevelId]);
    const completedLevelIds = mergeCampaignIds(save.completedLevelIds, [save.currentLevelId]);
    const weaponUnlocks = levelWeaponUnlocks[currentLevel.id] ?? [];
    const newWeaponUnlocks = weaponUnlocks.filter((weaponId) => !save.unlockedWeapons.includes(weaponId));

    this.saveStore.write({
      ...baseSave,
      currentLevelId: nextLevelId,
      unlockedLevelIds,
      completedLevelIds,
      unlockedWeapons: [...new Set([...save.unlockedWeapons, ...newWeaponUnlocks])],
    });

    return {
      nextLevel,
      currentLevel,
      shopUnlocked: true,
      loopedCampaign,
      newWeaponUnlocks: newWeaponUnlocks.map((weaponId) => getWeaponLabel(weaponId)),
    };
  }

  purchaseUpgrade(key: UpgradeKey): SaveData {
    const save = this.loadOrCreateSave();

    if (!canPurchaseUpgrade(save, key)) {
      return save;
    }

    const updated = purchaseUpgrade(save, key);
    this.saveStore.write(updated);
    return updated;
  }

  showStart(model: StartViewModel): void {
    this.chrome.renderStart(model);
  }

  showShop(model: ShopViewModel): void {
    this.chrome.renderShop(model);
  }

  showLevelSelect(model: LevelSelectViewModel): void {
    this.chrome.renderLevelSelect(model);
  }

  showLevelIntro(model: LevelIntroViewModel): void {
    this.chrome.renderLevelIntro(model);
  }

  showHud(model: HudViewModel): void {
    this.chrome.renderHud(model);
  }

  clearChrome(): void {
    this.chrome.clear();
  }
}

function mergeCampaignIds(existing: string[], additions: string[]): string[] {
  const merged = new Set([...existing, ...additions]);
  return battleLevelOrder.map((level) => level.id).filter((levelId) => merged.has(levelId));
}
