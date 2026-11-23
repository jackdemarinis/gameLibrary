import { getMusicBus } from "./dustlineSound";

/**
 * Dustline's soundtrack: two original tracks synthesized live by a small
 * step sequencer (no audio files). "menu" is a calm arpeggio over pads;
 * "battle" is a driving march with drums, bass and a lead line.
 *
 * Notes are semitones from A4 (440 Hz). A step is a 16th note.
 */

export type MusicTrack = "menu" | "battle";

interface Chord {
  root: number;
  minor: boolean;
}

interface TrackDefinition {
  bpm: number;
  chords: Chord[];
  /** Lead line, one entry per 8th note per bar (null = rest); bars past its end play arpeggios. */
  melody: (number | null)[][];
  drums: boolean;
  /** Steps (0-15) in each bar where the bass plays. */
  bassSteps: number[];
  pads: boolean;
}

const a = (root: number, minor = false): Chord => ({ root, minor });

const tracks: Record<MusicTrack, TrackDefinition> = {
  menu: {
    bpm: 92,
    // Am - F - C - G
    chords: [a(0, true), a(-4), a(3), a(-2)],
    melody: [],
    drums: false,
    bassSteps: [0, 8, 12],
    pads: true,
  },
  battle: {
    bpm: 124,
    // Am - Am - F - E, twice: the lead plays the first four bars, arpeggios the rest.
    chords: [a(0, true), a(0, true), a(-4), a(-5), a(0, true), a(0, true), a(-4), a(-5)],
    melody: [
      [0, null, 3, 5, 7, null, 5, 3],
      [0, null, -2, 0, 3, null, null, null],
      [8, null, 7, 5, 3, null, 5, null],
      [7, null, 2, null, -1, null, 2, null],
    ],
    drums: true,
    bassSteps: [0, 3, 6, 8, 11, 14],
    pads: false,
  },
};

const scheduler = {
  lookaheadS: 0.15,
  tickMs: 25,
  /** Overall music level before the player's music volume. */
  level: 0.55,
};

let currentTrack: MusicTrack | null = null;
let step = 0;
let nextStepAt = 0;
let timer: number | null = null;

/** Starts (or switches to) a track. Safe to call before audio is unlocked: it starts once it can. */
export function startMusic(track: MusicTrack): void {
  if (currentTrack === track && timer !== null) {
    return;
  }
  currentTrack = track;
  step = 0;
  nextStepAt = 0;
  if (timer === null) {
    timer = window.setInterval(tick, scheduler.tickMs);
  }
}

export function stopMusic(): void {
  currentTrack = null;
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
}

function tick(): void {
  const bus = getMusicBus();
  if (!bus || !currentTrack) {
    return;
  }

  const { audio } = bus;
  const track = tracks[currentTrack];
  const stepS = 60 / track.bpm / 4;

  // First tick after starting, or after the tab was in the background: resync.
  if (nextStepAt < audio.currentTime - 0.2) {
    nextStepAt = audio.currentTime + 0.08;
  }

  while (nextStepAt < audio.currentTime + scheduler.lookaheadS) {
    playStep(bus, track, step, nextStepAt, stepS);
    step += 1;
    nextStepAt += stepS;
  }
}

function playStep(
  bus: { audio: AudioContext; out: AudioNode; noise: AudioBuffer },
  track: TrackDefinition,
  stepIndex: number,
  at: number,
  stepS: number,
): void {
  const barIndex = Math.floor(stepIndex / 16) % track.chords.length;
  const inBar = stepIndex % 16;
  const chord = track.chords[barIndex];
  const chordTones = [0, chord.minor ? 3 : 4, 7].map((interval) => chord.root + interval);
  const { audio, out } = bus;

  if (track.pads && inBar === 0) {
    chordTones.forEach((note) => voice(audio, out, at, note - 12, "triangle", stepS * 16, 0.05, 0.35));
  }

  if (track.bassSteps.includes(inBar)) {
    const octaveUp = track.drums && inBar === 14;
    voice(audio, out, at, chord.root - 24 + (octaveUp ? 12 : 0), track.drums ? "square" : "triangle", stepS * 1.7, track.drums ? 0.07 : 0.12, 0.005, 900);
  }

  if (inBar % 2 === 0) {
    const eighth = inBar / 2;
    const melodyBar = track.melody[barIndex];
    if (melodyBar) {
      const note = melodyBar[eighth];
      if (note !== null && note !== undefined) {
        voice(audio, out, at, note, "square", stepS * 1.8, 0.045, 0.01, 2600);
      }
    } else {
      // Arpeggio up and down the chord, an octave above the pads.
      const pattern = [0, 1, 2, 1];
      const note = chordTones[pattern[eighth % pattern.length]] + (track.drums ? 12 : 0);
      voice(audio, out, at, note, track.drums ? "square" : "sine", stepS * 1.6, track.drums ? 0.03 : 0.07, 0.01, 2200);
    }
  }

  if (track.drums) {
    if (inBar === 0 || inBar === 8 || inBar === 10) kick(audio, out, at);
    if (inBar === 4 || inBar === 12) snare(bus, at);
    if (inBar % 2 === 0) hat(bus, at, inBar % 4 === 2 ? 0.035 : 0.02);
  } else if (inBar % 4 === 2) {
    hat(bus, at, 0.012);
  }
}

function frequency(semitonesFromA4: number): number {
  return 440 * Math.pow(2, semitonesFromA4 / 12);
}

function voice(
  audio: AudioContext,
  out: AudioNode,
  at: number,
  note: number,
  type: OscillatorType,
  lengthS: number,
  peak: number,
  attackS: number,
  lowpassHz?: number,
): void {
  const oscillator = audio.createOscillator();
  oscillator.type = type;
  oscillator.frequency.value = frequency(note);
  const gain = audio.createGain();
  const level = peak * scheduler.level;
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(level, at + attackS);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(attackS + 0.02, lengthS));

  let node: AudioNode = oscillator;
  if (lowpassHz) {
    const filter = audio.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = lowpassHz;
    oscillator.connect(filter);
    node = filter;
  }
  node.connect(gain);
  gain.connect(out);
  oscillator.start(at);
  oscillator.stop(at + lengthS + 0.05);
}

function kick(audio: AudioContext, out: AudioNode, at: number): void {
  const oscillator = audio.createOscillator();
  oscillator.frequency.setValueAtTime(130, at);
  oscillator.frequency.exponentialRampToValueAtTime(42, at + 0.12);
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.32 * scheduler.level, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
  oscillator.connect(gain);
  gain.connect(out);
  oscillator.start(at);
  oscillator.stop(at + 0.2);
}

function noiseHit(
  bus: { audio: AudioContext; out: AudioNode; noise: AudioBuffer },
  at: number,
  filterType: BiquadFilterType,
  filterHz: number,
  lengthS: number,
  peak: number,
): void {
  const { audio, out, noise } = bus;
  const source = audio.createBufferSource();
  source.buffer = noise;
  const filter = audio.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterHz;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(peak * scheduler.level, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + lengthS);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  // Random offset so every hit sounds a little different.
  source.start(at, Math.random() * 0.5, lengthS + 0.02);
}

function snare(bus: { audio: AudioContext; out: AudioNode; noise: AudioBuffer }, at: number): void {
  noiseHit(bus, at, "bandpass", 1900, 0.14, 0.16);
  voice(bus.audio, bus.out, at, -27, "triangle", 0.08, 0.08, 0.002);
}

function hat(bus: { audio: AudioContext; out: AudioNode; noise: AudioBuffer }, at: number, peak: number): void {
  noiseHit(bus, at, "highpass", 7500, 0.04, peak);
}
