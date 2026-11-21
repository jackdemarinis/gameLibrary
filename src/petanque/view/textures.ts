// Procedural canvas textures: everything is painted in code, so there are no
// image assets to ship. Each texture is built once and cached.

import * as THREE from "three";
import { cssColor, worldTheme } from "../config/theme";

const cache = new Map<string, THREE.Texture>();

function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const element = document.createElement("canvas");
  element.width = width;
  element.height = height;
  const context = element.getContext("2d");
  if (!context) throw new Error("2D canvas unavailable");
  return [element, context];
}

function finish(element: HTMLCanvasElement, repeat: [number, number] | null, srgb = true): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(element);
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
  }
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function cached<T extends THREE.Texture>(key: string, build: () => T): T {
  let texture = cache.get(key) as T | undefined;
  if (!texture) {
    texture = build();
    cache.set(key, texture);
  }
  return texture;
}

// Deterministic noise so the park looks the same every visit.
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function mixHex(a: number, b: number, t: number): string {
  return `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;
}

// Freshly mowed lawn: two broad stripes plus fine blades. One tile = one stripe pair.
export function grassTexture(): THREE.CanvasTexture {
  return cached("grass", () => {
    const size = 512;
    const [element, context] = canvas(size, size);
    const random = seeded(7);
    context.fillStyle = cssColor(worldTheme.grass);
    context.fillRect(0, 0, size, size);
    // Mowing stripes with a soft edge between them.
    const stripe = context.createLinearGradient(0, 0, size, 0);
    stripe.addColorStop(0, cssColor(worldTheme.grassStripe));
    stripe.addColorStop(0.46, cssColor(worldTheme.grassStripe));
    stripe.addColorStop(0.54, cssColor(worldTheme.grass));
    stripe.addColorStop(0.96, cssColor(worldTheme.grass));
    stripe.addColorStop(1, cssColor(worldTheme.grassStripe));
    context.fillStyle = stripe;
    context.fillRect(0, 0, size, size);
    // Soft clumps, then fine dapples: reads as turf without streaking up close.
    for (let i = 0; i < 160; i++) {
      context.globalAlpha = 0.07;
      context.fillStyle = random() < 0.5 ? cssColor(worldTheme.grassBlade) : cssColor(worldTheme.grassStripe);
      context.beginPath();
      context.arc(random() * size, random() * size, 8 + random() * 22, 0, Math.PI * 2);
      context.fill();
    }
    for (let i = 0; i < 26000; i++) {
      context.globalAlpha = 0.18 + random() * 0.25;
      context.fillStyle = random() < 0.5 ? cssColor(worldTheme.grassBlade) : cssColor(worldTheme.grassStripe);
      context.fillRect(random() * size, random() * size, 1 + random() * 1.5, 1 + random() * 2);
    }
    context.globalAlpha = 1;
    return finish(element, [1, 1]);
  });
}

// Packed gravel: hundreds of small shaded pebbles over a sandy base.
export function gravelTextures(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const map = cached("gravel", () => {
    const size = 512;
    const [element, context] = canvas(size, size);
    const [bumpElement, bumpContext] = canvas(size, size);
    const random = seeded(11);
    context.fillStyle = cssColor(worldTheme.gravel);
    context.fillRect(0, 0, size, size);
    bumpContext.fillStyle = "#606060";
    bumpContext.fillRect(0, 0, size, size);
    // Soft sandy mottling.
    for (let i = 0; i < 260; i++) {
      context.globalAlpha = 0.06;
      context.fillStyle = random() < 0.5 ? cssColor(worldTheme.gravelDark) : cssColor(worldTheme.gravelLight);
      context.beginPath();
      context.arc(random() * size, random() * size, 10 + random() * 30, 0, Math.PI * 2);
      context.fill();
    }
    const specks = worldTheme.gravelSpecks;
    for (let i = 0; i < 4200; i++) {
      const x = random() * size;
      const y = random() * size;
      const radius = 0.8 + random() * random() * 3.2;
      const color = specks[Math.floor(random() * specks.length)];
      const angle = random() * Math.PI;
      for (const [dx, dy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
        // Pebble: dark contact shadow, body, light top-left highlight.
        context.globalAlpha = 0.35;
        context.fillStyle = cssColor(worldTheme.gravelDark);
        context.beginPath();
        context.ellipse(x + dx + 0.6, y + dy + 0.8, radius * 1.1, radius * 0.85, angle, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 0.95;
        context.fillStyle = cssColor(color);
        context.beginPath();
        context.ellipse(x + dx, y + dy, radius, radius * 0.75, angle, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 0.5;
        context.fillStyle = cssColor(worldTheme.gravelLight);
        context.beginPath();
        context.arc(x + dx - radius * 0.3, y + dy - radius * 0.3, radius * 0.35, 0, Math.PI * 2);
        context.fill();
        bumpContext.globalAlpha = 0.9;
        bumpContext.fillStyle = `rgb(${150 + radius * 25},${150 + radius * 25},${150 + radius * 25})`;
        bumpContext.beginPath();
        bumpContext.ellipse(x + dx, y + dy, radius, radius * 0.75, angle, 0, Math.PI * 2);
        bumpContext.fill();
      }
    }
    context.globalAlpha = 1;
    cache.set("gravelBump", finish(bumpElement, [2, 6], false));
    return finish(element, [2, 6]);
  });
  return { map, bump: cache.get("gravelBump") as THREE.CanvasTexture };
}

// Warm planed wood with grain lines, for the pitch boards and benches.
export function woodTexture(): THREE.CanvasTexture {
  return cached("wood", () => {
    const [element, context] = canvas(512, 64);
    const random = seeded(23);
    context.fillStyle = cssColor(worldTheme.board);
    context.fillRect(0, 0, 512, 64);
    for (let i = 0; i < 40; i++) {
      context.globalAlpha = 0.12 + random() * 0.18;
      context.strokeStyle = cssColor(worldTheme.boardDark);
      context.lineWidth = 1 + random() * 2;
      const y = random() * 64;
      context.beginPath();
      context.moveTo(0, y);
      for (let x = 0; x <= 512; x += 32) context.lineTo(x, y + Math.sin(x * 0.02 + i) * 3);
      context.stroke();
    }
    context.globalAlpha = 1;
    return finish(element, [1, 1]);
  });
}

// Puffy cloud billboard: overlapping soft circles, shaded underneath.
export function cloudTexture(variant: number): THREE.CanvasTexture {
  return cached(`cloud${variant}`, () => {
    const [element, context] = canvas(512, 256);
    const random = seeded(100 + variant);
    const puffs: Array<[number, number, number]> = [];
    for (let i = 0; i < 9; i++) {
      const x = 110 + random() * 290;
      const radius = 45 + random() * 55;
      const y = 175 - radius * (0.5 + random() * 0.5) - Math.sin(((x - 100) / 310) * Math.PI) * 40;
      puffs.push([x, y, radius]);
    }
    for (const [pass, color, offset] of [
      [0, worldTheme.cloudShade, 10],
      [1, worldTheme.cloud, 0],
    ] as const) {
      for (const [x, y, radius] of puffs) {
        const gradient = context.createRadialGradient(x, y - offset, radius * 0.2, x, y + offset, radius);
        gradient.addColorStop(0, cssColor(color));
        gradient.addColorStop(pass === 0 ? 0.8 : 0.72, cssColor(color));
        gradient.addColorStop(1, `${cssColor(color)}00`);
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(x, y - offset, radius, 0, Math.PI * 2);
        context.fill();
      }
    }
    // Flat, slightly shaded base like a painted cloud.
    const base = context.createLinearGradient(0, 120, 0, 200);
    base.addColorStop(0, `${cssColor(worldTheme.cloudShade)}00`);
    base.addColorStop(1, `${cssColor(worldTheme.cloudShade)}aa`);
    context.globalCompositeOperation = "source-atop";
    context.fillStyle = base;
    context.fillRect(0, 0, 512, 256);
    return finish(element, null);
  });
}

// Soft round contact shadow, used under characters, balls and props.
export function blobShadowTexture(): THREE.CanvasTexture {
  return cached("blob", () => {
    const [element, context] = canvas(128, 128);
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    const shade = cssColor(worldTheme.contactShadow);
    gradient.addColorStop(0, `${shade}aa`);
    gradient.addColorStop(0.5, `${shade}55`);
    gradient.addColorStop(1, `${shade}00`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    return finish(element, null);
  });
}

// Vertical leaf mottling for tree canopies (applied with world-space-ish UVs).
export function leafTexture(): THREE.CanvasTexture {
  return cached("leaves", () => {
    const size = 256;
    const [element, context] = canvas(size, size);
    const random = seeded(31);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size, size);
    for (let i = 0; i < 700; i++) {
      const x = random() * size;
      const y = random() * size;
      context.globalAlpha = 0.08 + random() * 0.12;
      context.fillStyle = random() < 0.5 ? "#8a9a80" : "#ffffff";
      context.beginPath();
      context.ellipse(x, y, 5 + random() * 7, 3 + random() * 4, random() * Math.PI, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    return finish(element, [3, 2]);
  });
}

// Roof tiles: rows of rounded terracotta.
export function roofTexture(): THREE.CanvasTexture {
  return cached("roof", () => {
    const [element, context] = canvas(256, 256);
    context.fillStyle = cssColor(worldTheme.roof);
    context.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 8; row++) {
      for (let column = 0; column < 9; column++) {
        const x = column * 32 + (row % 2) * 16;
        const y = row * 32;
        const gradient = context.createLinearGradient(x, 0, x + 32, 0);
        gradient.addColorStop(0, cssColor(worldTheme.roofDark));
        gradient.addColorStop(0.45, cssColor(worldTheme.roof));
        gradient.addColorStop(1, cssColor(worldTheme.roofDark));
        context.fillStyle = gradient;
        context.beginPath();
        context.roundRect(x - 15, y, 30, 30, 10);
        context.fill();
      }
    }
    return finish(element, [2, 2]);
  });
}

export type FaceExpression = "neutral" | "happy" | "sad" | "blink" | "focus";

export interface FaceOptions {
  skin: number;
  hair: number;
  hasMustache: boolean;
  eyeShape: "round" | "tall" | "sleepy";
  hasFreckles: boolean;
}

// Face painted onto a sphere's equirectangular UVs. The head faces -z, which on
// three's SphereGeometry is u = 0.75; the equator is the vertical middle.
export function faceTexture(options: FaceOptions, expression: FaceExpression): THREE.CanvasTexture {
  const key = `face:${options.skin}:${options.hair}:${options.hasMustache}:${options.eyeShape}:${options.hasFreckles}:${expression}`;
  return cached(key, () => {
    const width = 1024;
    const height = 512;
    const [element, context] = canvas(width, height);
    context.fillStyle = cssColor(options.skin);
    context.fillRect(0, 0, width, height);

    const cx = width * 0.75;
    const eyeY = 232;
    const eyeGap = 62;
    // Longitude squashes toward the poles, so features are drawn slightly wide.
    const ink = cssColor(worldTheme.eye);

    // Cheeks
    for (const side of [-1, 1]) {
      const blush = context.createRadialGradient(cx + side * 92, 292, 2, cx + side * 92, 292, 34);
      blush.addColorStop(0, `${cssColor(worldTheme.blush)}${expression === "happy" ? "cc" : "88"}`);
      blush.addColorStop(1, `${cssColor(worldTheme.blush)}00`);
      context.fillStyle = blush;
      context.fillRect(cx + side * 92 - 40, 252, 80, 80);
    }
    if (options.hasFreckles) {
      context.fillStyle = mixHex(options.skin, worldTheme.trunkDark, 0.45);
      for (const side of [-1, 1]) {
        for (const [dx, dy] of [[0, 0], [14, 8], [-10, 10], [6, -10]]) {
          context.beginPath();
          context.arc(cx + side * (82 + dx), 282 + dy, 3, 0, Math.PI * 2);
          context.fill();
        }
      }
    }

    // Eyes
    for (const side of [-1, 1]) {
      const x = cx + side * eyeGap;
      context.fillStyle = ink;
      context.strokeStyle = ink;
      context.lineCap = "round";
      if (expression === "happy") {
        context.lineWidth = 9;
        context.beginPath();
        context.arc(x, eyeY + 10, 20, Math.PI * 1.1, Math.PI * 1.9);
        context.stroke();
      } else if (expression === "blink") {
        context.lineWidth = 8;
        context.beginPath();
        context.moveTo(x - 18, eyeY + 4);
        context.quadraticCurveTo(x, eyeY + 12, x + 18, eyeY + 4);
        context.stroke();
      } else {
        const tall = options.eyeShape === "tall" ? 30 : options.eyeShape === "sleepy" ? 18 : 24;
        const wide = options.eyeShape === "round" ? 17 : 14;
        context.fillStyle = cssColor(worldTheme.eyeWhite);
        context.beginPath();
        context.ellipse(x, eyeY, wide + 7, tall + 6, 0, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = ink;
        context.beginPath();
        context.ellipse(x + side * -2, eyeY + 3, wide, tall, 0, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = cssColor(worldTheme.eyeShine);
        context.beginPath();
        context.arc(x + 5, eyeY - tall * 0.45, 7, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.arc(x - 5, eyeY + tall * 0.35, 3, 0, Math.PI * 2);
        context.fill();
        if (options.eyeShape === "sleepy") {
          context.fillStyle = cssColor(options.skin);
          context.fillRect(x - 30, eyeY - tall - 10, 60, tall * 0.7);
          context.strokeStyle = ink;
          context.lineWidth = 5;
          context.beginPath();
          context.moveTo(x - 24, eyeY - tall * 0.3);
          context.lineTo(x + 24, eyeY - tall * 0.3);
          context.stroke();
        }
      }
      // Brows
      const browLift = expression === "happy" ? -12 : expression === "sad" ? 0 : expression === "focus" ? 6 : -4;
      const browTilt = expression === "sad" ? -10 : expression === "focus" ? 9 : 0;
      context.strokeStyle = cssColor(options.hair);
      context.lineWidth = 10;
      context.beginPath();
      context.moveTo(x - side * 22, eyeY - 46 + browLift - browTilt);
      context.quadraticCurveTo(x, eyeY - 56 + browLift, x + side * 22, eyeY - 46 + browLift + browTilt);
      context.stroke();
    }

    // Nose: a soft shaded dab.
    const nose = context.createRadialGradient(cx, 272, 2, cx, 276, 22);
    nose.addColorStop(0, mixHex(options.skin, 0xffffff, 0.25));
    nose.addColorStop(0.6, cssColor(options.skin));
    nose.addColorStop(1, mixHex(options.skin, worldTheme.mouth, 0.18));
    context.fillStyle = nose;
    context.beginPath();
    context.ellipse(cx, 276, 18, 15, 0, 0, Math.PI * 2);
    context.fill();

    // Mouth
    const mouthY = 326;
    context.strokeStyle = cssColor(worldTheme.mouth);
    context.lineWidth = 7;
    context.lineCap = "round";
    if (expression === "happy") {
      context.fillStyle = cssColor(worldTheme.mouthInside);
      context.beginPath();
      context.moveTo(cx - 34, mouthY - 6);
      context.quadraticCurveTo(cx, mouthY + 52, cx + 34, mouthY - 6);
      context.closePath();
      context.fill();
      context.fillStyle = cssColor(worldTheme.tongue);
      context.beginPath();
      context.ellipse(cx, mouthY + 20, 15, 9, 0, 0, Math.PI * 2);
      context.fill();
    } else if (expression === "sad") {
      context.beginPath();
      context.moveTo(cx - 22, mouthY + 12);
      context.quadraticCurveTo(cx, mouthY - 8, cx + 22, mouthY + 12);
      context.stroke();
    } else if (expression === "focus") {
      context.beginPath();
      context.moveTo(cx - 14, mouthY + 4);
      context.lineTo(cx + 14, mouthY + 2);
      context.stroke();
    } else {
      context.beginPath();
      context.moveTo(cx - 26, mouthY);
      context.quadraticCurveTo(cx, mouthY + 22, cx + 26, mouthY);
      context.stroke();
    }

    if (options.hasMustache) {
      context.fillStyle = cssColor(options.hair);
      for (const side of [-1, 1]) {
        context.beginPath();
        context.ellipse(cx + side * 24, mouthY - 22, 30, 13, side * -0.25, 0, Math.PI * 2);
        context.fill();
      }
    }

    return finish(element, null);
  });
}
