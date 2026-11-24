import Phaser from "phaser";
import { gameConfig } from "../../game/config/gameConfig";
import { worldTheme } from "../../game/config/theme";
import type { BattleResultSummary } from "../../game/simulation/battle/types";
import type { BattleFlowResult, SceneBridge } from "../adapters/sceneBridge";
import { startMusic, stopMusic } from "../audio/dustlineMusic";
import { playSound } from "../audio/dustlineSound";

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
    if (data.result.status === "won") {
      startMusic("menu");
    } else {
      // Sad trombone first, then the menu music comes back in.
      stopMusic();
      playSound("missionFailed");
      this.time.delayedCall(3600, () => startMusic("menu"));
    }
    this.cameras.main.setBackgroundColor(worldTheme.background);
    this.drawBackdrop();
    this.renderChrome(data);
    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("level-select"));
  }

  private renderChrome(data: ResultsSceneData): void {
    if (data.result.status === "won") {

      this.bridge.showHud({
        layout: "result",
        title: "Level Complete",
        banner: { text: "Level Complete", tone: "won" },
        copy: `${data.result.levelName} is secure. The crew logged a clean armored push through the sector. Your coins are banked: spend them in the shop from the level screen.`,
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
            label: "Continue To Levels",
            tone: "primary",
            onPress: () => this.scene.start("level-select"),
          },
        ],
      });
      return;
    }

    this.bridge.showHud({
      layout: "result",
      title: "Mission Failed",
      banner: { text: "Mission Failed", tone: "lost" },
      copy: `Your tank was destroyed. ${data.result.levelName} was not secured, and the coins you picked up were lost with it.`,
      objective: "Restart the encounter, or head back to the levels (and the shop) to re-arm.",
      kpis: [
        { label: "Points Earned", value: `${data.result.pointsEarned}` },
        { label: "Coins Lost", value: `$${data.result.creditsEarned}` },
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
          label: "Back To Levels",
          tone: "secondary",
          onPress: () => this.scene.start("level-select"),
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
