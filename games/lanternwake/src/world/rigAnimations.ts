// Procedural animation clips for the humanoid rig: each returns a target pose.
// Conventions (joint rotation order YXZ): for limbs hanging down, +x swings them back;
// for the spine, +x leans forward. The rig faces +z; its right side is -x.
import { hipHeight, keyframePose, mixPose, restPose, type Pose } from "./humanoidRig";

export function idlePose(time: number, holdingSword = true): Pose {
  const pose = restPose();
  const breath = Math.sin(time * 1.8);
  pose.bodyY = hipHeight - 0.01 + breath * 0.006;
  pose.spineX = 0.04 + breath * 0.015;
  pose.neckX = -0.02 - breath * 0.01;
  pose.shoulderLZ = 0.14 + breath * 0.02;
  pose.shoulderRZ = -0.16 - breath * 0.02;
  pose.elbowLX = -0.55;
  pose.shoulderLX = -0.1;
  if (holdingSword) {
    pose.elbowRX = -0.5;
    pose.wristRX = -1.1;
  }
  pose.hipLZ = 0.05;
  pose.hipRZ = -0.05;
  pose.kneeLX = 0.06;
  pose.kneeRX = 0.06;
  pose.capeLift = 0.06;
  return pose;
}

/** Walk-to-run cycle. `run` 0 = walk, 1 = full run. */
export function locomotionPose(phase: number, run: number, holdingSword = true): Pose {
  const pose = restPose();
  const stride = 0.38 + run * 0.32;
  const swing = Math.sin(phase);
  const lift = Math.cos(phase);
  pose.hipLX = -swing * stride;
  pose.hipRX = swing * stride;
  pose.kneeLX = 0.12 + Math.max(0, lift) * (0.55 + run * 0.75);
  pose.kneeRX = 0.12 + Math.max(0, -lift) * (0.55 + run * 0.75);
  pose.footLX = -pose.hipLX * 0.35;
  pose.footRX = -pose.hipRX * 0.35;
  pose.bodyY = hipHeight - 0.015 - Math.abs(swing) * (0.03 + run * 0.035) + run * 0.01;
  pose.spineX = 0.08 + run * 0.2;
  pose.spineY = swing * (0.1 + run * 0.06);
  pose.neckX = -pose.spineX * 0.6;
  pose.neckY = -pose.spineY * 0.7;
  pose.bodyRoll = swing * 0.03;
  // Lantern arm swings gently; sword arm swings fully.
  pose.shoulderLX = swing * stride * 0.45 - 0.15;
  pose.elbowLX = -0.6 - run * 0.4;
  pose.shoulderLZ = 0.16;
  pose.shoulderRX = -swing * stride * 0.9;
  pose.elbowRX = -0.45 - run * 0.8;
  pose.shoulderRZ = -0.14;
  if (holdingSword) pose.wristRX = -1.0 - run * 0.3;
  pose.capeLift = 0.2 + run * 0.5;
  return pose;
}

/** Airborne. `rise` 1 = leaving the ground (knees tucked, arms lifting),
 * 0 = falling (legs reaching down for the landing, arms out for balance). */
export function airPose(rise: number, time: number): Pose {
  const up = restPose();
  up.bodyY = hipHeight + 0.02;
  up.spineX = 0.12;
  up.neckX = -0.1;
  up.hipLX = -0.85;
  up.kneeLX = 1.35;
  up.footLX = 0.25;
  up.hipRX = 0.35;
  up.kneeRX = 0.75;
  up.footRX = 0.3;
  up.shoulderLX = -0.7;
  up.shoulderLZ = 0.35;
  up.elbowLX = -0.9;
  up.shoulderRX = -0.9;
  up.shoulderRZ = -0.3;
  up.elbowRX = -1.0;
  up.wristRX = -1.1;
  up.capeLift = 0.35;

  const down = restPose();
  down.bodyY = hipHeight;
  down.spineX = -0.02;
  down.neckX = 0.12;
  down.hipLX = -0.35;
  down.kneeLX = 0.35;
  down.footLX = -0.15;
  down.hipRX = 0.1;
  down.kneeRX = 0.45;
  down.footRX = -0.1;
  down.shoulderLX = -0.35;
  down.shoulderLZ = 0.85;
  down.elbowLX = -0.4;
  down.shoulderRX = -0.3;
  down.shoulderRZ = -0.85;
  down.elbowRX = -0.5;
  down.wristRX = -0.9;
  down.capeLift = 0.95 + Math.sin(time * 18) * 0.06;
  return mixPose(down, up, Math.max(0, Math.min(1, rise)));
}

/** Landing squash; progress 0 = touchdown, 1 = recovered. `weight` scales the dip. */
export function landPose(progress: number, weight: number): Pose {
  const pose = restPose();
  const dip = Math.sin(Math.min(1, progress) * Math.PI * 0.5 + Math.PI * 0.5) * weight;
  pose.bodyY = hipHeight - 0.24 * dip;
  pose.spineX = 0.08 + 0.4 * dip;
  pose.neckX = -0.25 * dip;
  pose.hipLX = -0.2 - 0.75 * dip;
  pose.hipRX = 0.15 - 0.55 * dip;
  pose.kneeLX = 0.15 + 1.25 * dip;
  pose.kneeRX = 0.15 + 1.05 * dip;
  pose.footLX = 0.45 * dip;
  pose.footRX = 0.4 * dip;
  pose.shoulderLX = -0.2 - 0.3 * dip;
  pose.shoulderLZ = 0.2 + 0.45 * dip;
  pose.elbowLX = -0.6;
  pose.shoulderRX = -0.2 - 0.3 * dip;
  pose.shoulderRZ = -0.2 - 0.45 * dip;
  pose.elbowRX = -0.6;
  pose.wristRX = -1.0;
  pose.capeLift = 0.1 + 0.3 * (1 - progress);
  return pose;
}

const swingStance: Partial<Pose> = {
  hipLX: -0.35,
  hipRX: 0.3,
  kneeLX: 0.3,
  kneeRX: 0.25,
  bodyY: hipHeight - 0.06,
  shoulderLX: -0.3,
  shoulderLZ: 0.45,
  elbowLX: -0.7,
};

/** Three-hit sword combo. progress 0..1 across the swing; strike lands around 0.3-0.55. */
export function attackPose(combo: number, progress: number): Pose {
  const base = { ...restPose(), ...swingStance };
  if (combo === 0) {
    // Forehand: right side to left, flat.
    return keyframePose(
      base,
      [
        [0, { shoulderRX: -1.2, shoulderRY: -1.6, wristRX: -0.6, spineY: -0.55, spineX: 0.1, elbowRX: -0.6 }],
        [0.28, { shoulderRX: -1.45, shoulderRY: -1.75, wristRX: -0.25, spineY: -0.6, spineX: 0.12, elbowRX: -0.2 }],
        [0.5, { shoulderRX: -1.4, shoulderRY: 1.15, wristRX: -0.2, spineY: 0.5, spineX: 0.2, elbowRX: -0.05, capeLift: 0.6 }],
        [1, { shoulderRX: -0.9, shoulderRY: 0.8, wristRX: -0.6, spineY: 0.3, spineX: 0.15, elbowRX: -0.4 }],
      ],
      progress,
    );
  }
  if (combo === 1) {
    // Backhand: left to right, rising.
    return keyframePose(
      base,
      [
        [0, { shoulderRX: -1.3, shoulderRY: 0.9, wristRX: -0.5, spineY: 0.45, spineX: 0.15, elbowRX: -0.9 }],
        [0.25, { shoulderRX: -1.35, shoulderRY: 1.25, wristRX: -0.3, spineY: 0.55, spineX: 0.15, elbowRX: -0.7 }],
        [0.5, { shoulderRX: -1.7, shoulderRY: -1.5, wristRX: -0.15, spineY: -0.55, spineX: 0.2, elbowRX: -0.05, capeLift: 0.6 }],
        [1, { shoulderRX: -1.0, shoulderRY: -1.0, wristRX: -0.7, spineY: -0.3, spineX: 0.1, elbowRX: -0.4 }],
      ],
      progress,
    );
  }
  // Finisher: overhead chop with a hop forward.
  return keyframePose(
    base,
    [
      [0, { shoulderRX: -2.2, shoulderRY: -0.2, wristRX: 0, spineX: -0.1, elbowRX: -0.6, bodyY: hipHeight }],
      [0.3, { shoulderRX: -3.0, shoulderRY: -0.15, wristRX: 0.25, spineX: -0.22, elbowRX: -0.3, bodyY: hipHeight + 0.06, kneeLX: 0.6, kneeRX: 0.5 }],
      [0.52, { shoulderRX: -0.55, shoulderRY: -0.1, wristRX: -0.2, spineX: 0.5, elbowRX: 0, bodyY: hipHeight - 0.14, kneeLX: 0.7, kneeRX: 0.5, capeLift: 0.9 }],
      [1, { shoulderRX: -0.6, shoulderRY: -0.2, wristRX: -0.8, spineX: 0.3, elbowRX: -0.3, bodyY: hipHeight - 0.08 }],
    ],
    progress,
  );
}

export function hurtPose(progress: number): Pose {
  const pose = restPose();
  const hit = Math.sin(Math.min(1, progress) * Math.PI) * (1 - progress * 0.3);
  pose.spineX = -0.45 * hit;
  pose.neckX = -0.35 * hit;
  pose.bodyPitch = -0.12 * hit;
  pose.shoulderLZ = 0.2 + 0.7 * hit;
  pose.shoulderRZ = -0.2 - 0.7 * hit;
  pose.shoulderLX = -0.4 * hit;
  pose.shoulderRX = -0.4 * hit;
  pose.kneeLX = 0.3 * hit;
  pose.kneeRX = 0.2 * hit;
  pose.hipLX = -0.25 * hit;
  pose.capeLift = 0.5 * hit;
  return pose;
}

export function deathPose(progress: number): Pose {
  return keyframePose(
    restPose(),
    [
      [0, { spineX: -0.4, neckX: -0.3, shoulderLZ: 0.8, shoulderRZ: -0.8 }],
      [0.35, { bodyY: 0.62, kneeLX: 1.3, kneeRX: 1.2, hipLX: -1.0, hipRX: -0.9, spineX: 0.5, neckX: 0.3, shoulderLX: -0.5, shoulderRX: -0.5 }],
      [1, { bodyY: 0.24, bodyPitch: 1.45, kneeLX: 0.3, kneeRX: 0.5, hipLX: -0.1, hipRX: 0.1, spineX: 0.1, neckY: 0.6, shoulderLX: -2.6, shoulderRX: -0.4, shoulderRZ: -1.0, wristRX: -0.3 }],
    ],
    progress,
  );
}

/** Lantern raised overhead for the flare. */
export function flarePose(progress: number): Pose {
  return keyframePose(
    restPose(),
    [
      [0, { shoulderLX: -0.4, elbowLX: -0.8 }],
      [0.25, { shoulderLX: -2.85, shoulderLZ: 0.25, elbowLX: -0.15, spineX: -0.18, neckX: -0.35, bodyY: hipHeight + 0.02, shoulderRX: 0.2, shoulderRZ: -0.4 }],
      [0.75, { shoulderLX: -2.85, shoulderLZ: 0.25, elbowLX: -0.15, spineX: -0.18, neckX: -0.35, bodyY: hipHeight + 0.02, shoulderRX: 0.2, shoulderRZ: -0.4 }],
      [1, { shoulderLX: -0.3, elbowLX: -0.6 }],
    ],
    progress,
  );
}

/** Villager idle with an occasional gesture while talking. */
export function villagerPose(time: number, talking: boolean): Pose {
  const pose = idlePose(time, false);
  pose.wristRX = 0;
  pose.elbowRX = -0.25;
  pose.shoulderRX = -0.1;
  if (talking) {
    const gesture = Math.max(0, Math.sin(time * 2.3));
    pose.shoulderLX = -0.6 - gesture * 0.5;
    pose.elbowLX = -1.0 - gesture * 0.3;
    pose.neckX = Math.sin(time * 5) * 0.05;
    pose.neckY = Math.sin(time * 1.3) * 0.1;
  }
  return pose;
}
