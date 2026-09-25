// Extension football du contrat générique (./sport-provider.ts). Un
// FootballProvider est un SportProvider dont `sport === "football"`, avec
// des méthodes optionnelles supplémentaires propres au foot (incidents,
// compositions, statistiques) — toujours gardées par `capabilities`.

import type { ProviderRef, SportProvider } from "./sport-provider.ts";

export type FootballIncidentType =
  | "goal"
  | "own_goal"
  | "penalty_goal"
  | "penalty_missed"
  | "yellow_card"
  | "red_card"
  | "substitution"
  | "var";

export interface FootballEventIncident extends ProviderRef {
  event_external_id: string;
  minute: number | null;
  type: FootballIncidentType;
  participant_external_id: string;
  player_name?: string;
  detail?: string;
}

export interface FootballLineupPlayer {
  player_name: string;
  shirt_number?: number;
  position?: string;
  is_starting: boolean;
}

export interface FootballLineup {
  event_external_id: string;
  participant_external_id: string;
  formation?: string;
  coach_name?: string;
  players: FootballLineupPlayer[];
}

export interface FootballMatchStatistic {
  event_external_id: string;
  participant_external_id: string;
  stat_type: string;
  value: string | number;
}

export interface FootballProvider extends SportProvider {
  sport: "football";

  getEventIncidents?(eventExternalId: string): Promise<FootballEventIncident[]>;
  getLineups?(eventExternalId: string): Promise<FootballLineup[]>;
  getStatistics?(eventExternalId: string): Promise<FootballMatchStatistic[]>;
}
