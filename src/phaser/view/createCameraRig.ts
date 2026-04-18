import Phaser from "phaser";
import { gameConfig } from "../../game/config/gameConfig";

export function createCameraRig(
  camera: Phaser.Cameras.Scene2D.Camera,
  focus: Phaser.GameObjects.GameObject,
): void {
  camera.setBounds(0, 0, gameConfig.worldWidth, gameConfig.worldHeight);
  camera.startFollow(focus, true, 0.08, 0.08);
  camera.setZoom(gameConfig.cameraZoom);
}
