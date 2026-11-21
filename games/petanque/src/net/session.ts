// An online room: who's in it, the pre-match lobby, and relaying game payloads.
// The host owns the lobby and is the referee for the match.

import { cpuLevels, defaultCpuLevel, match as matchRules, type CpuLevel } from "../config/rules";
import { getCourt, type CourtId } from "../content/courts";
import { characters, getCharacter } from "../content/characters";
import type { MatchConfig } from "../simulation/match";
import { isGamePayload, type GamePayload, type LobbySlot, type LobbyState } from "./protocol";
import { RoomClient, type JoinedMessage, type RoomMember } from "./roomClient";

export interface SessionEvents {
  onLobby(lobby: LobbyState): void;
  onPayload(from: string, payload: GamePayload): void;
  onMemberLeft(clientId: string, name: string): void;
  onMemberJoined(name: string): void;
  onClosed(reason: string): void;
}

// Slot order alternates teams so 2 vs 2 rotates A, B, A, B.
const slotTeams = [0, 1, 0, 1];

function cpuSlot(index: number): LobbySlot {
  const character = characters[(index + 1) % characters.length];
  return { controllerId: null, name: `${character.name} (CPU)`, characterId: character.id, team: slotTeams[index], cpuLevel: defaultCpuLevel };
}

export class OnlineSession {
  readonly client = new RoomClient();
  myId = "";
  hostId = "";
  code = "";
  members = new Map<string, string>();
  lobby: LobbyState | null = null;
  inMatch = false;
  private events: SessionEvents;

  constructor(events: SessionEvents) {
    this.events = events;
    this.client.onMessage((message) => {
      switch (message.type) {
        case "memberJoined":
          this.members.set(message.member.clientId, message.member.name);
          this.events.onMemberJoined(message.member.name);
          if (this.isHost) this.seatMember(message.member);
          break;
        case "memberLeft": {
          const name = this.members.get(message.clientId) ?? "A player";
          this.members.delete(message.clientId);
          if (this.isHost && this.lobby && !this.inMatch) this.unseatMember(message.clientId);
          this.events.onMemberLeft(message.clientId, name);
          break;
        }
        case "roomClosed":
          this.leave();
          this.events.onClosed(message.reason);
          break;
        case "relay":
          if (!isGamePayload(message.payload)) return;
          if (message.payload.kind === "lobby") {
            if (message.from !== this.hostId) return;
            this.lobby = message.payload.lobby;
            this.events.onLobby(this.lobby);
          } else if (message.payload.kind === "lobbyEdit") {
            if (this.isHost) this.applyEdit(message.from, message.payload);
          } else {
            this.events.onPayload(message.from, message.payload);
          }
          break;
        case "error":
          break;
      }
    });
    this.client.onClose(() => {
      this.leave();
      this.events.onClosed("Lost connection to the game server.");
    });
  }

  get isHost(): boolean {
    return this.myId !== "" && this.myId === this.hostId;
  }

  get isActive(): boolean {
    return this.myId !== "";
  }

  async host(name: string, characterId: string): Promise<void> {
    this.adopt(await this.client.enter({ create: true, name }));
    this.lobby = {
      playerCount: 2,
      targetScore: matchRules.defaultTargetScore,
      courtId: getCourt(undefined).id,
      slots: [{ controllerId: this.myId, name, characterId, team: 0 }, cpuSlot(1)],
    };
    const free = this.freeCharacter(1);
    this.lobby.slots[1] = { ...this.lobby.slots[1], characterId: free.id, name: `${free.name} (CPU)` };
    this.publishLobby();
  }

  async join(code: string, name: string): Promise<void> {
    this.adopt(await this.client.enter({ create: false, name, code }));
  }

  private adopt(joined: JoinedMessage): void {
    this.myId = joined.clientId;
    this.hostId = joined.hostId;
    this.code = joined.code;
    this.members = new Map(joined.members.map((member) => [member.clientId, member.name]));
  }

  leave(): void {
    this.client.close();
    this.myId = "";
    this.hostId = "";
    this.code = "";
    this.lobby = null;
    this.inMatch = false;
    this.members.clear();
  }

  send(payload: GamePayload, to?: string): void {
    this.client.relay(payload, to);
  }

  // ---------- host-only lobby management ----------

  publishLobby(): void {
    if (!this.isHost || !this.lobby) return;
    this.send({ kind: "lobby", lobby: this.lobby });
    this.events.onLobby(this.lobby);
  }

  setPlayerCount(count: 2 | 4): void {
    if (!this.lobby) return;
    const humans = this.lobby.slots.filter((slot) => slot.controllerId !== null);
    if (count === 2 && humans.length > 2) return;
    const slots: LobbySlot[] = [];
    for (let index = 0; index < count; index++) slots.push(cpuSlot(index));
    // Re-seat humans in their order of arrival.
    humans.forEach((human, order) => {
      slots[order] = { ...human, team: slotTeams[order] };
    });
    // CPUs take characters nobody else is using.
    slots.forEach((slot, index) => {
      if (slot.controllerId !== null) return;
      const used = new Set(slots.filter((_, other) => other !== index).map((other) => other.characterId));
      if (!used.has(slot.characterId)) return;
      const free = characters.find((character) => !used.has(character.id)) ?? characters[0];
      slots[index] = { ...slot, characterId: free.id, name: `${free.name} (CPU)` };
    });
    this.lobby = { ...this.lobby, playerCount: count, slots };
    this.publishLobby();
  }

  setTargetScore(score: number): void {
    if (!this.lobby) return;
    this.lobby = { ...this.lobby, targetScore: score };
    this.publishLobby();
  }

  setCourt(courtId: CourtId): void {
    if (!this.lobby) return;
    this.lobby = { ...this.lobby, courtId: getCourt(courtId).id };
    this.publishLobby();
  }

  setCpuCharacter(slotIndex: number, characterId: string): void {
    const slot = this.lobby?.slots[slotIndex];
    if (!this.lobby || !slot || slot.controllerId !== null) return;
    const next = getCharacter(characterId);
    if (this.lobby.slots.some((other, otherIndex) => otherIndex !== slotIndex && other.characterId === next.id)) return;
    this.lobby.slots[slotIndex] = { ...slot, characterId: next.id, name: `${next.name} (CPU)` };
    this.publishLobby();
  }

  setCpuLevel(slotIndex: number, level: CpuLevel): void {
    const slot = this.lobby?.slots[slotIndex];
    if (!this.lobby || !slot || slot.controllerId !== null || !(level in cpuLevels)) return;
    this.lobby.slots[slotIndex] = { ...slot, cpuLevel: level };
    this.publishLobby();
  }

  editMine(edit: { name?: string; characterId?: string }): void {
    if (this.isHost) this.applyEdit(this.myId, edit);
    else this.send({ kind: "lobbyEdit", ...edit }, this.hostId);
  }

  private applyEdit(from: string, edit: { name?: string; characterId?: string }): void {
    if (!this.lobby) return;
    const index = this.lobby.slots.findIndex((slot) => slot.controllerId === from);
    if (index < 0) return;
    const slot = { ...this.lobby.slots[index] };
    if (typeof edit.name === "string") slot.name = edit.name.trim().slice(0, 16) || slot.name;
    if (typeof edit.characterId === "string") {
      const wanted = getCharacter(edit.characterId).id;
      // Everyone plays a different character; a taken pick is ignored.
      if (!this.lobby.slots.some((other, otherIndex) => otherIndex !== index && other.characterId === wanted)) slot.characterId = wanted;
    }
    this.lobby.slots[index] = slot;
    this.publishLobby();
  }

  private seatMember(member: RoomMember): void {
    if (!this.lobby || this.inMatch) return;
    let index = this.lobby.slots.findIndex((slot) => slot.controllerId === null);
    if (index < 0 && this.lobby.playerCount === 2) {
      this.setPlayerCount(4);
      index = this.lobby.slots.findIndex((slot) => slot.controllerId === null);
    }
    if (index < 0) return;
    const character = this.freeCharacter(index);
    this.lobby.slots[index] = { controllerId: member.clientId, name: member.name, characterId: character.id, team: slotTeams[index] };
    this.publishLobby();
  }

  // First character, starting from a slot-based offset, that no other slot uses.
  private freeCharacter(index: number) {
    const used = new Set(this.lobby?.slots.filter((_, otherIndex) => otherIndex !== index).map((slot) => slot.characterId));
    for (let step = 0; step < characters.length; step++) {
      const candidate = characters[(index + 2 + step) % characters.length];
      if (!used.has(candidate.id)) return candidate;
    }
    return characters[0];
  }

  private unseatMember(clientId: string): void {
    if (!this.lobby) return;
    const index = this.lobby.slots.findIndex((slot) => slot.controllerId === clientId);
    if (index < 0) return;
    this.lobby.slots[index] = { ...cpuSlot(index), characterId: this.freeCharacter(index).id };
    this.lobby.slots[index].name = `${getCharacter(this.lobby.slots[index].characterId).name} (CPU)`;
    this.publishLobby();
  }

  buildMatchConfig(): MatchConfig | null {
    if (!this.lobby) return null;
    return {
      targetScore: this.lobby.targetScore,
      courtId: getCourt(this.lobby.courtId).id,
      players: this.lobby.slots.map((slot) => ({
        name: slot.name,
        characterId: slot.characterId,
        team: slot.team,
        isCpu: slot.controllerId === null,
        cpuLevel: slot.controllerId === null ? (slot.cpuLevel ?? defaultCpuLevel) : undefined,
        controllerId: slot.controllerId,
      })),
    };
  }
}
