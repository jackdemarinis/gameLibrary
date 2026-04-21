import type { Rect } from "../../content/levelTypes";
import type { Vector2 } from "./types";

const VISION_EPSILON = 0.0001;

export function hasLineOfSight(start: Vector2, end: Vector2, obstacles: readonly Rect[]): boolean {
  const allowedHitRects = obstacles.filter((rect) => pointInsideRectInclusive(end, rect));

  return !obstacles.some((rect) => {
    if (allowedHitRects.includes(rect)) {
      return false;
    }

    return segmentIntersectsRect(start, end, rect);
  });
}

export function pointInsideRectInclusive(point: Vector2, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function segmentIntersectsRect(start: Vector2, end: Vector2, rect: Rect): boolean {
  const delta = {
    x: end.x - start.x,
    y: end.y - start.y,
  };
  let entry = 0;
  let exit = 1;
  const bounds = [
    [-delta.x, start.x - rect.x],
    [delta.x, rect.x + rect.width - start.x],
    [-delta.y, start.y - rect.y],
    [delta.y, rect.y + rect.height - start.y],
  ];

  for (const [p, q] of bounds) {
    if (p === 0) {
      if (q < 0) {
        return false;
      }

      continue;
    }

    const ratio = q / p;

    if (p < 0) {
      entry = Math.max(entry, ratio);
    } else {
      exit = Math.min(exit, ratio);
    }

    if (entry > exit + VISION_EPSILON) {
      return false;
    }
  }

  return entry <= 1 && exit >= 0;
}
