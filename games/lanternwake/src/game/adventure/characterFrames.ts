// Animated character frames for Lanternwake, drawn procedurally onto a small pixel grid
// so every pose (run, sword swing, dodge roll, hurt) shares one consistent body.
import { adventureTheme as t } from "../config/adventureTheme";
import { bossSprite, type PixelSprite } from "./adventureSprites";

/** A tiny paint surface of palette characters; '.' is transparent. */
class PixelGrid {
  private readonly cells: string[][];

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.cells = Array.from({ length: height }, () => Array<string>(width).fill("."));
  }

  px(x: number, y: number, c: string): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix >= 0 && iy >= 0 && ix < this.width && iy < this.height) {
      this.cells[iy][ix] = c;
    }
  }

  get(x: number, y: number): string {
    return this.cells[y]?.[x] ?? ".";
  }

  rect(x: number, y: number, w: number, h: number, c: string): void {
    for (let j = 0; j < h; j += 1) {
      for (let i = 0; i < w; i += 1) {
        this.px(x + i, y + j, c);
      }
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, c: string, thick = 1): void {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let s = 0; s <= steps; s += 1) {
      const x = x0 + ((x1 - x0) * s) / steps;
      const y = y0 + ((y1 - y0) * s) / steps;
      this.rect(Math.round(x - (thick - 1) / 2), Math.round(y - (thick - 1) / 2), thick, thick, c);
    }
  }

  disc(cx: number, cy: number, r: number, c: string): void {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y += 1) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x += 1) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.3) {
          this.px(x, y, c);
        }
      }
    }
  }

  /** Rings every painted shape with a one-pixel outline so sprites read at night. */
  outline(c: string): void {
    const marks: [number, number][] = [];
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        if (this.get(x, y) !== ".") continue;
        const touches = [this.get(x - 1, y), this.get(x + 1, y), this.get(x, y - 1), this.get(x, y + 1)].some(
          (n) => n !== "." && n !== c,
        );
        if (touches) marks.push([x, y]);
      }
    }
    marks.forEach(([x, y]) => this.px(x, y, c));
  }

  rows(): string[] {
    return this.cells.map((row) => row.join(""));
  }
}

// ---------------------------------------------------------------- the lantern-keeper

export type KeeperDir = "down" | "up" | "side";
export type KeeperPose = "idle" | "run" | "attack" | "hurt" | "roll";

export const keeperFrameCounts: Record<KeeperPose, number> = { idle: 2, run: 6, attack: 4, hurt: 1, roll: 4 };
/** Seconds each frame is held, per pose (attack and roll are driven by their own timers). */
export const keeperFrameSeconds = { idle: 0.45, run: 0.085 } as const;
/** The keeper's grid is 32x32 art pixels; the feet sit on this row. */
export const keeperFeetRow = 29;
export const keeperGridSize = 32;
export const keeperScale = 3;

export function keeperTextureKey(lit: boolean, dir: KeeperDir, pose: KeeperPose, frame: number): string {
  // The roll is a ball, the same from every side.
  const d = pose === "roll" ? "any" : dir;
  return `lwKeeper${lit ? "Lit" : "Dim"}_${d}_${pose}${frame}`;
}

const keeperBasePalette = {
  h: t.hair,
  H: t.hairDark,
  s: t.skin,
  S: t.skinShade,
  e: t.eye,
  t: t.tunic,
  T: t.tunicDark,
  b: t.belt,
  p: t.pants,
  P: t.pantsBack,
  B: t.boots,
  g: t.hilt,
  o: t.keeperOutline,
};
const keeperDimPalette = { ...keeperBasePalette, w: t.bladeLight, W: t.bladeDark, l: t.staffKnot, L: t.stoneMid };
const keeperLitPalette = { ...keeperBasePalette, w: t.emberBlade, W: t.emberBladeEdge, l: t.lanternBody, L: t.lanternCore };

/** A short sword: grip behind the hand, crossguard, then a two-tone blade along `angle` (degrees). */
function drawSword(g: PixelGrid, hx: number, hy: number, angle: number): void {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const nx = -dy;
  const ny = dx;
  g.line(hx - dx * 2, hy - dy * 2, hx, hy, "b");
  g.line(hx + dx + nx * 1.6, hy + dy + ny * 1.6, hx + dx - nx * 1.6, hy + dy - ny * 1.6, "g");
  g.line(hx + dx * 2, hy + dy * 2, hx + dx * 11, hy + dy * 11, "w");
  g.line(hx + dx * 2 + nx * 0.8, hy + dy * 2 + ny * 0.8, hx + dx * 10 + nx * 0.8, hy + dy * 10 + ny * 0.8, "W");
  g.px(hx + dx * 12, hy + dy * 12, "w");
}

function drawArm(g: PixelGrid, sx: number, sy: number, hx: number, hy: number, sleeve: string): void {
  g.line(sx, sy, hx, hy, sleeve, 2);
  g.rect(Math.round(hx) - 1, Math.round(hy) - 1, 2, 2, "s");
}

/** Leg from hip to foot, with a boot. `toe` is the boot's facing: 1 right, 0 front. */
function drawLeg(g: PixelGrid, hipX: number, hipY: number, footX: number, footY: number, cloth: string, toe: number): void {
  g.line(hipX, hipY, footX, footY - 1, cloth, 2);
  g.rect(Math.round(footX) - 1, Math.round(footY) - 1, 3, 2, "B");
  if (toe > 0) g.px(Math.round(footX) + 2, Math.round(footY), "B");
}

interface SwingKey {
  hand: [number, number];
  angle: number;
  behind?: boolean;
}

// Sword swings, frame by frame: wind-up, cut, follow-through, recover.
const sideSwing: SwingKey[] = [
  { hand: [13, 11], angle: -150, behind: true },
  { hand: [20, 12], angle: -50 },
  { hand: [22, 17], angle: 15 },
  { hand: [20, 20], angle: 60 },
];
const downSwing: SwingKey[] = [
  { hand: [23, 13], angle: -45 },
  { hand: [23, 20], angle: 25 },
  { hand: [17, 23], angle: 90 },
  { hand: [10, 21], angle: 150 },
];
const upSwing: SwingKey[] = [
  { hand: [9, 16], angle: -160, behind: true },
  { hand: [12, 10], angle: -115, behind: true },
  { hand: [19, 9], angle: -65, behind: true },
  { hand: [23, 14], angle: -20, behind: true },
];

function drawKeeper(dir: KeeperDir, pose: KeeperPose, frame: number): PixelGrid {
  const g = new PixelGrid(keeperGridSize, keeperGridSize);
  const feet = keeperFeetRow;

  if (pose === "roll") {
    const a = (frame * Math.PI) / 2;
    const cx = 16;
    const cy = feet - 6;
    g.disc(cx, cy, 6.2, "t");
    g.disc(cx + Math.cos(a + 2.4) * 2, cy + Math.sin(a + 2.4) * 2, 3, "T");
    g.disc(cx + Math.cos(a) * 3.4, cy + Math.sin(a) * 3.4, 3, "h");
    g.disc(cx + Math.cos(a + Math.PI) * 3.8, cy + Math.sin(a + Math.PI) * 3.8, 1.6, "B");
    g.px(cx + Math.cos(a + 1.2) * 4.5, cy + Math.sin(a + 1.2) * 4.5, "s");
    g.outline("o");
    return g;
  }

  const phase = (frame / keeperFrameCounts.run) * Math.PI * 2;
  const running = pose === "run";
  const attacking = pose === "attack";
  const hurt = pose === "hurt";
  // Bodies bob up on the passing steps; the idle breath dips the head only.
  const bob = running ? -Math.round(Math.abs(Math.sin(phase)) * 1.4) : 0;
  const headBob = pose === "idle" && frame === 1 ? 1 : 0;
  const lean = hurt ? -1 : 0;
  const hipY = feet - 8 + bob;
  const torsoTop = feet - 15 + bob;
  const headTop = feet - 25 + bob + headBob;

  if (dir === "side") {
    // Legs: stride forward/back while running; lunge stance while swinging.
    let front = 18;
    let back = 14;
    let frontLift = 0;
    let backLift = 0;
    if (running) {
      const swing = Math.sin(phase) * 4;
      front = 16 + swing;
      back = 16 - swing;
      frontLift = Math.max(0, Math.cos(phase)) * 2;
      backLift = Math.max(0, -Math.cos(phase)) * 2;
    } else if (attacking && frame > 0) {
      front = 21;
      back = 12;
    }
    drawLeg(g, 15 + lean, hipY, back + lean, feet - backLift, "P", 1);

    // Back arm swings opposite the front leg.
    const armSwing = running ? -Math.sin(phase) * 3 : 0;
    drawArm(g, 15 + lean, torsoTop + 2, 14 + armSwing + lean, torsoTop + 6, "T");

    drawLeg(g, 17 + lean, hipY, front + lean, feet - frontLift, "p", 1);

    // Torso, belt and the lantern hanging at the hip.
    g.rect(13 + lean, torsoTop, 7, 8, "t");
    g.rect(13 + lean, torsoTop, 2, 8, "T");
    g.rect(13 + lean, torsoTop + 6, 7, 1, "b");
    g.rect(12 + lean, torsoTop + 6, 2, 3, "l");
    g.px(12 + lean, torsoTop + 7, "L");

    const swingKey = attacking ? sideSwing[frame] : null;
    if (swingKey?.behind) drawSword(g, swingKey.hand[0], swingKey.hand[1] + bob, swingKey.angle);

    // Head: big chibi head, hair swept back, one eye toward the facing.
    const hx = 11 + lean;
    g.rect(hx, headTop, 10, 9, "s");
    g.rect(hx + 8, headTop + 6, 2, 2, "S");
    g.rect(hx, headTop - 1, 9, 3, "h");
    g.rect(hx, headTop, 4, 7, "h");
    g.rect(hx + 1, headTop - 1, 5, 1, "H");
    g.px(hx + 9, headTop + 1, "h");
    if (hurt) {
      g.rect(hx + 6, headTop + 4, 2, 1, "e");
    } else {
      g.rect(hx + 7, headTop + 3, 1, 2, "e");
    }

    // Front arm with the sword.
    if (swingKey) {
      drawArm(g, 17, torsoTop + 2, swingKey.hand[0], swingKey.hand[1] + bob, "t");
      if (!swingKey.behind) drawSword(g, swingKey.hand[0], swingKey.hand[1] + bob, swingKey.angle);
    } else if (hurt) {
      drawArm(g, 17 + lean, torsoTop + 2, 15, torsoTop - 2, "t");
      drawSword(g, 15, torsoTop - 2, -110);
    } else {
      const hand: [number, number] = [19 + (running ? Math.sin(phase) * 1.5 : 0), torsoTop + 6];
      drawArm(g, 17, torsoTop + 2, hand[0], hand[1], "t");
      drawSword(g, hand[0], hand[1], -60);
    }
    g.outline("o");
    return g;
  }

  // Facing the camera or away from it: legs side by side, lifting alternately.
  const leftLift = running ? Math.max(0, Math.sin(phase)) * 2 : 0;
  const rightLift = running ? Math.max(0, -Math.sin(phase)) * 2 : 0;
  const swingKeys = dir === "down" ? downSwing : upSwing;
  const swingKey = attacking ? swingKeys[frame] : null;
  const facingUp = dir === "up";

  if (swingKey?.behind) drawSword(g, swingKey.hand[0], swingKey.hand[1] + bob, swingKey.angle);
  if (facingUp && !swingKey) {
    // From behind, the resting blade rises past the shoulder, behind the head.
    drawSword(g, 21, torsoTop + 5, -80);
  }

  drawLeg(g, 14, hipY, 14, feet - leftLift, "p", 0);
  drawLeg(g, 18, hipY, 18, feet - rightLift, "p", 0);

  g.rect(12, torsoTop, 8, 8, "t");
  g.rect(facingUp ? 12 : 15, torsoTop, facingUp ? 8 : 2, facingUp ? 2 : 8, "T");
  g.rect(12, torsoTop + 6, 8, 1, "b");
  if (!facingUp) {
    g.rect(19, torsoTop + 6, 2, 3, "l");
    g.px(19, torsoTop + 7, "L");
  }

  // Arms swing with the stride; the right one carries the sword.
  const armSwing = running ? Math.sin(phase) * 2 : 0;
  drawArm(g, 11, torsoTop + 1, 10, torsoTop + 6 + armSwing, "T");

  const hx = 11;
  if (facingUp) {
    g.rect(hx, headTop, 10, 9, "h");
    g.rect(hx + 2, headTop + 1, 6, 1, "H");
    g.rect(hx + 1, headTop + 5, 8, 1, "H");
    g.px(hx - 1, headTop + 4, "s");
    g.px(hx + 10, headTop + 4, "s");
  } else {
    g.rect(hx, headTop, 10, 9, "s");
    g.rect(hx, headTop + 7, 10, 2, "S");
    g.rect(hx, headTop - 1, 10, 3, "h");
    g.rect(hx, headTop, 2, 6, "h");
    g.rect(hx + 8, headTop, 2, 6, "h");
    g.px(hx + 3, headTop + 2, "h");
    g.px(hx + 6, headTop + 2, "H");
    if (hurt) {
      g.rect(hx + 2, headTop + 4, 2, 1, "e");
      g.rect(hx + 6, headTop + 4, 2, 1, "e");
    } else {
      g.rect(hx + 3, headTop + 4, 1, 2, "e");
      g.rect(hx + 6, headTop + 4, 1, 2, "e");
    }
  }

  if (swingKey) {
    drawArm(g, 20, torsoTop + 1, swingKey.hand[0], swingKey.hand[1] + bob, "t");
    if (!swingKey.behind) drawSword(g, swingKey.hand[0], swingKey.hand[1] + bob, swingKey.angle);
  } else if (hurt) {
    drawArm(g, 20, torsoTop + 1, 22, torsoTop - 2, "t");
    drawSword(g, 22, torsoTop - 2, -70);
  } else {
    const hand: [number, number] = [21, torsoTop + 6 - armSwing];
    drawArm(g, 20, torsoTop + 1, hand[0], hand[1], "t");
    if (!facingUp) drawSword(g, hand[0], hand[1], -80);
  }
  g.outline("o");
  return g;
}

const keeperDirs: KeeperDir[] = ["down", "up", "side"];
const keeperPoses: KeeperPose[] = ["idle", "run", "attack", "hurt", "roll"];

function buildKeeperSprites(): PixelSprite[] {
  const sprites: PixelSprite[] = [];
  for (const lit of [false, true]) {
    for (const pose of keeperPoses) {
      const dirs: KeeperDir[] = pose === "roll" ? ["side"] : keeperDirs;
      for (const dir of dirs) {
        for (let frame = 0; frame < keeperFrameCounts[pose]; frame += 1) {
          sprites.push({
            key: keeperTextureKey(lit, dir, pose, frame),
            scale: keeperScale,
            rows: drawKeeper(dir, pose, frame).rows(),
            palette: lit ? keeperLitPalette : keeperDimPalette,
          });
        }
      }
    }
  }
  return sprites;
}

// ---------------------------------------------------------------- shades

export type ShadePose = "float" | "windup" | "lunge" | "hurt";
export const shadeFrameCounts: Record<ShadePose, number> = { float: 4, windup: 2, lunge: 1, hurt: 1 };

export function shadeTextureKey(pose: ShadePose, frame: number): string {
  return `lwShade_${pose}${frame}`;
}

function drawShade(pose: ShadePose, frame: number): PixelGrid {
  const g = new PixelGrid(22, 22);
  // Squash before the lunge, stretch during it.
  const squash = pose === "windup" ? 1 + frame : 0;
  const stretch = pose === "lunge" ? 2 : 0;
  const top = 2 + squash - stretch;
  const halfW = 7 + (squash > 0 ? 1 : 0) - (stretch > 0 ? 1 : 0);
  const cx = 11;
  g.disc(cx, top + halfW, halfW, "B");
  g.rect(cx - halfW, top + halfW, halfW * 2 + 1, 7 - squash + stretch, "B");
  // A wavy tail that ripples frame to frame.
  const tailY = top + halfW + 7 - squash + stretch;
  for (let x = cx - halfW; x <= cx + halfW; x += 1) {
    const wave = Math.sin((x + frame * 2) * 1.1);
    const len = 2 + Math.round(wave * 1.5);
    g.rect(x, tailY, 1, Math.max(0, len), (x + frame) % 3 === 0 ? "D" : "B");
  }
  g.rect(cx - halfW + 1, top + halfW - 2, 2, 5, "L");
  // Face.
  const eyeY = top + halfW - 1;
  if (pose === "hurt") {
    g.line(cx - 4, eyeY - 1, cx - 2, eyeY + 1, "w");
    g.line(cx - 4, eyeY + 1, cx - 2, eyeY - 1, "w");
    g.line(cx + 2, eyeY - 1, cx + 4, eyeY + 1, "w");
    g.line(cx + 2, eyeY + 1, cx + 4, eyeY - 1, "w");
  } else {
    const big = pose === "windup" || pose === "lunge" ? 1 : 0;
    g.rect(cx - 4, eyeY - big, 2 + big, 2 + big, "e");
    g.rect(cx + 2, eyeY - big, 2 + big, 2 + big, "e");
  }
  if (pose === "windup" || pose === "lunge") {
    g.rect(cx - 2, eyeY + 3, 5, 3, "m");
    g.px(cx - 1, eyeY + 3, "w");
    g.px(cx + 1, eyeY + 3, "w");
  } else {
    g.rect(cx - 1, eyeY + 3, 3, 1, "m");
  }
  g.outline("o");
  return g;
}

const shadePalette = { o: t.shadeOutline, B: t.shadeBody, D: t.shadeOutline, L: t.staggerTint, e: t.shadeEye, m: t.shadeMouth, w: t.mushroomSpot };

function buildShadeSprites(): PixelSprite[] {
  return (Object.keys(shadeFrameCounts) as ShadePose[]).flatMap((pose) =>
    Array.from({ length: shadeFrameCounts[pose] }, (_, frame) => ({
      key: shadeTextureKey(pose, frame),
      scale: 3,
      rows: drawShade(pose, frame).rows(),
      palette: shadePalette,
    })),
  );
}

// ---------------------------------------------------------------- the Mirewarden

export type BossPose = "idle" | "charge" | "hurt";
export const bossFrameCounts: Record<BossPose, number> = { idle: 4, charge: 2, hurt: 1 };

export function bossTextureKey(pose: BossPose, frame: number): string {
  return `lwBoss_${pose}${frame}`;
}

/** Shifts the iris inside the eye-white rows so the eye glances around. */
function glance(rows: readonly string[], shift: number): string[] {
  return rows.map((row, y) => {
    if (y < 4 || y > 9 || shift === 0) return row;
    const chars = row.split("");
    const iris = chars.map((c, x) => (c === "r" || c === "R" ? x : -1)).filter((x) => x >= 0);
    if (!iris.length) return row;
    const out = chars.map((c) => (c === "r" || c === "R" ? "w" : c));
    iris.forEach((x) => {
      out[x + shift] = chars[x];
    });
    return out.join("");
  });
}

/** Ripples the bottom tendrils by sliding the last rows a pixel either way. */
function ripple(rows: readonly string[], frame: number): string[] {
  return rows.map((row, y) => {
    if (y < rows.length - 3) return row;
    const s = (frame + y) % 2 === 0 ? 1 : -1;
    return s > 0 ? `.${row.slice(0, -1)}` : `${row.slice(1)}.`;
  });
}

function buildBossSprites(): PixelSprite[] {
  const base = bossSprite.rows;
  const charged = { ...bossSprite.palette, w: t.pulse, r: t.lanternCore, R: t.bossIris, M: t.bossBody };
  const idleRows = [glance(ripple(base, 0), 0), glance(ripple(base, 1), -1), glance(ripple(base, 0), 0), glance(ripple(base, 1), 1)];
  const hurtRows = base.map((row, y) => (y >= 4 && y <= 9 ? row.replace(/[wrR]/g, y === 6 || y === 7 ? "T" : "M") : row));
  return [
    ...idleRows.map((rows, frame) => ({ key: bossTextureKey("idle", frame), scale: 4, rows, palette: bossSprite.palette })),
    { key: bossTextureKey("charge", 0), scale: 4, rows: ripple(base, 0), palette: charged },
    { key: bossTextureKey("charge", 1), scale: 4, rows: ripple(base, 1), palette: { ...charged, w: t.bossIris } },
    { key: bossTextureKey("hurt", 0), scale: 4, rows: hurtRows, palette: bossSprite.palette },
  ];
}

// ---------------------------------------------------------------- effects and pickups

export const slashFrameCount = 4;
export function slashTextureKey(lit: boolean, frame: number): string {
  return `lwSlash${lit ? "Lit" : "Dim"}${frame}`;
}

/** A crescent smear pointing right (+x); the scene rotates it to the swing direction. */
function drawSlash(frame: number): PixelGrid {
  const g = new PixelGrid(30, 30);
  const spans = [
    [-80, -30, 1],
    [-80, 30, 3],
    [-40, 75, 3],
    [20, 80, 1],
  ] as const;
  const [from, to, width] = spans[frame];
  for (let a = from; a <= to; a += 2) {
    const rad = (a * Math.PI) / 180;
    // Thickest in the middle of the arc.
    const mid = 1 - Math.abs((a - (from + to) / 2) / ((to - from) / 2 || 1));
    const w = Math.max(1, Math.round(width * (0.4 + mid * 0.6)));
    for (let r = 0; r < w + 1; r += 1) {
      const radius = 13 - r;
      g.px(15 + Math.cos(rad) * radius, 15 + Math.sin(rad) * radius, r === 0 ? "e" : "c");
    }
  }
  return g;
}

function buildSlashSprites(): PixelSprite[] {
  return [false, true].flatMap((lit) =>
    Array.from({ length: slashFrameCount }, (_, frame) => ({
      key: slashTextureKey(lit, frame),
      scale: 3,
      rows: drawSlash(frame).rows(),
      palette: lit ? { c: t.slashEmber, e: t.slashEmberEdge } : { c: t.slashSteel, e: t.slashSteelEdge },
    })),
  );
}

export const heartSprite: PixelSprite = {
  key: "lwHeart",
  scale: 3,
  rows: [
    ".oo...oo.",
    "orroorrro",
    "ohrrrrrro",
    "orrrrrrro",
    ".orrrrro.",
    "..orrro..",
    "...oro...",
    "....o....",
  ],
  palette: { o: t.heartOutline, r: t.heart, h: t.heartShine },
};

const swordItemRows = [
  ".........ow",
  "........owW",
  ".......owWo",
  "......owWo.",
  ".....owWo..",
  "..o.owWo...",
  "..ogowo....",
  "...ogo.....",
  "..obogo....",
  ".obo.o.....",
  ".oo........",
];

export const swordItemSprite: PixelSprite = {
  key: "lwItemSword",
  scale: 4,
  rows: swordItemRows,
  palette: { o: t.keeperOutline, w: t.bladeLight, W: t.bladeDark, g: t.hilt, b: t.belt },
};

export const emberSwordItemSprite: PixelSprite = {
  key: "lwItemEmberSword",
  scale: 4,
  rows: swordItemRows,
  palette: { o: t.keeperOutline, w: t.emberBlade, W: t.emberBladeEdge, g: t.hilt, b: t.belt },
};

export const characterSprites: readonly PixelSprite[] = [
  ...buildKeeperSprites(),
  ...buildShadeSprites(),
  ...buildBossSprites(),
  ...buildSlashSprites(),
  heartSprite,
  swordItemSprite,
  emberSwordItemSprite,
];
