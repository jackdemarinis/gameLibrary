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
    const hasSave = Boolean(this.bridge.loadSave());

    this.bridge.showMenu({
      eyebrow: "MVP Combat",
      title: gameConfig.title,
      subtitle:
        "Original top-down tank shooter MVP with live movement, cursor aiming, enemy fire, coin pickups, and a single training-yard combat test level.",
      status: hasSave
        ? "Local save ready."
        : "First launch will create a local save.",
      featureCards: this.bridge.getFeatureCards(),
      actions: [
        {
          label: hasSave ? "Continue" : "Enter Training Yard",
          tone: "primary",
          onPress: () => {
            this.bridge.loadOrCreateSave();
            this.scene.start("battle");
          },
        },
        {
          label: "New Run",
          tone: "secondary",
          onPress: () => {
            this.bridge.startFreshCampaign();
            this.scene.start("battle");
          },
        },
        {
          label: "Clear Save",
          tone: "danger",
          disabled: !hasSave,
          onPress: () => {
            this.bridge.clearSave();
            this.renderChrome();
          },
        },
      ],
    });
  }

  private drawBackdrop(): void {
    const graphics = this.add.graphics();
    const accent = this.add.graphics();

    graphics.fillGradientStyle(
      worldTheme.ground,
      worldTheme.ground,
      worldTheme.background,
      worldTheme.background,
      0.95,
    );
    graphics.fillRect(0, 0, gameConfig.width, gameConfig.height);

    for (let x = -120; x < gameConfig.width + 160; x += 180) {
      graphics.fillStyle(worldTheme.groundStripe, 0.24);
      graphics.fillRect(x, 0, 96, gameConfig.height);
    }

    for (let i = 0; i < 4; i += 1) {
      const width = 240 + i * 80;
      const height = 140 + i * 40;
      const alpha = 0.1 + i * 0.04;

      graphics.fillStyle(worldTheme.wallFill, alpha);
      graphics.fillRoundedRect(
        140 + i * 180,
        120 + i * 70,
        width,
        height,
        34,
      );
    }

    accent.fillStyle(worldTheme.enemyGlow, 0.18);
    accent.fillTriangle(980, 120, 1230, 260, 1060, 430);
    accent.fillTriangle(220, 510, 460, 620, 180, 760);

    this.add
      .text(70, 560, "TACTICAL", {
        color: "#f1c24c",
        fontFamily: "Impact, Haettenschweiler, sans-serif",
        fontSize: "40px",
        letterSpacing: 5,
      })
      .setAlpha(0.4);

    this.add
      .text(70, 605, "MOVE / AIM / SHOOT", {
        color: "#cdd29c",
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: "20px",
        letterSpacing: 2,
      })
      .setAlpha(0.48);
  }
}
