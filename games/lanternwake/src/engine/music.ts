// Procedural music: each track is a small recipe (tempo, key, mode, chord progression
// and instrument layers) played by a look-ahead Web Audio sequencer. Changing track
// crossfades. Everything is synthesised, so the game ships no audio files and the
// tunes are Lanternwake's own.

export type TrackName = "village" | "forest" | "shrine" | "boss" | "home" | "none";

type Wave = OscillatorType;

interface TrackDef {
  bpm: number;
  /** MIDI note of the tonic. */
  root: number;
  /** Seven scale steps in semitones. */
  mode: number[];
  /** Scale degree (0-6) of each chord; one chord per `chordBars` bars. */
  progression: number[];
  chordBars?: number;
  /** 0..1 swing on off-beat 16ths. */
  swing?: number;
  pad?: { octave: number; wave: Wave; volume: number; cutoff: number };
  /** Chord-tone indices per slot (null = rest); `division` is 16ths per slot. */
  arp?: { pattern: Array<number | null>; division: number; octave: number; wave: Wave; volume: number; decay: number; cutoff: number; chance?: number };
  bass?: { steps: number[]; octave: number; wave: Wave; volume: number; length: number; cutoff: number };
  /** A random high scale note, rolled every 8th. */
  bell?: { chance: number; octave: number; volume: number };
  drums?: { kick: number[]; snare: number[]; hat: number[]; volume: number };
  reverb: number;
}

const major = [0, 2, 4, 5, 7, 9, 11];
const minor = [0, 2, 3, 5, 7, 8, 10];
const dorian = [0, 2, 3, 5, 7, 9, 10];
const phrygian = [0, 1, 3, 5, 7, 8, 10];

const tracks: Record<Exclude<TrackName, "none">, TrackDef> = {
  // Wickmoor: warm and a little wistful, a plucked lute over a soft bed.
  village: {
    bpm: 84,
    root: 62,
    mode: major,
    progression: [0, 5, 3, 4, 0, 5, 1, 4],
    swing: 0.12,
    pad: { octave: -1, wave: "triangle", volume: 0.035, cutoff: 1100 },
    arp: { pattern: [0, 1, 2, 3, 2, 1, 2, 1], division: 2, octave: 0, wave: "triangle", volume: 0.085, decay: 0.75, cutoff: 2600 },
    bass: { steps: [0, 10], octave: -2, wave: "triangle", volume: 0.13, length: 6, cutoff: 700 },
    bell: { chance: 0.1, octave: 1, volume: 0.025 },
    reverb: 0.35,
  },
  // Gloamwood: sparse, uncertain plucks in the dark between the trees.
  forest: {
    bpm: 70,
    root: 57,
    mode: dorian,
    progression: [0, 6, 5, 6, 0, 3, 5, 4],
    pad: { octave: -1, wave: "sawtooth", volume: 0.018, cutoff: 620 },
    arp: { pattern: [0, null, 2, null, 1, null, 3, 2], division: 2, octave: 0, wave: "triangle", volume: 0.075, decay: 1.3, cutoff: 1700, chance: 0.75 },
    bass: { steps: [0], octave: -2, wave: "triangle", volume: 0.12, length: 14, cutoff: 500 },
    bell: { chance: 0.07, octave: 1, volume: 0.03 },
    reverb: 0.55,
  },
  // Sunken Shrine: a slow drowned drone with far-off bells.
  shrine: {
    bpm: 56,
    root: 48,
    mode: phrygian,
    progression: [0, 0, 1, 0, 0, 5, 1, 0],
    pad: { octave: 0, wave: "sawtooth", volume: 0.024, cutoff: 520 },
    arp: { pattern: [0, null, null, null, 4, null, null, null], division: 2, octave: 1, wave: "sine", volume: 0.05, decay: 2.2, cutoff: 3000 },
    bass: { steps: [0], octave: -1, wave: "triangle", volume: 0.11, length: 16, cutoff: 420 },
    bell: { chance: 0.13, octave: 2, volume: 0.03 },
    reverb: 0.7,
  },
  // The Hollow Warden: driving bass ostinato, drums, a nervous square arpeggio.
  boss: {
    bpm: 138,
    root: 52,
    mode: minor,
    progression: [0, 0, 5, 6, 0, 0, 3, 4],
    pad: { octave: 0, wave: "sawtooth", volume: 0.028, cutoff: 1300 },
    arp: { pattern: [0, 1, 2, 1, 3, 2, 1, 2, 0, 1, 2, 1, 4, 3, 2, 1], division: 1, octave: 1, wave: "square", volume: 0.026, decay: 0.16, cutoff: 2400 },
    bass: { steps: [0, 2, 3, 6, 8, 10, 11, 14], octave: -1, wave: "sawtooth", volume: 0.095, length: 1.6, cutoff: 950 },
    drums: { kick: [0, 6, 8, 11], snare: [4, 12], hat: [2, 6, 10, 14], volume: 1 },
    reverb: 0.25,
  },
  // Inside a cottage: a small music box by the fire.
  home: {
    bpm: 76,
    root: 65,
    mode: major,
    progression: [0, 3, 0, 4, 5, 3, 1, 4],
    pad: { octave: -1, wave: "triangle", volume: 0.028, cutoff: 900 },
    arp: { pattern: [0, 2, 4, 2, 3, 2, 4, 2], division: 2, octave: 1, wave: "sine", volume: 0.07, decay: 1.0, cutoff: 4000 },
    bass: { steps: [0, 8], octave: -2, wave: "triangle", volume: 0.08, length: 6, cutoff: 600 },
    reverb: 0.3,
  },
};

const lookAhead = 0.25;

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

class TrackPlayer {
  readonly output: GainNode;
  private step = 0;
  private nextTime: number;
  private stopped = false;

  constructor(
    private readonly context: AudioContext,
    private readonly def: TrackDef,
    destination: AudioNode,
    private readonly reverbSend: AudioNode,
    private readonly noise: AudioBuffer,
  ) {
    this.output = context.createGain();
    this.output.gain.value = 0;
    this.output.gain.setTargetAtTime(1, context.currentTime, 1.2);
    this.output.connect(destination);
    this.nextTime = context.currentTime + 0.1;
  }

  stop(): void {
    this.stopped = true;
    this.output.gain.setTargetAtTime(0, this.context.currentTime, 0.7);
    window.setTimeout(() => this.output.disconnect(), 5000);
  }

  /** Schedule every 16th that falls inside the look-ahead window. */
  pump(): void {
    if (this.stopped) return;
    const sixteenth = 60 / this.def.bpm / 4;
    // After a long tab-away, skip ahead instead of firing a burst of old notes.
    if (this.nextTime < this.context.currentTime - 0.5) this.nextTime = this.context.currentTime + 0.05;
    while (this.nextTime < this.context.currentTime + lookAhead) {
      const swing = this.step % 2 === 1 ? (this.def.swing ?? 0) * sixteenth : 0;
      this.playStep(this.step, this.nextTime + swing, sixteenth);
      this.nextTime += sixteenth;
      this.step += 1;
    }
  }

  /** Chord-tone `index` of the chord on scale degree `degree` (stacked thirds,
   * wrapping up an octave every three tones), as a MIDI note. */
  private chordTone(degree: number, index: number, octave: number): number {
    const scaleIndex = degree + Math.floor(index % 3) * 2 + Math.floor(index / 3) * 7;
    return this.scaleNote(scaleIndex, octave);
  }

  private scaleNote(scaleIndex: number, octave: number): number {
    const mode = this.def.mode;
    const wrapped = ((scaleIndex % 7) + 7) % 7;
    return this.def.root + mode[wrapped] + 12 * (Math.floor(scaleIndex / 7) + octave);
  }

  private playStep(step: number, time: number, sixteenth: number): void {
    const def = this.def;
    const inBar = step % 16;
    const bar = Math.floor(step / 16);
    const chordBars = def.chordBars ?? 1;
    const degree = def.progression[Math.floor(bar / chordBars) % def.progression.length];

    if (def.pad && inBar === 0 && bar % chordBars === 0) {
      const length = sixteenth * 16 * chordBars;
      const notes = [0, 1, 2].map((index) => midiToHz(this.chordTone(degree, index, def.pad!.octave)));
      this.pad(notes, time, length, def.pad.wave, def.pad.volume, def.pad.cutoff);
    }
    if (def.arp && inBar % def.arp.division === 0) {
      const slot = Math.floor(inBar / def.arp.division) % def.arp.pattern.length;
      const index = def.arp.pattern[slot];
      if (index !== null && Math.random() < (def.arp.chance ?? 1)) {
        const velocity = 0.8 + Math.random() * 0.25 + (slot === 0 ? 0.15 : 0);
        this.pluck(midiToHz(this.chordTone(degree, index, def.arp.octave)), time, def.arp.decay, def.arp.wave, def.arp.volume * velocity, def.arp.cutoff);
      }
    }
    if (def.bass && def.bass.steps.includes(inBar)) {
      this.pluck(midiToHz(this.chordTone(degree, 0, def.bass.octave)), time, def.bass.length * sixteenth, def.bass.wave, def.bass.volume, def.bass.cutoff, 0.01);
    }
    if (def.bell && inBar % 2 === 0 && Math.random() < def.bell.chance) {
      const scaleIndex = degree + [0, 2, 4, 7][Math.floor(Math.random() * 4)];
      this.bell(midiToHz(this.scaleNote(scaleIndex, def.bell.octave)), time, def.bell.volume);
    }
    if (def.drums) {
      if (def.drums.kick.includes(inBar)) this.kick(time, def.drums.volume);
      if (def.drums.snare.includes(inBar)) this.snare(time, def.drums.volume);
      if (def.drums.hat.includes(inBar)) this.hat(time, def.drums.volume * (inBar % 4 === 2 ? 1 : 0.6));
    }
  }

  // ------------------------------------------------------------ voices

  private connectOut(node: AudioNode, wet = this.def.reverb): void {
    node.connect(this.output);
    if (wet > 0) {
      const send = this.context.createGain();
      send.gain.value = wet;
      node.connect(send).connect(this.reverbSend);
    }
  }

  private pluck(frequency: number, time: number, decay: number, wave: Wave, volume: number, cutoff: number, attack = 0.005): void {
    const oscillator = this.context.createOscillator();
    oscillator.type = wave;
    oscillator.frequency.value = frequency;
    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff, time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(120, cutoff * 0.35), time + decay);
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(volume, time + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);
    oscillator.connect(filter).connect(gain);
    this.connectOut(gain);
    oscillator.start(time);
    oscillator.stop(time + decay + 0.05);
  }

  private pad(frequencies: number[], time: number, length: number, wave: Wave, volume: number, cutoff: number): void {
    const gain = this.context.createGain();
    const attack = Math.min(1.2, length * 0.3);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(volume, time + attack);
    gain.gain.setValueAtTime(volume, time + length - 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + length + 1.2);
    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    filter.connect(gain);
    this.connectOut(gain, this.def.reverb * 1.2);
    for (const frequency of frequencies) {
      for (const detune of [-7, 7]) {
        const oscillator = this.context.createOscillator();
        oscillator.type = wave;
        oscillator.frequency.value = frequency;
        oscillator.detune.value = detune;
        oscillator.connect(filter);
        oscillator.start(time);
        oscillator.stop(time + length + 1.3);
      }
    }
  }

  private bell(frequency: number, time: number, volume: number): void {
    for (const [ratio, level, decay] of [
      [1, 1, 2.2],
      [2.76, 0.35, 0.9],
      [5.4, 0.12, 0.4],
    ] as const) {
      const oscillator = this.context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency * ratio;
      const gain = this.context.createGain();
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(volume * level, time + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);
      oscillator.connect(gain);
      this.connectOut(gain, this.def.reverb * 1.4);
      oscillator.start(time);
      oscillator.stop(time + decay + 0.05);
    }
  }

  private kick(time: number, volume: number): void {
    const oscillator = this.context.createOscillator();
    oscillator.frequency.setValueAtTime(150, time);
    oscillator.frequency.exponentialRampToValueAtTime(42, time + 0.14);
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.32 * volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.32);
    oscillator.connect(gain);
    this.connectOut(gain, 0.05);
    oscillator.start(time);
    oscillator.stop(time + 0.35);
  }

  private noiseHit(time: number, volume: number, decay: number, type: BiquadFilterType, frequency: number): void {
    const source = this.context.createBufferSource();
    source.buffer = this.noise;
    const filter = this.context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);
    source.connect(filter).connect(gain);
    this.connectOut(gain, 0.15);
    source.start(time, Math.random() * 0.5);
    source.stop(time + decay + 0.02);
  }

  private snare(time: number, volume: number): void {
    this.noiseHit(time, 0.16 * volume, 0.16, "bandpass", 1900);
    const body = this.context.createOscillator();
    body.type = "triangle";
    body.frequency.setValueAtTime(210, time);
    body.frequency.exponentialRampToValueAtTime(140, time + 0.08);
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.09 * volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
    body.connect(gain);
    this.connectOut(gain, 0.1);
    body.start(time);
    body.stop(time + 0.12);
  }

  private hat(time: number, volume: number): void {
    this.noiseHit(time, 0.05 * volume, 0.045, "highpass", 7000);
  }
}

export class Music {
  private context: AudioContext | null = null;
  private bus: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private noise: AudioBuffer | null = null;
  private player: TrackPlayer | null = null;
  private wanted: TrackName = "none";
  private playing: TrackName = "none";
  private timer = 0;

  /** Called by Sfx once the AudioContext exists (after the first user gesture). */
  attach(context: AudioContext, bus: GainNode): void {
    this.context = context;
    this.bus = bus;
    this.reverb = context.createConvolver();
    this.reverb.buffer = this.impulse(2.8);
    this.reverb.connect(bus);
    this.noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
    this.timer = window.setInterval(() => this.player?.pump(), 60);
    this.apply();
  }

  /** Switch to `name` (no-op if it's already playing); crossfades. */
  play(name: TrackName): void {
    this.wanted = name;
    this.apply();
  }

  get current(): TrackName {
    return this.playing;
  }

  private apply(): void {
    if (!this.context || !this.bus || !this.reverb || !this.noise) return;
    if (this.wanted === this.playing) return;
    this.player?.stop();
    this.player = null;
    this.playing = this.wanted;
    if (this.wanted === "none") return;
    this.player = new TrackPlayer(this.context, tracks[this.wanted], this.bus, this.reverb, this.noise);
    this.player.pump();
  }

  /** Stereo noise with an exponential tail: a cheap hall reverb. */
  private impulse(seconds: number): AudioBuffer {
    const context = this.context!;
    const length = Math.floor(context.sampleRate * seconds);
    const buffer = context.createBuffer(2, length, context.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / length, 3.2);
    }
    return buffer;
  }

  dispose(): void {
    window.clearInterval(this.timer);
  }
}
