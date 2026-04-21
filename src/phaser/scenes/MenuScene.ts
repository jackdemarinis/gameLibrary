import Phaser from "phaser";
import { gameConfig } from "../../game/config/gameConfig";
import { worldTheme } from "../../game/config/theme";
import { SceneBridge } from "../adapters/sceneBridge";

export class MenuScene extends Phaser.Scene {
  private readonly bridge: SceneBridge;

  constructor(bridge: SceneBridge) {
    super("menu");
    this.bridge = bridge;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(worldTheme.background);
    this.drawBackdrop();
    this.renderChrome();
  }

  private renderChrome(): void {
    const save = this.bridge.loadSave();

    this.bridge.showStart({
      title: gameConfig.title,
      subtitle: "Fast tank battles, chunky upgrades, and level-by-level arcade progression.",
      saveStatus: save
        ? `Continue your run with $${save.credits} and ${save.totalScore} total points.`
        : "Start a new run and build your tank between levels.",
      playAction: {
        label: "Play",
        tone: "primary",
        onPress: () => {
          this.bridge.loadOrCreateSave();
          this.scene.start("shop");
        },
      },
    });
  }

  private drawBackdrop(): void {
    const graphics = this.add.graphics();
    const highlight = this.add.graphics();

    graphics.fillGradientStyle(
      0x10361f,
      0x0f4d27,
      worldTheme.background,
      worldTheme.ground,
      0.98,
    );
    graphics.fillRect(0, 0, gameConfig.width, gameConfig.height);

    for (let x = -160; x < gameConfig.width + 180; x += 180) {
      graphics.fillStyle(0x0a2515, 0.25);
      graphics.fillRect(x, 0, 88, gameConfig.height);
    }

    highlight.fillStyle(0xf2c544, 0.08);
    highlight.fillTriangle(920, 90, 1240, 220, 990, 480);
    highlight.fillStyle(0x8dc764, 0.1);
    highlight.fillTriangle(120, 420, 440, 700, 90, 760);
  }
}
