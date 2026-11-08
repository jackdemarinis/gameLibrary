import "./theme.css";
import "./styles.css";
import "./themeAdapter.css";
import "./library.css";
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

// Installable web app: offline support in production builds only, so dev reloads stay fresh.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch((error: unknown) => {
      console.warn("Service worker registration failed", error);
    });
    void cacheLoadedFonts();
  });
}

/**
 * Web fonts load before the service worker controls the page, so hand their URLs to it
 * for offline use. Pixelify Sans (Lanternwake's canvas labels) is loaded up front here.
 */
async function cacheLoadedFonts(): Promise<void> {
  try {
    await Promise.all([document.fonts.load('16px "Pixelify Sans"'), document.fonts.load('700 16px "Pixelify Sans"'), document.fonts.ready]);
    const registration = await navigator.serviceWorker.ready;
    const stylesheets = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map((link) => link.href);
    const urls = [...stylesheets, ...performance.getEntriesByType("resource").map((entry) => entry.name)];
    registration.active?.postMessage({ type: "cacheUrls", urls });
  } catch (error) {
    console.warn("Could not hand fonts to the service worker", error);
  }
}
