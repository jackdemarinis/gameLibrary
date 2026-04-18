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
    this.scene.start("menu");
  }
}
