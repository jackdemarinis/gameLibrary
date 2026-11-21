// Library home: a console-style game-select screen. A numbered list on the
// left picks a game; its key art fills the stage and its details sit beside it.
// Keyboard: ↑/↓ (or W/S) to choose, Enter to play, 1–9 to jump.

import "../theme.css";
import "./home.css";
import { registerOffline } from "../shared/offline";
import { games, type GameEntry } from "./games";

const lastGameKey = "gameLibrary.lastGame";

const root = document.querySelector<HTMLElement>("#library");
if (!root) throw new Error("Library mount point missing.");

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

// A relative url() inside a custom property resolves against the stylesheet
// (in /assets/), not the page, so hand CSS an absolute URL.
function artUrl(path: string): string {
  return new URL(path, document.baseURI).href;
}

function number(index: number): string {
  return String(index + 1).padStart(2, "0");
}

function readLastGame(): number {
  try {
    const index = games.findIndex((game) => game.id === localStorage.getItem(lastGameKey));
    return Math.max(0, index);
  } catch {
    return 0;
  }
}

function rememberGame(game: GameEntry): void {
  try {
    localStorage.setItem(lastGameKey, game.id);
  } catch {
    // Private mode or blocked storage: the menu just starts on the first game.
  }
}

root.innerHTML = `
  <div class="stage" aria-hidden="true">
    ${games
      .map(
        (game) => `
      <div class="stageArt" data-art="${game.id}"
        style="--art: url('${artUrl(game.art)}'); --artFocus: ${game.artFocus}"></div>`,
      )
      .join("")}
    <div class="stageShade"></div>
  </div>

  <header class="topBar">
    <span class="wordmark">Game<span class="wordmarkAccent">Library</span></span>
    <span class="topCount">${games.length} games</span>
  </header>

  <main class="gameSelect">
    <nav class="gameList" aria-label="Games">
      <p class="listLabel">Select a game</p>
      <ol>
        ${games
          .map(
            (game, index) => `
          <li>
            <a class="gameRow" href="${game.href}" data-index="${index}">
              <span class="rowNumber">${number(index)}</span>
              <span class="rowText">
                <span class="rowTitle">${escapeHtml(game.title)}</span>
                <span class="rowMeta">${escapeHtml(game.genre)} · ${escapeHtml(game.players)}</span>
              </span>
            </a>
          </li>`,
          )
          .join("")}
      </ol>
    </nav>

    <section class="detail" aria-live="polite">
      ${games
        .map(
          (game, index) => `
        <article class="detailCard" data-detail="${index}" hidden>
          <p class="detailGenre"><span class="detailNumber">${number(index)}</span>${escapeHtml(game.genre)}</p>
          <h1 class="detailTitle">${escapeHtml(game.title)}</h1>
          <p class="detailTagline">${escapeHtml(game.tagline)}</p>
          <p class="detailDescription">${escapeHtml(game.description)}</p>
          <dl class="detailFacts">
            <div><dt>Players</dt><dd>${escapeHtml(game.players)}</dd></div>
            <div><dt>Controls</dt><dd>${escapeHtml(game.controls)}</dd></div>
            ${game.badges.length ? `<div><dt>Features</dt><dd>${game.badges.map(escapeHtml).join(" · ")}</dd></div>` : ""}
          </dl>
          <a class="playButton" href="${game.href}">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" /></svg>
            Play
          </a>
        </article>`,
        )
        .join("")}
    </section>
  </main>

  <footer class="hintBar" aria-hidden="true">
    <span><kbd>↑</kbd><kbd>↓</kbd> Choose</span>
    <span><kbd>Enter</kbd> Play</span>
    <span><kbd>1</kbd>–<kbd>${games.length}</kbd> Jump</span>
  </footer>
`;

const rows = [...root.querySelectorAll<HTMLAnchorElement>(".gameRow")];
const cards = [...root.querySelectorAll<HTMLElement>(".detailCard")];
const arts = [...root.querySelectorAll<HTMLElement>(".stageArt")];
let current = -1;

function select(index: number, { focus = false } = {}): void {
  const next = (index + games.length) % games.length;
  if (focus) rows[next].focus({ preventScroll: true });
  if (next === current) return;
  current = next;
  rows.forEach((row, rowIndex) => {
    const on = rowIndex === current;
    row.classList.toggle("isOn", on);
    if (on) row.setAttribute("aria-current", "true");
    else row.removeAttribute("aria-current");
  });
  cards.forEach((card, cardIndex) => (card.hidden = cardIndex !== current));
  arts.forEach((art, artIndex) => art.classList.toggle("isOn", artIndex === current));
  rememberGame(games[current]);
}

rows.forEach((row, index) => {
  row.addEventListener("mouseenter", () => select(index));
  row.addEventListener("focus", () => select(index));
});

window.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const key = event.key.toLowerCase();
  if (key === "arrowdown" || key === "s") {
    event.preventDefault();
    select(current + 1, { focus: true });
  } else if (key === "arrowup" || key === "w") {
    event.preventDefault();
    select(current - 1, { focus: true });
  } else if (/^[1-9]$/.test(key) && Number(key) <= games.length) {
    select(Number(key) - 1, { focus: true });
  } else if (key === "enter" && !(document.activeElement instanceof HTMLAnchorElement)) {
    // Enter on a focused link already follows it; otherwise play the selection.
    window.location.href = games[current].href;
  }
});

select(readLastGame());
registerOffline("./");
