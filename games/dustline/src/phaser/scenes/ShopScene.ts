import Phaser from "phaser";
import { gameConfig } from "../../game/config/gameConfig";
import { worldTheme } from "../../game/config/theme";
import { battleConfig } from "../../game/config/battleConfig";
import { getWeaponDefinition, weaponOrder, type WeaponKind } from "../../game/content/weaponCatalog";
import type { SaveData } from "../../game/simulation/state";
import {
  getUpgradeDefinition,
  getUpgradePrice,
  getWeaponDamage,
  getWeaponPrice,
  getWeaponUpgradePrice,
  shopUpgradeOrder,
} from "../../game/simulation/shop";
import { SceneBridge } from "../adapters/sceneBridge";
import { startMusic } from "../audio/dustlineMusic";

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
  private activeTab: "upgrades" | "armory" = "upgrades";

  constructor(bridge: SceneBridge) {
    super("shop");
    this.bridge = bridge;
  }

  create(): void {
    startMusic("menu");
    this.cameras.main.setBackgroundColor(worldTheme.background);
    this.drawBackdrop();
    this.renderChrome();
    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("menu"));
    this.input.keyboard?.on("keydown-ENTER", () => {
      if (this.bridge.loadOrCreateSave().hasSelectedDifficulty) this.scene.start("level-select");
    });
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
          iconKey: key,
          category: definition.category,
          title: definition.title,
          summary: definition.body,
          nextBonus: `Next: ${definition.nextBonus}`,
          level: currentLevel,
          maxLevel: definition.maxLevel,
          priceValue: price,
          action: {
            label: difficultyLocked
              ? "Pick difficulty"
              : price === null
                ? "Maxed"
                : save.credits >= price
                  ? "Buy"
                  : `Need $${price - save.credits} more`,
            tone: price !== null && save.credits >= price ? "primary" : "secondary",
            disabled: difficultyLocked || price === null || save.credits < price,
            onPress: () => {
              this.bridge.purchaseUpgrade(key);
              this.renderChrome();
            },
          },
        };
      }),
      armory: weaponOrder.map((kind) => this.armoryOffer(save, kind, difficultyLocked)),
      activeTab: this.activeTab,
      tabs: [
        { id: "upgrades" as const, label: "Upgrades" },
        { id: "armory" as const, label: "Armory" },
      ].map((tab) => ({
        ...tab,
        onPress: () => {
          this.activeTab = tab.id;
          this.renderChrome();
        },
      })),
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

  /** A cannon card: buy it first, then level up its damage. */
  private armoryOffer(save: SaveData, kind: WeaponKind, difficultyLocked: boolean) {
    const definition = getWeaponDefinition(kind);
    const owned = save.unlockedWeapons.includes(kind);
    const level = save.weaponLevels[kind];
    const maxLevel = battleConfig.weaponUpgrades.maxLevel;
    const price = owned ? getWeaponUpgradePrice(save, kind) : getWeaponPrice(save, kind);
    const damage = getWeaponDamage(kind, level);
    const shots = battleConfig.weapons[kind].shotCount;
    const damageLabel = (value: number): string => (shots > 1 ? `${value} x${shots}` : `${value}`);
    const nextBonus = !owned
      ? `Damage ${damageLabel(damage)}`
      : level >= maxLevel
        ? `Damage ${damageLabel(damage)} · maxed`
        : `Damage ${damageLabel(damage)} > ${damageLabel(getWeaponDamage(kind, level + 1))}`;
    const affordable = price !== null && save.credits >= price;

    return {
      iconLabel: definition.iconLabel,
      category: owned ? "Owned" : "Locked",
      weaponKind: kind,
      iconKey: kind,
      title: definition.name,
      summary: definition.summary,
      nextBonus,
      level,
      maxLevel,
      priceValue: price,
      action: {
        label: difficultyLocked
          ? "Pick difficulty"
          : price === null
            ? "Maxed"
            : affordable
              ? owned
                ? "Upgrade damage"
                : "Buy cannon"
              : `Need $${price - save.credits} more`,
        tone: affordable ? ("primary" as const) : ("secondary" as const),
        disabled: difficultyLocked || !affordable,
        onPress: () => {
          if (owned) {
            this.bridge.upgradeWeapon(kind);
          } else {
            this.bridge.purchaseWeapon(kind);
          }
          this.renderChrome();
        },
      },
    };
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
