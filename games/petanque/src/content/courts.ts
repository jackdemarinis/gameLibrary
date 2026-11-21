// The courts you can play on. Each has the same regulation terrain at the same
// spot (so physics and cameras are shared); only the setting and light change.
// Built in view/courts/.

export type CourtId = "villageSquare" | "seaside";

export interface CourtDefinition {
  id: CourtId;
  name: string;
  blurb: string;
}

export const courts: readonly CourtDefinition[] = [
  { id: "villageSquare", name: "Village Square", blurb: "Plane trees, a fountain and the café crowd. High noon." },
  { id: "seaside", name: "Seaside Promenade", blurb: "Palms, the harbour wall and a low golden sun." },
];

export const defaultCourtId: CourtId = "villageSquare";

export function getCourt(id: string | undefined): CourtDefinition {
  return courts.find((court) => court.id === id) ?? courts[0];
}
