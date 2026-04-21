import type { FeatureCard } from "../game/content/campaignPlan";

export interface UiAction {
  label: string;
  tone: "primary" | "secondary" | "danger";
  onPress: () => void;
  disabled?: boolean;
}

export interface MenuViewModel {
  eyebrow: string;
  title: string;
  subtitle: string;
  status: string;
  featureCards: FeatureCard[];
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

export interface ShopOfferViewModel {
  iconLabel: string;
  title: string;
  summary: string;
  nextBonus: string;
  level: number;
  maxLevel: number;
  priceValue: number | null;
  action: UiAction;
}

export interface ShopViewModel {
  eyebrow: string;
  title: string;
  subtitle: string;
  status: string;
  credits: number;
  nextMissionTitle: string;
  nextMissionBriefing: string;
  offers: ShopOfferViewModel[];
  actions: UiAction[];
}

export class AppChrome {
  private readonly root: HTMLDivElement;

  constructor(root: HTMLDivElement) {
    this.root = root;
  }

  clear(): void {
    this.root.innerHTML = "";
  }

  renderMenu(model: MenuViewModel): void {
    const actionMap = new Map<string, UiAction>();
    const renderActions = model.actions
      .map((action, index) => {
        const id = `menu-${index}`;
        actionMap.set(id, action);
        return `
          <button
            class="chrome-button chrome-button-${action.tone}"
            data-action-id="${id}"
            ${action.disabled ? "disabled" : ""}
          >
            ${action.label}
          </button>
        `;
      })
      .join("");

    this.root.innerHTML = `
      <section class="menu-screen">
        <article class="menu-panel">
          <div class="menu-header">
            <p class="eyebrow">${model.eyebrow}</p>
            <h1 class="menu-title">${model.title}</h1>
            <p class="menu-subtitle menu-subtitle-wide">${model.subtitle}</p>
            <div class="status-pill">${model.status}</div>
          </div>
          <div class="feature-grid">
            ${model.featureCards
              .map(
                (card) => `
                  <article class="feature-card">
                    <h2 class="feature-card-title">${card.title}</h2>
                    <p class="feature-card-body">${card.body}</p>
                  </article>
                `,
              )
              .join("")}
          </div>
          <div class="action-row">
            ${renderActions}
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
    const registerAction = (
      id: string,
      action: UiAction,
      className = "",
    ): string => {
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
    };

    const renderActionGroup = (prefix: string, actions: UiAction[], className = ""): string =>
      actions
        .map((action, index) => registerAction(`${prefix}-${index}`, action, className))
        .join("");

    if (model.layout === "active") {
      this.root.innerHTML = `
        <section class="hud-bar-screen">
          <article class="hud-bar">
            <div class="hud-bar-kpis">
              ${model.kpis.map((kpi) => renderActiveKpi(kpi)).join("")}
            </div>
            ${
              model.helpAction
                ? registerAction("hud-help", model.helpAction, "hud-help-button")
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
                          ? registerAction("hud-help-back", model.helpBackAction)
                          : ""
                      }
                      ${renderActionGroup("hud-modal", model.actions)}
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
              ${renderActionGroup("hud-result", model.actions)}
            </div>
          </article>
        </section>
      `;
    }

    this.bindActionMap(actionMap);
  }

  renderShop(model: ShopViewModel): void {
    const actionMap = new Map<string, UiAction>();
    const registerAction = (id: string, action: UiAction, className = ""): string => {
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
    };
    const renderOffer = (offer: ShopOfferViewModel, index: number): string => {
      const progress = offer.maxLevel > 0 ? Math.min(100, (offer.level / offer.maxLevel) * 100) : 0;
      const priceLabel = offer.priceValue === null ? "MAX" : `$${offer.priceValue}`;

      return `
        <article class="shop-upgrade-tile${offer.priceValue === null ? " shop-upgrade-tile-maxed" : ""}">
          <div class="shop-upgrade-gauge" style="--shop-progress: ${progress}%;">
            <span class="shop-upgrade-gauge-core">${offer.iconLabel}</span>
          </div>
          <div class="shop-upgrade-copy">
            <span class="shop-upgrade-level">LV ${offer.level}/${offer.maxLevel}</span>
            <h2 class="shop-upgrade-title">${offer.title}</h2>
            <p class="shop-upgrade-price">${priceLabel}</p>
            <p class="shop-upgrade-bonus">${offer.nextBonus}</p>
            <p class="shop-upgrade-summary">${offer.summary}</p>
          </div>
          ${registerAction(`shop-offer-${index}`, offer.action, "shop-upgrade-button")}
        </article>
      `;
    };

    this.root.innerHTML = `
      <section class="menu-screen shop-screen">
        <article class="menu-panel shop-panel">
          <div class="shop-shell">
            <div class="shop-header">
              <div class="shop-hero">
                <div class="shop-mascot" aria-hidden="true">
                  <span class="shop-mascot-sun"></span>
                  <span class="shop-mascot-smoke"></span>
                  <span class="shop-mascot-track shop-mascot-track-left"></span>
                  <span class="shop-mascot-track shop-mascot-track-right"></span>
                  <span class="shop-mascot-hull"></span>
                  <span class="shop-mascot-turret"></span>
                  <span class="shop-mascot-barrel"></span>
                </div>
                <div class="shop-heading">
                  <p class="eyebrow shop-eyebrow">${model.eyebrow}</p>
                  <h1 class="menu-title shop-title">${model.title}</h1>
                  <p class="shop-subtitle">${model.subtitle}</p>
                  <p class="shop-status">${model.status}</p>
                </div>
              </div>
              <div class="shop-credit-pill">
                <span class="shop-credit-label">Credits</span>
                <strong class="shop-credit-value">$${model.credits}</strong>
              </div>
            </div>
            <div class="shop-tab-row" aria-hidden="true">
              <span class="shop-tab shop-tab-active">Performance</span>
              <span class="shop-tab shop-tab-idle">Weapons Bay Offline</span>
            </div>
            <div class="shop-main">
              <section class="shop-board">
                <div class="shop-grid">
                  ${model.offers.map((offer, index) => renderOffer(offer, index)).join("")}
                </div>
              </section>
              <aside class="shop-sidebar">
                <article class="shop-side-card">
                  <p class="shop-side-label">Next Contract</p>
                  <h2 class="shop-side-title">${model.nextMissionTitle}</h2>
                  <p class="shop-next-mission">${model.nextMissionBriefing}</p>
                </article>
                <article class="shop-side-card">
                  <p class="shop-side-label">Service Note</p>
                  <p class="shop-side-copy">
                    Performance upgrades are permanent. Spend now, then roll straight into the next engagement.
                  </p>
                </article>
              </aside>
            </div>
            <div class="shop-footer">
              <div class="action-row shop-action-row">
                ${model.actions
                  .map((action, index) => registerAction(`shop-action-${index}`, action, "shop-footer-button"))
                  .join("")}
              </div>
            </div>
          </div>
        </article>
      </section>
    `;

    this.bindActionMap(actionMap);
  }

  private bindActionMap(actions: Map<string, UiAction>): void {
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
