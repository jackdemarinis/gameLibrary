import "./styles.css";
import { applyThemeVariables } from "./game/config/theme";
import { createSaveStore } from "./game/simulation/saveStore";
import { createGame } from "./phaser/boot/createGame";
import { SceneBridge } from "./phaser/adapters/sceneBridge";
import { AppChrome } from "./ui/AppChrome";

const appRoot = document.querySelector<HTMLDivElement>("#app");

if (!appRoot) {
  throw new Error("App root not found.");
}

applyThemeVariables(document.documentElement);

appRoot.innerHTML = `
  <div class="shell-frame">
    <div id="game-root" class="game-root"></div>
    <div id="chrome-root" class="chrome-root"></div>
  </div>
`;

const gameRoot = document.querySelector<HTMLDivElement>("#game-root");
const chromeRoot = document.querySelector<HTMLDivElement>("#chrome-root");

if (!gameRoot || !chromeRoot) {
  throw new Error("Application layers failed to mount.");
}

const chrome = new AppChrome(chromeRoot);
const saveStore = createSaveStore(window.localStorage);
const bridge = new SceneBridge({ chrome, saveStore });

createGame(gameRoot, bridge);
