// Pause-menu map: a chunky top-down painting of the current area (1 px per metre,
// scaled up pixelated) hidden under parchment fog wherever Wren hasn't been yet.
// Terrain colours come from the art palette; UI ink/fog/marker colours come from the
// --lw-map-* tokens so the map matches the HUD.
import { areas } from "../game/content/areas";
import type { AreaDef, TileKind } from "../game/content/areaTypes";
import type { ExploreGrid } from "../game/rules/exploration";
import { artPalette } from "../world/artPalette";
import { slopeAt } from "../world/terrain";
import type { AreaRuntime } from "./areaRuntime";

export interface MapPin {
  kind: "lantern" | "lanternLit" | "npc" | "chest" | "gate" | "door";
  x: number;
  z: number;
}

export interface MapSnapshot {
  area: AreaRuntime;
  grid: ExploreGrid;
  player: { x: number; z: number; yaw: number };
  pins: MapPin[];
}

const tileColour: Record<TileKind, number> = {
  grass: artPalette.grass[3],
  grassForest: artPalette.grassForest[3],
  dirt: artPalette.dirt[3],
  cobble: artPalette.cobble[3],
  flagstone: artPalette.brick[3],
  shrineFloor: artPalette.shrine[3],
  cliff: artPalette.cliff[2],
};

const terrainCache = new Map<string, HTMLCanvasElement>();

function rgb(colour: number, shade = 1): string {
  const r = Math.min(255, Math.round(((colour >> 16) & 255) * shade));
  const g = Math.min(255, Math.round(((colour >> 8) & 255) * shade));
  const b = Math.min(255, Math.round((colour & 255) * shade));
  return `rgb(${r},${g},${b})`;
}

/** Terrain painted once per area: tile colour with a little hill shading from the north-west. */
function terrainImage(def: AreaDef): HTMLCanvasElement {
  const cached = terrainCache.get(def.id);
  if (cached) return cached;
  const size = def.size;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d")!;
  const image = context.createImageData(size, size);
  const half = size / 2;
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const x = column - half + 0.5;
      const z = row - half + 0.5;
      const height = def.height(x, z);
      const tile = def.paint(x, z, height, slopeAt(def, x, z));
      const light = (height - def.height(x - 1, z - 1)) * 0.35;
      const shade = Math.max(0.55, Math.min(1.35, 1 + light)) * (tile === "cliff" ? 0.8 : 1);
      // Two-tone dither so the map reads as pixel art rather than a smooth gradient.
      const dither = (row + column) % 2 === 0 ? 1.04 : 0.96;
      const colour = tileColour[tile];
      const index = (row * size + column) * 4;
      image.data[index] = Math.min(255, ((colour >> 16) & 255) * shade * dither);
      image.data[index + 1] = Math.min(255, ((colour >> 8) & 255) * shade * dither);
      image.data[index + 2] = Math.min(255, (colour & 255) * shade * dither);
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  terrainCache.set(def.id, canvas);
  return canvas;
}

function token(element: Element, name: string, fallback: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim() || fallback;
}

/** Draw the map into `canvas` (its pixel size is set here; CSS scales it up). */
export function drawMap(canvas: HTMLCanvasElement, snapshot: MapSnapshot): void {
  const { area, grid, player, pins } = snapshot;
  const def = area.def;
  const scale = 3; // canvas px per metre: crisp blocks after CSS upscaling
  const size = def.size;
  canvas.width = size * scale;
  canvas.height = size * scale;
  const context = canvas.getContext("2d")!;
  context.imageSmoothingEnabled = false;
  const half = size / 2;
  const toX = (x: number): number => (x + half) * scale;
  const toY = (z: number): number => (z + half) * scale;
  const seen = (x: number, z: number): boolean => {
    const { cellX, cellZ } = grid.cellOf(x, z);
    return grid.isRevealed(cellX, cellZ);
  };

  const ink = token(canvas, "--lw-map-ink", "#2a1a0e");
  const fog = token(canvas, "--lw-map-fog", "#c9a878");
  const fogDeep = token(canvas, "--lw-map-fog-deep", "#a8875a");
  const playerColour = token(canvas, "--lw-map-player", "#ffc457");
  const lit = token(canvas, "--lw-map-lantern", "#ffb347");
  const npcColour = token(canvas, "--lw-map-npc", "#7fe0ff");

  context.drawImage(terrainImage(def), 0, 0, canvas.width, canvas.height);

  // Landmarks.
  for (const mark of area.mapMarks) {
    if (!seen(mark.x, mark.z)) continue;
    const x = toX(mark.x);
    const y = toY(mark.z);
    switch (mark.kind) {
      case "tree":
      case "pine": {
        const radius = Math.round((mark.kind === "pine" ? 1.6 : 2.2) * mark.size * scale);
        context.fillStyle = rgb(mark.kind === "pine" ? artPalette.pine[2] : artPalette.leaf[2]);
        context.fillRect(Math.round(x - radius), Math.round(y - radius), radius * 2, radius * 2);
        context.fillStyle = rgb(mark.kind === "pine" ? artPalette.pine[3] : artPalette.leaf[3]);
        context.fillRect(Math.round(x - radius), Math.round(y - radius), radius, radius);
        break;
      }
      case "rock": {
        const radius = Math.max(2, Math.round(1.1 * mark.size * scale));
        context.fillStyle = rgb(artPalette.rock[3]);
        context.fillRect(Math.round(x - radius), Math.round(y - radius), radius * 2, radius * 2);
        break;
      }
      case "pond":
        context.fillStyle = rgb(artPalette.water[3]);
        context.beginPath();
        context.arc(x, y, mark.size * scale, 0, Math.PI * 2);
        context.fill();
        break;
      case "well":
        context.fillStyle = rgb(artPalette.water[4]);
        context.fillRect(Math.round(x - 1.2 * scale), Math.round(y - 1.2 * scale), Math.round(2.4 * scale), Math.round(2.4 * scale));
        break;
      case "house": {
        const roof = mark.variant === "blue" ? artPalette.roofBlue : mark.variant === "thatch" ? artPalette.roofThatch : artPalette.roofRed;
        context.save();
        context.translate(x, y);
        context.rotate(-mark.rot);
        context.fillStyle = ink;
        context.fillRect(-3.6 * scale, -3.0 * scale, 7.2 * scale, 6.0 * scale);
        context.fillStyle = rgb(roof[3]);
        context.fillRect(-3.3 * scale, -2.7 * scale, 6.6 * scale, 5.4 * scale);
        context.fillStyle = rgb(roof[4]);
        context.fillRect(-3.3 * scale, -2.7 * scale, 6.6 * scale, 2.7 * scale);
        context.restore();
        break;
      }
    }
  }

  // Exits: an arrow on the edge and the destination's name.
  context.font = `${Math.round(5 * scale)}px "Jersey 15", monospace`;
  context.textBaseline = "middle";
  for (const exit of def.exits) {
    if (!seen(exit.x, exit.z)) continue;
    const name = areas[exit.toArea]?.name ?? exit.toArea;
    const x = toX(exit.x);
    const y = toY(exit.z);
    const pointsRight = exit.x > 0;
    context.fillStyle = playerColour;
    context.beginPath();
    const tip = pointsRight ? 5 * scale : -5 * scale;
    context.moveTo(x + tip, y);
    context.lineTo(x, y - 3 * scale);
    context.lineTo(x, y + 3 * scale);
    context.fill();
    context.textAlign = pointsRight ? "right" : "left";
    context.lineWidth = scale * 1.2;
    context.strokeStyle = ink;
    context.strokeText(name, x - tip * 0.6, y - 6 * scale);
    context.fillText(name, x - tip * 0.6, y - 6 * scale);
  }

  // Fog of war: the reveal grid drawn as soft parchment over unexplored ground.
  const fogCanvas = document.createElement("canvas");
  fogCanvas.width = grid.cells;
  fogCanvas.height = grid.cells;
  const fogContext = fogCanvas.getContext("2d")!;
  const fogImage = fogContext.createImageData(grid.cells, grid.cells);
  for (let cellZ = 0; cellZ < grid.cells; cellZ += 1) {
    for (let cellX = 0; cellX < grid.cells; cellX += 1) {
      const index = (cellZ * grid.cells + cellX) * 4;
      fogImage.data[index + 3] = grid.isRevealed(cellX, cellZ) ? 0 : 255;
    }
  }
  fogContext.putImageData(fogImage, 0, 0);
  const tint = document.createElement("canvas");
  tint.width = canvas.width;
  tint.height = canvas.height;
  const tintContext = tint.getContext("2d")!;
  tintContext.imageSmoothingEnabled = true;
  tintContext.drawImage(fogCanvas, 0, 0, tint.width, tint.height);
  tintContext.globalCompositeOperation = "source-in";
  const gradient = tintContext.createLinearGradient(0, 0, tint.width, tint.height);
  gradient.addColorStop(0, fog);
  gradient.addColorStop(1, fogDeep);
  tintContext.fillStyle = gradient;
  tintContext.fillRect(0, 0, tint.width, tint.height);
  // Paper grain on the fog.
  tintContext.globalCompositeOperation = "source-atop";
  tintContext.fillStyle = ink;
  for (let y = 0; y < tint.height; y += scale * 2) {
    for (let x = ((y / (scale * 2)) % 2) * scale; x < tint.width; x += scale * 4) {
      if ((x * 7 + y * 13) % 11 < 2) {
        tintContext.globalAlpha = 0.12;
        tintContext.fillRect(x, y, scale, scale);
      }
    }
  }
  tintContext.globalAlpha = 1;
  context.drawImage(tint, 0, 0);

  // Pins (only where explored).
  for (const pin of pins) {
    if (!seen(pin.x, pin.z)) continue;
    const x = Math.round(toX(pin.x));
    const y = Math.round(toY(pin.z));
    const s = scale;
    context.fillStyle = ink;
    switch (pin.kind) {
      case "lantern":
      case "lanternLit":
        context.fillRect(x - 2 * s, y - 3 * s, 4 * s, 6 * s);
        context.fillStyle = pin.kind === "lanternLit" ? lit : fogDeep;
        context.fillRect(x - s, y - 2 * s, 2 * s, 4 * s);
        break;
      case "npc":
        context.fillRect(x - 2 * s, y - 2 * s, 4 * s, 4 * s);
        context.fillStyle = npcColour;
        context.fillRect(x - s, y - s, 2 * s, 2 * s);
        break;
      case "chest":
        context.fillRect(x - 2 * s, y - 1.5 * s, 4 * s, 3 * s);
        context.fillStyle = lit;
        context.fillRect(x - 0.5 * s, y - 0.5 * s, s, s);
        break;
      case "gate":
        context.fillRect(x - 3 * s, y - 3 * s, 6 * s, 6 * s);
        context.fillStyle = fogDeep;
        for (let bar = -2; bar <= 2; bar += 2) context.fillRect(x + bar * s - s / 2, y - 2 * s, s, 4 * s);
        break;
      case "door":
        context.fillStyle = lit;
        context.fillRect(x - s, y - s, 2 * s, 2 * s);
        break;
    }
  }

  // Wren: an arrow pointing the way Wren faces.
  const px = toX(player.x);
  const py = toY(player.z);
  const forwardX = Math.sin(player.yaw);
  const forwardY = Math.cos(player.yaw);
  const sideX = -forwardY;
  const sideY = forwardX;
  const length = 4.5 * scale;
  context.beginPath();
  context.moveTo(px + forwardX * length, py + forwardY * length);
  context.lineTo(px - forwardX * length * 0.6 + sideX * length * 0.7, py - forwardY * length * 0.6 + sideY * length * 0.7);
  context.lineTo(px - forwardX * length * 0.25, py - forwardY * length * 0.25);
  context.lineTo(px - forwardX * length * 0.6 - sideX * length * 0.7, py - forwardY * length * 0.6 - sideY * length * 0.7);
  context.closePath();
  context.fillStyle = playerColour;
  context.strokeStyle = ink;
  context.lineWidth = scale;
  context.fill();
  context.stroke();
}
