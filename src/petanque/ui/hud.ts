// DOM overlay: title, local setup, online lobby, in-game HUD, the two-bar
// throw meter, toasts and results. Styling lives in petanque.css; colours come
// from theme.ts.

import { cpuLevelOrder, cpuLevels, defaultCpuLevel, match as matchRules, meter as meterRules, throwing, type CpuLevel, type ThrowStyle } from "../config/rules";
import { characters, getCharacter, teamNames } from "../content/characters";
import { courts, defaultCourtId, getCourt, type CourtId } from "../content/courts";
import type { LobbyState } from "../net/protocol";
import type { MatchConfig, MatchState, PlayerSlot } from "../simulation/match";
import { boulesPerPlayer, teamBoulesLeft } from "../simulation/match";
import type { MeterState } from "../simulation/meter";
import { powerToDistance } from "../simulation/physics";

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

export type PortraitSource = (characterId: string) => string;

export interface TitleHandlers {
  onLocal(): void;
  onHost(name: string): void;
  onJoin(code: string, name: string): void;
}

export interface SetupHandlers {
  onStart(config: MatchConfig): void;
  onBack(): void;
  onPreviewCourt(id: CourtId): void;
}

export interface LobbyHandlers {
  onPlayerCount(count: 2 | 4): void;
  onTargetScore(score: number): void;
  onCourt(id: CourtId): void;
  onEditName(name: string): void;
  onPickCharacter(slotIndex: number, characterId: string): void;
  onCpuLevel(slotIndex: number, level: CpuLevel): void;
  onStart(): void;
  onLeave(): void;
}

interface SetupSlot {
  name: string;
  characterId: string;
  team: number;
  isCpu: boolean;
  cpuLevel: CpuLevel;
}

const presets: Array<{ id: string; label: string; count: 2 | 4; cpu: boolean[]; teams: number[] }> = [
  { id: "vsCpu", label: "1 vs 1 · you vs CPU", count: 2, cpu: [false, true], teams: [0, 1] },
  { id: "hotSeat", label: "1 vs 1 · two players", count: 2, cpu: [false, false], teams: [0, 1] },
  { id: "threeCpu", label: "2 vs 2 · you + 3 CPUs", count: 4, cpu: [false, true, true, true], teams: [0, 1, 0, 1] },
];

export class Hud {
  private readonly root: HTMLElement;
  private readonly screen: HTMLElement;
  private readonly hudLayer: HTMLElement;
  private readonly toastLayer: HTMLElement;
  private readonly meterBox: HTMLElement;
  private readonly distanceFill: HTMLElement;
  private readonly distanceNeedle: HTMLElement;
  private readonly distanceReadout: HTMLElement;
  private readonly directionNeedle: HTMLElement;
  private readonly directionBar: HTMLElement;
  private readonly distanceBar: HTMLElement;
  private readonly scoreBoard: HTMLElement;
  private readonly turnBanner: HTMLElement;
  private readonly infoLine: HTMLElement;
  private readonly styleChip: HTMLElement;
  private readonly roomChip: HTMLElement;
  private toastTimer = 0;
  private portrait: PortraitSource = () => "";

  constructor(root: HTMLElement) {
    this.root = root;
    const metreTicks = Array.from({ length: throwing.maxDistance - throwing.minDistance + 1 }, (_, index) => {
      const metres = throwing.minDistance + index;
      const left = (index / (throwing.maxDistance - throwing.minDistance)) * 100;
      return `<i style="left:${left}%" class="${metres % 2 === 0 ? "isMajor" : ""}">${metres % 2 === 0 ? `<b>${metres}</b>` : ""}</i>`;
    }).join("");
    const sweet = meterRules.directionSweetSpot * 50;
    root.innerHTML = `
      <a class="ppHome" href="../" aria-label="Back to JackGames">‹ JackGames</a>
      <div class="ppHud" hidden>
        <div class="ppScoreboard"></div>
        <div class="ppTurn"></div>
        <div class="ppRoomChip"></div>
        <div class="ppBottom">
          <div class="ppInfo"></div>
          <div class="ppMeterBox">
            <div class="ppStyleChip"></div>
            <div class="ppBar" data-bar="distance">
              <span class="ppBarLabel">Distance</span>
              <div class="ppTrack">
                <div class="ppTicks">${metreTicks}</div>
                <div class="ppFill"></div>
                <div class="ppNeedle"></div>
              </div>
              <span class="ppReadout"></span>
            </div>
            <div class="ppBar" data-bar="direction">
              <span class="ppBarLabel">Straight</span>
              <div class="ppTrack ppTrackDirection">
                <div class="ppSweet" style="left:${50 - sweet}%;width:${sweet * 2}%"></div>
                <div class="ppNeedle"></div>
              </div>
              <span class="ppReadout ppReadoutHint">◀ ▶</span>
            </div>
          </div>
          <div class="ppHelp">← → aim · ↑ ↓ roll / lob · Space: start → lock distance → lock straight</div>
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
    this.distanceBar = find('[data-bar="distance"]');
    this.directionBar = find('[data-bar="direction"]');
    this.distanceFill = this.distanceBar.querySelector<HTMLElement>(".ppFill")!;
    this.distanceNeedle = this.distanceBar.querySelector<HTMLElement>(".ppNeedle")!;
    this.distanceReadout = this.distanceBar.querySelector<HTMLElement>(".ppReadout")!;
    this.directionNeedle = this.directionBar.querySelector<HTMLElement>(".ppNeedle")!;
  }

  setPortraitSource(source: PortraitSource): void {
    this.portrait = source;
  }

  private avatar(characterId: string, extraClass = ""): string {
    const character = getCharacter(characterId);
    const src = this.portrait(characterId);
    return `<span class="ppAvatar ${extraClass}">${src ? `<img src="${src}" alt="${escapeHtml(character.name)}" draggable="false" />` : ""}</span>`;
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

  // ---------- shared pieces ----------

  private segment(name: string, options: Array<[string | number, string]>, current: string | number, extraClass = ""): string {
    return `<div class="ppSegment ${extraClass}" role="group">${options
      .map(([value, label]) => `<button data-${name}="${value}" class="${value === current ? "isOn" : ""}" aria-pressed="${value === current}">${label}</button>`)
      .join("")}</div>`;
  }

  private bindSegment(scope: ParentNode, name: string, onPick: (value: string) => void): void {
    for (const button of scope.querySelectorAll<HTMLButtonElement>(`[data-${name}]`)) {
      button.addEventListener("click", () => onPick(button.getAttribute(`data-${name}`)!));
    }
  }

  private courtPicker(current: CourtId, enabled: boolean): string {
    return `<div class="ppCourts">${courts
      .map(
        (court) => `
        <button class="ppCourt ppCourt-${court.id} ${court.id === current ? "isOn" : ""}" data-court="${court.id}" ${enabled ? "" : "disabled"} aria-pressed="${court.id === current}">
          <strong>${escapeHtml(court.name)}</strong>
          <small>${escapeHtml(court.blurb)}</small>
        </button>`,
      )
      .join("")}</div>`;
  }

  // Character select grid, shown over the setup or lobby panel.
  private openCharacterPicker(current: string, taken: Set<string>, onPick: (characterId: string) => void): void {
    const overlay = document.createElement("div");
    overlay.className = "ppPickerOverlay";
    overlay.innerHTML = `
      <div class="ppPanel ppPickerPanel" role="dialog" aria-label="Choose a character">
        <h2>Choose a player</h2>
        <div class="ppRoster">
          ${characters
            .map((character) => {
              const isTaken = taken.has(character.id) && character.id !== current;
              return `
              <button class="ppRosterCard ${character.id === current ? "isOn" : ""}" data-character="${character.id}" ${isTaken ? "disabled" : ""}>
                ${this.avatar(character.id, "ppAvatarBig")}
                <strong>${escapeHtml(character.name)}</strong>
                <small>${isTaken ? "Taken" : escapeHtml(character.tagline)}</small>
              </button>`;
            })
            .join("")}
        </div>
        <div class="ppActions"><button class="ppButton ppButtonGhost" data-cancel>Cancel</button></div>
      </div>
    `;
    const close = () => overlay.remove();
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });
    overlay.querySelector("[data-cancel]")!.addEventListener("click", close);
    for (const button of overlay.querySelectorAll<HTMLButtonElement>("[data-character]")) {
      button.addEventListener("click", () => {
        close();
        onPick(button.dataset.character!);
      });
    }
    this.screen.appendChild(overlay);
    overlay.querySelector<HTMLButtonElement>(".ppRosterCard.isOn, .ppRosterCard:not([disabled])")?.focus();
  }

  // ---------- local setup ----------

  showSetup(previous: MatchConfig | null, handlers: SetupHandlers): void {
    let playerCount: 2 | 4 = previous?.players.length === 4 ? 4 : 2;
    let targetScore = previous?.targetScore ?? matchRules.defaultTargetScore;
    let courtId: CourtId = getCourt(previous?.courtId ?? defaultCourtId).id;
    const defaults = ["rafa", "mina", "zuri", "gus"];
    const slots: SetupSlot[] = [0, 1, 2, 3].map((index) => {
      const existing = previous?.players[index];
      if (existing) {
        return { name: existing.name, characterId: existing.characterId, team: existing.team, isCpu: existing.isCpu, cpuLevel: existing.cpuLevel ?? defaultCpuLevel };
      }
      const character = getCharacter(defaults[index]);
      return { name: character.name, characterId: character.id, team: index % 2, isCpu: index !== 0, cpuLevel: defaultCpuLevel };
    });
    handlers.onPreviewCourt(courtId);

    const applyPreset = (preset: (typeof presets)[number]) => {
      playerCount = preset.count;
      preset.cpu.forEach((isCpu, index) => {
        slots[index].isCpu = isCpu;
        slots[index].team = preset.teams[index];
      });
    };

    const render = () => {
      const active = slots.slice(0, playerCount);
      const perTeam = playerCount / 2;
      const teamCounts = [0, 1].map((team) => active.filter((slot) => slot.team === team).length);
      const balanced = teamCounts[0] === perTeam && teamCounts[1] === perTeam;
      const presetOn = presets.find(
        (preset) => preset.count === playerCount && preset.cpu.every((isCpu, index) => active[index]?.isCpu === isCpu && active[index]?.team === preset.teams[index]),
      );
      let humanNumber = 0;
      this.screen.innerHTML = `
        <div class="ppPanel ppSetup">
          <h2>Match Setup</h2>
          <div class="ppPresets">${presets
            .map((preset) => `<button class="ppChip ${presetOn?.id === preset.id ? "isOn" : ""}" data-preset="${preset.id}">${preset.label}</button>`)
            .join("")}</div>
          <div class="ppRow"><span>Players</span>${this.segment("count", [[2, "1 vs 1"], [4, "2 vs 2"]], playerCount)}</div>
          <div class="ppSlots ppSlots${playerCount}">
            ${active
              .map((slot, index) => {
                const label = slot.isCpu ? "CPU" : `P${++humanNumber}`;
                return `
                <div class="ppSlotCard ppTeam${slot.team}" data-slot="${index}">
                  <button class="ppPortraitButton" data-pick aria-label="Change character for slot ${index + 1}">
                    ${this.avatar(slot.characterId, "ppAvatarBig")}
                    <span class="ppSlotTag">${label}</span>
                    <span class="ppSlotChange">Change</span>
                  </button>
                  <div class="ppSlotMain">
                    <input class="ppName" maxlength="16" value="${escapeHtml(slot.name)}" aria-label="Player ${index + 1} name" />
                    <span class="ppSlotCharacter">${escapeHtml(getCharacter(slot.characterId).name)}</span>
                    ${this.segment("controller", [["human", "Human"], ["cpu", "CPU"]], slot.isCpu ? "cpu" : "human", "ppSegmentSmall")}
                    ${slot.isCpu ? this.segment("level", cpuLevelOrder.map((level) => [level, cpuLevels[level].label]), slot.cpuLevel, "ppSegmentSmall") : ""}
                    ${this.segment("team", [[0, teamNames[0]], [1, teamNames[1]]], slot.team, "ppSegmentSmall ppSegmentTeam")}
                  </div>
                </div>`;
              })
              .join("")}
          </div>
          <p class="ppFormError">${balanced ? "" : `Each team needs ${perTeam} player${perTeam === 1 ? "" : "s"}: ${teamNames[0]} has ${teamCounts[0]}, ${teamNames[1]} has ${teamCounts[1]}.`}</p>
          <div class="ppRow ppRowTop"><span>Court</span>${this.courtPicker(courtId, true)}</div>
          <div class="ppRow"><span>Play to</span>${this.segment("target", matchRules.targetScoreOptions.map((score) => [score, String(score)]), targetScore)}</div>
          <div class="ppActions">
            <button class="ppButton ppButtonGhost" data-back>Back</button>
            <button class="ppButton" data-start ${balanced ? "" : "disabled"}>Start Match</button>
          </div>
        </div>
      `;
      const panel = this.screen.querySelector<HTMLElement>(".ppSetup")!;
      for (const button of panel.querySelectorAll<HTMLButtonElement>("[data-preset]")) {
        button.addEventListener("click", () => {
          applyPreset(presets.find((preset) => preset.id === button.dataset.preset)!);
          render();
        });
      }
      this.bindSegment(panel, "count", (value) => {
        playerCount = value === "4" ? 4 : 2;
        // Keep teams balanced when growing: slots 3 and 4 alternate.
        if (playerCount === 4) {
          slots[2].team = slots[0].team;
          slots[3].team = slots[1].team;
        }
        render();
      });
      this.bindSegment(panel, "target", (value) => {
        targetScore = Number(value);
        render();
      });
      this.bindSegment(panel, "court", (value) => {
        courtId = getCourt(value).id;
        handlers.onPreviewCourt(courtId);
        render();
      });
      for (const card of panel.querySelectorAll<HTMLElement>("[data-slot]")) {
        const slot = slots[Number(card.dataset.slot)];
        card.querySelector<HTMLInputElement>(".ppName")!.addEventListener("input", (event) => {
          slot.name = (event.target as HTMLInputElement).value;
        });
        card.querySelector("[data-pick]")!.addEventListener("click", () => {
          const taken = new Set(active.map((other) => other.characterId));
          this.openCharacterPicker(slot.characterId, taken, (characterId) => {
            if (slot.name.trim() === "" || slot.name === getCharacter(slot.characterId).name) slot.name = getCharacter(characterId).name;
            slot.characterId = characterId;
            render();
          });
        });
        this.bindSegment(card, "controller", (value) => {
          slot.isCpu = value === "cpu";
          render();
        });
        this.bindSegment(card, "level", (value) => {
          slot.cpuLevel = value as CpuLevel;
          render();
        });
        this.bindSegment(card, "team", (value) => {
          slot.team = Number(value);
          render();
        });
      }
      panel.querySelector("[data-back]")!.addEventListener("click", handlers.onBack);
      panel.querySelector("[data-start]")!.addEventListener("click", () => {
        if (!balanced) return;
        const players: PlayerSlot[] = active.map((slot) => ({
          name: slot.name.trim() || getCharacter(slot.characterId).name,
          characterId: slot.characterId,
          team: slot.team,
          isCpu: slot.isCpu,
          cpuLevel: slot.isCpu ? slot.cpuLevel : undefined,
          controllerId: undefined,
        }));
        handlers.onStart({ players: alternateTeams(players), targetScore, courtId });
      });
    };

    this.hudLayer.hidden = true;
    render();
  }

  // ---------- online lobby ----------

  showLobby(code: string, lobby: LobbyState, myId: string, isHost: boolean, handlers: LobbyHandlers): void {
    this.hudLayer.hidden = true;
    const focused = document.activeElement instanceof HTMLInputElement && this.screen.contains(document.activeElement);
    if (focused) return; // Don't yank the name box out from under someone typing; next update catches up.
    if (this.screen.querySelector(".ppPickerOverlay")) return; // Character grid open: refresh once it closes.

    const humans = lobby.slots.filter((slot) => slot.controllerId !== null).length;
    const courtId = getCourt(lobby.courtId).id;
    this.screen.innerHTML = `
      <div class="ppPanel ppSetup ppLobby">
        <p class="ppEyebrow">Room code</p>
        <div class="ppCodeBig" aria-label="Room code ${code.split("").join(" ")}">${code
          .split("")
          .map((letter) => `<span>${letter}</span>`)
          .join("")}</div>
        <p class="ppLobbyHint">Friends open this page, enter the code, and press Join.</p>
        ${isHost ? `<div class="ppRow"><span>Players</span>${this.segment("count", [[2, "1 vs 1"], [4, "2 vs 2"]], lobby.playerCount)}</div>` : ""}
        <div class="ppSlots ppSlots${lobby.playerCount}">
          ${lobby.slots
            .map((slot, index) => {
              const mine = slot.controllerId === myId;
              const isCpu = slot.controllerId === null;
              const editable = mine || (isHost && isCpu);
              const tag = mine ? "You" : isCpu ? "CPU" : "Friend";
              const level = slot.cpuLevel ?? defaultCpuLevel;
              return `
              <div class="ppSlotCard ppTeam${slot.team} ${mine ? "isMine" : ""}" data-slot="${index}">
                <button class="ppPortraitButton" data-pick ${editable ? "" : "disabled"} aria-label="Change character">
                  ${this.avatar(slot.characterId, "ppAvatarBig")}
                  <span class="ppSlotTag">${tag}</span>
                  ${editable ? '<span class="ppSlotChange">Change</span>' : ""}
                </button>
                <div class="ppSlotMain">
                  ${mine ? `<input class="ppName" data-myname maxlength="16" value="${escapeHtml(slot.name)}" aria-label="Your name" />` : `<div class="ppSlotName">${escapeHtml(slot.name)}</div>`}
                  <span class="ppSlotCharacter">${escapeHtml(getCharacter(slot.characterId).name)} · ${teamNames[slot.team]}</span>
                  ${isCpu && isHost ? this.segment("level", cpuLevelOrder.map((value) => [value, cpuLevels[value].label]), level, "ppSegmentSmall") : ""}
                  ${isCpu && !isHost ? `<span class="ppSlotCharacter">${cpuLevels[level].label} CPU</span>` : ""}
                </div>
              </div>`;
            })
            .join("")}
        </div>
        <div class="ppRow ppRowTop"><span>Court</span>${this.courtPicker(courtId, isHost)}</div>
        ${isHost ? `<div class="ppRow"><span>Play to</span>${this.segment("target", matchRules.targetScoreOptions.map((score) => [score, String(score)]), lobby.targetScore)}</div>` : `<p class="ppLobbyHint">Play to ${lobby.targetScore}. Waiting for the host to start…</p>`}
        <div class="ppActions">
          <button class="ppButton ppButtonGhost" data-leave>Leave</button>
          ${isHost ? `<button class="ppButton" data-start>${humans > 1 ? "Start Match" : "Start vs CPU"}</button>` : ""}
        </div>
      </div>
    `;

    const panel = this.screen.querySelector<HTMLElement>(".ppLobby")!;
    if (isHost) {
      this.bindSegment(panel, "count", (value) => handlers.onPlayerCount(value === "4" ? 4 : 2));
      this.bindSegment(panel, "target", (value) => handlers.onTargetScore(Number(value)));
      this.bindSegment(panel, "court", (value) => handlers.onCourt(getCourt(value).id));
      panel.querySelector("[data-start]")!.addEventListener("click", handlers.onStart);
    }
    panel.querySelector("[data-leave]")!.addEventListener("click", handlers.onLeave);
    const nameInput = panel.querySelector<HTMLInputElement>("[data-myname]");
    if (nameInput) {
      const commit = () => {
        if (nameInput.value.trim()) handlers.onEditName(nameInput.value.trim());
      };
      nameInput.addEventListener("change", commit);
      nameInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") nameInput.blur();
      });
    }
    for (const card of panel.querySelectorAll<HTMLElement>("[data-slot]")) {
      const index = Number(card.dataset.slot);
      const slot = lobby.slots[index];
      card.querySelector<HTMLButtonElement>("[data-pick]:not([disabled])")?.addEventListener("click", () => {
        const taken = new Set(lobby.slots.map((other) => other.characterId));
        this.openCharacterPicker(slot.characterId, taken, (characterId) => handlers.onPickCharacter(index, characterId));
      });
      this.bindSegment(card, "level", (value) => handlers.onCpuLevel(index, value as CpuLevel));
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
        const faces = state.config.players
          .filter((player) => player.team === team)
          .map((player) => this.avatar(player.characterId, "ppAvatarTiny"))
          .join("");
        return `
          <div class="ppScore ppTeam${team} ${isTurn ? "isTurn" : ""}">
            <div class="ppScoreFaces">${faces}</div>
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
    this.meterBox.dataset.phase = state.phase;
    const distance = state.phase === "distance" ? state.value : state.phase === "idle" ? 0 : state.power;
    this.distanceFill.style.width = `${distance * 100}%`;
    this.distanceNeedle.style.left = `${distance * 100}%`;
    this.distanceReadout.textContent = state.phase === "idle" ? "Space" : `${powerToDistance(distance).toFixed(1)} m`;
    this.distanceBar.classList.toggle("isLocked", state.phase === "direction" || state.phase === "done");
    this.distanceBar.classList.toggle("isActive", state.phase === "distance" || state.phase === "idle");
    const direction = state.phase === "direction" || state.phase === "done" ? state.value : 0;
    this.directionNeedle.style.left = `${50 + direction * 50}%`;
    this.directionBar.classList.toggle("isActive", state.phase === "direction");
    this.directionBar.classList.toggle("isLocked", state.phase === "done");
    this.directionBar.classList.toggle("isWaiting", state.phase === "idle" || state.phase === "distance");
    const off = Math.abs(direction);
    this.directionBar.classList.toggle("isPerfect", state.phase === "done" && off <= meterRules.directionSweetSpot);
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

// Throwing order alternates teams (A, B, A, B) however the slots were filled.
export function alternateTeams(players: PlayerSlot[]): PlayerSlot[] {
  const byTeam = [players.filter((player) => player.team === 0), players.filter((player) => player.team === 1)];
  const ordered: PlayerSlot[] = [];
  for (let index = 0; index < Math.max(byTeam[0].length, byTeam[1].length); index++) {
    if (byTeam[0][index]) ordered.push(byTeam[0][index]);
    if (byTeam[1][index]) ordered.push(byTeam[1][index]);
  }
  return ordered;
}
