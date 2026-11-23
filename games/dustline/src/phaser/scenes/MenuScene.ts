import Phaser from "phaser";
import { goToLibrary } from "../../shared/libraryNav";
import { gameConfig } from "../../game/config/gameConfig";
import { worldTheme } from "../../game/config/theme";
import { SceneBridge } from "../adapters/sceneBridge";
import { startMusic } from "../audio/dustlineMusic";

export class MenuScene extends Phaser.Scene {
  private readonly bridge: SceneBridge;

  constructor(bridge: SceneBridge) {
    super("menu");
    this.bridge = bridge;
  }

  create(): void {
    startMusic("menu");
    // The DOM title screen paints the pixel camo field over this.
    this.cameras.main.setBackgroundColor(worldTheme.background);
    this.renderChrome();
    this.input.keyboard?.on("keydown-ENTER", () => this.startRun());
  }

  private startRun(): void {
    this.bridge.loadOrCreateSave();
    this.scene.start("shop");
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
        onPress: () => this.startRun(),
      },
      secondaryAction: {
        label: "‹ JackGames",
        tone: "secondary",
        onPress: goToLibrary,
      },
    });
  }
}
