// All gameplay tuning for Pétanque Park lives here.
// Units are metres, seconds and kilograms. The circle sits at the origin and
// players throw toward -z.

export const pitch = {
  halfWidth: 2,
  backLine: 1.2,
  deadLine: -14,
  jackMinDistance: 6,
  jackMaxDistance: 10,
  jackEdgeMargin: 0.5,
  circleRadius: 0.25,
} as const;

export const balls = {
  bouleRadius: 0.09,
  bouleMass: 0.7,
  jackRadius: 0.045,
  jackMass: 0.03,
  restitution: 0.55,
} as const;

export const physics = {
  gravity: 9.81,
  stepSeconds: 1 / 240,
  rollingFriction: 0.2,
  landingGrip: 0.95,
  bounceRestitution: 0.22,
  bounceStopSpeed: 0.6,
  restSpeed: 0.03,
  popUpSpeed: 1.2,
  rollOffSpeed: 0.5,
  settleTimeoutSeconds: 8,
  maxSimSeconds: 20,
} as const;

export type ThrowStyle = "roll" | "lob";

export const throwing = {
  releaseHeight: 0.55,
  releaseForward: 0.35,
  minDistance: 1,
  maxDistance: 13,
  elevationDegrees: { roll: 14, lob: 58 } satisfies Record<ThrowStyle, number>,
  maxAimDegrees: 35,
  aimDegreesPerSecond: 22,
  // A fully missed straightness bar pulls the throw this far off line.
  maxAccuracyErrorDegrees: 9,
} as const;

// Two timed bars. Distance: a needle runs 0 -> full -> 0 on a loop; press to
// lock how far. Straightness: a needle swings left <-> right through the centre;
// press to lock, and the further from centre the more the throw pulls off line.
export const meter = {
  distanceSweepSeconds: 1.15,
  directionSweepSeconds: 0.62,
  // Within this much of centre the throw goes dead straight.
  directionSweetSpot: 0.07,
} as const;

export const match = {
  boulesPerPlayerSingles: 3,
  boulesPerPlayerDoubles: 3,
  targetScoreOptions: [7, 13] as const,
  defaultTargetScore: 7,
} as const;

export type CpuLevel = "easy" | "normal" | "hard";

export interface CpuProfile {
  label: string;
  thinkSeconds: number;
  // Fraction of the distance bar; 0.03 is about a third of a metre.
  powerNoise: number;
  aimNoiseDegrees: number;
  // How often it tries to knock a rival boule off the jack when one sits close.
  shootChance: number;
  // Reads the pitch: weighs pointing vs shooting and lobs over blockers.
  readsPitch: boolean;
}

export const cpuLevels: Record<CpuLevel, CpuProfile> = {
  easy: { label: "Easy", thinkSeconds: 1.2, powerNoise: 0.075, aimNoiseDegrees: 5.5, shootChance: 0, readsPitch: false },
  normal: { label: "Normal", thinkSeconds: 1.0, powerNoise: 0.035, aimNoiseDegrees: 2.5, shootChance: 0.45, readsPitch: false },
  hard: { label: "Hard", thinkSeconds: 0.9, powerNoise: 0.014, aimNoiseDegrees: 0.9, shootChance: 0.85, readsPitch: true },
};

export const cpuLevelOrder: readonly CpuLevel[] = ["easy", "normal", "hard"];
export const defaultCpuLevel: CpuLevel = "normal";
