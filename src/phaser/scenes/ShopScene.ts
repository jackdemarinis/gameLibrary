import Phaser from "phaser";
import { gameConfig } from "../../game/config/gameConfig";
import { worldTheme } from "../../game/config/theme";
import {
  getUpgradeDefinition,
  getUpgradePrice,
  shopUpgradeOrder,
} from "../../game/simulation/shop";
import { SceneBridge } from "../adapters/sceneBridge";

const shopDifficultyChoices = [
  {
    key: "rookie" as const,
    label: "Easy",
    stars: "*",
    caption: "Softer enemy armor and safer fights.",
  },
  {
    key: "normal" as const,
    label: "Medium",
    stars: "**",
    caption: "Balanced campaign pressure.",
  },
  {
    key: "ace" as const,
    label: "Hard",
    stars: "***",
    caption: "Harder hits, tougher clears.",
  },
];

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
    const difficultyLocked = !save.hasSelectedDifficulty;

    this.bridge.showShop({
      title: "Upgrade Garage",
      subtitle: "Buy permanent upgrades, then head into the next mission.",
      credits: save.credits,
      totalScore: save.totalScore,
      difficultyLabel: difficultyLocked ? "Choose one" : getDifficultyLabel(save.difficulty),
      difficultyLocked,
      difficultyOptions: shopDifficultyChoices.map((choice) => ({
        label: choice.label,
        stars: choice.stars,
        caption: choice.caption,
        active: save.difficulty === choice.key && save.hasSelectedDifficulty,
        onPress: () => {
          this.bridge.updateDifficulty(choice.key);
          this.renderChrome();
        },
      })),
      unlockedWeapons: this.bridge.getUnlockedWeaponLabels(save),
      offers: shopUpgradeOrder.map((key) => {
        const definition = getUpgradeDefinition(key);
        const currentLevel = save.upgrades[key];
        const price = getUpgradePrice(save, key);

        return {
          iconLabel: definition.iconLabel,
          category: definition.category,
          title: definition.title,
          summary: definition.body,
          nextBonus: `Next: ${definition.nextBonus}`,
          level: currentLevel,
          maxLevel: definition.maxLevel,
          priceValue: price,
          action: {
            label:
              price === null
                ? "Maxed"
                : save.credits >= price
                  ? "Buy"
                  : "Locked",
            tone: price !== null && save.credits >= price ? "primary" : "secondary",
            disabled: difficultyLocked || price === null || save.credits < price,
            onPress: () => {
              this.bridge.purchaseUpgrade(key);
              this.renderChrome();
            },
          },
        };
      }),
      actions: [
        {
          label: "Menu",
          tone: "secondary",
          disabled: difficultyLocked,
          onPress: () => this.scene.start("menu"),
        },
        {
          label: "Play",
          tone: "primary",
          disabled: difficultyLocked,
          onPress: () => this.scene.start("level-select"),
        },
      ],
    });
  }

  private drawBackdrop(): void {
    const graphics = this.add.graphics();

    graphics.fillGradientStyle(
      0x0d5d2f,
      0x16773f,
      worldTheme.background,
      worldTheme.ground,
      0.98,
    );
    graphics.fillRect(0, 0, gameConfig.width, gameConfig.height);

    for (let index = 0; index < 18; index += 1) {
      graphics.fillStyle(index % 2 === 0 ? 0x1e8a4b : 0x0d5f31, 0.09);
      graphics.fillCircle(
        Phaser.Math.Between(0, gameConfig.width),
        Phaser.Math.Between(0, gameConfig.height),
        Phaser.Math.Between(30, 110),
      );
    }
  }
}

function getDifficultyLabel(value: "rookie" | "normal" | "ace"): string {
  switch (value) {
    case "rookie":
      return "Easy";
    case "ace":
      return "Hard";
    case "normal":
    default:
      return "Medium";
  }
}
