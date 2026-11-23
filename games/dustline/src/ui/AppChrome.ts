import { getDustlineIcon } from "./dustlineIcons";
import { getDustlineMenuArt } from "./dustlineMenuArt";

export interface UiAction {
  label: string;
  tone: "primary" | "secondary" | "danger";
  onPress: () => void;
  disabled?: boolean;
}

export interface DifficultyChoiceViewModel {
  label: string;
  stars: string;
  caption: string;
  active?: boolean;
  onPress: () => void;
}

export interface StartViewModel {
  title: string;
  subtitle: string;
  saveStatus: string;
  playAction: UiAction;
  secondaryAction?: UiAction;
}

export interface ShopOfferViewModel {
  iconLabel: string;
  /** Which pixel icon to show (an upgrade key or cannon id); falls back to iconLabel text. */
  iconKey?: string;
  category: string;
  /** Cannon id, for the armory cards' colour stripe. */
  weaponKind?: string;
  title: string;
  summary: string;
  nextBonus: string;
  level: number;
  maxLevel: number;
  priceValue: number | null;
  action: UiAction;
}

export interface ShopViewModel {
  title: string;
  subtitle: string;
  credits: number;
  totalScore: number;
  difficultyLabel: string;
  difficultyLocked: boolean;
  difficultyOptions: DifficultyChoiceViewModel[];
  unlockedWeapons: string[];
  offers: ShopOfferViewModel[];
  /** Cannons to buy and upgrade, shown on the Armory tab. */
  armory: ShopOfferViewModel[];
  activeTab: "upgrades" | "armory";
  tabs: { id: "upgrades" | "armory"; label: string; onPress: () => void }[];
  actions: UiAction[];
}

export interface LevelChoiceViewModel {
  number: number;
  label: string;
  tagline: string;
  /** Badge text, e.g. "Bonus" or "Boss". */
  tier: string;
  unlocked: boolean;
  active: boolean;
  onPress: () => void;
}

export interface LevelSelectViewModel {
  title: string;
  difficultyLabel: string;
  totalScore: number;
  levels: LevelChoiceViewModel[];
  actions: UiAction[];
}

export interface LevelIntroViewModel {
  eyebrow: string;
  title: string;
  briefing: string;
  /** Rooms in the order the map flows. kind drives the chip colour. */
  rooms: { kind: string; label: string }[];
  tierLabel: string;
  difficultyLabel: string;
  totalScore: number;
  credits: number;
  actions: UiAction[];
}

export interface HudKpi {
  label: string;
  value?: string;
  meter?: {
    current: number;
    max: number;
  };
}

/** One slot of the cannon inventory in the battle HUD. */
export interface HudWeaponSlotViewModel {
  slot: number;
  label: string;
  /** Damage upgrade level, shown as pips. */
  level: number;
  kind: string;
  active: boolean;
  onPress: () => void;
}

export type VolumeChannel = "music" | "effects";

/** The in-battle settings window (Esc or the gear button). */
export interface SettingsViewModel {
  /** 0..100 */
  musicVolume: number;
  effectsVolume: number;
  muted: boolean;
  bindings: { id: string; label: string; key: string; waiting: boolean }[];
  /** Controls that can't be rebound, e.g. "Mouse: aim and fire". */
  fixedControls: string[];
  /** Live while the slider moves (no redraw). */
  onVolumeInput: (channel: VolumeChannel, value: number) => void;
  /** When the slider is let go: saved. */
  onVolumeCommit: (channel: VolumeChannel, value: number) => void;
  onToggleMute: () => void;
  onRebind: (id: string) => void;
  onResetBindings: () => void;
}

export interface HudViewModel {
  layout: "active" | "result";
  title: string;
  copy: string;
  objective: string;
  kpis: HudKpi[];
  notes: string[];
  actions: UiAction[];
  /** The gear button; opens settings. */
  settingsAction?: UiAction;
  resumeAction?: UiAction;
  settingsOpen?: boolean;
  settings?: SettingsViewModel;
  weapons?: HudWeaponSlotViewModel[];
}

/** Pixel gear for the settings button, drawn on a 12x12 grid. */
const gearIcon = `
  <svg class="hudGearIcon" viewBox="0 0 12 12" width="24" height="24" aria-hidden="true" shape-rendering="crispEdges">
    <path fill="currentColor" d="M5 0h2v2h1V1h2v2H9v1h3v4H9v1h1v2H8v-1H7v2H5v-2H4v1H2V9h1V8H0V4h3V3H2V1h2v1h1zM5 4v1H4v2h1v1h2V7h1V5H7V4z"/>
  </svg>
`;

export class AppChrome {
  private readonly root: HTMLDivElement;

  constructor(root: HTMLDivElement) {
    this.root = root;
  }

  clear(): void {
    this.root.innerHTML = "";
  }

  renderStart(model: StartViewModel): void {
    const actionMap = new Map<string, UiAction>();
    const playButton = this.renderActionButton("start-play", model.playAction, actionMap, "start-play-button");
    const secondaryButton = model.secondaryAction
      ? this.renderActionButton("start-secondary", model.secondaryAction, actionMap, "start-secondary-button")
      : "";
    const art = getDustlineMenuArt();
    const titleWords = model.title
      .split(" ")
      .map((word) => `<span class="startTitleWord" aria-hidden="true">${word}</span>`)
      .join("");
    this.root.innerHTML = `
      <section class="start-screen"${art.backdrop ? ` style="background-image: url('${art.backdrop}')"` : ""}>
        <article class="start-panel">
          <div class="start-art">
            <div class="start-logo">
              <p class="start-eyebrow">Arcade Campaign</p>
              <h1 class="start-title" aria-label="${model.title}">${titleWords}</h1>
              <p class="start-subtitle">${model.subtitle}</p>
            </div>
            <div class="startHero" aria-hidden="true">
              <img class="startHeroPuff startHeroPuffA" src="${art.puff}" alt="" />
              <img class="startHeroPuff startHeroPuffB" src="${art.puff}" alt="" />
              <img class="startHeroShell startHeroShellA" src="${art.shellUp}" alt="" />
              <img class="startHeroShell startHeroShellB" src="${art.shellDown}" alt="" />
              <img class="startHeroTank" src="${art.tank}" alt="" />
            </div>
          </div>
          <div class="start-footer">
            <p class="start-save-status">${model.saveStatus}</p>
            <div class="start-actions">${secondaryButton}${playButton}</div>
          </div>
        </article>
      </section>
    `;

    this.bindActionMap(actionMap);
  }

  renderShop(model: ShopViewModel): void {
    const actionMap = new Map<string, UiAction | DifficultyChoiceViewModel>();
    const registerChoice = (id: string, action: DifficultyChoiceViewModel, className = ""): string => {
      actionMap.set(id, action);
      return `
        <button class="${className}" data-action-id="${id}">
          <span>${action.label}</span>
          <strong>${action.stars}</strong>
          <small>${action.caption}</small>
        </button>
      `;
    };
    const renderBadge = (offer: ShopOfferViewModel): string => {
      const icon = offer.iconKey ? getDustlineIcon(offer.iconKey) : "";
      return icon
        ? `<div class="shop-upgrade-badge shopIconBadge" title="${offer.title}"><img class="dlIcon" src="${icon}" alt="${offer.iconLabel}" /></div>`
        : `<div class="shop-upgrade-badge">${offer.iconLabel}</div>`;
    };
    const renderOffer = (offer: ShopOfferViewModel, index: number | string): string => {
      const priceLabel = offer.priceValue === null ? "MAX" : `$${offer.priceValue}`;

      return `
        <article class="shop-upgrade-card${offer.priceValue === null ? " shop-upgrade-card-maxed" : ""}${
          offer.weaponKind ? ` shopWeaponCard shopWeaponCard-${offer.weaponKind}` : ""
        }">
          <div class="shop-upgrade-head">
            ${renderBadge(offer)}
            <div class="shop-upgrade-heading">
              <span class="shop-upgrade-tag">${offer.category}</span>
              <h2 class="shop-upgrade-title">${offer.title}</h2>
            </div>
            <span class="shop-upgrade-price">${priceLabel}</span>
          </div>
          <p class="shop-upgrade-bonus">${offer.nextBonus}</p>
          <div class="shop-upgrade-pips">
            ${Array.from({ length: offer.maxLevel }, (_, pipIndex) => `
              <span class="shop-upgrade-pip${pipIndex < offer.level ? " shop-upgrade-pip-active" : ""}"></span>
            `).join("")}
          </div>
          <p class="shop-upgrade-summary">${offer.summary}</p>
          ${this.renderActionButton(`shop-offer-${index}`, offer.action, actionMap, "shop-upgrade-button")}
        </article>
      `;
    };

    this.root.innerHTML = `
      <section class="shop-screen">
        <article class="shop-panel">
          <div class="shop-shell">
            <div class="shop-stage">
              <section class="shop-board arcade-card">
                <div class="shop-board-header">
                  <div>
                    <h1 class="shop-board-title">${model.title}</h1>
                    <p class="shop-board-copy">${model.subtitle}</p>
                  </div>
                  <div class="shopTabs" role="tablist">
                    ${model.tabs
                      .map((tab) => {
                        actionMap.set(`shop-tab-${tab.id}`, { label: tab.label, tone: "secondary", onPress: tab.onPress });
                        return `<button class="shopTab${tab.id === model.activeTab ? " shopTabActive" : ""}" role="tab" aria-selected="${tab.id === model.activeTab}" data-action-id="shop-tab-${tab.id}">${tab.label}</button>`;
                      })
                      .join("")}
                  </div>
                  <div class="shop-board-status">
                    <span class="shop-board-status-label">Difficulty</span>
                    <strong>${model.difficultyLabel}</strong>
                  </div>
                </div>
                <div class="shop-grid">
                  ${
                    model.activeTab === "armory"
                      ? model.armory.map((offer, index) => renderOffer(offer, `armory-${index}`)).join("")
                      : model.offers.map((offer, index) => renderOffer(offer, index)).join("")
                  }
                </div>
              </section>
              <aside class="shop-sidebar">
                <div class="shop-credit-pill">
                  <span class="shop-credit-label">Coins</span>
                  <strong class="shop-credit-value">$${model.credits}</strong>
                  <span class="shop-credit-subvalue">Total score: ${model.totalScore}</span>
                </div>
                <article class="shop-side-card arcade-card">
                  <p class="shop-side-label">Loadout · keys 1-5</p>
                  <div class="shop-weapon-stack">
                    ${model.unlockedWeapons
                      .map((weapon, index) => `<span class="shop-weapon-pill">${index + 1} ${weapon}</span>`)
                      .join("")}
                  </div>
                </article>
                <div class="shop-side-actions">
                  ${model.actions
                    .map((action, index) =>
                      this.renderActionButton(`shop-action-${index}`, action, actionMap, "shop-footer-button"),
                    )
                    .join("")}
                </div>
              </aside>
            </div>
            ${
              model.difficultyLocked
                ? `
                  <div class="difficulty-modal-backdrop">
                    <article class="difficulty-modal arcade-card">
                      <p class="difficulty-modal-title">Select Difficulty</p>
                      <div class="difficulty-choice-stack">
                        ${model.difficultyOptions
                          .map((choice, index) =>
                            registerChoice(
                              `difficulty-choice-${index}`,
                              choice,
                              `difficulty-choice${choice.active ? " difficulty-choice-active" : ""}`,
                            ),
                          )
                          .join("")}
                      </div>
                    </article>
                  </div>
                `
                : ""
            }
          </div>
        </article>
      </section>
    `;

    this.bindActionMap(actionMap);
  }

  renderLevelSelect(model: LevelSelectViewModel): void {
    const actionMap = new Map<string, UiAction | LevelChoiceViewModel>();
    const registerLevel = (id: string, level: LevelChoiceViewModel): string => {
      actionMap.set(id, level);
      return `
        <button
          class="level-tile${level.unlocked ? "" : " level-tile-locked"}${level.active ? " level-tile-active" : ""}"
          data-action-id="${id}"
          ${level.unlocked ? "" : "disabled"}
        >
          <span class="level-tile-number">${level.number}</span>
          ${level.tier ? `<span class="levelTier levelTier-${level.tier}">${level.tier}</span>` : ""}
          <span class="level-tile-label">${level.label}</span>
          ${
            level.unlocked
              ? level.tagline
                ? `<span class="levelTileTagline">${level.tagline}</span>`
                : ""
              : `<span class="level-tile-state">Locked · clear level ${level.number - 1}</span>`
          }
        </button>
      `;
    };

    this.root.innerHTML = `
      <section class="level-screen">
        <article class="level-panel arcade-card">
          <div class="level-header">
            <p class="eyebrow">Level Select</p>
            <h1 class="level-title">${model.title}</h1>
            <p class="level-meta">Difficulty: ${model.difficultyLabel}</p>
          </div>
          <div class="level-grid">
            ${model.levels.map((level, index) => registerLevel(`level-choice-${index}`, level)).join("")}
          </div>
          <p class="level-score">Total score: ${model.totalScore} Pts.</p>
          <div class="level-actions">
            ${model.actions
              .map((action, index) =>
                this.renderActionButton(`level-action-${index}`, action, actionMap, "chrome-button"),
              )
              .join("")}
          </div>
        </article>
      </section>
    `;

    this.bindActionMap(actionMap);
  }

  renderLevelIntro(model: LevelIntroViewModel): void {
    const actionMap = new Map<string, UiAction>();

    this.root.innerHTML = `
      <section class="brief-screen">
        <article class="brief-panel arcade-card">
          <p class="eyebrow">${model.eyebrow}${
            model.tierLabel ? ` <span class="levelTier levelTier-${model.tierLabel}">${model.tierLabel}</span>` : ""
          }</p>
          <h1 class="brief-title">${model.title}</h1>
          <p class="brief-copy">${model.briefing}</p>
          ${
            model.rooms.length
              ? `<ol class="briefRoute" aria-label="Map route">
                  ${model.rooms
                    .map(
                      (room, index) =>
                        `<li class="briefRoom briefRoom-${room.kind}"><span class="briefRoomStep">${index + 1}</span>${room.label}</li>`,
                    )
                    .join("")}
                </ol>`
              : ""
          }
          <div class="brief-stat-row">
            <article class="brief-stat-card">
              <span class="brief-stat-label">Difficulty</span>
              <strong class="brief-stat-value">${model.difficultyLabel}</strong>
            </article>
            <article class="brief-stat-card">
              <span class="brief-stat-label">Coins</span>
              <strong class="brief-stat-value">$${model.credits}</strong>
            </article>
            <article class="brief-stat-card">
              <span class="brief-stat-label">Total Score</span>
              <strong class="brief-stat-value">${model.totalScore}</strong>
            </article>
          </div>
          <div class="brief-actions">
            ${model.actions
              .map((action, index) =>
                this.renderActionButton(`brief-action-${index}`, action, actionMap, "chrome-button"),
              )
              .join("")}
          </div>
        </article>
      </section>
    `;

    this.bindActionMap(actionMap);
  }

  renderHud(model: HudViewModel): void {
    const actionMap = new Map<string, UiAction>();
    const renderActiveKpi = (kpi: HudKpi): string => {
      const safeMax = Math.max(1, kpi.meter?.max ?? 1);
      const fillWidth = kpi.meter
        ? Math.max(0, Math.min(100, (kpi.meter.current / safeMax) * 100))
        : 0;

      return `
        <div class="hud-bar-kpi${kpi.meter ? " hud-bar-kpi-metered" : ""}">
          <span class="hud-bar-kpi-label">${kpi.label}</span>
          ${
            kpi.meter
              ? `
                <div
                  class="hud-bar-kpi-meter"
                  role="progressbar"
                  aria-label="${kpi.label}"
                  aria-valuemin="0"
                  aria-valuemax="${safeMax}"
                  aria-valuenow="${Math.max(0, Math.round(kpi.meter.current))}"
                >
                  <span class="hud-bar-kpi-meter-track">
                    <span class="hud-bar-kpi-meter-fill" style="width: ${fillWidth}%"></span>
                  </span>
                </div>
              `
              : `<span class="hud-bar-kpi-value">${kpi.value ?? ""}</span>`
          }
        </div>
      `;
    };

    if (model.settingsAction) {
      actionMap.set("hud-settings", model.settingsAction);
    }
    const settingsButton = model.settingsAction
      ? `
        <button
          class="hud-help-button hudSettingsButton chrome-button chrome-button-secondary"
          data-action-id="hud-settings"
          aria-label="Settings (Esc)"
          title="Settings (Esc)"
        >${gearIcon}</button>
      `
      : "";

    if (model.layout === "active") {
      const weaponSlots = model.weapons ?? [];
      const inventory = weaponSlots.length
        ? `
            <nav class="hudInventory" aria-label="Cannons">
              ${weaponSlots
                .map(
                  (weapon) => `
                    <button
                      class="hudWeaponSlot hudWeaponSlot-${weapon.kind}${weapon.active ? " hudWeaponSlotActive" : ""}"
                      data-weapon-slot="${weapon.slot}"
                      aria-pressed="${weapon.active}"
                    >
                      <span class="hudWeaponKey">${weapon.slot}</span>
                      ${(() => {
                        const icon = getDustlineIcon(weapon.kind);
                        return icon ? `<img class="dlIcon hudWeaponIcon" src="${icon}" alt="" />` : "";
                      })()}
                      <span class="hudWeaponName">${weapon.label}</span>
                      <span class="hudWeaponPips" aria-label="Damage level ${weapon.level}">
                        ${Array.from({ length: 4 }, (_, pip) => `<span class="hudWeaponPip${pip < weapon.level ? " hudWeaponPipOn" : ""}"></span>`).join("")}
                      </span>
                    </button>
                  `,
                )
                .join("")}
            </nav>
          `
        : "";
      const mainHud = `
            <article class="hud-bar">
              <div class="hud-bar-kpis">
                ${model.kpis.map((kpi) => renderActiveKpi(kpi)).join("")}
              </div>
              ${settingsButton}
            </article>
          `;
      this.root.innerHTML = `
        <section class="hud-bar-screen">
          ${inventory}
          ${mainHud}
          ${model.settingsOpen && model.settings ? this.renderSettings(model, actionMap) : ""}
        </section>
      `;
    } else {
      this.root.innerHTML = `
        <section class="hud-result-screen">
          <article class="hud-result-card">
            <p class="eyebrow">${model.title}</p>
            <h2 class="hud-card-title">Briefing</h2>
            <p class="hud-copy">${model.copy}</p>
            ${model.objective ? `<p class="hud-copy hud-copy-secondary">${model.objective}</p>` : ""}
            <div class="hud-kpis">
              ${model.kpis
                .map(
                  (kpi) => `
                    <article class="hud-kpi">
                      <h3 class="hud-card-title">${kpi.label}</h3>
                      <span class="hud-kpi-value">${kpi.value ?? ""}</span>
                    </article>
                  `,
                )
                .join("")}
            </div>
            <div class="hud-action-row">
              ${model.actions
                .map((action, index) =>
                  this.renderActionButton(`hud-result-${index}`, action, actionMap, "chrome-button"),
                )
                .join("")}
            </div>
          </article>
        </section>
      `;
    }

    this.bindActionMap(actionMap);
    if (model.settingsOpen && model.settings) {
      this.bindSettings(model.settings);
    }
    // pointerdown, not click: the HUD redraws every second for the clock and
    // a click split across a redraw would be lost.
    this.root.querySelectorAll<HTMLButtonElement>("[data-weapon-slot]").forEach((button) => {
      const weapon = model.weapons?.find((slot) => `${slot.slot}` === button.dataset.weaponSlot);
      if (weapon) {
        button.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          weapon.onPress();
        });
      }
    });
  }

  private renderSettings(model: HudViewModel, actionMap: Map<string, UiAction>): string {
    const settings = model.settings!;
    const slider = (channel: VolumeChannel, label: string, value: number): string => `
      <label class="settingsSlider">
        <span class="settingsSliderLabel">${label}</span>
        <input type="range" min="0" max="100" step="5" value="${value}" data-volume="${channel}" />
        <output class="settingsSliderValue" data-volume-value="${channel}">${value}%</output>
      </label>
    `;

    return `
      <div class="hud-modal-backdrop">
        <article class="hud-modal-card settingsCard" role="dialog" aria-label="Settings">
          <div class="settingsHead">
            <p class="eyebrow">${model.title}</p>
            <h2 class="hud-card-title">Settings</h2>
            <p class="settingsObjective">${model.objective}</p>
          </div>
          <div class="settingsColumns">
            <section class="settingsSection">
              <h3 class="settingsSectionTitle">Audio</h3>
              ${slider("music", "Music", settings.musicVolume)}
              ${slider("effects", "Effects", settings.effectsVolume)}
              <button class="settingsToggle" data-settings-mute aria-pressed="${settings.muted}">
                Sound: <strong>${settings.muted ? "Muted" : "On"}</strong>
              </button>
              <h3 class="settingsSectionTitle">Always</h3>
              <ul class="settingsFixed">
                ${settings.fixedControls.map((line) => `<li>${line}</li>`).join("")}
              </ul>
            </section>
            <section class="settingsSection">
              <div class="settingsSectionHead">
                <h3 class="settingsSectionTitle">Key bindings</h3>
                <button class="settingsToggle" data-settings-reset>Reset</button>
              </div>
              <ul class="settingsBindings">
                ${settings.bindings
                  .map(
                    (binding) => `
                      <li class="settingsBinding">
                        <span>${binding.label}</span>
                        <button
                          class="settingsKey${binding.waiting ? " settingsKeyWaiting" : ""}"
                          data-rebind="${binding.id}"
                          aria-label="Rebind ${binding.label}"
                        >${binding.waiting ? "Press a key" : binding.key}</button>
                      </li>
                    `,
                  )
                  .join("")}
              </ul>
            </section>
          </div>
          <div class="hud-modal-actions settingsActions">
            ${model.resumeAction ? this.renderActionButton("hud-resume", model.resumeAction, actionMap, "chrome-button") : ""}
            ${model.actions
              .map((action, index) => this.renderActionButton(`hud-modal-${index}`, action, actionMap, "chrome-button"))
              .join("")}
          </div>
        </article>
      </div>
    `;
  }

  private bindSettings(settings: SettingsViewModel): void {
    this.root.querySelectorAll<HTMLInputElement>("[data-volume]").forEach((input) => {
      const channel = input.dataset.volume as VolumeChannel;
      const readout = this.root.querySelector<HTMLOutputElement>(`[data-volume-value="${channel}"]`);
      input.addEventListener("input", () => {
        if (readout) readout.textContent = `${input.value}%`;
        settings.onVolumeInput(channel, Number(input.value));
      });
      input.addEventListener("change", () => settings.onVolumeCommit(channel, Number(input.value)));
    });
    this.root.querySelector("[data-settings-mute]")?.addEventListener("click", settings.onToggleMute);
    this.root.querySelector("[data-settings-reset]")?.addEventListener("click", settings.onResetBindings);
    this.root.querySelectorAll<HTMLButtonElement>("[data-rebind]").forEach((button) => {
      button.addEventListener("click", () => settings.onRebind(button.dataset.rebind ?? ""));
    });
  }

  private renderActionButton(
    id: string,
    action: UiAction,
    actionMap: Map<string, { onPress: () => void; disabled?: boolean }>,
    className = "",
  ): string {
    actionMap.set(id, action);
    const classes = [`chrome-button`, `chrome-button-${action.tone}`, className]
      .filter(Boolean)
      .join(" ");

    return `
      <button
        class="${classes}"
        data-action-id="${id}"
        ${action.disabled ? "disabled" : ""}
      >
        ${action.label}
      </button>
    `;
  }

  private bindActionMap(
    actions: Map<string, { onPress: () => void; disabled?: boolean }>,
  ): void {
    const buttons = this.root.querySelectorAll<HTMLButtonElement>("[data-action-id]");

    buttons.forEach((button) => {
      const id = button.dataset.actionId;
      const action = id ? actions.get(id) : undefined;

      if (!action || action.disabled) {
        return;
      }

      button.addEventListener("click", action.onPress);
    });
  }
}
