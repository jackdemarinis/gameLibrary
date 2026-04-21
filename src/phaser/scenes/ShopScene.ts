import Phaser from "phaser";
import { gameConfig } from "../../game/config/gameConfig";
import { worldTheme } from "../../game/config/theme";
import {
  getUpgradeDefinition,
  getUpgradePrice,
  shopUpgradeOrder,
  type UpgradeKey,
} from "../../game/simulation/shop";
import { battleConfig } from "../../game/config/battleConfig";
import { SceneBridge } from "../adapters/sceneBridge";

export class ShopScene extends Phaser.Scene {
  private readonly bridge: SceneBridge;

  constructor(bridge: SceneBridge) {
    super("shop");
    this.bridge = bridge;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(worldTheme.background);
    this.drawBackdrop();
    this.renderChrome();
    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("menu"));
  }

  private renderChrome(): void {
    const save = this.bridge.loadOrCreateSave();
    const nextLevel = this.bridge.getBattleLevel();

    this.bridge.showShop({
      eyebrow: "Service Bay",
      title: "Motor Pool",
      subtitle: "Tune the tank, spend salvage, and roll into the next contract with a better machine.",
      status:
        nextLevel.id === this.bridge.getLevelSequence()[0].id
          ? "Campaign loop has reset to the opening yard."
          : `Refit window open before ${nextLevel.name}.`,
      credits: save.credits,
      nextMissionTitle: nextLevel.name,
      nextMissionBriefing: nextLevel.briefing,
      offers: shopUpgradeOrder.map((key) => {
        const definition = getUpgradeDefinition(key);
        const currentLevel = save.upgrades[key];
        const price = getUpgradePrice(save, key);

        return {
          iconLabel: getUpgradeIconLabel(key),
          title: definition.title,
          summary: definition.body,
          nextBonus: definition.nextBonus,
          level: currentLevel,
          maxLevel: battleConfig.shop.maxUpgradeLevel,
          priceValue: price,
          action: {
            label:
              price === null
                ? "Maxed"
                : save.credits >= price
                  ? "Purchase"
                  : "Need More Credits",
            tone: price !== null && save.credits >= price ? "primary" : "secondary",
            disabled: price === null || save.credits < price,
            onPress: () => {
              this.bridge.purchaseUpgrade(key);
              this.renderChrome();
            },
          },
        };
      }),
      actions: [
        {
          label: `Launch ${nextLevel.name}`,
          tone: "primary",
          onPress: () => this.scene.start("battle"),
        },
        {
          label: "Back To Menu",
          tone: "secondary",
          onPress: () => this.scene.start("menu"),
        },
      ],
    });
  }

  private drawBackdrop(): void {
    const graphics = this.add.graphics();

    graphics.fillGradientStyle(
      worldTheme.background,
      worldTheme.ground,
      worldTheme.background,
      worldTheme.ground,
      0.95,
    );
    graphics.fillRect(0, 0, gameConfig.width, gameConfig.height);

    graphics.fillStyle(worldTheme.accentSoft, 0.09);
    graphics.fillRoundedRect(120, 120, 300, 180, 28);
    graphics.fillRoundedRect(980, 160, 220, 120, 28);
    graphics.fillRoundedRect(820, 510, 320, 180, 34);
  }
}

function getUpgradeIconLabel(key: UpgradeKey): string {
  switch (key) {
    case "armor":
      return "ARM";
    case "optics":
      return "VIS";
    case "movement":
      return "SPD";
    case "turret":
      return "RPM";
    default:
      return "UP";
  }
}
