import { menuArtTheme as art } from "../game/config/theme";

/**
 * Pixel art for the Dustline title screen.
 *
 * Everything is painted at art resolution (one array cell per art pixel) from simple
 * shape tests, then exported as a tiny PNG that CSS scales up with
 * `image-rendering: pixelated`. Shapes get a 1px inner outline automatically, and
 * shading ramps dither only across their narrow transition bands.
 */

type Inside = (x: number, y: number) => boolean;
type Shade = (x: number, y: number) => number;
type Map2d = (x: number, y: number) => [number, number];

class PixelCanvas {
  private readonly pixels: Array<number | null>;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.pixels = new Array<number | null>(width * height).fill(null);
  }

  set(x: number, y: number, color: number): void {
    if (x >= 0 && y >= 0 && x < this.width && y < this.height) {
      this.pixels[y * this.width + x] = color;
    }
  }

  get(x: number, y: number): number | null {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return null;
    }
    return this.pixels[y * this.width + x];
  }

  /** Paints every pixel whose centre is inside the shape; edge pixels take the outline colour. */
  fill(inside: Inside, shade: Shade, outline: number | null = art.outline, map?: Map2d): void {
    const test = (x: number, y: number): boolean => {
      const [u, v] = map ? map(x, y) : [x, y];
      return inside(u, v);
    };
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const cx = x + 0.5;
        const cy = y + 0.5;
        if (!test(cx, cy)) {
          continue;
        }
        const isEdge = !test(cx + 1, cy) || !test(cx - 1, cy) || !test(cx, cy + 1) || !test(cx, cy - 1);
        if (isEdge && outline !== null) {
          this.set(x, y, outline);
        } else {
          const [u, v] = map ? map(cx, cy) : [cx, cy];
          this.set(x, y, shade(u, v));
        }
      }
    }
  }

  toDataUrl(): string {
    const canvas = document.createElement("canvas");
    canvas.width = this.width;
    canvas.height = this.height;
    const context = canvas.getContext("2d");
    if (!context) {
      return "";
    }
    const image = context.createImageData(this.width, this.height);
    this.pixels.forEach((color, index) => {
      if (color === null) {
        return;
      }
      const offset = index * 4;
      image.data[offset] = (color >> 16) & 0xff;
      image.data[offset + 1] = (color >> 8) & 0xff;
      image.data[offset + 2] = color & 0xff;
      image.data[offset + 3] = 0xff;
    });
    context.putImageData(image, 0, 0);
    return canvas.toDataURL("image/png");
  }
}

// ---- shapes -------------------------------------------------------------

function polygon(points: Array<[number, number]>): Inside {
  return (x, y) => {
    let isInside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        isInside = !isInside;
      }
    }
    return isInside;
  };
}

function circle(cx: number, cy: number, radius: number): Inside {
  return (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function segment(ax: number, ay: number, bx: number, by: number, radius: number): Inside {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  return (x, y) => {
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSquared));
    return (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2 <= radius ** 2;
  };
}

function stadium(x0: number, y0: number, x1: number, y1: number): Inside {
  const radius = (y1 - y0) / 2;
  const midY = y0 + radius;
  return (x, y) =>
    y >= y0 && y <= y1 && ((x >= x0 + radius && x <= x1 - radius) || circle(x0 + radius, midY, radius)(x, y) || circle(x1 - radius, midY, radius)(x, y));
}

function union(...shapes: Inside[]): Inside {
  return (x, y) => shapes.some((shape) => shape(x, y));
}

/** Maps output pixels back into an unrotated drawing so sprites can be painted at any angle. */
function rotateAbout(cx: number, cy: number, angle: number): Map2d {
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  return (x, y) => [cx + (x - cx) * cos - (y - cy) * sin, cy + (x - cx) * sin + (y - cy) * cos];
}

// ---- shading ------------------------------------------------------------

const bayer4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((value) => (value + 0.5) / 16));

/** Picks a ramp colour for t in 0..1, checker-dithering only near each step. */
function rampAt(ramp: readonly number[], t: number, x: number, y: number): number {
  const value = Math.max(0, Math.min(1, t)) * (ramp.length - 1);
  const base = Math.floor(value);
  const fraction = value - base;
  let index = base;
  if (fraction > 0.62) {
    index = base + 1;
  } else if (fraction > 0.38) {
    index = (Math.floor(x) + Math.floor(y)) % 2 === 0 ? base + 1 : base;
  }
  return ramp[Math.min(ramp.length - 1, index)];
}

function verticalRamp(ramp: readonly number[], top: number, bottom: number): Shade {
  return (x, y) => rampAt(ramp, (y - top) / (bottom - top), x, y);
}

// ---- noise for the camo field ------------------------------------------

function hash(x: number, y: number, seed: number): number {
  let value = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function valueNoise(x: number, y: number, cell: number, seed: number): number {
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  const fx = x / cell - gx;
  const fy = y / cell - gy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = hash(gx, gy, seed) * (1 - sx) + hash(gx + 1, gy, seed) * sx;
  const bottom = hash(gx, gy + 1, seed) * (1 - sx) + hash(gx + 1, gy + 1, seed) * sx;
  return top * (1 - sy) + bottom * sy;
}

// ---- sprites -------------------------------------------------------------

/** Full-screen camo field with diagonal light streaks and a stepped vignette. */
function paintBackdrop(): PixelCanvas {
  const width = 240;
  const height = 135;
  const canvas = new PixelCanvas(width, height);
  const camo = art.camo;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      // Stretched noise gives the long, torn blobs of a woodland camo print.
      const blob = valueNoise(x * 0.8, y * 1.15, 26, 11) * 0.62 + valueNoise(x, y, 9, 23) * 0.38;
      let level = blob < 0.36 ? 1 : blob < 0.5 ? 2 : blob < 0.63 ? 3 : 4;

      // Two diagonal light shafts across the field.
      const diagonal = x * 0.55 - y;
      if (diagonal > 52 && diagonal < 76) {
        level += 1;
      }
      if (diagonal > 112 && diagonal < 117) {
        level += 1;
      }

      // Stepped, ordered-dither vignette toward the corners.
      const nx = (x - width / 2) / (width / 2);
      const ny = (y - height / 2) / (height / 2);
      const falloff = (nx * nx * 0.7 + ny * ny) - 0.55;
      if (falloff > 0) {
        level -= Math.floor(falloff * 3.2 + bayer4[y % 4][x % 4]);
      }

      canvas.set(x, y, camo[Math.max(0, Math.min(camo.length - 1, level))]);
    }
  }
  return canvas;
}

/** Side-on hero tank, barrel to the right, firing. */
function paintTank(): PixelCanvas {
  const canvas = new PixelCanvas(132, 60);
  const tank = art.tank;

  // Radio antenna, behind everything.
  canvas.fill(segment(34, 14, 27, 1, 0.6), () => art.outline, null);
  canvas.set(27, 1, art.decal);

  // Tracks: dark link pattern around a mid band.
  canvas.fill(stadium(5, 39, 97, 59), (x, y) => {
    const isLinkRow = y < 42 || y > 56;
    if (!isLinkRow) {
      return art.treadMid;
    }
    return Math.floor(x) % 4 < 2 ? art.treadLight : art.treadDark;
  });
  for (let wheelX = 15; wheelX <= 88; wheelX += 12.1) {
    const cx = wheelX;
    const cy = 50;
    canvas.fill(circle(cx, cy, 6.2), (x, y) => {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= 3.2) {
        return art.hub;
      }
      return x - cx + (y - cy) < -2.5 ? art.wheelLight : art.wheelFace;
    });
  }

  // Hull: lit top deck, then the shaded side skirt.
  canvas.fill(polygon([[14, 30], [84, 30], [98, 37], [4, 37]]), verticalRamp(tank.slice(0, 3), 30, 37));
  canvas.fill(
    polygon([[2, 37], [99, 37], [104, 41], [97, 45], [8, 45], [1, 41]]),
    verticalRamp(tank.slice(1), 37, 45),
  );
  for (let x = 14; x <= 90; x += 8) {
    if (canvas.get(x, 40) !== art.outline) {
      canvas.set(x, 40, art.rivet);
    }
  }

  // Turret, cupola and mantlet.
  canvas.fill(polygon([[34, 10], [50, 10], [53, 17], [31, 17]]), verticalRamp(tank.slice(0, 3), 10, 17));
  canvas.fill(polygon([[29, 16], [62, 16], [72, 22], [74, 31], [22, 31], [24, 22]]), verticalRamp(tank.slice(0, 4), 16, 31));
  canvas.fill(polygon([[70, 18], [78, 18], [78, 29], [70, 29]]), verticalRamp(tank.slice(1, 4), 18, 29));

  // Barrel and muzzle brake.
  const barrelY = (x: number): number => 23 + ((x - 76) * (19.5 - 23)) / (104 - 76);
  canvas.fill(segment(76, 23, 104, 19.5, 3.1), (x, y) => rampAt(tank.slice(0, 4), (y - barrelY(x) + 3.1) / 6.2, x, y));
  canvas.fill(polygon([[100, 14], [110, 13.5], [110, 24.5], [100, 25]]), verticalRamp(tank.slice(1, 4), 13.5, 25));

  // Muzzle flash.
  const flashX = 119;
  const flashY = 19;
  canvas.fill(
    union(
      circle(flashX, flashY, 5.5),
      (x, y) => Math.abs(x - flashX) / 13 + Math.abs(y - flashY) / 4.5 <= 1,
      (x, y) => Math.abs(x - flashX) / 4.5 + Math.abs(y - flashY) / 10 <= 1,
    ),
    (x, y) => {
      const distance = Math.hypot(x - flashX, y - flashY);
      return distance < 2.6 ? art.flash[0] : distance < 4.8 ? art.flash[1] : art.flash[2];
    },
    art.flashEdge,
  );

  // Turret star decal.
  const star = ["..#..", "#####", ".###.", ".#.#."];
  star.forEach((row, dy) => [...row].forEach((cell, dx) => cell === "#" && canvas.set(44 + dx, 21 + dy, art.decal)));

  return canvas;
}

/** A brass shell with a short pixel smoke trail, painted at an angle. */
function paintShell(angle: number): PixelCanvas {
  const size = 44;
  const canvas = new PixelCanvas(size, size);
  const map = rotateAbout(size / 2, size / 2, angle);
  const midY = size / 2;

  canvas.fill(
    (x, y) => Math.abs(y - midY) < 1.1 && x > 3 && x < 16 && Math.floor(x) % 3 !== 0,
    () => art.smoke[1],
    null,
    map,
  );
  canvas.fill(
    union(
      polygon([[16, midY - 3.5], [31, midY - 3.5], [31, midY + 3.5], [16, midY + 3.5]]),
      polygon([[30, midY - 3.5], [35, midY - 2.2], [38, midY], [35, midY + 2.2], [30, midY + 3.5]]),
      polygon([[14, midY - 4.5], [17, midY - 4.5], [17, midY + 4.5], [14, midY + 4.5]]),
    ),
    (x, y) => rampAt(art.brass, (y - (midY - 3.5)) / 7, x, y),
    art.outline,
    map,
  );
  return canvas;
}

/** A lumpy pixel smoke puff. */
function paintPuff(): PixelCanvas {
  const canvas = new PixelCanvas(34, 24);
  canvas.fill(
    union(circle(9, 13, 6.5), circle(17, 9, 7.5), circle(25, 13, 5.8), circle(16, 16, 6)),
    (x, y) => rampAt(art.smoke, (y - 3 + (x - 17) * 0.15) / 18, x, y),
    art.smokeEdge,
  );
  return canvas;
}

export interface DustlineMenuArt {
  backdrop: string;
  tank: string;
  shellUp: string;
  shellDown: string;
  puff: string;
}

let cachedArt: DustlineMenuArt | null = null;

/** Paints the title-screen art once and returns PNG data URLs (empty strings if canvas is unavailable). */
export function getDustlineMenuArt(): DustlineMenuArt {
  cachedArt ??= {
    backdrop: paintBackdrop().toDataUrl(),
    tank: paintTank().toDataUrl(),
    shellUp: paintShell(-0.38).toDataUrl(),
    shellDown: paintShell(0.3).toDataUrl(),
    puff: paintPuff().toDataUrl(),
  };
  return cachedArt;
}
