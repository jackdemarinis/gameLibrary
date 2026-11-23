import { moveCircleWithCollisions } from "../geometry";
import type { BattleState, TankState } from "../types";

/** Separation passes per step; two is enough to settle a small pile-up. */
const separationPasses = 2;

/**
 * Tanks are solid: any two that overlap are pushed apart along the line between
 * their centres. Heavier (bigger) tanks give way less, so a boss shoves a
 * skirmisher aside but not the other way round. Pushes go through the wall
 * collision, so nobody is shoved into a wall.
 */
export function runTankCollisionSystem(state: BattleState): void {
  const tanks: TankState[] = [state.player, ...state.enemies].filter((tank) => tank.alive);

  for (let pass = 0; pass < separationPasses; pass += 1) {
    for (let first = 0; first < tanks.length; first += 1) {
      for (let second = first + 1; second < tanks.length; second += 1) {
        separate(state, tanks[first], tanks[second]);
      }
    }
  }
}

function separate(state: BattleState, a: TankState, b: TankState): void {
  let dx = b.position.x - a.position.x;
  let dy = b.position.y - a.position.y;
  let distance = Math.hypot(dx, dy);
  const minimum = a.radius + b.radius;

  if (distance >= minimum) {
    return;
  }

  if (distance < 0.001) {
    // Exactly on top of each other: split them sideways.
    dx = 1;
    dy = 0;
    distance = 1;
  }

  const overlap = minimum - distance;
  const normalX = dx / distance;
  const normalY = dy / distance;
  const weightA = a.radius * a.radius;
  const weightB = b.radius * b.radius;
  const shareA = weightB / (weightA + weightB);

  a.position = moveCircleWithCollisions(
    a.position,
    { x: -normalX * overlap * shareA, y: -normalY * overlap * shareA },
    a.radius,
    state.obstacles,
  );
  // b takes whatever a couldn't (a wall behind a stops it giving way).
  const left = minimum - Math.hypot(b.position.x - a.position.x, b.position.y - a.position.y);
  if (left > 0) {
    b.position = moveCircleWithCollisions(
      b.position,
      { x: normalX * left, y: normalY * left },
      b.radius,
      state.obstacles,
    );
  }
}
