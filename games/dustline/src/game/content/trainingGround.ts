import { compileTileLevel } from "./tileMap";

export const trainingGroundLevel = compileTileLevel({
  id: "training-yard",
  name: "Training Yard",
  tier: "easy",
  tagline: "Raiders only. Learn to break cover.",
  briefing: "A walled practice yard. Clear four raiders, then smash the bricks into the side cache for easy gold.",
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
    "#....c.........r...........#",
    "#..........####.......r....#",
    "#..........####............#",
    "#...c..............cc......#",
    "#.......r..................#",
    "#.....................+....#",
    "############################",
  ],
});
