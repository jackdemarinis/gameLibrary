import Phaser from "phaser";
import { gameConfig } from "../../game/config/gameConfig";
import { worldTheme } from "../../game/config/theme";
import { SceneBridge } from "../adapters/sceneBridge";
import { BattleScene } from "../scenes/BattleScene";
import { BootScene } from "../scenes/BootScene";
import { MenuScene } from "../scenes/MenuScene";
import { ResultsScene } from "../scenes/ResultsScene";
import { ShopScene } from "../scenes/ShopScene";

export function createGame(parent: HTMLElement, bridge: SceneBridge): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: gameConfig.width,
    height: gameConfig.height,
    backgroundColor: Phaser.Display.Color.IntegerToColor(worldTheme.background).rgba,
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: false,
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [
      new BootScene(bridge),
      new MenuScene(bridge),
      new BattleScene(bridge),
      new ResultsScene(bridge),
      new ShopScene(bridge),
    ],
  });
}
