export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EnemySpawn {
  id: string;
  x: number;
  y: number;
}

export interface BattleLevelData {
  id: string;
  name: string;
  playerSpawn: Point;
  enemySpawns: EnemySpawn[];
  walls: Rect[];
  crates: Rect[];
}
