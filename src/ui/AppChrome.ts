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
}

export interface ShopOfferViewModel {
  iconLabel: string;
  category: "Core" | "Bonus";
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
  actions: UiAction[];
}

export interface LevelChoiceViewModel {
  number: number;
  label: string;
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

export interface HudViewModel {
  layout: "active" | "result";
  title: string;
  copy: string;
  objective: string;
  kpis: HudKpi[];
  notes: string[];
  actions: UiAction[];
  helpAction?: UiAction;
  helpBackAction?: UiAction;
  helpOpen?: boolean;
}

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

    this.root.innerHTML = `
      <section class="start-screen">
        <article class="start-panel">
          <div class="start-art">
            <div class="start-logo">
              <p class="eyebrow start-eyebrow">Arcade Campaign</p>
              <h1 class="start-title">${model.title}</h1>
              <p class="start-subtitle">${model.subtitle}</p>
            </div>
            <div class="start-tank-illustration" aria-hidden="true">
              <span class="start-shell start-shell-a"></span>
              <span class="start-shell start-shell-b"></span>
              <span class="start-smoke start-smoke-a"></span>
              <span class="start-smoke start-smoke-b"></span>
              <div class="start-tank-shadow"></div>
              <div class="start-tank-body">
                <span class="start-tank-track start-tank-track-left"></span>
                <span class="start-tank-track start-tank-track-right"></span>
                <span class="start-tank-hull"></span>
                <span class="start-tank-turret"></span>
                <span class="start-tank-barrel"></span>
              </div>
            </div>
          </div>
          <div class="start-footer">
            <p class="start-save-status">${model.saveStatus}</p>
            ${playButton}
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
    const renderOffer = (offer: ShopOfferViewModel, index: number): string => {
      const progress = offer.maxLevel > 0 ? Math.min(100, (offer.level / offer.maxLevel) * 100) : 0;
      const priceLabel = offer.priceValue === null ? "MAX" : `$${offer.priceValue}`;

      return `
        <article class="shop-upgrade-card${offer.priceValue === null ? " shop-upgrade-card-maxed" : ""}">
          <div class="shop-upgrade-head">
            <div class="shop-upgrade-badge">${offer.iconLabel}</div>
            <div class="shop-upgrade-heading">
              <span class="shop-upgrade-tag">${offer.category}</span>
              <h2 class="shop-upgrade-title">${offer.title}</h2>
            </div>
            <span class="shop-upgrade-price">${priceLabel}</span>
          </div>
          <p class="shop-upgrade-bonus">${offer.nextBonus}</p>
          <div class="shop-upgrade-track"><span class="shop-upgrade-track-fill" style="width: ${progress}%"></span></div>
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
            <header class="shop-header shop-header-arcade">
              <div class="shop-header-tank" aria-hidden="true">
                <span class="shop-header-track shop-header-track-left"></span>
                <span class="shop-header-track shop-header-track-right"></span>
                <span class="shop-header-hull"></span>
                <span class="shop-header-turret"></span>
                <span class="shop-header-barrel"></span>
              </div>
              <div class="shop-credit-pill">
                <span class="shop-credit-label">Coins</span>
                <strong class="shop-credit-value">$${model.credits}</strong>
                <span class="shop-credit-subvalue">Total score: ${model.totalScore}</span>
              </div>
            </header>
            <div class="shop-stage">
              <section class="shop-board arcade-card">
                <div class="shop-board-header">
                  <div>
                    <h1 class="shop-board-title">${model.title}</h1>
                    <p class="shop-board-copy">${model.subtitle}</p>
                  </div>
                  <div class="shop-board-status">
                    <span class="shop-board-status-label">Difficulty</span>
                    <strong>${model.difficultyLabel}</strong>
                  </div>
                </div>
                <div class="shop-grid">
                  ${model.offers.map((offer, index) => renderOffer(offer, index)).join("")}
                </div>
              </section>
              <aside class="shop-sidebar">
                <article class="shop-side-card arcade-card">
                  <p class="shop-side-label">Unlocked Weapons</p>
                  <div class="shop-weapon-stack">
                    ${model.unlockedWeapons
                      .map((weapon) => `<span class="shop-weapon-pill">${weapon}</span>`)
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
          <span class="level-tile-label">${level.label}</span>
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
          <p class="eyebrow">${model.eyebrow}</p>
          <h1 class="brief-title">${model.title}</h1>
          <p class="brief-copy">${model.briefing}</p>
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

    if (model.layout === "active") {
      this.root.innerHTML = `
        <section class="hud-bar-screen">
          <article class="hud-bar">
            <div class="hud-bar-kpis">
              ${model.kpis.map((kpi) => renderActiveKpi(kpi)).join("")}
            </div>
            ${
              model.helpAction
                ? this.renderActionButton("hud-help", model.helpAction, actionMap, "hud-help-button chrome-button chrome-button-secondary")
                : ""
            }
          </article>
          ${
            model.helpOpen
              ? `
                <div class="hud-modal-backdrop">
                  <article class="hud-modal-card">
                    <p class="eyebrow">${model.title}</p>
                    <h2 class="hud-card-title">Objective</h2>
                    <p class="hud-copy">${model.objective}</p>
                    <h2 class="hud-card-title">Controls</h2>
                    <ul class="hud-sidebar-list">
                      ${model.notes.map((note) => `<li>${note}</li>`).join("")}
                    </ul>
                    <div class="hud-modal-actions">
                      ${
                        model.helpBackAction
                          ? this.renderActionButton("hud-help-back", model.helpBackAction, actionMap, "chrome-button")
                          : ""
                      }
                      ${model.actions
                        .map((action, index) =>
                          this.renderActionButton(`hud-modal-${index}`, action, actionMap, "chrome-button"),
                        )
                        .join("")}
                    </div>
                  </article>
                </div>
              `
              : ""
          }
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
