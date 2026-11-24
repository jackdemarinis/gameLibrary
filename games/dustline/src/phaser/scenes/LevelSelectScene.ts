import Phaser from "phaser";
import { gameConfig } from "../../game/config/gameConfig";
import { worldTheme } from "../../game/config/theme";
import { SceneBridge } from "../adapters/sceneBridge";
import { startMusic } from "../audio/dustlineMusic";
import { difficultyChoices, getDifficultyLabel } from "./difficultyChoices";

export class LevelSelectScene extends Phaser.Scene {
  private readonly bridge: SceneBridge;

  constructor(bridge: SceneBridge) {
    super("level-select");
    this.bridge = bridge;
  }

  create(): void {
    startMusic("menu");
    this.cameras.main.setBackgroundColor(worldTheme.background);
    this.drawBackdrop();
    this.renderChrome();
    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("menu"));
    // Enter jumps straight to the highlighted (latest) level's briefing.
    this.input.keyboard?.on("keydown-ENTER", () => {
      if (this.bridge.loadOrCreateSave().hasSelectedDifficulty) this.scene.start("level-intro");
    });
  }

  private renderChrome(): void {
    const save = this.bridge.loadOrCreateSave();
    const selectedLevelId = save.currentLevelId;

    this.bridge.showLevelSelect({
      title: "Select Level",
      difficultyLabel: save.hasSelectedDifficulty ? getDifficultyLabel(save.difficulty) : "Choose one",
      // First visit: pick a difficulty before any mission (it can't be changed later).
      difficultyOptions: save.hasSelectedDifficulty
        ? undefined
        : difficultyChoices.map((choice) => ({
            label: choice.label,
            stars: choice.stars,
            caption: choice.caption,
            onPress: () => {
              this.bridge.updateDifficulty(choice.key);
              this.renderChrome();
            },
          })),
      totalScore: save.totalScore,
      levels: this.bridge.getLevelSequence().map((level, index) => ({
        number: index + 1,
        label: level.name,
        tagline: level.tagline ?? "",
        tier: level.tier ?? "",
        unlocked: save.unlockedLevelIds.includes(level.id),
        active: selectedLevelId === level.id,
        onPress: () => {
          this.bridge.selectLevel(level.id);
          this.scene.start("level-intro");
        },
      })),
      actions: [
        {
          label: "Menu",
          tone: "secondary",
          onPress: () => this.scene.start("menu"),
        },
        {
          label: "Shop",
          tone: "primary",
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
