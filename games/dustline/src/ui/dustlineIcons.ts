import { iconTheme as ink } from "../game/config/theme";
import { PixelCanvas, circle, polygon, rampAt, rotateAbout, segment, stadium, union, verticalRamp } from "./dustlineMenuArt";

/**
 * 32x32 pixel icons for the garage upgrade cards, the armory cannon cards and the
 * in-battle cannon inventory. Painted once at art resolution, exported as PNG data
 * URLs, and scaled up by CSS with `image-rendering: pixelated`.
 */

export type DustlineIconKey =
  | "maxHealth"
  | "movementSpeed"
  | "visibilityRadius"
  | "fireRate"
  | "turretRotationSpeed"
  | "cannon"
  | "autocannon"
  | "scattergun"
  | "ricochet"
  | "laser"
  | "missile";

const size = 32;
const rect = (x0: number, y0: number, x1: number, y1: number) => polygon([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
/** Shading that gets darker away from a light point (upper left by default). */
const radialRamp = (ramp: readonly number[], cx: number, cy: number, radius: number, lightX = -0.4, lightY = -0.4) =>
  (x: number, y: number) =>
    rampAt(ramp, Math.hypot(x - (cx + lightX * radius), y - (cy + lightY * radius)) / (radius * 1.6), x, y);

/** Armour plate with a repair cross. */
function paintMaxHealth(canvas: PixelCanvas): void {
  canvas.fill(polygon([[5, 4], [27, 4], [27, 16], [16, 29], [5, 16]]), verticalRamp(ink.steel, 4, 29));
  [[8, 7], [23, 7], [8, 15], [23, 15]].forEach(([x, y]) => canvas.set(x, y, ink.rivet));
  canvas.fill(union(rect(13.5, 8, 18.5, 23), rect(9, 13, 23, 18)), verticalRamp(ink.repair, 8, 23), ink.repairEdge);
}

/** A tank seen side-on, racing right with speed lines behind it. */
function paintMovementSpeed(canvas: PixelCanvas): void {
  [12, 18, 24].forEach((y, index) =>
    canvas.fill(segment(0.5 + (index % 2) * 1.5, y, 5.5, y, 1.2), () => ink.speedLine, null),
  );
  canvas.fill(rect(22, 10, 31, 14.5), verticalRamp(ink.olive, 10, 15));
  canvas.fill(polygon([[12, 9], [21, 9], [23.5, 15.5], [10.5, 15.5]]), verticalRamp(ink.olive, 9, 16));
  canvas.fill(polygon([[9, 15], [28, 15], [30.5, 20.5], [6.5, 20.5]]), verticalRamp(ink.olive, 14, 21));
  canvas.fill(stadium(7.5, 20, 30, 29), verticalRamp(ink.tread, 20, 29));
  for (let x = 11; x < 28; x += 3) {
    canvas.set(x, 21, ink.tread[0]);
  }
  [11.5, 16, 20.5, 25].forEach((cx) => {
    canvas.fill(circle(cx, 24.5, 2.2), radialRamp(ink.wheel, cx, 24.5, 2.2), null);
    canvas.set(Math.floor(cx), 24, ink.hub);
  });
}

/** Binoculars with glinting lenses. */
function paintVisibility(canvas: PixelCanvas): void {
  canvas.fill(union(rect(9, 8, 14, 16), rect(18, 8, 23, 16)), verticalRamp(ink.darkSteel, 8, 16));
  canvas.fill(rect(13, 12, 19, 17), verticalRamp(ink.steel, 12, 17));
  [9.5, 22.5].forEach((cx) => {
    canvas.fill(circle(cx, 20, 7.5), verticalRamp(ink.darkSteel, 13, 27));
    canvas.fill(circle(cx, 20, 4.6), radialRamp(ink.lens, cx, 20, 4.6));
    canvas.set(Math.floor(cx) - 2, 18, ink.glint);
    canvas.set(Math.floor(cx) - 1, 18, ink.glint);
    canvas.set(Math.floor(cx) - 2, 19, ink.glint);
  });
}

/** Stopwatch: shoot sooner. */
function paintFireRate(canvas: PixelCanvas): void {
  canvas.fill(rect(13.5, 2, 18.5, 6), verticalRamp(ink.brass, 2, 6));
  canvas.fill(rect(23, 6, 27, 10), verticalRamp(ink.brass, 6, 10), ink.outline, rotateAbout(25, 8, 0.7));
  canvas.fill(circle(16, 18, 12), radialRamp(ink.brass, 16, 18, 12));
  canvas.fill(circle(16, 18, 9), verticalRamp(ink.dialFace, 9, 27));
  [[16, 11], [23, 18], [16, 25], [9, 18]].forEach(([x, y]) => canvas.set(x, y, ink.outline));
  canvas.fill(segment(16, 18, 20.5, 12.5, 0.9), () => ink.dialHand, null);
  canvas.fill(segment(16, 18, 12.5, 18, 0.8), () => ink.outline, null);
  canvas.set(15, 17, ink.outline);
  canvas.set(16, 17, ink.outline);
}

/** Turret seen from above, with two bold arrows circling it clockwise. */
function paintTurretRotation(canvas: PixelCanvas): void {
  const centre = 16;
  const tau = Math.PI * 2;
  const deg = (value: number) => (value * Math.PI) / 180;
  const ring = (from: number, to: number) => (x: number, y: number) => {
    const radius = Math.hypot(x - centre, y - centre);
    const angle = (Math.atan2(y - centre, x - centre) + tau) % tau;
    return radius >= 10.5 && radius <= 15 && angle >= from && angle <= to;
  };
  /** Arrowhead at the clockwise end of an arc, pointing along it. */
  const head = (end: number) => {
    const at = (radius: number, angle: number): [number, number] => [
      centre + Math.cos(angle) * radius,
      centre + Math.sin(angle) * radius,
    ];
    return polygon([at(8, end), at(17.5, end), at(12.75, end + deg(30))]);
  };
  const arrows = union(ring(deg(195), deg(305)), head(deg(305)), ring(deg(15), deg(125)), head(deg(125)));
  canvas.fill(arrows, (x, y) => rampAt(ink.flash, Math.hypot(x - centre, y - centre) / 17, x, y), ink.flashEdge);
  canvas.fill(segment(centre, centre, 28, centre, 1.9), verticalRamp(ink.olive, 13, 19));
  canvas.fill(circle(centre, centre, 6.5), radialRamp(ink.olive, centre, centre, 6.5));
  canvas.fill(circle(centre, centre, 2.2), () => ink.olive[3], null);
}

/** One big brass shell, pointing up and right. */
function paintCannon(canvas: PixelCanvas): void {
  const map = rotateAbout(16, 16, (Math.PI * 3) / 4);
  const shade = (x: number, y: number) => rampAt(ink.brass, (21.5 - y) / 11, x, y);
  canvas.fill(
    union(rect(7, 11, 20, 21), polygon([[19.5, 11], [25, 12.5], [29.5, 16], [25, 19.5], [19.5, 21]]), rect(3.5, 10, 7.5, 22)),
    shade,
    ink.outline,
    map,
  );
  canvas.fill((x, y) => x >= 17 && x < 18.4 && y > 11.6 && y < 20.4, () => ink.brassDark, null, map);
}

/** A belt of three small rounds. */
function paintAutocannon(canvas: PixelCanvas): void {
  [8, 16, 24].forEach((cx, index) => {
    const top = 5 + index * 1;
    canvas.fill(
      union(rect(cx - 2.6, top + 6, cx + 2.6, 25), polygon([[cx - 2.6, top + 6.5], [cx, top], [cx + 2.6, top + 6.5]]), rect(cx - 3.4, 24, cx + 3.4, 28)),
      (x, y) => rampAt(ink.brass, (x - (cx - 2.6)) / 6, x, y),
    );
  });
  canvas.fill(rect(3, 18, 29, 21.5), verticalRamp(ink.steel, 18, 22));
  [8, 16, 24].forEach((cx) => canvas.set(cx, 19, ink.rivet));
}

/** A muzzle burst throwing a fan of pellets. */
function paintScattergun(canvas: PixelCanvas): void {
  const origin = { x: 6, y: 26 };
  const angles = [-0.18, -0.5, -0.8, -1.1, -1.4];
  angles.forEach((angle, index) => {
    const reach = index % 2 === 0 ? 20 : 16.5;
    const end = { x: origin.x + Math.cos(angle) * reach, y: origin.y + Math.sin(angle) * reach };
    canvas.fill(segment(origin.x + Math.cos(angle) * 6, origin.y + Math.sin(angle) * 6, end.x - Math.cos(angle) * 3.5, end.y - Math.sin(angle) * 3.5, 0.55), () => ink.flash[2], null);
    canvas.fill(circle(end.x, end.y, 2.8), radialRamp(ink.brass, end.x, end.y, 2.8));
  });
  canvas.fill(
    union(circle(origin.x, origin.y, 4.5), circle(origin.x + 3, origin.y - 2.5, 2.6), circle(origin.x - 1, origin.y - 3.5, 2.2)),
    radialRamp(ink.flash, origin.x + 1, origin.y - 1, 5, 0, 0),
    ink.flashEdge,
  );
}

/** A violet orb bouncing off a wall. */
function paintRicochet(canvas: PixelCanvas): void {
  canvas.fill(rect(24, 2, 30, 30), verticalRamp(ink.stone, 2, 30));
  [9, 17, 25].forEach((y) => canvas.fill(rect(25, y, 29, y + 1), () => ink.stoneGap, null));
  const dotted = (ax: number, ay: number, bx: number, by: number) => {
    const line = segment(ax, ay, bx, by, 0.75);
    return (x: number, y: number) => line(x, y) && (Math.floor(x) + Math.floor(y)) % 3 !== 0;
  };
  canvas.fill(union(dotted(3, 29, 23, 15), dotted(23, 15, 12, 8)), () => ink.ricochet[1], null);
  [[22, 13], [22, 17], [21, 15], [20, 12], [20, 18]].forEach(([x, y]) => canvas.set(x, y, ink.flash[1]));
  canvas.fill(circle(9.5, 7, 4.4), radialRamp(ink.ricochet, 9.5, 7, 4.4), ink.ricochetEdge);
  canvas.set(8, 5, ink.glint);
}

/** An emitter firing a straight beam. */
function paintLaser(canvas: PixelCanvas): void {
  canvas.fill(segment(10, 22, 29.5, 2.5, 3.4), radialRamp(ink.laser, 20, 12, 14, 0, 0), ink.laserEdge);
  canvas.fill(segment(10, 22, 29, 3, 1.2), () => ink.laser[0], null);
  canvas.fill(rect(2, 20, 12, 30), verticalRamp(ink.darkSteel, 20, 30), ink.outline, rotateAbout(7, 25, -Math.PI / 4));
  canvas.fill(circle(9.5, 22.5, 2.4), () => ink.laser[0], ink.laserEdge);
  [[25, 13], [18, 4], [28, 9]].forEach(([x, y]) => canvas.set(x, y, ink.glint));
}

/** A rocket climbing up and right on a tail of fire. */
function paintMissile(canvas: PixelCanvas): void {
  const map = rotateAbout(16, 16, -Math.PI / 4);
  canvas.fill(
    union(circle(5, 16, 3.2), circle(2.5, 16, 2.2), circle(6.5, 13.5, 1.8), circle(6.5, 18.5, 1.8)),
    (x, y) => rampAt(ink.flash, Math.hypot(x - 7, y - 16) / 5, x, y),
    ink.flashEdge,
    map,
  );
  canvas.fill(
    union(polygon([[8, 16], [12, 9], [15, 9], [14, 16]]), polygon([[8, 16], [12, 23], [15, 23], [14, 16]])),
    verticalRamp(ink.fin, 9, 23),
    ink.outline,
    map,
  );
  canvas.fill(rect(8.5, 13, 23, 19), (x, y) => rampAt(ink.missileBody, (y - 13) / 6, x, y), ink.outline, map);
  canvas.fill(
    polygon([[22.5, 13], [26, 13.6], [29.5, 16], [26, 18.4], [22.5, 19]]),
    (x, y) => rampAt(ink.warhead, (y - 13) / 6, x, y),
    ink.outline,
    map,
  );
}

const painters: Record<DustlineIconKey, (canvas: PixelCanvas) => void> = {
  maxHealth: paintMaxHealth,
  movementSpeed: paintMovementSpeed,
  visibilityRadius: paintVisibility,
  fireRate: paintFireRate,
  turretRotationSpeed: paintTurretRotation,
  cannon: paintCannon,
  autocannon: paintAutocannon,
  scattergun: paintScattergun,
  ricochet: paintRicochet,
  laser: paintLaser,
  missile: paintMissile,
};

const cache = new Map<string, string>();

/** PNG data URL for an icon, or "" for an unknown key or when canvas isn't available. */
export function getDustlineIcon(key: string): string {
  if (!(key in painters)) {
    return "";
  }
  let url = cache.get(key);
  if (url === undefined) {
    const canvas = new PixelCanvas(size, size);
    painters[key as DustlineIconKey](canvas);
    url = canvas.toDataUrl();
    cache.set(key, url);
  }
  return url;
}
