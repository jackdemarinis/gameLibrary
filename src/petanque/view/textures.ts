// Procedural canvas textures, painted in code so there are no image assets.
// Late-2000s console look: small textures (256–512px), lots of grime and
// grit baked in, filtered bilinear with no anisotropy, so surfaces soften and
// smear at a distance the way they did on a 480p console.
//
// Most textures are painted near-white and tinted by the material colour, so
// one texture serves every wall colour, shirt colour, hair colour, etc.

import * as THREE from "three";
import { cssColor, worldTheme } from "../config/theme";

const cache = new Map<string, THREE.Texture>();

function canvas(width: number, height = width): [HTMLCanvasElement, CanvasRenderingContext2D] {
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
  // Deliberately no anisotropic filtering: ground goes soft at grazing angles.
  texture.anisotropy = 1;
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

// Deterministic noise so the courts look the same every visit.
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function mixHex(a: number, b: number, t: number): string {
  return `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;
}

function grey(value: number, alpha = 1): string {
  const v = Math.round(Math.max(0, Math.min(255, value)));
  return `rgba(${v},${v},${v},${alpha})`;
}

// Draw at (x, y) and at every wrapped copy so tiles repeat seamlessly.
function wrapped(size: number, x: number, y: number, draw: (x: number, y: number) => void): void {
  for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) draw(x + dx, y + dy);
}

// Soft blotches plus fine speckle: the "dirty" base of every gritty surface.
function grunge(context: CanvasRenderingContext2D, size: number, random: () => number, strength: number, blotches = 90): void {
  for (let i = 0; i < blotches; i++) {
    const x = random() * size;
    const y = random() * size;
    const radius = size * (0.03 + random() * 0.12);
    const dark = random() < 0.6;
    wrapped(size, x, y, (cx, cy) => {
      const gradient = context.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, dark ? `rgba(40,30,20,${0.16 * strength})` : `rgba(255,250,235,${0.12 * strength})`);
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = gradient;
      context.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    });
  }
  const image = context.getImageData(0, 0, size, size);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (random() - 0.5) * 46 * strength;
    data[i] += n;
    data[i + 1] += n;
    data[i + 2] += n;
  }
  context.putImageData(image, 0, 0);
}

// ---------- terrain ----------

// Compacted grit: fine sand with scattered pebbles, raked streaks and boot scuffs.
export function gravelTextures(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const map = cached("gravel", () => {
    const size = 512;
    const [element, context] = canvas(size);
    const [bumpElement, bumpContext] = canvas(size);
    const random = seeded(11);
    context.fillStyle = cssColor(worldTheme.gravel);
    context.fillRect(0, 0, size, size);
    bumpContext.fillStyle = grey(110);
    bumpContext.fillRect(0, 0, size, size);
    grunge(context, size, random, 1.1, 120);
    // Rake lines running down the pitch.
    for (let i = 0; i < 70; i++) {
      const x = random() * size;
      context.strokeStyle = random() < 0.5 ? `${cssColor(worldTheme.gravelDark)}30` : `${cssColor(worldTheme.gravelLight)}28`;
      context.lineWidth = 1 + random() * 2;
      context.beginPath();
      context.moveTo(x, 0);
      context.bezierCurveTo(x + random() * 8 - 4, size * 0.33, x + random() * 8 - 4, size * 0.66, x, size);
      context.stroke();
    }
    const specks = worldTheme.gravelSpecks;
    for (let i = 0; i < 2600; i++) {
      const x = random() * size;
      const y = random() * size;
      const radius = 0.7 + random() * random() * 3.6;
      const color = specks[Math.floor(random() * specks.length)];
      const angle = random() * Math.PI;
      wrapped(size, x, y, (px, py) => {
        context.fillStyle = `${cssColor(worldTheme.gravelDark)}80`;
        context.beginPath();
        context.ellipse(px + 0.8, py + 1, radius * 1.15, radius * 0.9, angle, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = cssColor(color);
        context.beginPath();
        context.ellipse(px, py, radius, radius * 0.75, angle, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = `${cssColor(worldTheme.gravelLight)}90`;
        context.beginPath();
        context.arc(px - radius * 0.3, py - radius * 0.35, radius * 0.3, 0, Math.PI * 2);
        context.fill();
        bumpContext.fillStyle = grey(150 + radius * 28);
        bumpContext.beginPath();
        bumpContext.ellipse(px, py, radius, radius * 0.75, angle, 0, Math.PI * 2);
        bumpContext.fill();
      });
    }
    cache.set("gravelBump", finish(bumpElement, [2, 6], false));
    return finish(element, [2, 6]);
  });
  return { map, bump: cache.get("gravelBump") as THREE.CanvasTexture };
}

// Paving for the square around the terrain. "cobble" = old rounded setts,
// "slab" = big sandstone promenade flags. Painted near-white; tint via material.
export function pavingTextures(style: "cobble" | "slab"): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const key = `paving:${style}`;
  const map = cached(key, () => {
    const size = 512;
    const [element, context] = canvas(size);
    const [bumpElement, bumpContext] = canvas(size);
    const random = seeded(style === "cobble" ? 41 : 43);
    context.fillStyle = grey(120);
    context.fillRect(0, 0, size, size);
    bumpContext.fillStyle = grey(40);
    bumpContext.fillRect(0, 0, size, size);

    const stone = (x: number, y: number, w: number, h: number, round: number) => {
      const shade = 200 + random() * 50;
      const tint = random() * 14 - 7;
      context.fillStyle = `rgb(${shade + tint},${shade},${shade - tint - 6})`;
      context.beginPath();
      context.roundRect(x, y, w, h, round);
      context.fill();
      // Worn top: lighter centre, darker edges.
      const gradient = context.createRadialGradient(x + w * 0.45, y + h * 0.4, 1, x + w / 2, y + h / 2, Math.max(w, h) * 0.7);
      gradient.addColorStop(0, "rgba(255,255,245,0.18)");
      gradient.addColorStop(1, "rgba(30,20,10,0.22)");
      context.fillStyle = gradient;
      context.fill();
      bumpContext.fillStyle = grey(170 + random() * 60);
      bumpContext.beginPath();
      bumpContext.roundRect(x + 1, y + 1, w - 2, h - 2, round);
      bumpContext.fill();
    };

    if (style === "cobble") {
      const rows = 16;
      const rowHeight = size / rows;
      for (let row = 0; row < rows; row++) {
        let x = row % 2 ? -rowHeight * 0.5 : 0;
        while (x < size) {
          const width = rowHeight * (0.9 + random() * 0.5);
          stone(x + 1.5, row * rowHeight + 1.5, width - 3, rowHeight - 3, rowHeight * 0.32);
          x += width;
        }
      }
    } else {
      const rows = 4;
      const rowHeight = size / rows;
      for (let row = 0; row < rows; row++) {
        let x = row % 2 ? -rowHeight * 0.6 : 0;
        while (x < size) {
          const width = rowHeight * (1.1 + random() * 0.6);
          stone(x + 2, row * rowHeight + 2, Math.min(width, size - x + rowHeight) - 4, rowHeight - 4, 4);
          x += width;
        }
      }
      // Cracks and chips in the big flags.
      context.strokeStyle = "rgba(60,45,30,0.35)";
      context.lineWidth = 1;
      for (let i = 0; i < 26; i++) {
        let x = random() * size;
        let y = random() * size;
        context.beginPath();
        context.moveTo(x, y);
        for (let step = 0; step < 6; step++) {
          x += random() * 24 - 12;
          y += random() * 24 - 12;
          context.lineTo(x, y);
        }
        context.stroke();
      }
    }
    grunge(context, size, random, 1.2, 140);
    cache.set(`${key}:bump`, finish(bumpElement, [1, 1], false));
    return finish(element, [1, 1]);
  });
  return { map, bump: cache.get(`${key}:bump`) as THREE.CanvasTexture };
}

// Coarse grass for verges and planters.
export function grassTexture(): THREE.CanvasTexture {
  return cached("grass", () => {
    const size = 256;
    const [element, context] = canvas(size);
    const random = seeded(7);
    context.fillStyle = cssColor(worldTheme.grass);
    context.fillRect(0, 0, size, size);
    for (let i = 0; i < 9000; i++) {
      context.fillStyle = random() < 0.5 ? `${cssColor(worldTheme.grassBlade)}aa` : `${cssColor(worldTheme.grassStripe)}99`;
      context.fillRect(random() * size, random() * size, 1, 1 + random() * 3);
    }
    grunge(context, size, random, 1.3, 60);
    return finish(element, [1, 1]);
  });
}

// ---------- buildings ----------

// Lime-washed render: blotchy, with rain streaks and a grimy base. One tile
// spans a whole storey (v = 0 at the bottom of the texture is street level).
export function plasterTexture(): THREE.CanvasTexture {
  return cached("plaster", () => {
    const size = 256;
    const [element, context] = canvas(size);
    const random = seeded(51);
    context.fillStyle = grey(232);
    context.fillRect(0, 0, size, size);
    grunge(context, size, random, 1.6, 110);
    // Rain streaks.
    for (let i = 0; i < 40; i++) {
      const x = random() * size;
      const length = 20 + random() * 90;
      const gradient = context.createLinearGradient(0, 0, 0, length);
      gradient.addColorStop(0, "rgba(70,60,45,0.14)");
      gradient.addColorStop(1, "rgba(70,60,45,0)");
      context.fillStyle = gradient;
      context.fillRect(x, random() * size * 0.3, 1 + random() * 3, length);
    }
    // Patches of bare stone where render has fallen off.
    for (let i = 0; i < 5; i++) {
      const x = random() * size;
      const y = random() * size;
      wrapped(size, x, y, (px, py) => {
        context.fillStyle = "rgba(150,130,105,0.35)";
        context.beginPath();
        context.ellipse(px, py, 8 + random() * 14, 5 + random() * 8, random(), 0, Math.PI * 2);
        context.fill();
      });
    }
    return finish(element, [1, 1]);
  });
}

// Dirt that collects at street level; used as a separate decal strip.
export function grimeStripTexture(): THREE.CanvasTexture {
  return cached("grimeStrip", () => {
    const [element, context] = canvas(256, 64);
    const random = seeded(53);
    const gradient = context.createLinearGradient(0, 0, 0, 64);
    gradient.addColorStop(0, "rgba(40,32,22,0)");
    gradient.addColorStop(1, "rgba(40,32,22,0.55)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 64);
    for (let i = 0; i < 80; i++) {
      context.fillStyle = `rgba(40,32,22,${0.08 + random() * 0.12})`;
      context.fillRect(random() * 256, 30 + random() * 34, 2 + random() * 10, 34);
    }
    return finish(element, [1, 1]);
  });
}

// Curved terracotta roof tiles, near-white for tinting.
export function roofTexture(): THREE.CanvasTexture {
  return cached("roof", () => {
    const size = 256;
    const [element, context] = canvas(size);
    const random = seeded(61);
    context.fillStyle = grey(150);
    context.fillRect(0, 0, size, size);
    const rows = 8;
    const cols = 10;
    const rowHeight = size / rows;
    const colWidth = size / cols;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols + 1; col++) {
        const x = col * colWidth + (row % 2 ? colWidth / 2 : 0);
        const y = row * rowHeight;
        const gradient = context.createLinearGradient(x - colWidth / 2, 0, x + colWidth / 2, 0);
        const base = 190 + random() * 50;
        gradient.addColorStop(0, grey(base * 0.62));
        gradient.addColorStop(0.45, grey(base));
        gradient.addColorStop(1, grey(base * 0.55));
        context.fillStyle = gradient;
        context.beginPath();
        context.roundRect(x - colWidth / 2 + 1, y, colWidth - 2, rowHeight + 4, [0, 0, 8, 8]);
        context.fill();
      }
    }
    grunge(context, size, random, 1.4, 70);
    // Lichen.
    for (let i = 0; i < 30; i++) {
      context.fillStyle = `rgba(160,170,110,${0.1 + random() * 0.15})`;
      context.beginPath();
      context.arc(random() * size, random() * size, 2 + random() * 6, 0, Math.PI * 2);
      context.fill();
    }
    return finish(element, [1, 1]);
  });
}

// Weathered painted timber: shutters, doors, benches.
export function woodTexture(): THREE.CanvasTexture {
  return cached("wood", () => {
    const size = 256;
    const [element, context] = canvas(size);
    const random = seeded(23);
    context.fillStyle = grey(225);
    context.fillRect(0, 0, size, size);
    for (let i = 0; i < 90; i++) {
      const y = random() * size;
      context.strokeStyle = `rgba(60,40,25,${0.06 + random() * 0.14})`;
      context.lineWidth = 1 + random() * 2;
      context.beginPath();
      context.moveTo(0, y);
      for (let x = 0; x <= size; x += 32) context.lineTo(x, y + Math.sin(x * 0.05 + i) * 2);
      context.stroke();
    }
    // Plank gaps.
    for (let y = 0; y < size; y += size / 4) {
      context.fillStyle = "rgba(30,20,12,0.55)";
      context.fillRect(0, y, size, 2);
    }
    grunge(context, size, random, 1.3, 50);
    return finish(element, [1, 1]);
  });
}

// Bare structural timber (pitch boards), warmer and darker.
export function timberTexture(): THREE.CanvasTexture {
  return cached("timber", () => {
    const size = 256;
    const [element, context] = canvas(size);
    const random = seeded(29);
    context.fillStyle = cssColor(worldTheme.board);
    context.fillRect(0, 0, size, size);
    for (let i = 0; i < 120; i++) {
      const y = random() * size;
      context.strokeStyle = `${cssColor(worldTheme.boardDark)}${random() < 0.5 ? "55" : "30"}`;
      context.lineWidth = 1 + random() * 2.5;
      context.beginPath();
      context.moveTo(0, y);
      for (let x = 0; x <= size; x += 16) context.lineTo(x, y + Math.sin(x * 0.04 + i * 1.3) * 3);
      context.stroke();
    }
    // Knots.
    for (let i = 0; i < 4; i++) {
      const x = random() * size;
      const y = random() * size;
      context.fillStyle = `${cssColor(worldTheme.boardDark)}aa`;
      context.beginPath();
      context.ellipse(x, y, 6 + random() * 5, 3 + random() * 2, 0, 0, Math.PI * 2);
      context.fill();
    }
    grunge(context, size, random, 1.5, 70);
    return finish(element, [1, 1]);
  });
}

// Mottled plane-tree / palm bark, near-white for tinting.
export function barkTexture(kind: "plane" | "palm"): THREE.CanvasTexture {
  return cached(`bark:${kind}`, () => {
    const size = 256;
    const [element, context] = canvas(size);
    const random = seeded(kind === "plane" ? 71 : 73);
    context.fillStyle = grey(210);
    context.fillRect(0, 0, size, size);
    if (kind === "plane") {
      // Plane trees shed bark in big pale and olive patches.
      for (let i = 0; i < 70; i++) {
        const x = random() * size;
        const y = random() * size;
        const tone = random();
        wrapped(size, x, y, (px, py) => {
          context.fillStyle = tone < 0.4 ? "rgba(245,240,215,0.7)" : tone < 0.75 ? "rgba(150,150,110,0.55)" : "rgba(110,95,75,0.5)";
          context.beginPath();
          context.ellipse(px, py, 8 + random() * 22, 6 + random() * 16, random() * Math.PI, 0, Math.PI * 2);
          context.fill();
        });
      }
    } else {
      // Palm trunk rings.
      for (let y = 0; y < size; y += 16) {
        context.fillStyle = "rgba(60,45,30,0.5)";
        context.fillRect(0, y, size, 3);
        context.fillStyle = "rgba(255,245,225,0.2)";
        context.fillRect(0, y + 4, size, 5);
      }
    }
    grunge(context, size, random, 1.4, 40);
    return finish(element, [1, 1]);
  });
}

// Leaf canopy card: clumps of leaves with alpha, near-white for tinting.
export function foliageTexture(kind: "broad" | "palm"): THREE.CanvasTexture {
  return cached(`foliage:${kind}`, () => {
    const size = 256;
    const [element, context] = canvas(size);
    const random = seeded(kind === "broad" ? 81 : 83);
    if (kind === "broad") {
      for (let i = 0; i < 520; i++) {
        const angle = random() * Math.PI * 2;
        const distance = Math.sqrt(random()) * size * 0.46;
        const x = size / 2 + Math.cos(angle) * distance;
        const y = size / 2 + Math.sin(angle) * distance;
        const shade = 120 + random() * 135 - distance * 0.4;
        context.fillStyle = grey(shade);
        context.save();
        context.translate(x, y);
        context.rotate(random() * Math.PI * 2);
        context.beginPath();
        // Five-lobed plane leaf, roughly.
        context.moveTo(0, -9);
        context.quadraticCurveTo(8, -6, 9, 2);
        context.quadraticCurveTo(4, 4, 0, 9);
        context.quadraticCurveTo(-4, 4, -9, 2);
        context.quadraticCurveTo(-8, -6, 0, -9);
        context.fill();
        context.restore();
      }
    } else {
      // A single palm frond, pointing up the card.
      context.strokeStyle = grey(150);
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(size / 2, size);
      context.quadraticCurveTo(size / 2 + 6, size / 2, size / 2, 6);
      context.stroke();
      for (let i = 0; i < 46; i++) {
        const t = i / 46;
        const y = size - t * (size - 10);
        const length = Math.sin(t * Math.PI) * size * 0.46 + 10;
        for (const side of [-1, 1]) {
          context.strokeStyle = grey(140 + random() * 110);
          context.lineWidth = 3;
          context.beginPath();
          context.moveTo(size / 2, y);
          context.quadraticCurveTo(size / 2 + side * length * 0.6, y - 6, size / 2 + side * length, y + 14 + random() * 8);
          context.stroke();
        }
      }
    }
    return finish(element, null);
  });
}

// Striped awning canvas.
export function awningTexture(color: number): THREE.CanvasTexture {
  return cached(`awning:${color}`, () => {
    const [element, context] = canvas(256, 128);
    const random = seeded(91);
    context.fillStyle = cssColor(color);
    context.fillRect(0, 0, 256, 128);
    context.fillStyle = cssColor(worldTheme.tablecloth);
    for (let x = 0; x < 256; x += 64) context.fillRect(x + 32, 0, 32, 128);
    // Scalloped valance at the bottom edge is part of the geometry; here: fading.
    grunge(context, 256, random, 1.2, 30);
    return finish(element, null);
  });
}

// Sea surface: used as a normal-ish brightness map, scrolled in the shader.
export function waterTexture(): THREE.CanvasTexture {
  return cached("water", () => {
    const size = 256;
    const [element, context] = canvas(size);
    const random = seeded(97);
    context.fillStyle = grey(128);
    context.fillRect(0, 0, size, size);
    for (let i = 0; i < 900; i++) {
      const x = random() * size;
      const y = random() * size;
      const w = 6 + random() * 26;
      wrapped(size, x, y, (px, py) => {
        context.strokeStyle = random() < 0.5 ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.25)";
        context.lineWidth = 1 + random() * 1.5;
        context.beginPath();
        context.moveTo(px - w / 2, py);
        context.quadraticCurveTo(px, py - 2, px + w / 2, py);
        context.stroke();
      });
    }
    return finish(element, [1, 1], false);
  });
}

// Soft round contact shadow.
export function blobShadowTexture(): THREE.CanvasTexture {
  return cached("blob", () => {
    const size = 64;
    const [element, context] = canvas(size);
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(0,0,0,0.55)");
    gradient.addColorStop(0.6, "rgba(0,0,0,0.25)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    return finish(element, null);
  });
}

// ---------- people ----------

export interface FabricOptions {
  style: "tee" | "polo" | "tank" | "jersey" | "breton" | "cardigan";
  color: number;
  trim: number;
  number: number;
}

// Shirt wrapped around a lathed torso. u runs around the body (front at u = 0
// and 1, back at u = 0.5); v runs from the hem (0) to the collar (1).
export function fabricTexture(options: FabricOptions): THREE.CanvasTexture {
  const key = `fabric:${options.style}:${options.color}:${options.trim}:${options.number}`;
  return cached(key, () => {
    const width = 512;
    const height = 256;
    const [element, context] = canvas(width, height);
    const random = seeded(options.color & 0xffff);
    const trim = cssColor(options.trim);
    context.fillStyle = cssColor(options.color);
    context.fillRect(0, 0, width, height);

    if (options.style === "breton") {
      context.fillStyle = trim;
      for (let y = 18; y < height - 30; y += 22) context.fillRect(0, y, width, 9);
    }
    if (options.style === "jersey") {
      // Side panels and a big number on the back, like a club shirt.
      context.fillStyle = trim;
      for (const u of [0.25, 0.75]) context.fillRect(width * u - 14, 0, 28, height);
      context.font = `900 ${Math.round(height * 0.42)}px "IBM Plex Sans", system-ui, sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.lineWidth = 8;
      context.strokeStyle = trim;
      context.fillStyle = cssColor(worldTheme.tablecloth);
      const text = String(options.number);
      context.strokeText(text, width * 0.5, height * 0.52);
      context.fillText(text, width * 0.5, height * 0.52);
    }
    if (options.style === "cardigan") {
      // Button band down the front (the seam at u = 0 / 1).
      context.fillStyle = trim;
      for (const x of [0, width]) context.fillRect(x - 10, 0, 20, height);
      context.fillStyle = cssColor(worldTheme.metalDark);
      for (let y = 30; y < height - 20; y += 38) {
        for (const x of [0, width]) {
          context.beginPath();
          context.arc(x, y, 5, 0, Math.PI * 2);
          context.fill();
        }
      }
      // Knit ribbing.
      for (let x = 0; x < width; x += 6) {
        context.fillStyle = "rgba(0,0,0,0.07)";
        context.fillRect(x, 0, 2, height);
      }
    }
    if (options.style === "polo") {
      // Placket at the front collar.
      context.fillStyle = trim;
      for (const x of [0, width]) context.fillRect(x - 12, height * 0.72, 24, height * 0.28);
      context.fillStyle = cssColor(worldTheme.tablecloth);
      for (const y of [height * 0.8, height * 0.9]) {
        for (const x of [0, width]) {
          context.beginPath();
          context.arc(x, y, 4, 0, Math.PI * 2);
          context.fill();
        }
      }
    }
    // Hem and collar trim.
    context.fillStyle = trim;
    context.fillRect(0, 0, width, options.style === "tank" ? 4 : 10);
    context.fillRect(0, height - 12, width, 12);

    // Creases, sweat-darkening and fabric weave.
    for (let i = 0; i < 26; i++) {
      const y = random() * height;
      context.strokeStyle = `rgba(0,0,0,${0.05 + random() * 0.08})`;
      context.lineWidth = 2 + random() * 5;
      context.beginPath();
      context.moveTo(random() * width, y);
      context.quadraticCurveTo(random() * width, y + random() * 30 - 15, random() * width, y + random() * 20 - 10);
      context.stroke();
    }
    grunge(context, width, random, 0.9, 40);
    return finish(element, null);
  });
}

// Hair: dense strands, near-white for tinting.
export function hairTexture(): THREE.CanvasTexture {
  return cached("hair", () => {
    const size = 256;
    const [element, context] = canvas(size);
    const random = seeded(101);
    context.fillStyle = grey(190);
    context.fillRect(0, 0, size, size);
    for (let i = 0; i < 1600; i++) {
      const x = random() * size;
      const y = random() * size;
      context.strokeStyle = random() < 0.5 ? grey(120, 0.5) : grey(255, 0.45);
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x, y);
      context.quadraticCurveTo(x + random() * 6 - 3, y + 12, x + random() * 8 - 4, y + 26 + random() * 20);
      context.stroke();
    }
    return finish(element, [1, 1]);
  });
}

export type FaceExpression = "neutral" | "happy" | "sad" | "blink" | "focus";

export interface FaceOptions {
  skin: number;
  eyes: number;
  hair: number;
  facialHair: "none" | "stubble" | "mustache" | "beard";
  freckles: boolean;
  elder: boolean;
}

// Face painted onto a sphere's equirectangular UVs. The head faces -z, which on
// three's SphereGeometry is u = 0.75; the equator is the vertical middle.
// Semi-realistic: almond eyes with coloured irises, painted shading under the
// brow and along the jaw, real lips.
export function faceTexture(options: FaceOptions, expression: FaceExpression): THREE.CanvasTexture {
  const key = `face:${options.skin}:${options.eyes}:${options.hair}:${options.facialHair}:${options.freckles}:${options.elder}:${expression}`;
  return cached(key, () => {
    const width = 512;
    const height = 256;
    const [element, context] = canvas(width, height);
    const skin = options.skin;
    const shade = (t: number) => mixHex(skin, 0x3a1e10, t);
    const light = (t: number) => mixHex(skin, 0xfff4e6, t);
    context.fillStyle = cssColor(skin);
    context.fillRect(0, 0, width, height);

    const cx = width * 0.75;
    const eyeY = 118;
    const eyeGap = 23;
    const mouthY = 158;

    // Painted ambient occlusion: brow shadow, cheekbone light, jaw shadow.
    const blob = (x: number, y: number, rx: number, ry: number, color: string, alpha: number) => {
      const gradient = context.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
      gradient.addColorStop(0, `${color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`);
      gradient.addColorStop(1, `${color}00`);
      context.save();
      context.translate(x, y);
      context.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry));
      context.translate(-x, -y);
      context.fillStyle = gradient;
      context.fillRect(x - Math.max(rx, ry), y - Math.max(rx, ry), Math.max(rx, ry) * 2, Math.max(rx, ry) * 2);
      context.restore();
    };
    for (const side of [-1, 1]) {
      blob(cx + side * eyeGap, eyeY - 2, 18, 10, shade(0.5), 0.35);
      blob(cx + side * 34, eyeY + 22, 16, 10, light(0.6), 0.35);
      blob(cx + side * 30, mouthY - 6, 12, 8, mixHex(skin, worldTheme.blush, 0.6), expression === "happy" ? 0.5 : 0.28);
    }
    blob(cx, mouthY + 34, 52, 18, shade(0.6), 0.3);
    blob(cx, 30, 90, 30, light(0.4), 0.2);
    if (options.elder) {
      context.strokeStyle = shade(0.5);
      context.lineWidth = 1;
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          context.beginPath();
          context.moveTo(cx + side * (eyeGap + 11), eyeY - 3 + i * 4);
          context.lineTo(cx + side * (eyeGap + 18), eyeY - 5 + i * 5);
          context.stroke();
        }
        context.beginPath();
        context.moveTo(cx + side * 14, mouthY - 14);
        context.quadraticCurveTo(cx + side * 20, mouthY - 2, cx + side * 17, mouthY + 6);
        context.stroke();
      }
      for (let i = 0; i < 2; i++) {
        context.beginPath();
        context.moveTo(cx - 20, eyeY - 34 + i * 6);
        context.quadraticCurveTo(cx, eyeY - 37 + i * 6, cx + 20, eyeY - 34 + i * 6);
        context.stroke();
      }
    }
    if (options.freckles) {
      const random = seeded(skin);
      context.fillStyle = shade(0.35);
      for (let i = 0; i < 40; i++) {
        const side = random() < 0.5 ? -1 : 1;
        context.globalAlpha = 0.5 + random() * 0.4;
        context.fillRect(cx + side * (10 + random() * 34), eyeY + 8 + random() * 18, 1.6, 1.6);
      }
      context.globalAlpha = 1;
    }
    if (options.facialHair === "stubble" || options.facialHair === "beard") {
      const random = seeded(options.hair & 0xffff);
      for (let i = 0; i < 2200; i++) {
        const angle = random() * Math.PI;
        const r = 30 + random() * 30;
        const x = cx + Math.cos(angle) * r * 1.1;
        const y = mouthY - 26 + Math.sin(angle) * r * 0.9;
        if (Math.abs(x - cx) < 12 && y < mouthY + 6 && y > mouthY - 16) continue;
        context.fillStyle = `${cssColor(options.hair)}${options.facialHair === "beard" ? "cc" : "38"}`;
        context.fillRect(x, y, 1.2, 1.2);
      }
    }

    // Eyes.
    const ink = cssColor(worldTheme.eye);
    for (const side of [-1, 1]) {
      const x = cx + side * eyeGap;
      context.lineCap = "round";
      if (expression === "happy" || expression === "blink") {
        context.strokeStyle = ink;
        context.lineWidth = 2.6;
        context.beginPath();
        if (expression === "happy") context.arc(x, eyeY + 5, 8, Math.PI * 1.15, Math.PI * 1.85);
        else {
          context.moveTo(x - 8, eyeY + 1);
          context.quadraticCurveTo(x, eyeY + 4, x + 8, eyeY + 1);
        }
        context.stroke();
      } else {
        const lid = expression === "focus" ? 3.2 : 0;
        const almond = () => {
          context.beginPath();
          context.moveTo(x - 9, eyeY + 1);
          context.quadraticCurveTo(x - side * 1, eyeY - 8 + lid, x + 9, eyeY);
          context.quadraticCurveTo(x, eyeY + 6, x - 9, eyeY + 1);
          context.closePath();
        };
        almond();
        context.fillStyle = cssColor(worldTheme.eyeWhite);
        context.fill();
        context.save();
        almond();
        context.clip();
        context.fillStyle = cssColor(options.eyes);
        context.beginPath();
        context.arc(x, eyeY, 5, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = ink;
        context.beginPath();
        context.arc(x, eyeY, 2.2, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "rgba(0,0,0,0.25)";
        context.fillRect(x - 10, eyeY - 9 + lid, 20, 4);
        context.restore();
        context.fillStyle = cssColor(worldTheme.eyeShine);
        context.beginPath();
        context.arc(x + 1.6, eyeY - 1.8, 1.3, 0, Math.PI * 2);
        context.fill();
        // Upper lid and lashes.
        context.strokeStyle = ink;
        context.lineWidth = 2.2;
        context.beginPath();
        context.moveTo(x - 9.5, eyeY + 1);
        context.quadraticCurveTo(x - side * 1, eyeY - 8.5 + lid, x + 9.5, eyeY - 0.5);
        context.stroke();
        context.strokeStyle = shade(0.35);
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(x - 7, eyeY - 6 + lid * 0.5);
        context.quadraticCurveTo(x, eyeY - 10 + lid * 0.5, x + 7, eyeY - 6.5 + lid * 0.5);
        context.stroke();
      }
      // Brows.
      const lift = expression === "happy" ? -3 : expression === "sad" ? 1 : expression === "focus" ? 2 : 0;
      const tilt = expression === "sad" ? -3 : expression === "focus" ? 3 : 0;
      context.strokeStyle = cssColor(options.hair);
      context.lineWidth = options.elder ? 2.4 : 3;
      context.beginPath();
      context.moveTo(x - side * 9, eyeY - 13 + lift - tilt);
      context.quadraticCurveTo(x, eyeY - 17 + lift, x + side * 10, eyeY - 13 + lift + tilt * 0.4);
      context.stroke();
    }

    // Nose shading (the nose itself is a mesh).
    blob(cx, eyeY + 26, 8, 6, shade(0.6), 0.45);

    // Mouth.
    const lip = mixHex(skin, worldTheme.mouth, 0.55);
    context.lineCap = "round";
    if (expression === "happy") {
      context.fillStyle = cssColor(worldTheme.mouthInside);
      context.beginPath();
      context.moveTo(cx - 13, mouthY - 3);
      context.quadraticCurveTo(cx, mouthY + 15, cx + 13, mouthY - 3);
      context.closePath();
      context.fill();
      context.fillStyle = cssColor(worldTheme.eyeWhite);
      context.fillRect(cx - 9, mouthY - 3, 18, 3.5);
      context.strokeStyle = lip;
      context.lineWidth = 1.6;
      context.stroke();
    } else if (expression === "sad") {
      context.strokeStyle = lip;
      context.lineWidth = 2.6;
      context.beginPath();
      context.moveTo(cx - 10, mouthY + 4);
      context.quadraticCurveTo(cx, mouthY - 3, cx + 10, mouthY + 4);
      context.stroke();
    } else {
      context.fillStyle = lip;
      context.beginPath();
      context.moveTo(cx - 10, mouthY);
      context.quadraticCurveTo(cx, mouthY - 3, cx + 10, mouthY);
      context.quadraticCurveTo(cx, mouthY + (expression === "focus" ? 3 : 5), cx - 10, mouthY);
      context.fill();
      context.strokeStyle = shade(0.6);
      context.lineWidth = 1.2;
      context.beginPath();
      context.moveTo(cx - 10, mouthY);
      context.quadraticCurveTo(cx, mouthY + (expression === "focus" ? 0 : 1.5), cx + 10, mouthY);
      context.stroke();
    }
    return finish(element, null);
  });
}

// Painted shop sign: faded lettering on a board.
export function signTexture(text: string, background: number, ink: number): THREE.CanvasTexture {
  return cached(`sign:${text}:${background}:${ink}`, () => {
    const [element, context] = canvas(512, 96);
    const random = seeded(text.length * 131);
    context.fillStyle = cssColor(background);
    context.fillRect(0, 0, 512, 96);
    context.strokeStyle = cssColor(ink);
    context.lineWidth = 4;
    context.strokeRect(8, 8, 496, 80);
    context.fillStyle = cssColor(ink);
    context.font = `700 54px Georgia, "Times New Roman", serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, 256, 52);
    grunge(context, 512, random, 1.4, 30);
    return finish(element, null);
  });
}

// Round clock face for the church tower.
export function clockTexture(): THREE.CanvasTexture {
  return cached("clock", () => {
    const [element, context] = canvas(128);
    context.fillStyle = "#efe6d0";
    context.beginPath();
    context.arc(64, 64, 62, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#2a2622";
    context.lineWidth = 4;
    context.stroke();
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      context.fillRect(64 + Math.sin(angle) * 50 - 2, 64 - Math.cos(angle) * 50 - 5, 4, 10);
    }
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(64, 64);
    context.lineTo(64 + 26, 64 - 18);
    context.moveTo(64, 64);
    context.lineTo(64 - 4, 64 - 44);
    context.stroke();
    return finish(element, null);
  });
}
