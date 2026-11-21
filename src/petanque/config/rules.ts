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
  maxAccuracyErrorDegrees: 7,
} as const;

export const meter = {
  // Bar runs from `overshoot` (left of the sweet spot) to 1 (full power).
  fillSeconds: 1.15,
  returnSeconds: 1.0,
  overshoot: -0.14,
  sweetSpotHalfWidth: 0.018,
  accuracyWindow: 0.12,
} as const;

export const match = {
  boulesPerPlayerSingles: 3,
  boulesPerPlayerDoubles: 3,
  targetScoreOptions: [7, 13] as const,
  defaultTargetScore: 7,
} as const;

export const cpu = {
  thinkSeconds: 0.9,
  powerNoise: 0.035,
  aimNoiseDegrees: 2.5,
} as const;
