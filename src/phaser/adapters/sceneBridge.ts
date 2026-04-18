import { foundationFeatureCards } from "../../game/content/campaignPlan";
import { trainingGroundLevel } from "../../game/content/trainingGround";
import type { SaveData } from "../../game/simulation/state";
import { createInitialSave } from "../../game/simulation/state";
import type { SaveStore } from "../../game/simulation/saveStore";
import type { AppChrome, HudViewModel, MenuViewModel } from "../../ui/AppChrome";

export interface SceneBridgeOptions {
  chrome: AppChrome;
  saveStore: SaveStore;
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
    return trainingGroundLevel;
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

  showMenu(model: MenuViewModel): void {
    this.chrome.renderMenu(model);
  }

  showHud(model: HudViewModel): void {
    this.chrome.renderHud(model);
  }

  clearChrome(): void {
    this.chrome.clear();
  }
}
