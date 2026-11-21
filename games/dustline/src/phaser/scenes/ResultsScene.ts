import Phaser from "phaser";
import { gameConfig } from "../../game/config/gameConfig";
import { worldTheme } from "../../game/config/theme";
import type { BattleResultSummary } from "../../game/simulation/battle/types";
import type { BattleFlowResult, SceneBridge } from "../adapters/sceneBridge";

export interface ResultsSceneData {
  flow: BattleFlowResult;
  result: BattleResultSummary;
}

export class ResultsScene extends Phaser.Scene {
  private readonly bridge: SceneBridge;

  constructor(bridge: SceneBridge) {
    super("results");
    this.bridge = bridge;
  }

  create(data: ResultsSceneData): void {
    this.cameras.main.setBackgroundColor(worldTheme.background);
    this.drawBackdrop();
    this.renderChrome(data);
    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("menu"));
  }

  private renderChrome(data: ResultsSceneData): void {
    if (data.result.status === "won") {
      const unlockCopy =
        data.flow.newWeaponUnlocks.length > 0
          ? ` New weapon unlocked: ${data.flow.newWeaponUnlocks.join(", ")}.`
          : "";

      this.bridge.showHud({
        layout: "result",
        title: "Level Complete",
        copy: `${data.result.levelName} is secure. The crew logged a clean armored push through the sector.${unlockCopy}`,
        objective: data.flow.loopedCampaign
          ? "Campaign loop complete. The motor pool has cycled back to the opening yard."
          : `Next contract staged: ${data.flow.nextLevel.name}.`,
        kpis: [
          { label: "Points Earned", value: `${data.result.pointsEarned}` },
          { label: "Coins Earned", value: `$${data.result.creditsEarned}` },
          { label: "Total Score", value: `${data.result.totalScore}` },
          { label: "Damage Taken", value: `${data.result.damageTaken}` },
          { label: "Completion Time", value: formatTime(data.result.completionTimeMs) },
        ],
        notes: [],
        actions: [
          {
            label: "Continue To Shop",
            tone: "primary",
            onPress: () => this.scene.start("shop"),
          },
          {
            label: "Back To Menu",
            tone: "secondary",
            onPress: () => this.scene.start("menu"),
          },
        ],
      });
      return;
    }

    this.bridge.showHud({
      layout: "result",
      title: "Mission Failed",
      copy: `${data.result.levelName} was not secured. The tank needs another pass before the route can open.`,
      objective: "Re-arm, restart the encounter, or return to the main menu.",
      kpis: [
        { label: "Points Earned", value: `${data.result.pointsEarned}` },
        { label: "Coins Earned", value: `$${data.result.creditsEarned}` },
        { label: "Total Score", value: `${data.result.totalScore}` },
        { label: "Damage Taken", value: `${data.result.damageTaken}` },
        { label: "Time Survived", value: formatTime(data.result.completionTimeMs) },
      ],
      notes: [],
      actions: [
        {
          label: "Restart Encounter",
          tone: "primary",
          onPress: () => this.scene.start("battle"),
        },
        {
          label: "Back To Menu",
          tone: "secondary",
          onPress: () => this.scene.start("menu"),
        },
      ],
    });
  }

  private drawBackdrop(): void {
    const graphics = this.add.graphics();

    graphics.fillGradientStyle(
      worldTheme.ground,
      worldTheme.ground,
      worldTheme.background,
      worldTheme.background,
      0.95,
    );
    graphics.fillRect(0, 0, gameConfig.width, gameConfig.height);

    graphics.fillStyle(worldTheme.enemyGlow, 0.12);
    graphics.fillTriangle(980, 120, 1210, 260, 1020, 460);
    graphics.fillTriangle(210, 450, 470, 620, 170, 760);
  }
}

function formatTime(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
