import "./theme.css";
import "./jackGames.css";
import "./styles.css";
import "./themeAdapter.css";
import "./lanternwakeHud.css";
import "./stage.css";
import { Game } from "./play/game";
import { registerOffline } from "./shared/offline";

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) throw new Error("App root not found.");

appRoot.innerHTML = `
  <div class="shell-frame">
    <div class="gameStage">
      <div id="game-root" class="game-root"></div>
    </div>
  </div>
`;

const gameRoot = document.querySelector<HTMLDivElement>("#game-root");
const stage = document.querySelector<HTMLDivElement>(".gameStage");
if (!gameRoot || !stage) throw new Error("Application layers failed to mount.");

const game = new Game(gameRoot, stage);
void game.start();
// Dev-only handle for automated play-testing scripts.
if (import.meta.env.DEV) Object.assign(window, { lanternwake: game });

registerOffline("../", ['500 16px "Alegreya Sans"', '700 16px "Alegreya Sans"', '700 16px "Cinzel"', '900 16px "Cinzel"']);
