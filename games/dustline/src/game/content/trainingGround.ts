import { compileTileLevel } from "./tileMap";

export const trainingGroundLevel = compileTileLevel({
  id: "training-yard",
  name: "Training Yard",
  tier: "easy",
  tagline: "Raiders only. Learn to break cover.",
  briefing: "A walled practice yard. Clear four raiders and knock out the spawner in the east yard before it builds more. Shoot open supply crates for repairs and a freeze charge, then smash into the side cache for gold.",
  rooms: [
    { kind: "staging", label: "Staging Bay" },
    { kind: "skirmish", label: "Practice Yard" },
    { kind: "vault", label: "Brick Cache" },
    { kind: "command", label: "Range Office" },
  ],
  map: [
    "############################",
    "#.......#..........#.......#",
    "#.......#..........#..o.o..#",
    "#..P....b....r.....b.......#",
    "#.......b..........b..$.$..#",
    "#.......#..........#.......#",
    "#.......#...cc.....#########",
    "###..####..................#",
    "#..........................#",
    "#....F.........r...........#",
    "#..........####.......r....#",
    "#..........####..........X.#",
    "#...c..............cc......#",
    "#.......r..................#",
    "#....H................+....#",
    "############################",
  ],
});
