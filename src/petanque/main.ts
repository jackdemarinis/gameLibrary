// Pétanque Park entry point: owns the game loop and wires the pure
// simulation (rules, physics, meter) to the Three.js view, DOM HUD and,
// for online play, the room session.
//
// Authority: locally, this browser runs the rules. Online, only the host does.
// Every rules decision is packaged as an `Outcome` and applied through
// `applyOutcome`, so local and online play share one code path.

import "./petanque.css";
import * as THREE from "three";
import { cpuLevels, defaultCpuLevel, physics, pitch, throwing, type ThrowStyle } from "./config/rules";
import { applyThemeVariables, worldTheme } from "./config/theme";
import { characters, getCharacter, teamNames, type CharacterDefinition } from "./content/characters";
import { getCourt, type CourtId } from "./content/courts";
import type { GamePayload, LobbyState, Outcome, OutcomeEvent } from "./net/protocol";
import { OnlineSession } from "./net/session";
import {
  afterBouleThrow,
  afterJackThrow,
  consumeBoule,
  createMatch,
  isJackPlacementValid,
  nextEnd,
  teamHoldingPoint,
  type FieldSnapshot,
  type MatchConfig,
  type MatchState,
} from "./simulation/match";
import { cpuThrow } from "./simulation/cpu";
import { createMeter, pressMeter, updateMeter, type MeterState } from "./simulation/meter";
import {
  createWorld,
  forceSettle,
  horizontalDistance,
  isLive,
  isSettled,
  powerToDistance,
  restoreBalls,
  snapshotBalls,
  stepWorld,
  throwBall,
  type Ball,
  type ThrowInput,
  type World,
} from "./simulation/physics";
import { registerOffline } from "../shared/offline";
import { Hud } from "./ui/hud";
import { createCharacter, throwTiming, type CharacterView } from "./view/characterModel";
import { createAimGuide, createBallMesh, createScoreRing, rollMesh } from "./view/props";
import { portraitFor } from "./view/portraits";
import { createStage } from "./view/scene";

type Mode = "menu" | "aim" | "swing" | "throwing" | "flight" | "review" | "endSummary" | "matchOver";

const stageRoot = document.querySelector<HTMLElement>("#stage");
const uiRoot = document.querySelector<HTMLElement>("#ui");
if (!stageRoot || !uiRoot) throw new Error("Pétanque Park mount points missing.");

applyThemeVariables(document.documentElement);

const stage = createStage(stageRoot);

const aimGuide = createAimGuide();
stage.scene.add(aimGuide.root);
aimGuide.setVisible(false);

const degrees = Math.PI / 180;
const teamColors = [worldTheme.teamA, worldTheme.teamB];
const nameStorageKey = "petanquePark/name";
const aimSendSeconds = 1 / 15;

let mode: Mode = "menu";
let localConfig: MatchConfig | null = null;
let matchState: MatchState | null = null;
let world: World = createWorld();
let ballMeshes = new Map<number, THREE.Object3D>();
let scoreRings: THREE.Object3D[] = [];
let characterViews: CharacterView[] = [];
let castKey = "";

let aimRadians = 0;
let throwStyle: ThrowStyle = "roll";
let meterState: MeterState = createMeter();
let pendingThrow: ThrowInput | null = null;
let throwNumber = 0;
let modeTimer = 0;
let followBallId: number | null = null;
let physicsAccumulator = 0;
let menuOrbit = 0;
let aimSendTimer = 0;
let lastAimSent = "";
let pendingOutcome: Outcome | null = null;

const cameraPosition = new THREE.Vector3(6, 4, 4);
const cameraLook = new THREE.Vector3(0, 0, -6);
const cameraPositionGoal = new THREE.Vector3();
const cameraLookGoal = new THREE.Vector3();

const hud = new Hud(uiRoot);

hud.setPortraitSource(portraitFor);

// Onlookers around the terrain: the cast in different shirts, wearing either
// team's wristbands. Rebuilt whenever the court changes.
let spectators: CharacterView[] = [];

function crowdDefinition(index: number): CharacterDefinition {
  const base = characters[(index * 3 + 2) % characters.length];
  const tops = worldTheme.crowdTops;
  return {
    ...base,
    id: `${base.id}Crowd${index}`,
    top: { ...base.top, style: base.top.style === "jersey" ? "tee" : base.top.style, color: tops[index % tops.length] },
  };
}

function setCourt(id: CourtId | undefined): void {
  const courtId = getCourt(id).id;
  if (courtId === stage.courtId && spectators.length > 0) return;
  stage.setCourt(courtId);
  for (const view of spectators) stage.scene.remove(view.root);
  spectators = stage.spectatorSpots.map((spot, index) => {
    const view = createCharacter(crowdDefinition(index), teamColors[index % 2]);
    view.root.position.copy(spot.position);
    view.root.rotation.y = spot.facing;
    stage.scene.add(view.root);
    return view;
  });
}

setCourt(undefined);

function setCrowdMood(scoringTeam: number | null): void {
  spectators.forEach((view, index) => {
    view.setMood(scoringTeam === null ? "idle" : index % 2 === scoringTeam ? "cheer" : "clap");
  });
}

const session = new OnlineSession({
  onLobby: renderLobby,
  onPayload: handlePayload,
  onMemberJoined(name) {
    hud.toast(`${name} joined`, null, 1.6);
  },
  onMemberLeft(clientId, name) {
    hud.toast(`${name} left`, null, 2);
    if (!session.isHost || !session.inMatch || !matchState) return;
    // Their player keeps going as a CPU so the match can finish. While balls are
    // moving we wait and fold the change into the next outcome instead.
    leaversToCpu.add(clientId);
    if (mode === "aim" || mode === "swing") publishOutcome(buildOutcome("turn", matchState, null));
    else if (mode === "endSummary" || mode === "matchOver") publishOutcome(buildOutcome("turn", matchState, null), "keepScreen");
  },
  onClosed(reason) {
    showTitle(reason);
  },
});

// ---------- who controls what ----------

function isOnline(): boolean {
  return session.isActive;
}

function isReferee(): boolean {
  return !isOnline() || session.isHost;
}

function currentPlayerIsMine(): boolean {
  if (!matchState) return false;
  const player = matchState.config.players[matchState.currentPlayer];
  return isOnline() ? player.controllerId === session.myId : !player.isCpu;
}

function currentPlayerIsCpu(): boolean {
  return !!matchState && matchState.config.players[matchState.currentPlayer].isCpu;
}

function savedName(): string {
  try {
    return window.localStorage.getItem(nameStorageKey) ?? "";
  } catch {
    return "";
  }
}

function rememberName(name: string): void {
  try {
    window.localStorage.setItem(nameStorageKey, name);
  } catch {
    // Remembering the name is a convenience only.
  }
}

// ---------- menus ----------

function showTitle(notice = ""): void {
  if (session.isActive) session.leave();
  leaversToCpu.clear();
  mode = "menu";
  matchState = null;
  clearPitch();
  clearCharacters();
  aimGuide.setVisible(false);
  hud.showTitle(savedName(), {
    onLocal: () => hud.showSetup(localConfig, { onStart: startLocalMatch, onBack: () => showTitle(), onPreviewCourt: setCourt }),
    onHost: (name) => void enterOnline(() => session.host(name, characters[0].id), name),
    onJoin: (code, name) => void enterOnline(() => session.join(code, name), name),
  }, notice);
}

async function enterOnline(connect: () => Promise<void>, name: string): Promise<void> {
  rememberName(name);
  hud.setTitleBusy(true);
  try {
    await connect();
    if (!session.isHost) hud.toast(`Joined room ${session.code}`, null, 1.6);
    if (session.lobby) renderLobby(session.lobby);
  } catch (error) {
    hud.setTitleBusy(false);
    hud.showTitleError(error instanceof Error ? error.message : "Couldn't connect.");
  }
}

function renderLobby(lobby: LobbyState): void {
  if (session.inMatch) return;
  setCourt(lobby.courtId);
  hud.showLobby(session.code, lobby, session.myId, session.isHost, {
    onPlayerCount: (count) => session.setPlayerCount(count),
    onTargetScore: (score) => session.setTargetScore(score),
    onCourt: (courtId) => session.setCourt(courtId),
    onEditName(name) {
      rememberName(name);
      session.editMine({ name });
    },
    onPickCharacter(slotIndex, characterId) {
      const slot = lobby.slots[slotIndex];
      if (slot.controllerId === session.myId) session.editMine({ characterId });
      else session.setCpuCharacter(slotIndex, characterId);
    },
    onCpuLevel: (slotIndex, level) => session.setCpuLevel(slotIndex, level),
    onStart: startOnlineMatch,
    onLeave: () => showTitle(),
  });
}

function startLocalMatch(config: MatchConfig): void {
  localConfig = config;
  const match = createMatch(config, Math.random() < 0.5 ? 0 : 1);
  publishOutcome(buildOutcome("start", match, { text: `${teamNames[match.jackTeam]} win the toss!`, team: match.jackTeam }, true));
}

function startOnlineMatch(): void {
  const config = session.buildMatchConfig();
  if (!config) return;
  session.client.lock(true);
  session.inMatch = true;
  const match = createMatch(config, Math.random() < 0.5 ? 0 : 1);
  publishOutcome(buildOutcome("start", match, { text: `${teamNames[match.jackTeam]} win the toss!`, team: match.jackTeam }, true));
}

// ---------- outcomes: the only way match state changes ----------

const leaversToCpu = new Set<string>();

function withCpuTakeovers(match: MatchState): MatchState {
  if (leaversToCpu.size === 0) return match;
  const players = match.config.players.map((player) =>
    player.controllerId && leaversToCpu.has(player.controllerId)
      ? { ...player, isCpu: true, cpuLevel: defaultCpuLevel, controllerId: null, name: `${player.name} (CPU)` }
      : player,
  );
  return { ...match, config: { ...match.config, players } };
}

function buildOutcome(event: OutcomeEvent, match: MatchState, toast: Outcome["toast"], emptyPitch = false): Outcome {
  return {
    event,
    match: withCpuTakeovers(match),
    balls: emptyPitch ? [] : snapshotBalls(world),
    nextBallId: emptyPitch ? 1 : world.nextId,
    toast,
  };
}

// Referee only: apply locally and, online, send to everyone.
function publishOutcome(outcome: Outcome, flow: "resume" | "keepScreen" = "resume"): void {
  if (isOnline()) session.send({ kind: "outcome", outcome });
  applyOutcome(outcome, flow);
}

function applyOutcome(outcome: Outcome, flow: "resume" | "keepScreen" = "resume"): void {
  pendingOutcome = null;
  matchState = outcome.match;
  if (isOnline()) session.inMatch = true;

  setCourt(outcome.match.config.courtId);
  syncPitch(outcome);
  ensureCast();
  if (outcome.toast) hud.toast(outcome.toast.text, outcome.toast.team, outcome.event === "start" ? 2.2 : 1.8);

  if (flow === "keepScreen") {
    refreshScore();
    return;
  }
  if (outcome.event === "start" || outcome.event === "newEnd") {
    startIntroShot();
    hud.closeScreen();
    hud.showHud(isOnline() ? session.code : null);
  }
  if (matchState.phase === "endOver" || matchState.phase === "matchOver") {
    showEndResult();
  } else {
    beginTurn();
  }
}

function syncPitch(outcome: Outcome): void {
  restoreBalls(world, outcome.balls, outcome.nextBallId);
  const liveIds = new Set(world.balls.map((ball) => ball.id));
  for (const [id, mesh] of ballMeshes) {
    if (!liveIds.has(id)) {
      stage.scene.remove(mesh);
      ballMeshes.delete(id);
    }
  }
  for (const ball of world.balls) {
    let mesh = ballMeshes.get(ball.id);
    if (!mesh) {
      mesh = createBallMesh(ball.kind, ball.team);
      stage.scene.add(mesh);
      ballMeshes.set(ball.id, mesh);
    }
    mesh.position.set(ball.position.x, ball.position.y, ball.position.z);
    mesh.visible = ball.state !== "out";
  }
  for (const ring of scoreRings) stage.scene.remove(ring);
  scoreRings = [];
  followBallId = null;
}

function ensureCast(): void {
  if (!matchState) return;
  const key = matchState.config.players.map((player) => `${player.characterId}:${player.team}`).join("|");
  if (key === castKey) return;
  clearCharacters();
  castKey = key;
  characterViews = matchState.config.players.map((player) => {
    const view = createCharacter(getCharacter(player.characterId), teamColors[player.team]);
    stage.scene.add(view.root);
    return view;
  });
  placeCharacters(true);
}

function clearPitch(): void {
  for (const mesh of ballMeshes.values()) stage.scene.remove(mesh);
  for (const ring of scoreRings) stage.scene.remove(ring);
  ballMeshes = new Map();
  scoreRings = [];
  world = createWorld();
  followBallId = null;
}

function clearCharacters(): void {
  for (const view of characterViews) stage.scene.remove(view.root);
  characterViews = [];
  castKey = "";
}

// ---------- pitch helpers ----------

function jackBall(): Ball | undefined {
  return world.balls.find((ball) => ball.kind === "jack");
}

function fieldSnapshot(): FieldSnapshot {
  const jack = jackBall();
  return {
    jackAlive: !!jack && isLive(jack),
    boules: world.balls
      .filter((ball) => ball.kind === "boule" && isLive(ball) && ball.team !== null)
      .map((ball) => ({
        id: ball.id,
        team: ball.team as number,
        distanceToJack: jack ? horizontalDistance(ball.position, jack.position) : Infinity,
      })),
  };
}

function currentPointTeam(): number | null {
  if (!matchState || matchState.phase === "jack") return null;
  const holder = teamHoldingPoint(fieldSnapshot());
  return typeof holder === "number" ? holder : null;
}

function refreshScore(): void {
  if (matchState) hud.updateScore(matchState, currentPointTeam());
}

function placeCharacters(snap: boolean): void {
  if (!matchState) return;
  const waiting = [0, 0];
  matchState.config.players.forEach((player, index) => {
    const view = characterViews[index];
    if (!view) return;
    let target: THREE.Vector3;
    let facing: number;
    if (index === matchState!.currentPlayer && (mode === "aim" || mode === "swing" || mode === "throwing")) {
      // Shift left so the throwing (right) hand lines up with the release point.
      target = new THREE.Vector3(-0.5, 0, 0.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), aimRadians);
      facing = aimRadians;
    } else {
      const side = player.team === 0 ? 1 : -1;
      const slot = waiting[player.team]++;
      target = new THREE.Vector3(side * (pitch.halfWidth + 1.1), 0, -1.6 - slot * 1.1);
      facing = side * (Math.PI / 3);
    }
    view.root.userData.target = target;
    view.root.userData.facing = facing;
    if (snap) {
      view.root.position.copy(target);
      view.root.rotation.y = facing;
    }
  });
}

function defaultAim(): number {
  const jack = jackBall();
  if (!jack || !isLive(jack) || matchState?.phase === "jack") return 0;
  return clampAim(Math.atan2(-jack.position.x, -jack.position.z));
}

function clampAim(value: number): number {
  const limit = throwing.maxAimDegrees * degrees;
  return Math.max(-limit, Math.min(limit, value));
}

// ---------- turns ----------

function beginTurn(): void {
  if (!matchState) return;
  mode = "aim";
  modeTimer = 0;
  meterState = createMeter();
  aimRadians = defaultAim();
  throwStyle = "roll";
  lastAimSent = "";
  hud.setStyle(throwStyle);
  hud.setMeter(meterState);
  aimGuide.setVisible(true);
  aimGuide.setPowerMarker(null);

  const player = matchState.config.players[matchState.currentPlayer];
  const isJack = matchState.phase === "jack";
  const who = currentPlayerIsMine() && isOnline() ? `Your turn, ${player.name}` : player.name;
  hud.setTurn(`${who} — ${isJack ? "throw the jack" : "throw a boule"}`, player.team);
  hud.setControls(!player.isCpu, currentPlayerIsMine());
  updateInfo();
  refreshScore();

  for (const view of characterViews) view.setMood("idle");
  setCrowdMood(null);
  characterViews[matchState.currentPlayer]?.hold(createBallMesh(isJack ? "jack" : "boule", player.team));
  placeCharacters(false);
}

function updateInfo(): void {
  if (!matchState) return;
  if (matchState.phase === "jack") {
    hud.setInfo(`Land the jack between ${pitch.jackMinDistance} m and ${pitch.jackMaxDistance} m`);
    return;
  }
  const jack = jackBall();
  if (jack) {
    hud.setInfo(`Jack: ${Math.hypot(jack.position.x, jack.position.z).toFixed(1)} m · aim ${Math.round(-aimRadians / degrees)}°`);
  }
}

// ---------- input ----------

function toggleStyle(): void {
  if (mode !== "aim" || !currentPlayerIsMine()) return;
  throwStyle = throwStyle === "roll" ? "lob" : "roll";
  hud.setStyle(throwStyle);
}

function pressSwing(): void {
  if (mode === "endSummary") {
    continueAfterEnd();
    return;
  }
  if ((mode !== "aim" && mode !== "swing") || !currentPlayerIsMine()) return;
  meterState = pressMeter(meterState);
  mode = "swing";
  if (meterState.phase === "done") {
    sendThrow({ aimRadians, power: meterState.power, style: throwStyle, accuracyError: meterState.accuracyError });
  }
}

const heldKeys = new Set<string>();
window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement) return;
  heldKeys.add(event.key);
  if (event.repeat) return;
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    pressSwing();
  } else if (["ArrowUp", "ArrowDown", "w", "s", "Tab"].includes(event.key)) {
    event.preventDefault();
    toggleStyle();
  }
});
window.addEventListener("keyup", (event) => heldKeys.delete(event.key));
window.addEventListener("blur", () => heldKeys.clear());
stage.renderer.domElement.addEventListener("pointerdown", () => {
  if (mode === "aim" || mode === "swing") pressSwing();
});

function readAimInput(): -1 | 0 | 1 {
  const left = heldKeys.has("ArrowLeft") || heldKeys.has("a");
  const right = heldKeys.has("ArrowRight") || heldKeys.has("d");
  return left === right ? 0 : left ? -1 : 1;
}

// ---------- network payloads ----------

function handlePayload(from: string, payload: GamePayload): void {
  switch (payload.kind) {
    case "outcome":
      if (from !== session.hostId) return;
      // Arriving mid-flight just means the host's physics finished first: snap to it.
      if (mode === "throwing" || mode === "flight") {
        pendingOutcome = payload.outcome;
        if (mode === "flight") applyOutcome(payload.outcome);
      } else {
        applyOutcome(payload.outcome);
      }
      break;
    case "throw": {
      if (!matchState || payload.playerIndex !== matchState.currentPlayer) return;
      const player = matchState.config.players[payload.playerIndex];
      const allowed = player.controllerId === from || (player.isCpu && from === session.hostId);
      if (!allowed || (mode !== "aim" && mode !== "swing")) return;
      aimRadians = payload.input.aimRadians;
      throwStyle = payload.input.style;
      startThrow(payload.input);
      break;
    }
    case "aim":
      if (!matchState || currentPlayerIsMine() || (mode !== "aim" && mode !== "swing")) return;
      aimRadians = payload.aimRadians;
      throwStyle = payload.style;
      meterState = { ...meterState, phase: payload.meterPhase, value: payload.meterValue, power: payload.meterPower };
      hud.setStyle(throwStyle);
      placeCharacters(false);
      updateInfo();
      break;
  }
}

function sendAim(dt: number): void {
  if (!isOnline() || !currentPlayerIsMine()) return;
  aimSendTimer += dt;
  if (aimSendTimer < aimSendSeconds) return;
  aimSendTimer = 0;
  const key = `${aimRadians.toFixed(3)}|${throwStyle}|${meterState.phase}|${meterState.value.toFixed(3)}`;
  if (key === lastAimSent) return;
  lastAimSent = key;
  session.send({
    kind: "aim",
    aimRadians,
    style: throwStyle,
    meterPhase: meterState.phase,
    meterValue: meterState.value,
    meterPower: meterState.power,
  });
}

// ---------- throwing ----------

function sendThrow(input: ThrowInput): void {
  if (!matchState) return;
  if (isOnline()) session.send({ kind: "throw", playerIndex: matchState.currentPlayer, throwNumber: ++throwNumber, input });
  startThrow(input);
}

function startThrow(input: ThrowInput): void {
  if (!matchState) return;
  pendingThrow = input;
  mode = "throwing";
  modeTimer = 0;
  aimGuide.setVisible(false);
  hud.setControls(false, false);
  characterViews[matchState.currentPlayer]?.setMood("throw");
  if (matchState.phase === "boules") {
    matchState = consumeBoule(matchState);
    refreshScore();
  }
}

function releaseBall(): void {
  if (!matchState || !pendingThrow) return;
  const thrower = matchState.config.players[matchState.currentPlayer];
  const isJack = matchState.phase === "jack";
  characterViews[matchState.currentPlayer]?.hold(null);
  const ball = throwBall(world, isJack ? "jack" : "boule", isJack ? null : thrower.team, pendingThrow);
  const expectedAim = pendingThrow.aimRadians + pendingThrow.accuracyError * throwing.maxAccuracyErrorDegrees * degrees;
  const expectedDistance = powerToDistance(pendingThrow.power);
  throwTarget.set(-Math.sin(expectedAim) * expectedDistance, 0, -Math.cos(expectedAim) * expectedDistance);
  const mesh = createBallMesh(ball.kind, ball.team);
  mesh.position.set(ball.position.x, ball.position.y, ball.position.z);
  stage.scene.add(mesh);
  ballMeshes.set(ball.id, mesh);
  followBallId = ball.id;
  pendingThrow = null;
  mode = "flight";
  modeTimer = 0;
  physicsAccumulator = 0;
  if (pendingOutcome) applyOutcome(pendingOutcome);
}

function currentCpuLevel() {
  return matchState?.config.players[matchState.currentPlayer].cpuLevel ?? defaultCpuLevel;
}

function cpuInput(): ThrowInput {
  const player = matchState!.config.players[matchState!.currentPlayer];
  return cpuThrow({ balls: world.balls, team: player.team, throwingJack: matchState!.phase === "jack", level: currentCpuLevel() });
}

// ---------- after the balls stop (referee only) ----------

function resolveThrow(): void {
  if (!matchState) return;

  if (matchState.phase === "jack") {
    const jack = jackBall();
    const valid = !!jack && isLive(jack) && isJackPlacementValid(jack.position.x, jack.position.z);
    if (!valid) {
      world.balls = world.balls.filter((ball) => ball !== jack);
      publishOutcome(
        buildOutcome("jackRetry", matchState, { text: `Jack must land ${pitch.jackMinDistance}–${pitch.jackMaxDistance} m out. Try again!`, team: null }),
      );
      return;
    }
    const match = afterJackThrow(matchState, true);
    publishOutcome(buildOutcome("jackSet", match, { text: `Jack set at ${Math.hypot(jack!.position.x, jack!.position.z).toFixed(1)} m`, team: null }));
    return;
  }

  const field = fieldSnapshot();
  const match = afterBouleThrow(matchState, field);

  if (match.phase === "endOver" || match.phase === "matchOver") {
    publishOutcome(buildOutcome(match.phase, match, null));
    return;
  }

  const holder = teamHoldingPoint(field);
  let toast: Outcome["toast"] = null;
  if (!field.jackAlive) toast = { text: "The jack is out!", team: null };
  else if (typeof holder === "number") toast = { text: `${teamNames[holder]} hold the point`, team: holder };
  else if (holder === "tie") toast = { text: "Dead even!", team: null };
  publishOutcome(buildOutcome("turn", match, toast));
}

function showEndResult(): void {
  if (!matchState?.lastEnd) return;
  const result = matchState.lastEnd;
  mode = matchState.phase === "matchOver" ? "matchOver" : "endSummary";
  aimGuide.setVisible(false);
  hud.setControls(false, false);
  hud.setTurn("", 0);
  hud.setInfo("");
  refreshScore();

  for (const id of result.scoringBallIds) {
    const ball = world.balls.find((candidate) => candidate.id === id);
    if (!ball || result.scoringTeam === null) continue;
    const ring = createScoreRing(result.scoringTeam);
    ring.position.set(ball.position.x, 0.012, ball.position.z);
    stage.scene.add(ring);
    scoreRings.push(ring);
  }

  matchState.config.players.forEach((player, index) => {
    characterViews[index]?.setMood(result.scoringTeam === null ? "idle" : player.team === result.scoringTeam ? "cheer" : "sulk");
  });
  setCrowdMood(result.scoringTeam);
  placeCharacters(false);

  if (mode === "matchOver" && matchState.winner !== null) {
    hud.showMatchOver(`${teamNames[matchState.winner]} win!`, matchState.scores, matchState.winner, isReferee(), rematch, () => showTitle());
    return;
  }

  let headline: string;
  let detail: string;
  if (result.scoringTeam === null) {
    headline = "No points this end";
    detail = result.reason === "deadJack" ? "The jack went out and both teams still had boules." : "Nobody could separate the boules.";
  } else {
    headline = `${teamNames[result.scoringTeam]} +${result.points}`;
    detail =
      result.reason === "deadJack"
        ? "The jack went out — unthrown boules count as points."
        : `${result.points} boule${result.points === 1 ? "" : "s"} closer than the other team's best.`;
  }
  hud.showEndSummary(headline, detail, result.scoringTeam, isReferee(), continueAfterEnd);
}

function continueAfterEnd(): void {
  if (!matchState || mode !== "endSummary" || !isReferee()) return;
  const match = nextEnd(matchState);
  publishOutcome(buildOutcome("newEnd", match, { text: `End ${match.endNumber} — ${teamNames[match.jackTeam]} throw the jack`, team: match.jackTeam }, true));
}

function rematch(): void {
  if (!matchState || !isReferee()) return;
  const match = createMatch(matchState.config, Math.random() < 0.5 ? 0 : 1);
  publishOutcome(buildOutcome("start", match, { text: `Rematch! ${teamNames[match.jackTeam]} win the toss`, team: match.jackTeam }, true));
}

// ---------- frame loop ----------

function damp(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}

// ---------- camera director ----------
// TV-sports style: hard cuts between a handful of set-ups rather than one
// floating camera. Intro crane at the start of each end, over-the-shoulder
// while aiming, a chase then a low trackside "landing" camera while the ball
// runs, a measuring shot over the jack, and a reaction shot of the players.

type Shot = "orbit" | "intro" | "behind" | "chase" | "landing" | "measure" | "reaction";
let shot: Shot = "orbit";
let shotTime = 0;
let snapCamera = false;
const throwTarget = new THREE.Vector3(0, 0, -8);

function cutTo(next: Shot): void {
  if (shot === next) return;
  shot = next;
  shotTime = 0;
  snapCamera = true;
}

function startIntroShot(): void {
  shot = "intro";
  shotTime = 0;
  // Start high over the far end of the terrain and crane down behind the thrower.
  cameraPosition.set(9, 9, -22);
  cameraLook.set(0, 0, -7);
}

function updateCamera(dt: number): void {
  const forward = new THREE.Vector3(-Math.sin(aimRadians), 0, -Math.cos(aimRadians));
  const right = new THREE.Vector3(Math.cos(aimRadians), 0, -Math.sin(aimRadians));
  const jack = jackBall();
  const ball = followBallId === null ? undefined : world.balls.find((candidate) => candidate.id === followBallId);
  let rate = 3;
  shotTime += dt;

  if (mode === "menu") {
    shot = "orbit";
  } else if (mode === "aim" || mode === "swing" || mode === "throwing") {
    if (shot !== "intro") cutTo("behind");
  } else if (mode === "flight") {
    const travelled = ball ? Math.hypot(ball.position.x, ball.position.z) : 0;
    const going = throwTarget.length();
    if (shot !== "landing" && (shot !== "chase" || (going > 3 && travelled > going * 0.45))) cutTo(shot === "chase" ? "landing" : "chase");
  } else if (mode === "review") {
    cutTo("measure");
  } else if (mode === "endSummary" || mode === "matchOver") {
    if (shot !== "measure" && shot !== "reaction") cutTo("measure");
    if (shot === "measure" && shotTime > 2.2) cutTo("reaction");
  }

  switch (shot) {
    case "orbit": {
      menuOrbit += dt * 0.12;
      // Slow crane down the terrain, kept inside the avenue of trees.
      cameraPositionGoal.set(Math.sin(menuOrbit) * 2.4, 3.6 + Math.sin(menuOrbit * 0.7) * 0.5, 5.5 + Math.cos(menuOrbit * 0.8) * 1.2);
      cameraLookGoal.set(Math.sin(menuOrbit) * -1.2, 0.6, -10);
      rate = 1.2;
      break;
    }
    case "intro":
    case "behind": {
      // Low over the thrower's right shoulder, looking down the aim line.
      cameraPositionGoal.copy(forward).multiplyScalar(-2.7).addScaledVector(right, 0.62).setY(1.85);
      const lookDistance = jack && matchState?.phase === "boules" ? Math.min(11, Math.hypot(jack.position.x, jack.position.z)) : 8;
      cameraLookGoal.copy(forward).multiplyScalar(lookDistance).setY(0.25);
      if (mode === "throwing") cameraPositionGoal.addScaledVector(forward, 0.35).setY(1.7);
      rate = shot === "intro" ? 1.4 : 3;
      if (shot === "intro" && (shotTime > 2.6 || cameraPosition.distanceTo(cameraPositionGoal) < 0.15)) shot = "behind";
      break;
    }
    case "chase": {
      if (ball && ball.state !== "out") {
        const position = new THREE.Vector3(ball.position.x, ball.position.y, ball.position.z);
        cameraPositionGoal.copy(position).addScaledVector(forward, -2.6).addScaledVector(right, 0.4).setY(Math.max(1.6, ball.position.y + 1.1));
        cameraLookGoal.copy(position).addScaledVector(forward, 2);
      }
      rate = 5;
      break;
    }
    case "landing": {
      // Trackside, low, beside where the ball should end up; pans to follow it.
      const side = throwTarget.x > 0.8 ? -1 : 1;
      cameraPositionGoal.set(throwTarget.x + side * 2.7, 0.75, throwTarget.z + 2.2);
      if (ball && ball.state !== "out") cameraLookGoal.set(ball.position.x, Math.max(0.1, ball.position.y * 0.6), ball.position.z - 0.4);
      rate = 6;
      break;
    }
    case "measure": {
      const centre = jack && isLive(jack) ? jack.position : ball?.position ?? { x: 0, y: 0, z: -8 };
      cameraPositionGoal.set(centre.x + 0.55, 2.4, centre.z + 1.25);
      cameraLookGoal.set(centre.x, 0, centre.z - 0.15);
      rate = 2.2;
      break;
    }
    case "reaction": {
      // From the terrain looking back at the players and the crowd.
      cameraPositionGoal.set(0.4, 1.45, -6.2);
      cameraLookGoal.set(0, 1.05, -1.6);
      rate = 1.5;
      break;
    }
  }

  if (snapCamera) {
    cameraPosition.copy(cameraPositionGoal);
    cameraLook.copy(cameraLookGoal);
    snapCamera = false;
  } else {
    cameraPosition.lerp(cameraPositionGoal, damp(rate, dt));
    cameraLook.lerp(cameraLookGoal, damp(rate, dt));
  }
  stage.camera.position.copy(cameraPosition);
  stage.camera.lookAt(cameraLook);
}

function updateCharacters(dt: number): void {
  for (const view of characterViews) {
    const target = view.root.userData.target as THREE.Vector3 | undefined;
    if (target) view.root.position.lerp(target, damp(6, dt));
    const facing = view.root.userData.facing as number | undefined;
    if (facing !== undefined) view.root.rotation.y += (facing - view.root.rotation.y) * damp(8, dt);
    view.update(dt);
  }
  for (const view of spectators) view.update(dt);
}

function syncBallMeshes(): void {
  for (const ball of world.balls) {
    const mesh = ballMeshes.get(ball.id);
    if (!mesh) continue;
    if (ball.state === "out") {
      mesh.visible = false;
      continue;
    }
    const dx = ball.position.x - mesh.position.x;
    const dz = ball.position.z - mesh.position.z;
    if (ball.state !== "air") rollMesh(mesh, dx, dz, ball.radius);
    mesh.position.set(ball.position.x, ball.position.y, ball.position.z);
  }
}

function tick(dt: number): void {
  modeTimer += dt;

  if (mode === "aim" || mode === "swing") {
    if (currentPlayerIsCpu()) {
      if (isReferee() && modeTimer > cpuLevels[currentCpuLevel()].thinkSeconds) sendThrow(cpuInput());
    } else if (currentPlayerIsMine()) {
      const aimInput = readAimInput();
      if (mode === "aim" && aimInput !== 0) {
        aimRadians = clampAim(aimRadians - aimInput * throwing.aimDegreesPerSecond * degrees * dt);
        placeCharacters(false);
        updateInfo();
      }
      if (mode === "swing") {
        meterState = updateMeter(meterState, dt);
        if (meterState.phase === "done") {
          sendThrow({ aimRadians, power: meterState.power, style: throwStyle, accuracyError: meterState.accuracyError });
        }
      }
      sendAim(dt);
    }
    aimGuide.setAim(aimRadians, throwStyle);
    const markerPower = meterState.phase === "distance" ? meterState.value : meterState.phase === "direction" ? meterState.power : null;
    aimGuide.setPowerMarker(markerPower === null ? null : powerToDistance(markerPower));
    hud.setMeter(meterState);
  }

  if (mode === "throwing" && modeTimer >= throwTiming.releaseSeconds) {
    releaseBall();
  }

  if (mode === "flight" || mode === "review") {
    physicsAccumulator += dt;
    while (physicsAccumulator >= physics.stepSeconds) {
      stepWorld(world);
      physicsAccumulator -= physics.stepSeconds;
    }
    if (mode === "flight" && !isSettled(world) && modeTimer > physics.settleTimeoutSeconds) {
      forceSettle(world);
    }
    syncBallMeshes();
    if (mode === "flight" && isSettled(world)) {
      mode = "review";
      modeTimer = 0;
      placeCharacters(false);
      refreshScore();
    } else if (mode === "review" && modeTimer > 0.9 && isReferee()) {
      resolveThrow();
    }
  }

  stage.update(dt);
  updateCharacters(dt);
  updateCamera(dt);
}

const maxFrameSeconds = 0.05;
const maxCatchUpSeconds = 2;
let lastTime = performance.now();

// Advance by real elapsed time in small steps, so a throttled tab catches up
// instead of running in slow motion.
function advance(now: number): void {
  let elapsed = Math.min(maxCatchUpSeconds, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  while (elapsed > 0) {
    const dt = Math.min(maxFrameSeconds, elapsed);
    tick(dt);
    elapsed -= dt;
  }
}

function frame(now: number): void {
  if (!document.hidden) {
    const before = lastTime;
    advance(now);
    stage.render((now - before) / 1000);
  }
  requestAnimationFrame(frame);
}

// Browsers stop animation frames in background tabs. Online, the host's tab is the
// referee, so keep the match ticking on a timer while hidden.
window.setInterval(() => {
  if (document.hidden && isOnline()) advance(performance.now());
}, 250);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) lastTime = performance.now() - maxFrameSeconds * 1000;
});

window.addEventListener("resize", () => stage.resize());
showTitle();
requestAnimationFrame(frame);
registerOffline("../", ['700 16px "IBM Plex Sans"', '600 16px "IBM Plex Mono"']);
