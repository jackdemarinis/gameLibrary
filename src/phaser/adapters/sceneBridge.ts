import { foundationFeatureCards } from "../../game/content/campaignPlan";
import {
  battleLevelOrder,
  getBattleLevelById,
  getNextBattleLevelId,
} from "../../game/content/levelCatalog";
import type { BattleLevelData } from "../../game/content/levelTypes";
import type { BattleResultSummary } from "../../game/simulation/battle/types";
import type { SaveData } from "../../game/simulation/state";
import { canPurchaseUpgrade, purchaseUpgrade, type UpgradeKey } from "../../game/simulation/shop";
import { createInitialSave } from "../../game/simulation/state";
import type { SaveStore } from "../../game/simulation/saveStore";
import type { AppChrome, HudViewModel, MenuViewModel, ShopViewModel } from "../../ui/AppChrome";

export interface SceneBridgeOptions {
  chrome: AppChrome;
  saveStore: SaveStore;
}

export interface BattleFlowResult {
  nextLevel: BattleLevelData;
  currentLevel: BattleLevelData;
  shopUnlocked: boolean;
  loopedCampaign: boolean;
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

  startFreshCampaign(): SaveData {
    const save = createInitialSave();
    this.saveStore.write(save);
    return save;
  }

  clearSave(): void {
    this.saveStore.clear();
  }

  getFeatureCards() {
    return foundationFeatureCards;
  }

  getBattleLevel() {
    return getBattleLevelById(this.loadOrCreateSave().currentLevelId);
  }

  getLevelSequence() {
    return battleLevelOrder;
  }

  persistCredits(credits: number): void {
    const save = this.loadOrCreateSave();

    if (save.credits === credits) {
      return;
    }

    this.saveStore.write({
      ...save,
      credits,
    });
  }

  finalizeBattle(summary: BattleResultSummary): BattleFlowResult {
    const save = this.loadOrCreateSave();
    const currentLevel = getBattleLevelById(save.currentLevelId);

    if (summary.status !== "won") {
      return {
        nextLevel: currentLevel,
        currentLevel,
        shopUnlocked: false,
        loopedCampaign: false,
      };
    }

    const nextLevelId = getNextBattleLevelId(save.currentLevelId);
    const nextLevel = getBattleLevelById(nextLevelId);
    const loopedCampaign = nextLevelId === battleLevelOrder[0].id && currentLevel.id !== nextLevelId;

    this.saveStore.write({
      ...save,
      currentLevelId: nextLevelId,
      completedPrompts: save.completedPrompts.includes(4)
        ? save.completedPrompts
        : [...save.completedPrompts, 4],
    });

    return {
      nextLevel,
      currentLevel,
      shopUnlocked: true,
      loopedCampaign,
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

  showMenu(model: MenuViewModel): void {
    this.chrome.renderMenu(model);
  }

  showHud(model: HudViewModel): void {
    this.chrome.renderHud(model);
  }

  showShop(model: ShopViewModel): void {
    this.chrome.renderShop(model);
  }

  clearChrome(): void {
    this.chrome.clear();
  }
}
