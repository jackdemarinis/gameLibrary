// Procedural pixel-art textures, painted at boot from the art palette with ordered
// dithering, then sampled with nearest filtering for the late-90s console look.
import * as THREE from "three";
import { artPalette } from "../world/artPalette";
import { hash2, makeRng } from "./rng";

type Rgb = [number, number, number];

const bayer4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((value) => (value + 0.5) / 16);

function rgb(color: number): Rgb {
  return [(color >> 16) & 255, (color >> 8) & 255, color & 255];
}

/** Tileable value noise with integer period. */
function tileNoise(x: number, y: number, period: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const wrap = (value: number) => ((value % period) + period) % period;
  const a = hash2(wrap(ix), wrap(iy), seed);
  const b = hash2(wrap(ix + 1), wrap(iy), seed);
  const c = hash2(wrap(ix), wrap(iy + 1), seed);
  const d = hash2(wrap(ix + 1), wrap(iy + 1), seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Tileable fbm over a `size` pixel texture, starting at `cells` lattice cells across. */
function tileFbm(x: number, y: number, size: number, cells: number, seed: number, octaves = 3): number {
  let total = 0;
  let amplitude = 0.5;
  let norm = 0;
  let period = cells;
  for (let octave = 0; octave < octaves; octave += 1) {
    total += tileNoise((x / size) * period, (y / size) * period, period, seed + octave * 31) * amplitude;
    norm += amplitude;
    amplitude *= 0.5;
    period *= 2;
  }
  return total / norm;
}

export class PixelCanvas {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;

  constructor(width: number, height = width) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  private index(x: number, y: number): number {
    const wx = ((Math.floor(x) % this.width) + this.width) % this.width;
    const wy = ((Math.floor(y) % this.height) + this.height) % this.height;
    return (wy * this.width + wx) * 4;
  }

  set(x: number, y: number, color: number | Rgb, alpha = 255): void {
    const value = typeof color === "number" ? rgb(color) : color;
    const i = this.index(x, y);
    this.data[i] = value[0];
    this.data[i + 1] = value[1];
    this.data[i + 2] = value[2];
    this.data[i + 3] = alpha;
  }

  alpha(x: number, y: number): number {
    return this.data[this.index(x, y) + 3];
  }

  /** Pick a colour from a dark->light ramp at t in [0, 1], ordered-dithered between steps. */
  ramp(x: number, y: number, colors: readonly number[], t: number, alpha = 255): void {
    const steps = colors.length - 1;
    const scaled = Math.max(0, Math.min(1, t)) * steps;
    let step = Math.floor(scaled);
    if (scaled - step > bayer4[(y & 3) * 4 + (x & 3)]) step += 1;
    this.set(x, y, colors[Math.min(step, steps)], alpha);
  }

  /** Multiply a pixel's brightness. */
  shade(x: number, y: number, factor: number): void {
    const i = this.index(x, y);
    this.data[i] = this.data[i] * factor;
    this.data[i + 1] = this.data[i + 1] * factor;
    this.data[i + 2] = this.data[i + 2] * factor;
  }

  fill(painter: (x: number, y: number) => void): void {
    for (let y = 0; y < this.height; y += 1) for (let x = 0; x < this.width; x += 1) painter(x, y);
  }

  toTexture(options: { repeat?: boolean; mipmaps?: boolean } = {}): THREE.DataTexture {
    // DataTexture rows start at the bottom; flip so painting coordinates read top-down.
    const flipped = new Uint8Array(this.data.length);
    const row = this.width * 4;
    for (let y = 0; y < this.height; y += 1) {
      flipped.set(this.data.subarray(y * row, (y + 1) * row), (this.height - 1 - y) * row);
    }
    const texture = new THREE.DataTexture(flipped, this.width, this.height, THREE.RGBAFormat);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    const mipmaps = options.mipmaps ?? true;
    texture.generateMipmaps = mipmaps;
    texture.minFilter = mipmaps ? THREE.NearestMipmapNearestFilter : THREE.NearestFilter;
    const wrap = options.repeat === false ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    texture.wrapS = wrap;
    texture.wrapT = wrap;
    texture.needsUpdate = true;
    return texture;
  }
}

// ---------------------------------------------------------------- painters

function paintGrass(colors: readonly number[], seed: number, flowers: boolean): PixelCanvas {
  const size = 32;
  const canvas = new PixelCanvas(size);
  const rng = makeRng(seed);
  canvas.fill((x, y) => {
    const base = tileFbm(x, y, size, 4, seed) * 0.75 + hash2(x, y, seed) * 0.25;
    canvas.ramp(x, y, colors, base * 0.85);
  });
  // Grass blades: short vertical strokes, light tip over dark root.
  for (let blade = 0; blade < 70; blade += 1) {
    const x = Math.floor(rng() * size);
    const y = Math.floor(rng() * size);
    const tall = 1 + Math.floor(rng() * 3);
    canvas.set(x, y + tall, colors[1]);
    for (let step = 0; step < tall; step += 1) canvas.set(x, y + step, colors[Math.min(colors.length - 1, 3 + (step === 0 ? 1 : 0))]);
  }
  if (flowers) {
    const petals = [artPalette.flowerGold, artPalette.flowerRose, artPalette.flowerBlue];
    for (let flower = 0; flower < 4; flower += 1) {
      const x = Math.floor(rng() * size);
      const y = Math.floor(rng() * size);
      canvas.set(x, y, petals[flower % petals.length]);
      canvas.set(x, y + 1, colors[1]);
    }
  }
  return canvas;
}

function paintDirt(seed: number): PixelCanvas {
  const size = 32;
  const canvas = new PixelCanvas(size);
  const rng = makeRng(seed);
  const colors = artPalette.dirt;
  canvas.fill((x, y) => {
    canvas.ramp(x, y, colors, tileFbm(x, y, size, 4, seed) * 0.7 + hash2(x, y, seed + 1) * 0.3);
  });
  for (let pebble = 0; pebble < 16; pebble += 1) {
    const x = Math.floor(rng() * size);
    const y = Math.floor(rng() * size);
    canvas.set(x, y, colors[4]);
    canvas.set(x + 1, y, colors[3]);
    canvas.set(x, y + 1, colors[1]);
    canvas.set(x + 1, y + 1, colors[0]);
  }
  return canvas;
}

/** Voronoi stones with mortar lines and top-left lighting. */
function paintCobble(colors: readonly number[], mortar: number, seed: number, stones = 9, size = 32): PixelCanvas {
  const canvas = new PixelCanvas(size);
  const rng = makeRng(seed);
  const seeds: Array<{ x: number; y: number; tone: number }> = [];
  for (let stone = 0; stone < stones; stone += 1) seeds.push({ x: rng() * size, y: rng() * size, tone: rng() });
  canvas.fill((x, y) => {
    let best = Infinity;
    let second = Infinity;
    let owner = seeds[0];
    for (const point of seeds) {
      for (let ox = -1; ox <= 1; ox += 1) {
        for (let oy = -1; oy <= 1; oy += 1) {
          const dx = x + 0.5 - (point.x + ox * size);
          const dy = y + 0.5 - (point.y + oy * size);
          const distance = Math.hypot(dx, dy);
          if (distance < best) {
            second = best;
            best = distance;
            owner = point;
          } else if (distance < second) {
            second = distance;
          }
        }
      }
    }
    if (second - best < 1.3) {
      canvas.set(x, y, mortar);
      return;
    }
    // Light from the top-left: pixels toward the stone's lower-right edge get darker.
    const edge = Math.min(1, (second - best) / 6);
    const tone = 0.25 + owner.tone * 0.45 + edge * 0.25 + (hash2(x, y, seed) - 0.5) * 0.15;
    canvas.ramp(x, y, colors, tone);
  });
  return canvas;
}

function paintBricks(colors: readonly number[], mortar: number, seed: number, mossy: boolean, size = 32): PixelCanvas {
  const canvas = new PixelCanvas(size);
  const rowHeight = size / 4;
  const brickWidth = size / 2;
  canvas.fill((x, y) => {
    const row = Math.floor(y / rowHeight);
    const offset = row % 2 === 0 ? 0 : brickWidth / 2;
    const bx = ((x + offset) % size + size) % size;
    const inX = bx % brickWidth;
    const inY = y % rowHeight;
    if (inY === rowHeight - 1 || inX === brickWidth - 1) {
      canvas.set(x, y, mortar);
      return;
    }
    const brickId = Math.floor(bx / brickWidth) + row * 7;
    let tone = 0.3 + hash2(brickId, row, seed) * 0.35 + (hash2(x, y, seed + 3) - 0.5) * 0.2;
    if (inY === 0 || inX === 0) tone += 0.25;
    if (inY === rowHeight - 2) tone -= 0.15;
    if (mossy && tileFbm(x, y, size, 3, seed + 9) > 0.62) {
      canvas.ramp(x, y, artPalette.moss, tone);
      return;
    }
    canvas.ramp(x, y, colors, tone);
  });
  return canvas;
}

function paintPlank(colors: readonly number[], seed: number, vertical = true): PixelCanvas {
  const size = 32;
  const canvas = new PixelCanvas(size);
  canvas.fill((x, y) => {
    const along = vertical ? y : x;
    const across = vertical ? x : y;
    const plank = Math.floor(across / 8);
    const inPlank = across % 8;
    if (inPlank === 7) {
      canvas.set(x, y, colors[0]);
      return;
    }
    const grain = Math.sin((along + plank * 13) * 0.45 + tileNoise(across / 4, along / 8, 8, seed + plank) * 4) * 0.5 + 0.5;
    let tone = 0.35 + grain * 0.3 + hash2(plank, 3, seed) * 0.2;
    if (inPlank === 0) tone += 0.2;
    canvas.ramp(x, y, colors, tone);
  });
  // Nails near plank ends.
  for (let plank = 0; plank < 4; plank += 1) {
    const across = plank * 8 + 3;
    for (const along of [3, 28]) {
      if (vertical) canvas.set(across, along, artPalette.metal[3]);
      else canvas.set(along, across, artPalette.metal[3]);
    }
  }
  return canvas;
}

function paintBark(colors: readonly number[], seed: number): PixelCanvas {
  const size = 32;
  const canvas = new PixelCanvas(size);
  canvas.fill((x, y) => {
    const streak = tileNoise(x / 3, y / 12, size / 3, seed) * 0.7 + tileNoise(x / 1.5, y / 4, size / 1.5, seed + 5) * 0.3;
    canvas.ramp(x, y, colors, streak);
  });
  return canvas;
}

function paintLeaves(colors: readonly number[], seed: number): PixelCanvas {
  const size = 32;
  const canvas = new PixelCanvas(size);
  const rng = makeRng(seed);
  canvas.fill((x, y) => canvas.ramp(x, y, colors, tileFbm(x, y, size, 4, seed) * 0.4));
  // Leaf clusters: little lit-top blobs layered over the dark base.
  for (let leaf = 0; leaf < 90; leaf += 1) {
    const cx = Math.floor(rng() * size);
    const cy = Math.floor(rng() * size);
    const tone = 0.45 + rng() * 0.55;
    canvas.ramp(cx, cy, colors, tone);
    canvas.ramp(cx + 1, cy, colors, tone - 0.1);
    canvas.ramp(cx, cy + 1, colors, tone - 0.25);
    canvas.ramp(cx + 1, cy + 1, colors, tone - 0.35);
    if (rng() > 0.5) canvas.ramp(cx - 1, cy, colors, tone - 0.15);
  }
  return canvas;
}

function paintRock(colors: readonly number[], seed: number, size = 32, strata = false): PixelCanvas {
  const canvas = new PixelCanvas(size);
  const rng = makeRng(seed);
  canvas.fill((x, y) => {
    let tone = tileFbm(x, y, size, 4, seed, 4);
    if (strata) tone = tone * 0.6 + (Math.sin((y + tileNoise(x / 8, y / 8, size / 8, seed + 2) * 6) * 0.7) * 0.5 + 0.5) * 0.4;
    canvas.ramp(x, y, colors, tone);
  });
  // Cracks: short random walks in the darkest colour.
  for (let crack = 0; crack < (size / 8) * 2; crack += 1) {
    let x = Math.floor(rng() * size);
    let y = Math.floor(rng() * size);
    for (let step = 0; step < 6 + rng() * 6; step += 1) {
      canvas.set(x, y, colors[0]);
      canvas.set(x + 1, y, colors[1]);
      x += rng() > 0.5 ? 1 : 0;
      y += rng() > 0.3 ? 1 : -1;
    }
  }
  // Lichen flecks.
  for (let fleck = 0; fleck < size / 3; fleck += 1) canvas.set(Math.floor(rng() * size), Math.floor(rng() * size), artPalette.moss[2]);
  return canvas;
}

function paintRoof(colors: readonly number[], seed: number): PixelCanvas {
  const size = 32;
  const canvas = new PixelCanvas(size);
  canvas.fill((x, y) => {
    const row = Math.floor(y / 6);
    const inRow = y % 6;
    const offset = row % 2 === 0 ? 0 : 4;
    const inTile = (x + offset) % 8;
    // Scalloped bottom edge: each tile's lower corners are rounded into shadow.
    const scallop = inRow === 5 || (inRow === 4 && (inTile === 0 || inTile === 7));
    if (scallop || inTile === 0) {
      canvas.ramp(x, y, colors, 0.05);
      return;
    }
    const tone = 0.75 - inRow * 0.1 + (hash2(Math.floor((x + offset) / 8), row, seed) - 0.5) * 0.3 + (hash2(x, y, seed) - 0.5) * 0.1;
    canvas.ramp(x, y, colors, tone);
  });
  return canvas;
}

function paintThatch(seed: number): PixelCanvas {
  const size = 32;
  const canvas = new PixelCanvas(size);
  const colors = artPalette.roofThatch;
  canvas.fill((x, y) => {
    const band = y % 8;
    const straw = tileNoise(x / 1.2, y / 6, size / 1.2, seed) * 0.6 + 0.2;
    canvas.ramp(x, y, colors, band >= 6 ? 0.1 : straw + (5 - band) * 0.04);
  });
  return canvas;
}

/** Cottage wall: plaster panel with a dark timber frame and a cross brace. */
function paintTimberWall(seed: number): PixelCanvas {
  const size = 64;
  const canvas = new PixelCanvas(size);
  canvas.fill((x, y) => {
    const beam = x < 4 || x >= size - 4 || y < 4 || y >= size - 4;
    const brace = Math.abs(x - y) < 2.5 || Math.abs(x - (size - 1 - y)) < 2.5;
    const middle = Math.abs(y - size / 2) < 2;
    if (beam || brace || middle) {
      const grain = tileNoise(x / 2, y / 2, size / 2, seed + 7);
      canvas.ramp(x, y, artPalette.timber, 0.3 + grain * 0.5);
      return;
    }
    canvas.ramp(x, y, artPalette.plaster, 0.45 + tileFbm(x, y, size, 4, seed) * 0.5 - (hash2(x, y, seed) > 0.97 ? 0.4 : 0));
  });
  return canvas;
}

function paintShrineFloor(seed: number): PixelCanvas {
  const size = 32;
  const canvas = new PixelCanvas(size);
  const colors = artPalette.shrine;
  canvas.fill((x, y) => {
    const tileEdge = x % 16 === 0 || y % 16 === 0;
    if (tileEdge) {
      canvas.set(x, y, colors[0]);
      return;
    }
    const inX = x % 16;
    const inY = y % 16;
    let tone = 0.35 + tileFbm(x, y, size, 4, seed) * 0.4;
    if (inX === 1 || inY === 1) tone += 0.2;
    if (inX === 15 || inY === 15) tone -= 0.15;
    canvas.ramp(x, y, colors, tone);
  });
  // A faint rune ring in one tile.
  for (let angle = 0; angle < Math.PI * 2; angle += 0.4) {
    canvas.set(8 + Math.round(Math.cos(angle) * 4), 8 + Math.round(Math.sin(angle) * 4), colors[4]);
  }
  return canvas;
}

function paintWater(seed: number): PixelCanvas {
  const size = 32;
  const canvas = new PixelCanvas(size);
  const colors = artPalette.water;
  canvas.fill((x, y) => {
    const wave = Math.sin((x + tileNoise(x / 8, y / 8, 4, seed) * 10) * (Math.PI / 8) + y * 0.4) * 0.5 + 0.5;
    canvas.ramp(x, y, colors, wave * 0.55 + tileFbm(x, y, size, 4, seed) * 0.35);
  });
  return canvas;
}

function paintMetal(colors: readonly number[], seed: number): PixelCanvas {
  const size = 16;
  const canvas = new PixelCanvas(size);
  canvas.fill((x, y) => {
    const sheen = 1 - Math.abs((x + y * 0.3) / size - 0.55) * 1.6;
    canvas.ramp(x, y, colors, 0.25 + sheen * 0.6 + (hash2(x, y, seed) - 0.5) * 0.15);
  });
  return canvas;
}

/** Woven cloth: alternating threads, plus darker seams. */
function paintCloth(colors: readonly number[], seed: number, stripe?: number): PixelCanvas {
  const size = 16;
  const canvas = new PixelCanvas(size);
  canvas.fill((x, y) => {
    const weave = (x + y) % 2 === 0 ? 0.08 : -0.08;
    canvas.ramp(x, y, colors, 0.5 + weave + (tileFbm(x, y, size, 2, seed) - 0.5) * 0.5);
    if (stripe !== undefined && (y === 3 || y === 12)) canvas.set(x, y, stripe);
  });
  return canvas;
}

function paintLeather(seed: number): PixelCanvas {
  const size = 16;
  const canvas = new PixelCanvas(size);
  canvas.fill((x, y) => {
    canvas.ramp(x, y, artPalette.leather, 0.4 + (tileFbm(x, y, size, 4, seed) - 0.5) * 0.7);
    if (y === 2 && x % 3 === 0) canvas.set(x, y, artPalette.leather[3]);
  });
  return canvas;
}

function paintSkin(seed: number): PixelCanvas {
  const size = 8;
  const canvas = new PixelCanvas(size);
  canvas.fill((x, y) => canvas.ramp(x, y, artPalette.skin, 0.55 + (hash2(x, y, seed) - 0.5) * 0.2));
  return canvas;
}

/** Head texture wrapped on a sphere: the face sits at u = 0.25 (the sphere's +z side). */
function paintFace(skin: readonly number[], hair: readonly number[], beard: boolean): PixelCanvas {
  const width = 32;
  const height = 16;
  const canvas = new PixelCanvas(width, height);
  canvas.fill((x, y) => {
    // Hair covers the top rows and the back half.
    const back = x >= 15 || x <= 0;
    if (y < 4 || (back && y < 12)) {
      canvas.ramp(x, y, hair, 0.3 + hash2(x, y, 4) * 0.5);
      return;
    }
    canvas.ramp(x, y, skin, 0.6 - (y > 11 ? 0.2 : 0));
  });
  const cx = 8;
  // Brows, eyes (white + dark pupil), nose shadow, mouth.
  for (const side of [-1, 1]) {
    const ex = cx + side * 2 - (side > 0 ? 1 : 0);
    canvas.set(ex, 5, hair[0]);
    canvas.set(ex + 1, 5, hair[0]);
    canvas.set(ex, 7, 0xe8e2d0);
    canvas.set(ex + 1, 7, 0x1a1210);
    canvas.set(ex, 8, skin[1]);
  }
  canvas.set(cx, 9, skin[1]);
  canvas.set(cx - 1, 11, skin[0]);
  canvas.set(cx, 11, skin[0]);
  if (beard) {
    for (let x = cx - 4; x <= cx + 3; x += 1) for (let y = 10; y < 16; y += 1) if (y > 11 || x < cx - 1 || x > cx) canvas.ramp(x, y, hair, 0.4 + hash2(x, y, 2) * 0.6);
  }
  return canvas;
}

function paintShadeRobe(seed: number): PixelCanvas {
  const size = 32;
  const canvas = new PixelCanvas(size);
  canvas.fill((x, y) => {
    const fold = Math.sin(x * 0.8 + tileNoise(x / 4, y / 8, 8, seed) * 3) * 0.5 + 0.5;
    canvas.ramp(x, y, artPalette.shadeRobe, fold * 0.5 + (y / size) * 0.35);
  });
  return canvas;
}

/** Grass tuft card: blades with alpha cut-out, for instanced crossed quads. */
function paintGrassTuft(colors: readonly number[], seed: number, flowerColor?: number): PixelCanvas {
  const size = 16;
  const canvas = new PixelCanvas(size);
  const rng = makeRng(seed);
  for (let blade = 0; blade < 9; blade += 1) {
    let x = 1 + rng() * 13;
    const lean = (rng() - 0.5) * 0.6;
    const tall = 6 + Math.floor(rng() * 9);
    for (let step = 0; step < tall; step += 1) {
      const y = size - 1 - step;
      canvas.ramp(Math.round(x), y, colors, 0.25 + (step / tall) * 0.75);
      x += lean;
    }
    if (flowerColor !== undefined && blade % 4 === 0) {
      canvas.set(Math.round(x), size - tall - 1, flowerColor);
      canvas.set(Math.round(x) + 1, size - tall - 1, flowerColor);
    }
  }
  return canvas;
}

function radialCanvas(size: number, inner: number, soft: number): HTMLCanvasElement {
  const element = document.createElement("canvas");
  element.width = size;
  element.height = size;
  const context = element.getContext("2d");
  if (!context) return element;
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, `rgba(255,255,255,${inner})`);
  gradient.addColorStop(soft, `rgba(255,255,255,${inner * 0.35})`);
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return element;
}

// ---------------------------------------------------------------- library

function build() {
  return {
    grass: paintGrass(artPalette.grass, 11, true).toTexture(),
    grassForest: paintGrass(artPalette.grassForest, 12, false).toTexture(),
    dirt: paintDirt(13).toTexture(),
    cobble: paintCobble(artPalette.cobble, artPalette.mortar, 14).toTexture(),
    flagstone: paintCobble(artPalette.brick, artPalette.mortar, 15, 5).toTexture(),
    stoneBrick: paintBricks(artPalette.brick, artPalette.mortar, 16, false).toTexture(),
    mossBrick: paintBricks(artPalette.brick, artPalette.mortar, 17, true).toTexture(),
    shrineBrick: paintBricks(artPalette.shrine, 0x0d0a14, 18, false).toTexture(),
    shrineFloor: paintShrineFloor(19).toTexture(),
    plank: paintPlank(artPalette.wood, 20).toTexture(),
    plankFlat: paintPlank(artPalette.wood, 21, false).toTexture(),
    bark: paintBark(artPalette.bark, 22).toTexture(),
    leaves: paintLeaves(artPalette.leaf, 23).toTexture(),
    pine: paintLeaves(artPalette.pine, 24).toTexture(),
    rock: paintRock(artPalette.rock, 25).toTexture(),
    cliff: paintRock(artPalette.cliff, 26, 64, true).toTexture(),
    roofRed: paintRoof(artPalette.roofRed, 27).toTexture(),
    roofBlue: paintRoof(artPalette.roofBlue, 28).toTexture(),
    thatch: paintThatch(29).toTexture(),
    timberWall: paintTimberWall(30).toTexture(),
    water: paintWater(31).toTexture(),
    steel: paintMetal(artPalette.metal, 32).toTexture(),
    gold: paintMetal(artPalette.gold, 33).toTexture(),
    wardenPlate: paintMetal(artPalette.wardenPlate, 34).toTexture(),
    tunic: paintCloth(artPalette.tunicTeal, 35).toTexture(),
    scarf: paintCloth(artPalette.scarfRust, 36, artPalette.gold[3]).toTexture(),
    robe: paintCloth(artPalette.robeElder, 37, artPalette.gold[2]).toTexture(),
    apron: paintCloth(artPalette.apron, 38).toTexture(),
    leather: paintLeather(39).toTexture(),
    boots: paintCloth(artPalette.boots, 40).toTexture(),
    skin: paintSkin(41).toTexture(),
    heroFace: paintFace(artPalette.skin, artPalette.hairBrown, false).toTexture({ repeat: false }),
    elderFace: paintFace(artPalette.skin, artPalette.hairGrey, true).toTexture({ repeat: false }),
    smithFace: paintFace(artPalette.skin, artPalette.hairBrown, true).toTexture({ repeat: false }),
    hair: paintCloth(artPalette.hairBrown, 42).toTexture(),
    hairGrey: paintCloth(artPalette.hairGrey, 43).toTexture(),
    shadeRobe: paintShadeRobe(44).toTexture(),
    huskBark: paintBark(artPalette.huskBark, 45).toTexture(),
    grassTuft: paintGrassTuft(artPalette.grass, 46).toTexture({ repeat: false, mipmaps: false }),
    flowerTuft: paintGrassTuft(artPalette.grass, 47, artPalette.flowerGold).toTexture({ repeat: false, mipmaps: false }),
    forestTuft: paintGrassTuft(artPalette.grassForest, 48).toTexture({ repeat: false, mipmaps: false }),
    glow: new THREE.CanvasTexture(radialCanvas(64, 1, 0.3)),
    blobShadow: new THREE.CanvasTexture(radialCanvas(32, 0.85, 0.55)),
  };
}

export type TextureLibrary = ReturnType<typeof build>;

let library: TextureLibrary | null = null;

export function textures(): TextureLibrary {
  if (!library) library = build();
  return library;
}
