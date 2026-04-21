import { relayStationLevel } from "./relayStation";
import { trainingGroundLevel } from "./trainingGround";

export const battleLevelOrder = [trainingGroundLevel, relayStationLevel] as const;

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
