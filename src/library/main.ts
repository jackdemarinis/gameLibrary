// JackGames home: a flat, terminal-style game portal. Featured games up top,
// category rows, then the full grid with category chips and search filtering it.

import "../theme.css";
import "../jackGames.css";
import "./home.css";
import { registerOffline } from "../shared/offline";
import { categories, games, type GameEntry } from "./games";

const root = document.querySelector<HTMLElement>("#library");
if (!root) throw new Error("Library mount point missing.");

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

// A relative url() inside a custom property resolves against the stylesheet
// (in /assets/), not the page, so hand CSS an absolute URL.
function artStyle(game: GameEntry): string {
  return `--art: url('${new URL(game.art, document.baseURI).href}'); --artFocus: ${game.artFocus}`;
}

// ---------- icons (inline, drawn in currentColor) ----------

const icons = {
  play: `<svg viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg>`,
  // A terminal window with a ">_" prompt.
  brand: `<svg viewBox="0 0 32 32" aria-hidden="true"><rect class="brandFrame" x="2" y="4" width="28" height="24"/><path class="brandPrompt" d="M8 12l5 4-5 4M16 21h8"/></svg>`,
};

// ---------- markup ----------

const [featured, ...others] = games;
const sideGames = others.slice(0, 2);

function badgeList(game: GameEntry): string {
  return game.badges
    .map((badge) => `<span class="pill badge${badge.replace(/\W/g, "")}">${escapeHtml(badge)}</span>`)
    .join("");
}

// Category colour for a game: its first category.
function catClass(game: GameEntry): string {
  return `mood-${game.categories[0]}`;
}

function featureTile(game: GameEntry): string {
  return `
    <a class="featureTile" href="${game.href}" style="${artStyle(game)}">
      <span class="featureArt" aria-hidden="true"></span>
      <span class="featureBody">
        <span class="featureText">
          <span class="featureEyebrow"><span class="featureFlag">Featured</span>${badgeList(game)}</span>
          <span class="featureTitle">${escapeHtml(game.title)}</span>
          <span class="featureTagline">${escapeHtml(game.tagline)}</span>
          <span class="featureMeta">${escapeHtml(game.players)} · ${escapeHtml(game.controls)}</span>
        </span>
        <span class="playButton">${icons.play}Play</span>
      </span>
    </a>`;
}

function sideTile(game: GameEntry): string {
  return `
    <a class="sideTile ${catClass(game)}" href="${game.href}" style="${artStyle(game)}">
      <span class="featureArt" aria-hidden="true"></span>
      <span class="sideBody">
        <span class="sideText">
          <span class="sideGenre">${escapeHtml(game.genre)}</span>
          <span class="sideTitle">${escapeHtml(game.title)}</span>
        </span>
        <span class="squarePlay" aria-hidden="true">${icons.play}</span>
      </span>
    </a>`;
}

function gridTile(game: GameEntry, index: number): string {
  const searchText = [game.title, game.genre, game.tagline, ...game.badges].join(" ").toLowerCase();
  return `
    <a class="tile" href="${game.href}" data-categories="${game.categories.join(" ")}" data-search="${escapeHtml(searchText)}">
      <span class="tileArt" style="${artStyle(game)}">
        <span class="tileBadges">${badgeList(game)}</span>
      </span>
      <span class="tileInfo">
        <span class="tileRank">${String(index + 1).padStart(2, "0")}</span>
        <span class="tileText">
          <span class="tileTitle">${escapeHtml(game.title)}</span>
          <span class="tileTagline">${escapeHtml(game.tagline)}</span>
          <span class="tileMeta">${escapeHtml(game.genre)} · ${escapeHtml(game.players)}</span>
        </span>
        <span class="squarePlay" aria-hidden="true">${icons.play}</span>
      </span>
    </a>`;
}

const usedCategories = categories.filter((category) => games.some((game) => game.categories.includes(category.id)));

root.innerHTML = `
  <header class="siteHeader">
    <a class="brand" href="./" aria-label="JackGames home">
      ${icons.brand}
      <span class="brandWord">jack<span class="brandAccent">games</span><span class="brandCursor" aria-hidden="true"></span></span>
    </a>
    <label class="search">
      <span class="searchPrompt" aria-hidden="true">&gt;</span>
      <input type="search" placeholder="search games" aria-label="Search games" autocomplete="off" spellcheck="false" />
      <kbd>/</kbd>
    </label>
  </header>

  <nav class="catRow" aria-label="Categories">
    <button class="catChip" type="button" data-filter="all" aria-pressed="true">All</button>
    ${usedCategories
      .map(
        (category) =>
          `<button class="catChip catChip-${category.id}" type="button" data-filter="${category.id}" aria-pressed="false">${escapeHtml(category.label)}</button>`,
      )
      .join("")}
  </nav>

  <main class="page">
    <section class="bento" aria-label="Featured games">
      ${featured ? featureTile(featured) : ""}
      ${sideGames.map(sideTile).join("")}
    </section>

    <section class="block" aria-labelledby="moodHeading">
      <div class="blockHead">
        <h2 class="blockTitle" id="moodHeading">Browse</h2>
      </div>
      <div class="moodRow">
        ${usedCategories
          .map((category) => {
            const count = games.filter((game) => game.categories.includes(category.id)).length;
            return `
          <button class="mood mood-${category.id}" type="button" data-filter="${category.id}">
            <span class="moodText">
              <span class="moodLabel">${escapeHtml(category.label)}</span>
              <span class="moodPitch">${escapeHtml(category.pitch)}</span>
            </span>
            <span class="moodCount">${count}</span>
          </button>`;
          })
          .join("")}
      </div>
    </section>

    <section class="block" id="allGames" aria-labelledby="allHeading">
      <div class="blockHead">
        <h2 class="blockTitle" id="allHeading">All Games</h2>
        <span class="blockCount" aria-live="polite"></span>
      </div>
      <div class="tileGrid">${games.map(gridTile).join("")}</div>
      <p class="emptyState" hidden>No games match that. <button type="button" class="linkButton" data-filter="all">Show all games</button></p>
    </section>
  </main>

  <footer class="siteFooter">
    <span class="footerBrand">jack<span class="brandAccent">games</span></span>
    <span>Free browser games, made by Jack. Best with a keyboard and mouse.</span>
  </footer>
`;

// ---------- filtering ----------

const searchInput = root.querySelector<HTMLInputElement>(".search input")!;
const chips = [...root.querySelectorAll<HTMLButtonElement>(".catChip")];
const tiles = [...root.querySelectorAll<HTMLElement>(".tile")];
const countLabel = root.querySelector<HTMLElement>(".blockCount")!;
const emptyState = root.querySelector<HTMLElement>(".emptyState")!;
const allHeading = root.querySelector<HTMLElement>("#allHeading")!;
let activeFilter = "all";

function applyFilters(): void {
  const query = searchInput.value.trim().toLowerCase();
  let shown = 0;
  for (const tile of tiles) {
    const inCategory = activeFilter === "all" || tile.dataset.categories!.split(" ").includes(activeFilter);
    const matches = !query || tile.dataset.search!.includes(query);
    tile.hidden = !(inCategory && matches);
    if (!tile.hidden) shown += 1;
  }
  chips.forEach((chip) => chip.setAttribute("aria-pressed", String(chip.dataset.filter === activeFilter)));
  const category = categories.find((entry) => entry.id === activeFilter);
  allHeading.textContent = category ? category.label : "All Games";
  countLabel.textContent = `${shown} ${shown === 1 ? "game" : "games"}`;
  emptyState.hidden = shown > 0;
}

function setFilter(filter: string, { reveal = false } = {}): void {
  activeFilter = filter;
  if (filter === "all") searchInput.value = "";
  applyFilters();
  if (reveal) root!.querySelector("#allGames")!.scrollIntoView({ behavior: "smooth", block: "start" });
}

root.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-filter]");
  if (!button) return;
  // Chips sit right above the grid; mood cards and "show all" jump down to it.
  setFilter(button.dataset.filter!, { reveal: !button.classList.contains("catChip") });
});

searchInput.addEventListener("input", applyFilters);
searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    searchInput.value = "";
    applyFilters();
    searchInput.blur();
  } else if (event.key === "Enter") {
    const first = tiles.find((tile) => !tile.hidden);
    if (first) window.location.href = (first as HTMLAnchorElement).href;
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key !== "/" || document.activeElement === searchInput) return;
  event.preventDefault();
  searchInput.focus();
});

applyFilters();
registerOffline("./", ['700 16px "IBM Plex Sans"', '600 16px "IBM Plex Mono"']);
