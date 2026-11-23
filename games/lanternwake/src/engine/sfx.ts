// Small synthesised sound effects and an ambient drone, so the game ships no audio files.
// Effects/ambience and music run on separate buses with their own volumes.
import { Music } from "./music";

export type Sound =
  | "swing"
  | "hit"
  | "hurt"
  | "flare"
  | "pickup"
  | "levelUp"
  | "step"
  | "shadeCry"
  | "break"
  | "gate"
  | "solve"
  | "talk"
  | "bossRoar"
  | "slam"
  | "chest"
  | "ignite"
  | "jump"
  | "land"
  | "doorOpen"
  | "locked";

export class Sfx {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  /** Effects + ambience bus (what tone/noise/ambient connect to). */
  private effects: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private volumes = { sfx: 0.8, music: 0.55 };
  readonly music = new Music();
  private noiseBuffer: AudioBuffer | null = null;
  private ambient: { gain: GainNode; nodes: AudioScheduledSourceNode[] } | null = null;

  /** Must be called from a user gesture (browsers block audio before one). */
  unlock(): void {
    if (this.context) {
      void this.context.resume();
      return;
    }
    const AudioCtor = window.AudioContext;
    if (!AudioCtor) return;
    this.context = new AudioCtor();
    this.master = this.context.createGain();
    this.master.gain.value = 0.45;
    this.master.connect(this.context.destination);
    this.effects = this.context.createGain();
    this.effects.connect(this.master);
    this.musicBus = this.context.createGain();
    this.musicBus.connect(this.master);
    this.applyVolumes();
    this.music.attach(this.context, this.musicBus);
    const length = this.context.sampleRate;
    this.noiseBuffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  }

  /** Volumes 0..1; perceptual (squared) curve so the slider's middle sounds like half. */
  setVolumes(sfxVolume: number, musicVolume: number): void {
    this.volumes = { sfx: sfxVolume, music: musicVolume };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.context || !this.effects || !this.musicBus) return;
    const now = this.context.currentTime;
    this.effects.gain.setTargetAtTime(this.volumes.sfx * this.volumes.sfx * 1.25, now, 0.05);
    this.musicBus.gain.setTargetAtTime(this.volumes.music * this.volumes.music * 1.4, now, 0.05);
  }

  private tone(type: OscillatorType, from: number, to: number, duration: number, volume: number, delay = 0): void {
    if (!this.context || !this.master) return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(this.effects!);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private noise(duration: number, volume: number, filterFrom: number, filterTo: number, type: BiquadFilterType = "bandpass", delay = 0): void {
    if (!this.context || !this.master || !this.noiseBuffer) return;
    const start = this.context.currentTime + delay;
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.context.createBiquadFilter();
    filter.type = type;
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(filterFrom, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, filterTo), start + duration);
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(this.effects!);
    source.start(start, Math.random() * 0.5);
    source.stop(start + duration + 0.02);
  }

  play(sound: Sound): void {
    switch (sound) {
      case "swing":
        this.noise(0.16, 0.35, 900, 3200);
        break;
      case "hit":
        this.tone("square", 220, 70, 0.12, 0.18);
        this.noise(0.08, 0.3, 2500, 600);
        break;
      case "hurt":
        this.tone("sawtooth", 320, 90, 0.25, 0.16);
        break;
      case "flare":
        this.tone("triangle", 330, 990, 0.45, 0.16);
        this.tone("triangle", 495, 1480, 0.45, 0.1, 0.05);
        this.noise(0.5, 0.15, 3000, 8000, "highpass");
        break;
      case "pickup":
        [660, 880, 1320].forEach((frequency, index) => this.tone("square", frequency, frequency, 0.09, 0.08, index * 0.06));
        break;
      case "levelUp":
        [523, 659, 784, 1046].forEach((frequency, index) => this.tone("square", frequency, frequency, 0.18, 0.09, index * 0.1));
        break;
      case "step":
        this.noise(0.05, 0.05, 300, 150, "lowpass");
        break;
      case "shadeCry":
        this.tone("sine", 520, 260, 0.6, 0.07);
        this.tone("sine", 530, 250, 0.6, 0.05, 0.03);
        break;
      case "break":
        this.noise(0.3, 0.4, 1800, 300);
        this.tone("square", 140, 60, 0.15, 0.1);
        break;
      case "jump":
        this.noise(0.18, 0.16, 600, 2200, "bandpass");
        this.tone("triangle", 180, 320, 0.12, 0.05);
        break;
      case "land":
        this.noise(0.16, 0.35, 420, 90, "lowpass");
        this.tone("sine", 110, 55, 0.12, 0.12);
        break;
      case "doorOpen":
        // Latch click, then a slow hinge creak.
        this.noise(0.05, 0.3, 3000, 2000, "highpass");
        this.tone("sawtooth", 210, 150, 0.7, 0.035, 0.18);
        this.tone("square", 320, 260, 0.5, 0.015, 0.22);
        this.noise(0.6, 0.08, 500, 200, "lowpass", 0.2);
        break;
      case "locked":
        // Handle jiggle and two dull knocks against the frame.
        [0, 0.07, 0.14].forEach((delay) => this.noise(0.04, 0.22, 2600, 1800, "highpass", delay));
        this.noise(0.12, 0.45, 300, 120, "lowpass", 0.05);
        this.tone("square", 95, 70, 0.1, 0.08, 0.05);
        this.noise(0.12, 0.4, 300, 120, "lowpass", 0.3);
        this.tone("square", 90, 65, 0.1, 0.07, 0.3);
        break;
      case "gate":
        this.noise(0.9, 0.25, 200, 80, "lowpass");
        this.tone("sawtooth", 60, 45, 0.9, 0.08);
        break;
      case "solve":
        [392, 523, 659, 784, 1046].forEach((frequency, index) => this.tone("triangle", frequency, frequency, 0.25, 0.1, index * 0.09));
        break;
      case "talk":
        this.tone("square", 440 + Math.random() * 120, 440, 0.035, 0.035);
        break;
      case "bossRoar":
        this.tone("sawtooth", 110, 45, 1.2, 0.2);
        this.noise(1.2, 0.25, 600, 120, "lowpass");
        break;
      case "slam":
        this.tone("sine", 90, 30, 0.5, 0.4);
        this.noise(0.4, 0.4, 900, 100, "lowpass");
        break;
      case "chest":
        [523, 659, 784, 1046, 1318].forEach((frequency, index) => this.tone("triangle", frequency, frequency, 0.3, 0.1, index * 0.12));
        break;
      case "ignite":
        this.noise(0.4, 0.3, 500, 2500);
        this.tone("triangle", 200, 600, 0.3, 0.08);
        break;
    }
  }

  /** A low wind drone with a slow filter sweep; mood changes its pitch. */
  setAmbient(mood: "village" | "forest" | "shrine" | "none"): void {
    if (!this.context || !this.effects || !this.noiseBuffer) return;
    const now = this.context.currentTime;
    if (this.ambient) {
      const old = this.ambient;
      old.gain.gain.setTargetAtTime(0, now, 0.6);
      window.setTimeout(() => old.nodes.forEach((node) => node.stop()), 3000);
      this.ambient = null;
    }
    if (mood === "none") return;
    const gain = this.context.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(1, now, 1.5);
    gain.connect(this.effects);
    const wind = this.context.createBufferSource();
    wind.buffer = this.noiseBuffer;
    wind.loop = true;
    const windFilter = this.context.createBiquadFilter();
    windFilter.type = "lowpass";
    windFilter.frequency.value = mood === "forest" ? 380 : 520;
    const windGain = this.context.createGain();
    windGain.gain.value = 0.05;
    const sweep = this.context.createOscillator();
    sweep.frequency.value = 0.07;
    const sweepDepth = this.context.createGain();
    sweepDepth.gain.value = 200;
    sweep.connect(sweepDepth).connect(windFilter.frequency);
    wind.connect(windFilter).connect(windGain).connect(gain);
    const root = mood === "shrine" ? 55 : mood === "forest" ? 65.4 : 73.4;
    const drones = [root, root * 1.5, root * 2.01].map((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      oscillator.type = index === 0 ? "sine" : "triangle";
      oscillator.frequency.value = frequency;
      const droneGain = this.context!.createGain();
      droneGain.gain.value = index === 0 ? 0.05 : 0.018;
      oscillator.connect(droneGain).connect(gain);
      return oscillator;
    });
    const nodes: AudioScheduledSourceNode[] = [wind, sweep, ...drones];
    nodes.forEach((node) => node.start());
    this.ambient = { gain, nodes };
  }
}

export const sfx = new Sfx();
