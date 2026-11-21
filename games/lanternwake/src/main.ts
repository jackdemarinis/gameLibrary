import "./theme.css";
import "./jackGames.css";
import "./styles.css";
import "./themeAdapter.css";
import "./lanternwakeHud.css";
import "./stage.css";
import Phaser from "phaser";
import { AdventureScene } from "./phaser/scenes/AdventureScene";
import { AppChrome } from "./ui/AppChrome";
import { registerOffline } from "./shared/offline";

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) {
  throw new Error("App root not found.");
}

appRoot.innerHTML = `
  <div class="shell-frame">
    <div class="gameStage">
      <div id="game-root" class="game-root"></div>
      <div id="chrome-root" class="chrome-root"></div>
    </div>
  </div>
`;

const gameRoot = document.querySelector<HTMLDivElement>("#game-root");
const chromeRoot = document.querySelector<HTMLDivElement>("#chrome-root");
if (!gameRoot || !chromeRoot) {
  throw new Error("Application layers failed to mount.");
}

const chrome = new AppChrome(chromeRoot);

new Phaser.Game({
  type: Phaser.AUTO,
  parent: gameRoot,
  width: 1280,
  height: 720,
  backgroundColor: "#07130f",
  render: { antialias: true, pixelArt: false, roundPixels: false },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [new AdventureScene(chrome)],
});

registerOffline("../", ['16px "Pixelify Sans"', '700 16px "Pixelify Sans"']);
