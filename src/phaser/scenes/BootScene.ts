import Phaser from "phaser";
import { SceneBridge } from "../adapters/sceneBridge";

export class BootScene extends Phaser.Scene {
  private readonly bridge: SceneBridge;

  constructor(bridge: SceneBridge) {
    super("boot");
    this.bridge = bridge;
  }

  create(): void {
    this.bridge.clearChrome();
    // Each game page picks its opening scene: /dustline/ the tank menu, /lanternwake/ the adventure.
    this.scene.start(document.body.dataset.startScene === "adventure" ? "adventure" : "menu");
  }
}
