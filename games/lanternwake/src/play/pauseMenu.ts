// The Esc menu: tabs for hero status + items, the explored map, key bindings and
// mouse feel, and audio volumes. DOM only; the Game feeds it data and applies the
// settings it hands back.
import { bindLabels, bindOrder, defaultBindings, keyName, rebind, reservedKeys, type BindAction, type Settings } from "../game/rules/settings";
import { chapterTitle } from "../game/content/mainQuest";
import type { QuestLog } from "../game/rules/quests";
import { libraryHomeUrl } from "../shared/libraryNav";
import { drawMap, type MapSnapshot } from "./mapView";

export interface PauseItem {
  icon: "sword" | "lantern" | "heart" | "key" | "flame" | "chest";
  name: string;
  detail: string;
  count?: number;
}

export interface PauseStatus {
  areaName: string;
  objective: string;
  level: number;
  xpInto: number;
  xpNeeded: number;
  totalXp: number;
  hp: number;
  maxHearts: number;
  swordDamage: number;
  maxOil: number;
  flareCost: number;
  playSeconds: number;
  lanternsLit: number;
  chestsOpened: number;
  items: PauseItem[];
  quests: QuestLog;
  lastHint: string;
  lastHintArea: string;
}

export interface PauseCallbacks {
  resume(): void;
  quitToTitle(): void;
  settingsChanged(settings: Settings): void;
  /** Play a short sound so the effects slider can be judged by ear. */
  previewSound(): void;
}

interface InfoTile {
  tile: HTMLElement;
  fill(box: HTMLElement): void;
}

/** Item grid size: empty slots hint that there is more to find. */
const itemSlots = 10;

type Tab = "quests" | "status" | "map" | "controls" | "audio";
const tabs: Array<[Tab, string]> = [
  ["quests", "Quests"],
  ["status", "Status"],
  ["map", "Map"],
  ["controls", "Controls"],
  ["audio", "Audio"],
];

// Blocky 8x8 pixel icons (each string is a row; # = filled).
const iconRows: Record<PauseItem["icon"], string[]> = {
  sword: ["      ##", "     ###", "    ### ", " # ###  ", "  ###   ", "  ##    ", " #  #   ", "#       "],
  lantern: ["   ##   ", "  #  #  ", " ###### ", " #.##.# ", " #.##.# ", " #.##.# ", " ###### ", "  ####  "],
  heart: [" ## ##  ", "####### ", "####### ", "####### ", " #####  ", "  ###   ", "   #    ", "        "],
  key: ["  ###   ", " #   #  ", " #   #  ", "  ###   ", "   #    ", "   ##   ", "   #    ", "   ##   "],
  flame: ["   #    ", "   ##   ", "  ###   ", "  #### ", " ##.### ", " #...## ", " ##..## ", "  ####  "],
  chest: ["        ", " ###### ", "#......#", "########", "#..##..#", "#......#", "########", "        "],
};

function pixelIcon(kind: PauseItem["icon"]): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 8 8");
  svg.setAttribute("class", `lwIcon lwIcon-${kind}`);
  iconRows[kind].forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === " ") return;
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", String(x));
      rect.setAttribute("y", String(y));
      rect.setAttribute("width", "1");
      rect.setAttribute("height", "1");
      rect.setAttribute("class", cell === "." ? "lwIconLight" : "lwIconFill");
      svg.appendChild(rect);
    });
  });
  return svg;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent?: HTMLElement, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  parent?.appendChild(node);
  return node;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${String(minutes % 60).padStart(2, "0")}m` : `${minutes}m ${String(Math.floor(seconds % 60)).padStart(2, "0")}s`;
}

export class PauseMenu {
  private readonly root: HTMLDivElement;
  private readonly tabBar: HTMLDivElement;
  private readonly body: HTMLDivElement;
  private tab: Tab = "quests";
  private status: PauseStatus | null = null;
  private map: (() => MapSnapshot) | null = null;
  private settings: Settings | null = null;
  private listening: BindAction | null = null;
  private readonly captureKey = (event: KeyboardEvent): void => this.onCapturedKey(event);

  constructor(
    parent: HTMLElement,
    private readonly callbacks: PauseCallbacks,
  ) {
    this.root = element("div", "lwPause", parent);
    const card = element("div", "lwPauseCard", this.root);
    const head = element("div", "lwPauseHead", card);
    element("div", "lwPauseTitle", head, "Paused");
    this.tabBar = element("div", "lwTabs", head);
    for (const [id, label] of tabs) {
      const button = element("button", "lwTab", this.tabBar, label);
      button.type = "button";
      button.dataset.tab = id;
      button.addEventListener("click", () => this.show(id));
    }
    this.body = element("div", "lwPauseBody", card);
    const foot = element("div", "lwPauseFoot", card);
    const resume = element("button", "lwMenuButton lwPauseResume", foot, "Resume");
    resume.type = "button";
    resume.addEventListener("click", () => this.callbacks.resume());
    const quit = element("button", "lwMenuButton", foot, "Return to title");
    quit.type = "button";
    quit.addEventListener("click", () => this.callbacks.quitToTitle());
    element("div", "lwPauseHint", foot, "Esc resume · ← → switch tabs · hover or click a tile for details");
    const home = element("a", "lwMenuHome", foot, "← JackGames library");
    home.href = libraryHomeUrl();
  }

  get isOpen(): boolean {
    return this.root.classList.contains("isShown");
  }

  open(status: PauseStatus, map: () => MapSnapshot, settings: Settings): void {
    this.status = status;
    this.map = map;
    this.settings = { ...settings, bindings: { ...settings.bindings } };
    this.root.classList.add("isShown");
    this.show(this.tab);
  }

  close(): void {
    this.stopListening();
    this.root.classList.remove("isShown");
  }

  /** Menu keys while open. Returns true when the key was used. */
  handleKey(event: KeyboardEvent): boolean {
    if (!this.isOpen || this.listening) return false;
    const index = tabs.findIndex(([id]) => id === this.tab);
    if (event.code === "ArrowRight" || event.code === "KeyE") {
      this.show(tabs[(index + 1) % tabs.length][0]);
      return true;
    }
    if (event.code === "ArrowLeft" || event.code === "KeyQ") {
      this.show(tabs[(index + tabs.length - 1) % tabs.length][0]);
      return true;
    }
    if (event.code === "Escape" || event.code === "KeyP") {
      this.callbacks.resume();
      return true;
    }
    return false;
  }

  private show(tab: Tab): void {
    this.stopListening();
    this.tab = tab;
    this.tabBar.querySelectorAll<HTMLButtonElement>(".lwTab").forEach((button) => button.classList.toggle("isActive", button.dataset.tab === tab));
    this.body.innerHTML = "";
    this.body.dataset.tab = tab;
    if (tab === "quests") this.renderQuests();
    else if (tab === "status") this.renderStatus();
    else if (tab === "map") this.renderMap();
    else if (tab === "controls") this.renderControls();
    else this.renderAudio();
  }

  // ------------------------------------------------------------ quests

  private renderQuests(): void {
    const status = this.status;
    const log = status?.quests;
    if (!status || !log) return;
    const columns = element("div", "lwStatusColumns", this.body);

    // Left: what to do right now.
    const now = element("div", "lwPanel", columns);
    element("div", "lwPanelTitle", now, chapterTitle);
    const card = element("div", "lwNextStep", now);
    const current = log.current;
    if (current) {
      element("div", "lwNextLabel", card, `Current mission ${current.number} · ${current.where}`);
      element("div", "lwNextTitle", card, current.title);
      element("div", "lwNextText", card, current.text);
    } else {
      card.classList.add("isComplete");
      element("div", "lwNextLabel", card, "All missions done");
      element("div", "lwNextTitle", card, "Chapter One complete");
      element("div", "lwNextText", card, "The great lantern burns again. That's the whole story in this version of Lanternwake, and more of Wren's journey is on the way. Until then, finish any side quests and fill in your map.");
    }
    if (current?.hint) {
      const hint = element("div", "lwMissionHint", now);
      element("span", "lwHintLabel", hint, "Hint ");
      element("span", "", hint, current.hint);
    }
    const latest = element("div", "lwLatestHint", now);
    element("span", "lwHintLabel", latest, "Latest hint ");
    element("span", "", latest, status.lastHint ? `“${status.lastHint}”` : "None yet. Explore, and the world will tell you things.");
    if (status.lastHint && status.lastHintArea) element("span", "lwHintWhere", latest, ` · ${status.lastHintArea}`);

    // Right: the journal as tiles, with details on hover or click.
    const journal = element("div", "lwPanel", columns);
    element("div", "lwPanelTitle", journal, "Missions");
    const missionGrid = element("div", "lwTileGrid lwMissionGrid", journal);
    const tiles: InfoTile[] = [];
    let initial = 0;
    const missions = [...log.completed].reverse();
    if (current) missions.push(current);
    missions.forEach((mission) => {
      const done = mission !== current;
      const tile = this.tile(missionGrid, `lwMissionTile ${done ? "isDone" : "isCurrent"}`);
      element("span", "lwTileMark", tile, done ? "✓" : "▸");
      element("span", "lwTileNumber", tile, String(mission.number));
      if (!done) initial = tiles.length;
      tiles.push({
        tile,
        fill: (box) => {
          element("div", "lwInfoLabel", box, `${done ? "Completed" : "Current"} · mission ${mission.number} · ${mission.where}`);
          element("div", "lwInfoTitle", box, mission.title);
          element("div", "lwInfoText", box, mission.text);
        },
      });
    });
    for (let hidden = 0; hidden < log.hiddenCount; hidden += 1) {
      const tile = this.tile(missionGrid, "lwMissionTile isLocked");
      element("span", "lwTileMark", tile, "?");
      tiles.push({
        tile,
        fill: (box) => {
          element("div", "lwInfoLabel", box, "Undiscovered");
          element("div", "lwInfoTitle", box, "???");
          element("div", "lwInfoText", box, "Keep following the story to reveal this mission.");
        },
      });
    }
    if (!current && missions.length) initial = missions.length - 1;

    element("div", "lwPanelTitle", journal, "Side quests");
    const sideGrid = element("div", "lwSideGrid", journal);
    for (const task of log.side) {
      const finished = task.done >= task.total;
      const tile = this.tile(sideGrid, `lwSideTile${finished ? " isDone" : ""}`);
      const head = element("span", "lwSideHead", tile);
      element("span", "", head, task.title);
      element("span", "lwSideCount", head, `${task.done}/${task.total}`);
      const bar = element("span", "lwXpBar lwSideBar", tile);
      element("span", "lwXpFill", bar).style.width = `${task.total ? (task.done / task.total) * 100 : 0}%`;
      tiles.push({
        tile,
        fill: (box) => {
          element("div", "lwInfoLabel", box, `Side quest · ${task.done} of ${task.total}`);
          element("div", "lwInfoTitle", box, task.title);
          element("div", "lwInfoText", box, task.detail);
          element("div", "lwHintWhere", box, finished ? "Complete!" : task.remaining.join(" · "));
        },
      });
    }
    const box = element("div", "lwInfoBox", journal);
    this.linkInfo(box, tiles, initial);
  }

  // ------------------------------------------------------------ status

  private renderStatus(): void {
    const status = this.status;
    if (!status) return;
    const columns = element("div", "lwStatusColumns", this.body);
    const hero = element("div", "lwPanel", columns);
    element("div", "lwPanelTitle", hero, "Wren · Apprentice Keeper");
    const level = element("div", "lwStatLevel", hero);
    element("span", "lwStatLevelNumber", level, `LV ${status.level}`);
    const xp = element("div", "lwStatXp", level);
    const bar = element("div", "lwXpBar lwStatXpBar", xp);
    element("div", "lwXpFill", bar).style.width = status.xpNeeded > 0 ? `${(status.xpInto / status.xpNeeded) * 100}%` : "100%";
    element("span", "lwStatXpText", xp, status.xpNeeded > 0 ? `${status.xpInto} / ${status.xpNeeded} XP to next level` : "Max level");
    const rows: Array<[string, string]> = [
      ["Health", `${(status.hp / 2).toFixed(status.hp % 2 ? 1 : 0)} / ${status.maxHearts} hearts`],
      ["Sword damage", `${status.swordDamage} per hit`],
      ["Lantern oil", `${status.maxOil} max · flare ${status.flareCost}`],
      ["Total experience", `${status.totalXp} XP`],
      ["Lanterns lit · chests", `${status.lanternsLit} · ${status.chestsOpened}`],
      ["Time played", formatTime(status.playSeconds)],
    ];
    const table = element("div", "lwStatTable", hero);
    for (const [label, value] of rows) {
      element("span", "lwStatLabel", table, label);
      element("span", "lwStatValue", table, value);
    }

    const bag = element("div", "lwPanel", columns);
    element("div", "lwPanelTitle", bag, "Items");
    const grid = element("div", "lwTileGrid lwItemGrid", bag);
    const tiles: InfoTile[] = [];
    for (const item of status.items) {
      const tile = this.tile(grid, "lwItemSlot");
      tile.appendChild(pixelIcon(item.icon));
      if (item.count && item.count > 1) element("span", "lwSlotCount", tile, `×${item.count}`);
      tiles.push({
        tile,
        fill: (box) => {
          element("div", "lwInfoTitle", box, item.count && item.count > 1 ? `${item.name} ×${item.count}` : item.name);
          element("div", "lwInfoText", box, item.detail);
        },
      });
    }
    for (let empty = status.items.length; empty < itemSlots; empty += 1) element("span", "lwTile lwItemSlot isEmpty", grid);
    const box = element("div", "lwInfoBox", bag);
    this.linkInfo(box, tiles, 0);
  }

  /** A focusable tile button. */
  private tile(parent: HTMLElement, className: string): HTMLButtonElement {
    const tile = element("button", `lwTile ${className}`, parent);
    tile.type = "button";
    return tile;
  }

  /** Hovering or focusing a tile previews it in `box`; clicking pins it. Every entry is
   *  rendered into the same grid cell (only the active one visible), so the box is as
   *  tall as its longest entry: nothing is clipped and the layout never jumps. */
  private linkInfo(box: HTMLElement, tiles: InfoTile[], initial: number): void {
    let pinned = Math.min(initial, tiles.length - 1);
    const pages = tiles.map((entry) => {
      const page = element("div", "lwInfoPage", box);
      entry.fill(page);
      return page;
    });
    const show = (index: number): void => {
      pages.forEach((page, other) => page.classList.toggle("isActive", other === index));
      tiles.forEach((entry, other) => entry.tile.classList.toggle("isSelected", other === pinned));
    };
    tiles.forEach((entry, index) => {
      entry.tile.addEventListener("mouseenter", () => show(index));
      entry.tile.addEventListener("focus", () => show(index));
      entry.tile.addEventListener("mouseleave", () => show(pinned));
      entry.tile.addEventListener("click", () => {
        pinned = index;
        show(index);
      });
    });
    if (tiles.length) show(pinned);
  }


  // ------------------------------------------------------------ map

  private renderMap(): void {
    if (!this.map) return;
    const snapshot = this.map();
    const wrap = element("div", "lwMapWrap", this.body);
    const frame = element("div", "lwMapFrame", wrap);
    const canvas = element("canvas", "lwMapCanvas", frame);
    const side = element("div", "lwMapSide", wrap);
    element("div", "lwPanelTitle", side, snapshot.area.def.name);
    element("div", "lwMapPercent", side, `${Math.round(snapshot.grid.fraction() * 100)}% explored`);
    element("div", "lwMapNote", side, "The map fills in as you explore.");
    const legend = element("div", "lwLegend", side);
    for (const [kind, label] of [
      ["player", "Wren"],
      ["lantern", "Way-lantern"],
      ["npc", "Villager"],
      ["chest", "Unopened chest"],
      ["gate", "Gate"],
      ["exit", "Path onward"],
    ] as const) {
      const row = element("div", "lwLegendRow", legend);
      element("span", `lwLegendSwatch lwLegend-${kind}`, row);
      element("span", "", row, label);
    }
    // Draw after layout so the canvas inherits the --lw-map-* tokens.
    drawMap(canvas, snapshot);
  }

  // ------------------------------------------------------------ controls

  private renderControls(): void {
    const settings = this.settings;
    if (!settings) return;
    const columns = element("div", "lwStatusColumns", this.body);
    const keys = element("div", "lwPanel", columns);
    element("div", "lwPanelTitle", keys, "Keyboard · click a key to change it");
    const table = element("div", "lwBindTable", keys);
    for (const action of bindOrder) {
      element("span", "lwBindLabel", table, bindLabels[action]);
      const button = element("button", "lwKeyCap", table, this.listening === action ? "Press a key…" : keyName(settings.bindings[action]));
      button.type = "button";
      button.classList.toggle("isListening", this.listening === action);
      button.addEventListener("click", () => this.startListening(action));
    }

    const mouse = element("div", "lwPanel", columns);
    element("div", "lwPanelTitle", mouse, "Mouse & fixed keys");
    const fixed = element("div", "lwBindTable", mouse);
    for (const [label, key] of [
      ["Look around", "Mouse"],
      ["Sword", "Left click"],
      ["Lantern flare", "Right click"],
      ["Lock on", "Middle click"],
      ["Pause / this menu", "Esc"],
      ["Gamepad", "Supported"],
    ]) {
      element("span", "lwBindLabel", fixed, label);
      element("span", "lwKeyCap isFixed", fixed, key);
    }
    this.slider(mouse, "Mouse sensitivity", settings.mouseSensitivity, 0.3, 2.5, 0.05, (value) => `${value.toFixed(2)}×`, (value) => {
      settings.mouseSensitivity = value;
      this.commit();
    });
    const invert = element("label", "lwCheck", mouse);
    const box = element("input", "", invert);
    box.type = "checkbox";
    box.checked = settings.invertY;
    box.addEventListener("change", () => {
      settings.invertY = box.checked;
      this.commit();
    });
    element("span", "", invert, "Invert vertical look");
    const reset = element("button", "lwSmallButton", mouse, "Reset keys to defaults");
    reset.type = "button";
    reset.addEventListener("click", () => {
      settings.bindings = { ...defaultBindings };
      this.commit();
      this.show("controls");
    });

  }

  private startListening(action: BindAction): void {
    this.show("controls"); // fresh render; also cancels any earlier listen
    this.listening = action;
    window.addEventListener("keydown", this.captureKey, true);
    const caps = this.body.querySelectorAll<HTMLButtonElement>(".lwBindTable .lwKeyCap");
    const index = bindOrder.indexOf(action);
    caps[index]?.classList.add("isListening");
    if (caps[index]) caps[index].textContent = "Press a key…";
  }

  private stopListening(): void {
    window.removeEventListener("keydown", this.captureKey, true);
    this.listening = null;
  }

  private onCapturedKey(event: KeyboardEvent): void {
    // Swallow the key so the game and the menu don't also act on it.
    event.preventDefault();
    event.stopImmediatePropagation();
    const action = this.listening;
    if (!action || !this.settings) return;
    this.stopListening();
    if (event.code !== "Escape" && !reservedKeys.has(event.code)) {
      this.settings.bindings = rebind(this.settings.bindings, action, event.code);
      this.commit();
    }
    this.show("controls");
  }

  // ------------------------------------------------------------ audio

  private renderAudio(): void {
    const settings = this.settings;
    if (!settings) return;
    const panel = element("div", "lwPanel lwAudioPanel", this.body);
    element("div", "lwPanelTitle", panel, "Volume");
    this.slider(panel, "Music", settings.musicVolume, 0, 1, 0.01, (value) => `${Math.round(value * 100)}%`, (value) => {
      settings.musicVolume = value;
      this.commit();
    });
    this.slider(
      panel,
      "Sound effects",
      settings.sfxVolume,
      0,
      1,
      0.01,
      (value) => `${Math.round(value * 100)}%`,
      (value) => {
        settings.sfxVolume = value;
        this.commit();
      },
      () => this.callbacks.previewSound(),
    );
    element("div", "lwMapNote", panel, "Each place has its own music: the village, the woods, the shrine, indoors by the fire, and boss fights.");
  }

  private slider(parent: HTMLElement, label: string, value: number, min: number, max: number, step: number, format: (value: number) => string, onInput: (value: number) => void, onRelease?: () => void): void {
    const row = element("label", "lwSlider", parent);
    element("span", "lwSliderLabel", row, label);
    const input = element("input", "lwSliderInput", row);
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    const readout = element("span", "lwSliderValue", row, format(value));
    const sync = (): void => {
      const fill = ((Number(input.value) - min) / (max - min)) * 100;
      input.style.setProperty("--lwFill", `${fill}%`);
    };
    sync();
    input.addEventListener("input", () => {
      const next = Number(input.value);
      readout.textContent = format(next);
      sync();
      onInput(next);
    });
    if (onRelease) input.addEventListener("change", onRelease);
  }

  private commit(): void {
    if (this.settings) this.callbacks.settingsChanged({ ...this.settings, bindings: { ...this.settings.bindings } });
  }
}
