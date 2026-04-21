import Phaser from "phaser";
import { gameConfig } from "../../game/config/gameConfig";
import { worldTheme } from "../../game/config/theme";
import { SceneBridge } from "../adapters/sceneBridge";

export class LevelSelectScene extends Phaser.Scene {
  private readonly bridge: SceneBridge;

  constructor(bridge: SceneBridge) {
    super("level-select");
    this.bridge = bridge;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(worldTheme.background);
    this.drawBackdrop();
    this.renderChrome();
    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("shop"));
  }

  private renderChrome(): void {
    const save = this.bridge.loadOrCreateSave();
    const selectedLevelId = save.currentLevelId;

    this.bridge.showLevelSelect({
      title: "Select Level",
      difficultyLabel: getDifficultyLabel(save.difficulty),
      totalScore: save.totalScore,
      levels: this.bridge.getLevelSequence().map((level, index) => ({
        number: index + 1,
        label: level.name,
        unlocked: save.unlockedLevelIds.includes(level.id),
        active: selectedLevelId === level.id,
        onPress: () => {
          this.bridge.selectLevel(level.id);
          this.scene.start("level-intro");
        },
      })),
      actions: [
        {
          label: "Back To Upgrades",
          tone: "secondary",
          onPress: () => this.scene.start("shop"),
        },
      ],
    });
  }

  private drawBackdrop(): void {
    const graphics = this.add.graphics();
    graphics.fillGradientStyle(
      0x118445,
      0x0f6f3b,
      worldTheme.background,
      worldTheme.ground,
      0.95,
    );
    graphics.fillRect(0, 0, gameConfig.width, gameConfig.height);
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
