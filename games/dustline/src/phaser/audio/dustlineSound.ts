import type { SoundCue } from "../../game/simulation/battle/types";
import { getSettings } from "../settings/dustlineSettings";

/**
 * Dustline's sound effects, synthesized live with the Web Audio API: no audio
 * files. Each cue is a short recipe of oscillators and filtered noise.
 *
 * The simulation tags effects with a SoundCue; BattleScene hands them here with
 * the listener (player) position so distant fire is quieter.
 *
 * Routing: effects and music (dustlineMusic.ts) each have their own volume,
 * set from the settings menu, and both feed one master bus with a limiter.
 * Mute silences the master bus.
 */

const soundSettings = {
  masterVolume: 0.5,
  /** Sounds fade with distance from the player, down to this floor. */
  fadeDistance: 1300,
  minDistanceVolume: 0.12,
  /** The same cue can't retrigger faster than this, so volleys don't stack into noise. */
  minRepeatMs: 45,
  mutedStorageKey: "dustline.soundMuted",
};

type Recipe = (audio: AudioContext, out: AudioNode, at: number) => void;

let context: AudioContext | null = null;
let masterGain: GainNode | null = null;
let effectsGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let muted = readMuted();
const lastPlayedAt = new Map<SoundCue, number>();

/** Music bus for the soundtrack: null until audio exists and is allowed to play. */
export function getMusicBus(): { audio: AudioContext; out: AudioNode; noise: AudioBuffer } | null {
  const audio = getContext();
  if (!audio || !musicGain || !noiseBuffer || audio.state !== "running") {
    return null;
  }
  return { audio, out: musicGain, noise: noiseBuffer };
}

/** Applies volumes live (0..1). The settings menu calls this while a slider moves. */
export function setChannelVolumes(music: number, effects: number): void {
  if (musicGain) musicGain.gain.value = music;
  if (effectsGain) effectsGain.gain.value = effects;
}

export function isSoundMuted(): boolean {
  return muted;
}

export function toggleSoundMuted(): boolean {
  muted = !muted;

  try {
    window.localStorage.setItem(soundSettings.mutedStorageKey, muted ? "1" : "0");
  } catch {
    // Storage blocked: the toggle still works for this session.
  }

  if (masterGain) {
    masterGain.gain.value = muted ? 0 : soundSettings.masterVolume;
  }

  return muted;
}

/** Browsers only allow audio after a click or key press; call this from one. */
export function unlockSound(): void {
  const audio = getContext();
  if (audio && audio.state === "suspended") {
    void audio.resume();
  }
}

export function playSound(
  cue: SoundCue,
  position?: { x: number; y: number },
  listener?: { x: number; y: number },
): void {
  if (muted) {
    return;
  }

  const audio = getContext();
  if (!audio || !masterGain || audio.state !== "running") {
    return;
  }

  const nowMs = audio.currentTime * 1000;
  if (nowMs - (lastPlayedAt.get(cue) ?? -Infinity) < soundSettings.minRepeatMs) {
    return;
  }
  lastPlayedAt.set(cue, nowMs);

  let volume = 1;
  if (position && listener) {
    const distance = Math.hypot(position.x - listener.x, position.y - listener.y);
    volume = Math.max(soundSettings.minDistanceVolume, 1 - distance / soundSettings.fadeDistance);
  }

  const cueGain = audio.createGain();
  cueGain.gain.value = volume;
  cueGain.connect(effectsGain ?? masterGain);
  recipes[cue](audio, cueGain, audio.currentTime + 0.005);
  // Disconnect once every recipe has certainly finished.
  window.setTimeout(() => cueGain.disconnect(), 4500);
}

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(soundSettings.mutedStorageKey) === "1";
  } catch {
    return false;
  }
}

function getContext(): AudioContext | null {
  if (context) {
    return context;
  }

  const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }

  context = new AudioContextClass();
  masterGain = context.createGain();
  masterGain.gain.value = muted ? 0 : soundSettings.masterVolume;
  const settings = getSettings();
  effectsGain = context.createGain();
  effectsGain.gain.value = settings.effectsVolume;
  effectsGain.connect(masterGain);
  musicGain = context.createGain();
  musicGain.gain.value = settings.musicVolume;
  musicGain.connect(masterGain);

  // A gentle limiter so explosions on top of gunfire don't clip.
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -14;
  limiter.ratio.value = 8;
  masterGain.connect(limiter);
  limiter.connect(context.destination);

  noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const samples = noiseBuffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.random() * 2 - 1;
  }

  return context;
}

// ---- Building blocks -------------------------------------------------------

/** A pitched tone that glides from startHz to endHz and decays to silence. */
function tone(
  audio: AudioContext,
  out: AudioNode,
  at: number,
  wave: OscillatorType,
  startHz: number,
  endHz: number,
  durationS: number,
  peak: number,
): void {
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(startHz, at);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endHz), at + durationS);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + durationS);
  oscillator.connect(gain).connect(out);
  oscillator.start(at);
  oscillator.stop(at + durationS + 0.02);
}

/** A burst of filtered noise; the filter cutoff sweeps from startHz to endHz. */
function noise(
  audio: AudioContext,
  out: AudioNode,
  at: number,
  filterType: BiquadFilterType,
  startHz: number,
  endHz: number,
  durationS: number,
  peak: number,
): void {
  if (!noiseBuffer) {
    return;
  }

  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();
  source.buffer = noiseBuffer;
  source.playbackRate.value = 0.8 + Math.random() * 0.4;
  filter.type = filterType;
  filter.frequency.setValueAtTime(startHz, at);
  filter.frequency.exponentialRampToValueAtTime(Math.max(20, endHz), at + durationS);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + durationS);
  source.connect(filter).connect(gain).connect(out);
  source.start(at, Math.random() * 0.5);
  source.stop(at + durationS + 0.02);
}

/** A few notes in a row, for pickups. */
function arpeggio(
  audio: AudioContext,
  out: AudioNode,
  at: number,
  wave: OscillatorType,
  notesHz: number[],
  stepS: number,
  peak: number,
): void {
  notesHz.forEach((hz, index) => {
    tone(audio, out, at + index * stepS, wave, hz, hz, stepS * 1.8, peak);
  });
}

/**
 * One muted-brass "wah": a buzzy sawtooth through a wah filter that opens and
 * closes, sagging in pitch at the end. wobble adds a sobbing vibrato.
 */
function wah(audio: AudioContext, out: AudioNode, at: number, hz: number, lengthS: number, wobble: boolean): void {
  const oscillator = audio.createOscillator();
  oscillator.type = "sawtooth";
  oscillator.frequency.setValueAtTime(hz * 1.03, at);
  oscillator.frequency.linearRampToValueAtTime(hz, at + 0.06);
  oscillator.frequency.setValueAtTime(hz, at + lengthS * 0.6);
  oscillator.frequency.linearRampToValueAtTime(hz * (wobble ? 0.84 : 0.95), at + lengthS);

  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 6;
  filter.frequency.setValueAtTime(350, at);
  filter.frequency.linearRampToValueAtTime(1500, at + 0.12);
  filter.frequency.linearRampToValueAtTime(600, at + lengthS);

  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.22, at + 0.05);
  gain.gain.setValueAtTime(0.22, at + lengthS * 0.7);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + lengthS);

  if (wobble) {
    const lfo = audio.createOscillator();
    const depth = audio.createGain();
    lfo.frequency.value = 6;
    depth.gain.setValueAtTime(0, at);
    depth.gain.linearRampToValueAtTime(hz * 0.035, at + 0.35);
    lfo.connect(depth).connect(oscillator.frequency);
    lfo.start(at);
    lfo.stop(at + lengthS + 0.02);
  }

  oscillator.connect(filter).connect(gain).connect(out);
  oscillator.start(at);
  oscillator.stop(at + lengthS + 0.02);
}

function boom(audio: AudioContext, out: AudioNode, at: number, sizeS: number, peak: number): void {
  noise(audio, out, at, "lowpass", 1600, 90, sizeS, peak);
  tone(audio, out, at, "sine", 110, 32, sizeS * 0.9, peak * 0.9);
  noise(audio, out, at + 0.03, "bandpass", 700, 200, sizeS * 0.5, peak * 0.35);
}

// ---- Recipes ---------------------------------------------------------------

const recipes: Record<SoundCue, Recipe> = {
  playerShot: (audio, out, at) => {
    noise(audio, out, at, "lowpass", 2600, 300, 0.16, 0.55);
    tone(audio, out, at, "sine", 160, 48, 0.17, 0.6);
    tone(audio, out, at, "square", 420, 120, 0.05, 0.08);
  },
  enemyShot: (audio, out, at) => {
    noise(audio, out, at, "lowpass", 1900, 260, 0.14, 0.4);
    tone(audio, out, at, "sine", 130, 44, 0.15, 0.45);
  },
  heavyShot: (audio, out, at) => {
    noise(audio, out, at, "lowpass", 1400, 120, 0.3, 0.6);
    tone(audio, out, at, "sine", 95, 30, 0.3, 0.7);
  },
  autoShot: (audio, out, at) => {
    noise(audio, out, at, "bandpass", 2400, 900, 0.06, 0.35);
    tone(audio, out, at, "square", 320, 140, 0.045, 0.1);
  },
  scatterShot: (audio, out, at) => {
    noise(audio, out, at, "lowpass", 3800, 220, 0.26, 0.7);
    tone(audio, out, at, "sine", 120, 40, 0.2, 0.55);
    noise(audio, out, at + 0.02, "highpass", 3000, 1200, 0.08, 0.25);
  },
  ricochetShot: (audio, out, at) => {
    tone(audio, out, at, "sine", 260, 900, 0.12, 0.35);
    noise(audio, out, at, "lowpass", 1800, 300, 0.12, 0.3);
    tone(audio, out, at + 0.03, "triangle", 900, 1400, 0.08, 0.08);
  },
  laserShot: (audio, out, at) => {
    tone(audio, out, at, "sawtooth", 1900, 260, 0.2, 0.14);
    tone(audio, out, at, "sine", 2600, 700, 0.16, 0.18);
    noise(audio, out, at, "highpass", 5000, 2500, 0.05, 0.12);
  },
  missileShot: (audio, out, at) => {
    tone(audio, out, at, "sine", 120, 50, 0.16, 0.45);
    noise(audio, out, at, "bandpass", 700, 2600, 0.5, 0.32);
    tone(audio, out, at + 0.02, "sawtooth", 190, 90, 0.32, 0.08);
  },
  ricochet: (audio, out, at) => {
    tone(audio, out, at, "triangle", 1500, 2300, 0.11, 0.16);
    noise(audio, out, at, "highpass", 3500, 1800, 0.04, 0.2);
  },
  weaponSwitch: (audio, out, at) => {
    tone(audio, out, at, "square", 1300, 1250, 0.025, 0.08);
    tone(audio, out, at + 0.045, "square", 820, 800, 0.035, 0.09);
    noise(audio, out, at + 0.045, "bandpass", 1800, 1200, 0.03, 0.15);
  },
  hitEnemy: (audio, out, at) => {
    tone(audio, out, at, "square", 720, 260, 0.07, 0.16);
    noise(audio, out, at, "highpass", 2400, 900, 0.06, 0.3);
    tone(audio, out, at, "triangle", 1180, 1100, 0.12, 0.1);
  },
  hitWall: (audio, out, at) => {
    noise(audio, out, at, "bandpass", 900, 300, 0.09, 0.35);
    tone(audio, out, at, "sine", 140, 70, 0.07, 0.25);
  },
  hitCrate: (audio, out, at) => {
    noise(audio, out, at, "bandpass", 600, 250, 0.08, 0.4);
    tone(audio, out, at, "triangle", 210, 150, 0.08, 0.3);
  },
  hitMetal: (audio, out, at) => {
    tone(audio, out, at, "triangle", 880, 860, 0.35, 0.18);
    tone(audio, out, at, "triangle", 1347, 1320, 0.25, 0.1);
    noise(audio, out, at, "highpass", 3000, 1500, 0.05, 0.25);
  },
  playerHurt: (audio, out, at) => {
    tone(audio, out, at, "square", 240, 90, 0.16, 0.22);
    noise(audio, out, at, "bandpass", 1200, 400, 0.1, 0.35);
  },
  tankDestroyed: (audio, out, at) => {
    boom(audio, out, at, 0.6, 0.8);
  },
  // Sad trombone for the mission-failed screen: wah, wah, wah, waaaaahhh.
  missionFailed: (audio, out, at) => {
    const notes = [293.7, 277.2, 261.6];
    notes.forEach((hz, index) => wah(audio, out, at + index * 0.5, hz, 0.46, false));
    wah(audio, out, at + 1.5, 246.9, 1.7, true);
  },
  playerDestroyed: (audio, out, at) => {
    boom(audio, out, at, 1.1, 0.9);
    tone(audio, out, at + 0.15, "square", 330, 70, 0.9, 0.12);
  },
  crateBreak: (audio, out, at) => {
    noise(audio, out, at, "bandpass", 800, 200, 0.28, 0.55);
    tone(audio, out, at, "triangle", 180, 90, 0.2, 0.3);
    noise(audio, out, at + 0.06, "bandpass", 1400, 500, 0.12, 0.25);
  },
  wallBreak: (audio, out, at) => {
    noise(audio, out, at, "lowpass", 1100, 120, 0.42, 0.65);
    tone(audio, out, at, "sine", 90, 40, 0.3, 0.4);
  },
  spawnerDestroyed: (audio, out, at) => {
    boom(audio, out, at, 1.3, 1);
    boom(audio, out, at + 0.22, 0.9, 0.7);
    tone(audio, out, at, "sawtooth", 600, 60, 1.0, 0.08);
  },
  spawn: (audio, out, at) => {
    tone(audio, out, at, "square", 180, 520, 0.28, 0.12);
    noise(audio, out, at, "bandpass", 500, 1800, 0.3, 0.2);
  },
  coin: (audio, out, at) => {
    arpeggio(audio, out, at, "square", [988, 1319], 0.06, 0.12);
  },
  repair: (audio, out, at) => {
    arpeggio(audio, out, at, "triangle", [523, 659, 784, 1047], 0.07, 0.3);
  },
  rapidFire: (audio, out, at) => {
    arpeggio(audio, out, at, "sawtooth", [392, 523, 659, 784, 1047], 0.045, 0.1);
  },
  freeze: (audio, out, at) => {
    arpeggio(audio, out, at, "sine", [2093, 1760, 1568, 1319, 1047], 0.06, 0.22);
    noise(audio, out, at, "highpass", 6000, 3000, 0.5, 0.12);
  },
};
