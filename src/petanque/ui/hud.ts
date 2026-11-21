// DOM overlay: title, local setup, online lobby, in-game HUD, swing meter,
// toasts and results. Styling lives in petanque.css; colours come from theme.ts.

import { match as matchRules, meter as meterRules, type ThrowStyle } from "../config/rules";
import { characters, getCharacter, teamNames } from "../content/characters";
import type { MatchConfig, MatchState, PlayerSlot } from "../simulation/match";
import { boulesPerPlayer, teamBoulesLeft } from "../simulation/match";
import type { MeterState } from "../simulation/meter";
import type { LobbyState } from "../net/protocol";

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function avatar(characterId: string): string {
  const character = getCharacter(characterId);
  const hat = character.hat === "none" ? character.hair : character.hatColor;
  return `<div class="ppAvatar" style="--avatar-skin:${hex(character.skin)};--avatar-shirt:${hex(character.shirt)};--avatar-hat:${hex(hat)}"></div>`;
}

export interface TitleHandlers {
  onLocal(): void;
  onHost(name: string): void;
  onJoin(code: string, name: string): void;
}

export interface LobbyHandlers {
  onPlayerCount(count: 2 | 4): void;
  onTargetScore(score: number): void;
  onEditName(name: string): void;
  onPickCharacter(slotIndex: number, step: number): void;
  onStart(): void;
  onLeave(): void;
}

export class Hud {
  private readonly root: HTMLElement;
  private readonly screen: HTMLElement;
  private readonly hudLayer: HTMLElement;
  private readonly toastLayer: HTMLElement;
  private readonly meterFill: HTMLElement;
  private readonly meterMarker: HTMLElement;
  private readonly meterLock: HTMLElement;
  private readonly meterBox: HTMLElement;
  private readonly scoreBoard: HTMLElement;
  private readonly turnBanner: HTMLElement;
  private readonly infoLine: HTMLElement;
  private readonly styleChip: HTMLElement;
  private readonly roomChip: HTMLElement;
  private toastTimer = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    root.innerHTML = `
      <a class="ppHome" href="../" aria-label="Back to Game Library">‹ Library</a>
      <div class="ppHud" hidden>
        <div class="ppScoreboard"></div>
        <div class="ppTurn"></div>
        <div class="ppRoomChip"></div>
        <div class="ppBottom">
          <div class="ppInfo"></div>
          <div class="ppMeterBox">
            <div class="ppStyleChip"></div>
            <div class="ppMeter">
              <div class="ppMeterSweet"></div>
              <div class="ppMeterFill"></div>
              <div class="ppMeterLock"></div>
              <div class="ppMeterMarker"></div>
            </div>
          </div>
          <div class="ppHelp">← → aim · ↑ ↓ roll / lob · Space: start, set power, set accuracy</div>
        </div>
      </div>
      <div class="ppToasts"></div>
      <div class="ppScreen"></div>
    `;
    const find = (selector: string) => root.querySelector<HTMLElement>(selector)!;
    this.hudLayer = find(".ppHud");
    this.screen = find(".ppScreen");
    this.toastLayer = find(".ppToasts");
    this.scoreBoard = find(".ppScoreboard");
    this.turnBanner = find(".ppTurn");
    this.infoLine = find(".ppInfo");
    this.styleChip = find(".ppStyleChip");
    this.roomChip = find(".ppRoomChip");
    this.meterBox = find(".ppMeterBox");
    this.meterFill = find(".ppMeterFill");
    this.meterMarker = find(".ppMeterMarker");
    this.meterLock = find(".ppMeterLock");

    const sweet = find(".ppMeterSweet");
    sweet.style.left = `${this.meterPercent(-meterRules.sweetSpotHalfWidth)}%`;
    sweet.style.width = `${this.meterPercent(meterRules.sweetSpotHalfWidth) - this.meterPercent(-meterRules.sweetSpotHalfWidth)}%`;
  }

  private meterPercent(value: number): number {
    return ((value - meterRules.overshoot) / (1 - meterRules.overshoot)) * 100;
  }

  closeScreen(): void {
    this.screen.innerHTML = "";
  }

  // ---------- title ----------

  showTitle(savedName: string, handlers: TitleHandlers, notice = ""): void {
    this.hudLayer.hidden = true;
    this.screen.innerHTML = `
      <div class="ppTitle">
        <div class="ppLogo">
          <span class="ppLogoBall"></span>
          <h1>Pétanque<br /><em>Park</em></h1>
        </div>
        <p class="ppTagline">Toss it close. Knock 'em away. Bragging rights on the line.</p>
        ${notice ? `<p class="ppNotice">${escapeHtml(notice)}</p>` : ""}
        <div class="ppPanel ppTitleMenu">
          <button class="ppButton ppButtonBig" data-local>Play on this PC</button>
          <div class="ppDivider"><span>Online with friends</span></div>
          <label class="ppField">
            <span>Your name</span>
            <input class="ppName" data-name maxlength="16" value="${escapeHtml(savedName)}" placeholder="Name" />
          </label>
          <div class="ppOnlineRow">
            <button class="ppButton" data-host>Host a room</button>
            <div class="ppJoin">
              <input class="ppCode" data-code maxlength="4" placeholder="CODE" aria-label="Room code" autocomplete="off" spellcheck="false" />
              <button class="ppButton ppButtonGhost" data-join>Join</button>
            </div>
          </div>
          <p class="ppFormError" data-error></p>
        </div>
      </div>
    `;
    const nameInput = this.screen.querySelector<HTMLInputElement>("[data-name]")!;
    const codeInput = this.screen.querySelector<HTMLInputElement>("[data-code]")!;
    const errorLine = this.screen.querySelector<HTMLElement>("[data-error]")!;
    const name = () => nameInput.value.trim();
    codeInput.addEventListener("input", () => {
      codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z]/g, "");
    });
    this.screen.querySelector("[data-local]")!.addEventListener("click", handlers.onLocal);
    this.screen.querySelector("[data-host]")!.addEventListener("click", () => {
      if (!name()) return this.flagError(errorLine, "Enter your name first.", nameInput);
      handlers.onHost(name());
    });
    const join = () => {
      if (!name()) return this.flagError(errorLine, "Enter your name first.", nameInput);
      if (codeInput.value.length !== 4) return this.flagError(errorLine, "Room codes are 4 letters.", codeInput);
      handlers.onJoin(codeInput.value, name());
    };
    this.screen.querySelector("[data-join]")!.addEventListener("click", join);
    codeInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") join();
    });
  }

  private flagError(line: HTMLElement, message: string, input?: HTMLElement): void {
    line.textContent = message;
    input?.focus();
  }

  showTitleError(message: string): void {
    const line = this.screen.querySelector<HTMLElement>("[data-error]");
    if (line) line.textContent = message;
  }

  setTitleBusy(busy: boolean): void {
    for (const button of this.screen.querySelectorAll<HTMLButtonElement>("button")) button.disabled = busy;
  }

  // ---------- local setup ----------

  showSetup(previous: MatchConfig | null, onStart: (config: MatchConfig) => void, onBack: () => void): void {
    let playerCount = previous?.players.length ?? 2;
    let targetScore = previous?.targetScore ?? matchRules.defaultTargetScore;
    const slots: PlayerSlot[] = [0, 1, 2, 3].map((index) => {
      const existing = previous?.players[index];
      return existing ?? { name: characters[index].name, characterId: characters[index].id, team: index % 2, isCpu: index === 1 };
    });

    const render = () => {
      const activeSlots = slots.slice(0, playerCount);
      this.screen.innerHTML = `
        <div class="ppPanel ppSetup">
          <h2>Match Setup</h2>
          ${this.segment("count", [[2, "1 vs 1"], [4, "2 vs 2"]], playerCount)}
          <div class="ppTeams">
            ${[0, 1]
              .map(
                (team) => `
              <div class="ppTeam ppTeam${team}">
                <h3>${teamNames[team]}</h3>
                ${activeSlots
                  .map((slot, index) => ({ slot, index }))
                  .filter(({ slot }) => slot.team === team)
                  .map(
                    ({ slot, index }) => `
                    <div class="ppSlot" data-slot="${index}">
                      ${avatar(slot.characterId)}
                      <div class="ppSlotMain">
                        <input class="ppName" maxlength="16" value="${escapeHtml(slot.name)}" aria-label="Player name" />
                        ${this.picker(getCharacter(slot.characterId).name)}
                      </div>
                      <button class="ppToggle ${slot.isCpu ? "isCpu" : ""}" data-cpu>${slot.isCpu ? "CPU" : "Human"}</button>
                    </div>`,
                  )
                  .join("")}
              </div>`,
              )
              .join("")}
          </div>
          <div class="ppRow"><span>Play to</span>${this.segment("target", matchRules.targetScoreOptions.map((score) => [score, String(score)]), targetScore)}</div>
          <div class="ppActions">
            <button class="ppButton ppButtonGhost" data-back>Back</button>
            <button class="ppButton" data-start>Start Match</button>
          </div>
        </div>
      `;
      this.bindSegment("count", (value) => {
        playerCount = value;
        render();
      });
      this.bindSegment("target", (value) => {
        targetScore = value;
        render();
      });
      for (const slotElement of this.screen.querySelectorAll<HTMLElement>("[data-slot]")) {
        const slot = slots[Number(slotElement.dataset.slot)];
        slotElement.querySelector<HTMLInputElement>(".ppName")!.addEventListener("input", (event) => {
          slot.name = (event.target as HTMLInputElement).value;
        });
        for (const button of slotElement.querySelectorAll<HTMLButtonElement>("[data-pick]")) {
          button.addEventListener("click", () => {
            const current = characters.findIndex((character) => character.id === slot.characterId);
            const next = (current + Number(button.dataset.pick) + characters.length) % characters.length;
            if (slot.name === characters[current].name) slot.name = characters[next].name;
            slot.characterId = characters[next].id;
            render();
          });
        }
        slotElement.querySelector("[data-cpu]")!.addEventListener("click", () => {
          slot.isCpu = !slot.isCpu;
          render();
        });
      }
      this.screen.querySelector("[data-back]")!.addEventListener("click", onBack);
      this.screen.querySelector("[data-start]")!.addEventListener("click", () => {
        const players = slots
          .slice(0, playerCount)
          .map((slot) => ({ ...slot, name: slot.name.trim() || getCharacter(slot.characterId).name, controllerId: undefined }));
        onStart({ players, targetScore });
      });
    };

    this.hudLayer.hidden = true;
    render();
  }

  private segment(name: string, options: Array<[number, string]>, current: number): string {
    return `<div class="ppSegment" role="group">${options
      .map(([value, label]) => `<button data-${name}="${value}" class="${value === current ? "isOn" : ""}">${label}</button>`)
      .join("")}</div>`;
  }

  private bindSegment(name: string, onPick: (value: number) => void): void {
    for (const button of this.screen.querySelectorAll<HTMLButtonElement>(`[data-${name}]`)) {
      button.addEventListener("click", () => onPick(Number(button.getAttribute(`data-${name}`))));
    }
  }

  private picker(label: string, enabled = true): string {
    if (!enabled) return `<div class="ppPicker"><span>${escapeHtml(label)}</span></div>`;
    return `<div class="ppPicker">
      <button data-pick="-1" aria-label="Previous character">‹</button>
      <span>${escapeHtml(label)}</span>
      <button data-pick="1" aria-label="Next character">›</button>
    </div>`;
  }

  // ---------- online lobby ----------

  showLobby(code: string, lobby: LobbyState, myId: string, isHost: boolean, handlers: LobbyHandlers): void {
    this.hudLayer.hidden = true;
    const focused = document.activeElement instanceof HTMLInputElement && this.screen.contains(document.activeElement);
    if (focused) return; // Don't yank the name box out from under someone typing; next update catches up.

    const humans = lobby.slots.filter((slot) => slot.controllerId !== null).length;
    this.screen.innerHTML = `
      <div class="ppPanel ppSetup ppLobby">
        <p class="ppEyebrow">Room code</p>
        <div class="ppCodeBig" aria-label="Room code ${code.split("").join(" ")}">${code
          .split("")
          .map((letter) => `<span>${letter}</span>`)
          .join("")}</div>
        <p class="ppLobbyHint">Friends open this page, enter the code, and press Join.</p>
        ${isHost ? this.segment("count", [[2, "1 vs 1"], [4, "2 vs 2"]], lobby.playerCount) : ""}
        <div class="ppTeams">
          ${[0, 1]
            .map(
              (team) => `
            <div class="ppTeam ppTeam${team}">
              <h3>${teamNames[team]}</h3>
              ${lobby.slots
                .map((slot, index) => ({ slot, index }))
                .filter(({ slot }) => slot.team === team)
                .map(({ slot, index }) => {
                  const mine = slot.controllerId === myId;
                  const editable = mine || (isHost && slot.controllerId === null);
                  const tag = mine ? "You" : slot.controllerId === null ? "CPU" : "Friend";
                  return `
                  <div class="ppSlot ${mine ? "isMine" : ""}" data-slot="${index}">
                    ${avatar(slot.characterId)}
                    <div class="ppSlotMain">
                      ${mine ? `<input class="ppName" data-myname maxlength="16" value="${escapeHtml(slot.name)}" aria-label="Your name" />` : `<div class="ppSlotName">${escapeHtml(slot.name)}</div>`}
                      ${this.picker(getCharacter(slot.characterId).name, editable)}
                    </div>
                    <span class="ppToggle ${slot.controllerId === null ? "isCpu" : ""}">${tag}</span>
                  </div>`;
                })
                .join("")}
            </div>`,
            )
            .join("")}
        </div>
        ${isHost ? `<div class="ppRow"><span>Play to</span>${this.segment("target", matchRules.targetScoreOptions.map((score) => [score, String(score)]), lobby.targetScore)}</div>` : `<p class="ppLobbyHint">Play to ${lobby.targetScore}. Waiting for the host to start…</p>`}
        <div class="ppActions">
          <button class="ppButton ppButtonGhost" data-leave>Leave</button>
          ${isHost ? `<button class="ppButton" data-start>${humans > 1 ? "Start Match" : "Start vs CPU"}</button>` : ""}
        </div>
      </div>
    `;

    if (isHost) {
      this.bindSegment("count", (value) => handlers.onPlayerCount(value as 2 | 4));
      this.bindSegment("target", handlers.onTargetScore);
      this.screen.querySelector("[data-start]")!.addEventListener("click", handlers.onStart);
    }
    this.screen.querySelector("[data-leave]")!.addEventListener("click", handlers.onLeave);
    const nameInput = this.screen.querySelector<HTMLInputElement>("[data-myname]");
    if (nameInput) {
      const commit = () => {
        if (nameInput.value.trim()) handlers.onEditName(nameInput.value.trim());
      };
      nameInput.addEventListener("change", commit);
      nameInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") nameInput.blur();
      });
    }
    for (const slotElement of this.screen.querySelectorAll<HTMLElement>("[data-slot]")) {
      for (const button of slotElement.querySelectorAll<HTMLButtonElement>("[data-pick]")) {
        button.addEventListener("click", () => handlers.onPickCharacter(Number(slotElement.dataset.slot), Number(button.dataset.pick)));
      }
    }
  }

  // ---------- in-game ----------

  showHud(roomCode: string | null): void {
    this.hudLayer.hidden = false;
    this.roomChip.textContent = roomCode ? `Room ${roomCode}` : "";
  }

  updateScore(state: MatchState, pointTeam: number | null): void {
    const perPlayer = boulesPerPlayer(state.config);
    this.scoreBoard.innerHTML = [0, 1]
      .map((team) => {
        const left = teamBoulesLeft(state, team);
        const total = state.config.players.filter((player) => player.team === team).length * perPlayer;
        const dots = Array.from({ length: total }, (_, index) => `<i class="${index < left ? "isLeft" : ""}"></i>`).join("");
        const isTurn = state.currentTeam === team && state.phase !== "endOver" && state.phase !== "matchOver";
        return `
          <div class="ppScore ppTeam${team} ${isTurn ? "isTurn" : ""}">
            <div class="ppScoreName">${teamNames[team]}${pointTeam === team ? '<span class="ppPoint">POINT</span>' : ""}</div>
            <div class="ppScoreValue">${state.scores[team]}</div>
            <div class="ppDots">${dots}</div>
          </div>`;
      })
      .join(`<div class="ppScoreMid">End ${state.endNumber}<small>to ${state.config.targetScore}</small></div>`);
  }

  setTurn(text: string, team: number): void {
    this.turnBanner.className = `ppTurn ppTeam${team}`;
    this.turnBanner.textContent = text;
  }

  setInfo(text: string): void {
    this.infoLine.textContent = text;
  }

  // Meter and key help show for whoever is throwing; watchers see the meter only.
  setControls(meterVisible: boolean, helpVisible: boolean): void {
    this.root.classList.toggle("ppMeterHidden", !meterVisible);
    this.root.classList.toggle("ppHelpHidden", !helpVisible);
  }

  setStyle(style: ThrowStyle): void {
    this.styleChip.textContent = style === "roll" ? "Roll (point)" : "Lob (high toss)";
    this.styleChip.dataset.style = style;
  }

  setMeter(state: MeterState): void {
    const active = state.phase === "power" || state.phase === "accuracy";
    this.meterBox.classList.toggle("isActive", active);
    const zero = this.meterPercent(0);
    if (state.phase === "power") {
      this.meterFill.style.left = `${zero}%`;
      this.meterFill.style.width = `${this.meterPercent(state.value) - zero}%`;
      this.meterLock.hidden = true;
    } else if (state.phase === "accuracy" || state.phase === "done") {
      this.meterFill.style.left = `${zero}%`;
      this.meterFill.style.width = `${this.meterPercent(state.power) - zero}%`;
      this.meterLock.hidden = false;
      this.meterLock.style.left = `${this.meterPercent(state.power)}%`;
    } else {
      this.meterFill.style.width = "0";
      this.meterLock.hidden = true;
    }
    const markerValue = state.phase === "idle" || state.phase === "cancelled" ? 0 : state.value;
    this.meterMarker.style.left = `${this.meterPercent(markerValue)}%`;
  }

  toast(text: string, team: number | null = null, seconds = 1.8): void {
    this.toastLayer.innerHTML = `<div class="ppToast ${team === null ? "" : `ppTeam${team}`}">${escapeHtml(text)}</div>`;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toastLayer.innerHTML = "";
    }, seconds * 1000);
  }

  showEndSummary(headline: string, detail: string, team: number | null, canContinue: boolean, onContinue: () => void): void {
    this.screen.innerHTML = `
      <div class="ppPanel ppSummary ${team === null ? "" : `ppTeam${team}`}">
        <h2>${escapeHtml(headline)}</h2>
        <p>${escapeHtml(detail)}</p>
        ${canContinue ? `<button class="ppButton" data-continue>Next End</button><small>or press Space</small>` : `<small>Waiting for the host…</small>`}
      </div>
    `;
    this.screen.querySelector("[data-continue]")?.addEventListener("click", onContinue);
  }

  showMatchOver(headline: string, scores: [number, number], team: number, canRematch: boolean, onRematch: () => void, onMenu: () => void): void {
    this.screen.innerHTML = `
      <div class="ppPanel ppSummary ppFinal ppTeam${team}">
        <div class="ppTrophy">🏆</div>
        <h2>${escapeHtml(headline)}</h2>
        <p class="ppFinalScore"><span class="ppTeam0">${scores[0]}</span> – <span class="ppTeam1">${scores[1]}</span></p>
        <div class="ppActions">
          <button class="ppButton ppButtonGhost" data-menu>Menu</button>
          ${canRematch ? `<button class="ppButton" data-rematch>Rematch</button>` : ""}
        </div>
        ${canRematch ? "" : "<small>The host can start a rematch.</small>"}
      </div>
    `;
    this.screen.querySelector("[data-rematch]")?.addEventListener("click", onRematch);
    this.screen.querySelector("[data-menu]")!.addEventListener("click", onMenu);
  }
}
