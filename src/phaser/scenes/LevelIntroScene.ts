import Phaser from "phaser";
import { gameConfig } from "../../game/config/gameConfig";
import { worldTheme } from "../../game/config/theme";
import { SceneBridge } from "../adapters/sceneBridge";

export class LevelIntroScene extends Phaser.Scene {
  private readonly bridge: SceneBridge;

  constructor(bridge: SceneBridge) {
    super("level-intro");
    this.bridge = bridge;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(worldTheme.background);
    this.drawBackdrop();
    this.renderChrome();
    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("level-select"));
  }

  private renderChrome(): void {
    const save = this.bridge.loadOrCreateSave();
    const level = this.bridge.getBattleLevel();

    this.bridge.showLevelIntro({
      eyebrow: "Mission Briefing",
      title: level.name,
      briefing: level.briefing,
      difficultyLabel: getDifficultyLabel(save.difficulty),
      totalScore: save.totalScore,
      credits: save.credits,
      actions: [
        {
          label: "Start Mission",
          tone: "primary",
          onPress: () => this.scene.start("battle"),
        },
        {
          label: "Back To Levels",
          tone: "secondary",
          onPress: () => this.scene.start("level-select"),
        },
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
      worldTheme.background,
      0x0e4527,
      worldTheme.ground,
      worldTheme.ground,
      0.98,
    );
    graphics.fillRect(0, 0, gameConfig.width, gameConfig.height);

    graphics.fillStyle(0xf4bf41, 0.08);
    graphics.fillTriangle(880, 80, 1230, 230, 960, 460);
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
