import { coinCellarLevel } from "./coinCellar";
import { dustlineCitadelLevel } from "./dustlineCitadel";
import { ironGauntletLevel } from "./ironGauntlet";
import { quarrySwitchbacksLevel } from "./quarrySwitchbacks";
import { relayStationLevel } from "./relayStation";
import { scrapyardMazeLevel } from "./scrapyardMaze";
import { signalRidgeLevel } from "./signalRidge";
import { supplyDepotLevel } from "./supplyDepot";
import { trainingGroundLevel } from "./trainingGround";

/**
 * Campaign flow: two easy intro maps, a bonus vault, two maps that each bring in
 * a new enemy type, a bonus breather, then the two hardest maps and the boss.
 * Each map is itself a chain of rooms (see the rooms list in each level file).
 */
export const battleLevelOrder = [
  trainingGroundLevel,
  relayStationLevel,
  coinCellarLevel,
  quarrySwitchbacksLevel,
  signalRidgeLevel,
  supplyDepotLevel,
  scrapyardMazeLevel,
  ironGauntletLevel,
  dustlineCitadelLevel,
] as const;

export function getBattleLevelById(levelId: string) {
  return battleLevelOrder.find((level) => level.id === levelId) ?? trainingGroundLevel;
}

export function getNextBattleLevelId(currentLevelId: string): string {
  const currentIndex = battleLevelOrder.findIndex((level) => level.id === currentLevelId);

  if (currentIndex === -1 || currentIndex === battleLevelOrder.length - 1) {
    return battleLevelOrder[0].id;
  }

  return battleLevelOrder[currentIndex + 1].id;
}
