// Lanternwake's DOM HUD: portrait plate, hotbar, help modal and result card.
export interface UiAction {
  label: string;
  tone: "primary" | "secondary" | "danger";
  onPress: () => void;
  disabled?: boolean;
}

export interface HudKpi {
  label: string;
  value?: string;
  meter?: {
    current: number;
    max: number;
  };
}

/** Portrait plate for character-driven games (top-left). */
export interface HudStatusViewModel {
  portraitUrl: string;
  name: string;
  caption?: string;
  meter: { label: string; current: number; max: number };
}

/** One inventory slot in a bottom hotbar; no icon means an empty slot. */
export interface HudSlotViewModel {
  label: string;
  iconUrl?: string;
  count?: string;
  active?: boolean;
  dim?: boolean;
}

export interface HudViewModel {
  layout: "active" | "result";
  /** Per-game look for the HUD; omitted means the default JackGames chrome. */
  skin?: "lanternwake";
  /** When set, the active HUD shows a portrait plate + hotbar instead of the KPI bar. */
  status?: HudStatusViewModel;
  hotbar?: HudSlotViewModel[];
  title: string;
  /** Result-card heading (defaults to "Briefing"). */
  heading?: string;
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

    const skinClass = model.skin ? ` hudSkin-${model.skin}` : "";

    const renderStatus = (status: HudStatusViewModel): string => {
      const safeMax = Math.max(1, status.meter.max);
      const fraction = Math.max(0, Math.min(1, status.meter.current / safeMax));
      return `
        <article class="hudStatus">
          <span class="hudPortrait"><img src="${status.portraitUrl}" alt="" /></span>
          <div class="hudStatusBody">
            <span class="hudStatusName">${status.name}</span>
            <div
              class="hudHealth${fraction <= 0.3 ? " hudHealthLow" : ""}"
              role="progressbar"
              aria-label="${status.meter.label}"
              aria-valuemin="0"
              aria-valuemax="${safeMax}"
              aria-valuenow="${Math.max(0, Math.round(status.meter.current))}"
            >
              <span class="hudHealthFill" style="width: ${fraction * 100}%"></span>
              <span class="hudHealthText">${Math.max(0, Math.round(status.meter.current))}/${safeMax}</span>
            </div>
            ${status.caption ? `<span class="hudStatusCaption">${status.caption}</span>` : ""}
          </div>
        </article>
      `;
    };

    const renderSlot = (slot: HudSlotViewModel, index: number): string => `
      <div
        class="hudSlot${slot.active ? " hudSlotActive" : ""}${slot.dim ? " hudSlotDim" : ""}${slot.iconUrl ? "" : " hudSlotEmpty"}"
        title="${slot.label}"
        aria-label="${slot.label}${slot.count ? `: ${slot.count}` : ""}"
      >
        <span class="hudSlotKey" aria-hidden="true">${index + 1}</span>
        ${slot.iconUrl ? `<img class="hudSlotIcon" src="${slot.iconUrl}" alt="" />` : ""}
        ${slot.count ? `<span class="hudSlotCount">${slot.count}</span>` : ""}
      </div>
    `;

    const helpButton = model.helpAction
      ? this.renderActionButton("hud-help", model.helpAction, actionMap, "hud-help-button chrome-button chrome-button-secondary")
      : "";

    if (model.layout === "active") {
      const mainHud =
        model.status || model.hotbar
          ? `
            ${model.status ? renderStatus(model.status) : ""}
            <article class="hudHotbar">
              ${(model.hotbar ?? []).map(renderSlot).join("")}
              ${helpButton}
            </article>
          `
          : `
            <article class="hud-bar">
              <div class="hud-bar-kpis">
                ${model.kpis.map((kpi) => renderActiveKpi(kpi)).join("")}
              </div>
              ${helpButton}
            </article>
          `;
      this.root.innerHTML = `
        <section class="hud-bar-screen${skinClass}">
          ${mainHud}
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
        <section class="hud-result-screen${skinClass}">
          <article class="hud-result-card">
            <p class="eyebrow">${model.title}</p>
            <h2 class="hud-card-title">${model.heading ?? "Briefing"}</h2>
            <p class="hud-copy">${model.copy}</p>
            ${model.objective ? `<p class="hud-copy hud-copy-secondary">${model.objective}</p>` : ""}
            ${
              model.notes.length
                ? `<ul class="hud-sidebar-list">${model.notes.map((note) => `<li>${note}</li>`).join("")}</ul>`
                : ""
            }
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
