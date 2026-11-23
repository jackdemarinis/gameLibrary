// DOM HUD over the canvas: hearts, lantern oil, level/XP, objective, prompts,
// typewriter dialogue, area banners, boss bar, and the menu screens.
import { libraryHomeUrl } from "../shared/libraryNav";

export interface HudStatus {
  hp: number;
  maxHearts: number;
  oil: number;
  maxOil: number;
  flareCost: number;
  level: number;
  xpInto: number;
  xpNeeded: number;
}

export interface MenuOption {
  label: string;
  action: () => void;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent?: HTMLElement): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  parent?.appendChild(node);
  return node;
}

export class Hud {
  readonly root: HTMLDivElement;
  private readonly hearts: HTMLDivElement;
  private readonly oilFill: HTMLDivElement;
  private readonly oilMark: HTMLDivElement;
  private readonly level: HTMLSpanElement;
  private readonly xpFill: HTMLDivElement;
  private readonly objective: HTMLDivElement;
  private readonly prompt: HTMLDivElement;
  private readonly dialogue: HTMLDivElement;
  private readonly speaker: HTMLDivElement;
  private readonly line: HTMLDivElement;
  private readonly banner: HTMLDivElement;
  private readonly toastBox: HTMLDivElement;
  private readonly boss: HTMLDivElement;
  private readonly bossFill: HTMLDivElement;
  private readonly bossName: HTMLDivElement;
  private readonly menu: HTMLDivElement;
  private readonly lockMark: HTMLDivElement;
  private lastHearts = "";
  private bannerTimer = 0;
  private toastTimer = 0;
  private fullLine = "";
  private shownChars = 0;
  private menuOptions: MenuOption[] = [];
  private menuIndex = 0;

  constructor(parent: HTMLElement) {
    this.root = element("div", "lwHud", parent);
    const status = element("div", "lwStatus", this.root);
    this.hearts = element("div", "lwHearts", status);
    const oil = element("div", "lwOil", status);
    element("span", "lwOilLabel", oil).textContent = "OIL";
    const oilBar = element("div", "lwOilBar", oil);
    this.oilFill = element("div", "lwOilFill", oilBar);
    this.oilMark = element("div", "lwOilMark", oilBar);
    const levelRow = element("div", "lwLevel", status);
    this.level = element("span", "lwLevelText", levelRow);
    const xpBar = element("div", "lwXpBar", levelRow);
    this.xpFill = element("div", "lwXpFill", xpBar);

    this.objective = element("div", "lwObjective", this.root);
    this.prompt = element("div", "lwPrompt", this.root);
    this.lockMark = element("div", "lwLock", this.root);

    this.boss = element("div", "lwBoss", this.root);
    this.bossName = element("div", "lwBossName", this.boss);
    const bossBar = element("div", "lwBossBar", this.boss);
    this.bossFill = element("div", "lwBossFill", bossBar);

    this.banner = element("div", "lwBanner", this.root);
    this.toastBox = element("div", "lwToast", this.root);

    this.dialogue = element("div", "lwDialogue", this.root);
    this.speaker = element("div", "lwSpeaker", this.dialogue);
    this.line = element("div", "lwLine", this.dialogue);
    element("div", "lwContinue", this.dialogue).textContent = "F ▸";

    this.menu = element("div", "lwMenu", this.root);
    this.setPlaying(false);
  }

  setPlaying(playing: boolean): void {
    this.root.classList.toggle("isPlaying", playing);
  }

  status(status: HudStatus): void {
    const key = `${status.hp}/${status.maxHearts}`;
    if (key !== this.lastHearts) {
      this.lastHearts = key;
      this.hearts.innerHTML = "";
      for (let index = 0; index < status.maxHearts; index += 1) {
        const fill = Math.max(0, Math.min(2, status.hp - index * 2));
        element("span", `lwHeart ${fill === 2 ? "full" : fill === 1 ? "half" : "empty"}`, this.hearts);
      }
      this.hearts.classList.toggle("isLow", status.hp <= 2);
    }
    this.oilFill.style.width = `${(status.oil / status.maxOil) * 100}%`;
    this.oilFill.classList.toggle("isLow", status.oil < status.flareCost);
    this.oilMark.style.left = `${(status.flareCost / status.maxOil) * 100}%`;
    this.level.textContent = `LV ${status.level}`;
    this.xpFill.style.width = status.xpNeeded > 0 ? `${(status.xpInto / status.xpNeeded) * 100}%` : "100%";
  }

  setObjective(text: string): void {
    if (this.objective.textContent !== text) this.objective.textContent = text;
  }

  setPrompt(text: string | null): void {
    this.prompt.textContent = text ?? "";
    this.prompt.classList.toggle("isShown", Boolean(text));
  }

  /** Screen-space lock-on marker (x/y in 0..1), or null to hide. */
  setLock(at: { x: number; y: number } | null): void {
    this.lockMark.classList.toggle("isShown", Boolean(at));
    if (at) {
      this.lockMark.style.left = `${at.x * 100}%`;
      this.lockMark.style.top = `${at.y * 100}%`;
    }
  }

  setBoss(name: string | null, fraction = 1): void {
    this.boss.classList.toggle("isShown", Boolean(name));
    if (name) {
      this.bossName.textContent = name;
      this.bossFill.style.width = `${Math.max(0, fraction) * 100}%`;
    }
  }

  showBanner(title: string, subtitle = ""): void {
    this.banner.innerHTML = "";
    element("div", "lwBannerTitle", this.banner).textContent = title;
    if (subtitle) element("div", "lwBannerSub", this.banner).textContent = subtitle;
    this.banner.classList.remove("isShown");
    void this.banner.offsetWidth;
    this.banner.classList.add("isShown");
    this.bannerTimer = 3.2;
  }

  toast(text: string): void {
    this.toastBox.textContent = text;
    this.toastBox.classList.add("isShown");
    this.toastTimer = 3.5;
  }

  // ------------------------------------------------------------ dialogue

  openDialogue(speaker: string, text: string): void {
    this.dialogue.classList.add("isShown");
    this.speaker.textContent = speaker;
    this.fullLine = text;
    this.shownChars = 0;
    this.line.textContent = "";
  }

  /** Returns true if the line was still typing (and is now completed). */
  skipTyping(): boolean {
    if (this.shownChars < this.fullLine.length) {
      this.shownChars = this.fullLine.length;
      this.line.textContent = this.fullLine;
      return true;
    }
    return false;
  }

  closeDialogue(): void {
    this.dialogue.classList.remove("isShown");
  }

  get typing(): boolean {
    return this.shownChars < this.fullLine.length;
  }

  // ------------------------------------------------------------ menus

  showMenu(kind: string, title: string, body: string, options: MenuOption[]): void {
    this.menu.innerHTML = "";
    this.menu.className = `lwMenu isShown lwMenu-${kind}`;
    const card = element("div", "lwMenuCard", this.menu);
    element("div", "lwMenuTitle", card).textContent = title;
    if (body) {
      const paragraph = element("div", "lwMenuBody", card);
      paragraph.textContent = body;
    }
    const list = element("div", "lwMenuOptions", card);
    this.menuOptions = options;
    this.menuIndex = 0;
    options.forEach((option, index) => {
      const button = element("button", "lwMenuButton", list);
      button.type = "button";
      button.textContent = option.label;
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        option.action();
      });
      button.addEventListener("mouseenter", () => this.highlight(index));
    });
    if (kind === "title" || kind === "pause") {
      const help = element("div", "lwMenuHelp", card);
      help.innerHTML =
        "<b>WASD</b> move · <b>Mouse</b> look · <b>Click/J</b> sword · <b>Q/Right-click</b> lantern flare · <b>F</b> talk/open/use · <b>Tab</b> lock on · <b>Esc</b> pause<br/>Gamepad supported.";
      const home = element("a", "lwMenuHome", card);
      home.href = libraryHomeUrl();
      home.textContent = "← JackGames library";
    }
    this.highlight(0);
  }

  hideMenu(): void {
    this.menu.className = "lwMenu";
    this.menuOptions = [];
  }

  get menuOpen(): boolean {
    return this.menuOptions.length > 0;
  }

  /** Keyboard/gamepad menu navigation. */
  menuMove(delta: number): void {
    if (!this.menuOptions.length) return;
    this.highlight((this.menuIndex + delta + this.menuOptions.length) % this.menuOptions.length);
  }

  menuConfirm(): void {
    this.menuOptions[this.menuIndex]?.action();
  }

  private highlight(index: number): void {
    this.menuIndex = index;
    this.menu.querySelectorAll(".lwMenuButton").forEach((button, buttonIndex) => button.classList.toggle("isActive", buttonIndex === index));
  }

  update(dt: number): void {
    if (this.shownChars < this.fullLine.length) {
      this.shownChars = Math.min(this.fullLine.length, this.shownChars + dt * 48);
      this.line.textContent = this.fullLine.slice(0, Math.floor(this.shownChars));
    }
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.banner.classList.remove("isShown");
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastBox.classList.remove("isShown");
    }
  }
}
